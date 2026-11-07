from __future__ import annotations

import asyncio
import unicodedata
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from typing import Any

import httpx
from appie import AHClient
from appie.models import ShoppingListItem

from .store import Store

type ClientFactory = Callable[[str], AbstractAsyncContextManager[AHClient]]


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def product_amounts(items: list[ShoppingListItem]) -> dict[int, int]:
    amounts: dict[int, int] = {}
    for item in items:
        if item.product_id is not None and item.quantity > 0:
            amounts[item.product_id] = amounts.get(item.product_id, 0) + item.quantity
    return amounts


def http_status(error: Exception) -> int | None:
    cause: BaseException | None = error
    while cause is not None:
        if isinstance(cause, httpx.HTTPStatusError):
            return cause.response.status_code
        cause = cause.__cause__
    return None


def definitive_rejection(error: Exception) -> bool:
    status = http_status(error)
    return status is not None and 400 <= status < 500 and status != 408


LINE_REJECTIONS = {400, 422}


def transient(error: Exception) -> bool:
    status = http_status(error)
    if status is not None:
        return status in {408, 409, 429} or status >= 500
    cause: BaseException | None = error
    while cause is not None:
        if isinstance(cause, httpx.TimeoutException | httpx.RequestError):
            return True
        cause = cause.__cause__
    return False


def safe_error(error: Exception, phase: str) -> str:
    """Only fixed text and an HTTP integer may cross the public status boundary."""
    status = http_status(error)
    if status is not None:
        reason = {
            400: "AH accepteert het aanvraagformaat niet.",
            401: "De AH-aanmelding is niet meer geldig; koppel AH opnieuw.",
            403: "AH staat deze actie niet toe voor deze verbinding.",
            404: "Het AH-eindpunt is niet beschikbaar.",
            408: "De AH-aanvraag is verlopen.",
            409: "AH meldt een conflict met de huidige lijst.",
            422: "AH accepteert de lijstgegevens niet.",
            429: "AH ontvangt te veel aanvragen; probeer later bewust opnieuw.",
        }.get(
            status,
            "AH is tijdelijk niet beschikbaar." if status >= 500 else "AH weigert de aanvraag.",
        )
        return f"AH: {phase} mislukt (HTTP {status}). {reason}"
    cause: BaseException | None = error
    while cause is not None:
        if isinstance(cause, httpx.TimeoutException):
            return f"AH: {phase} mislukt door een time-out."
        if isinstance(cause, httpx.RequestError):
            return f"AH: {phase} mislukt door een verbindingsfout."
        cause = cause.__cause__
    return f"AH: {phase} mislukt; geen bruikbaar antwoord ontvangen."


class Jobs:
    retry_delays: tuple[float, ...] = (1.0, 4.0)
    write_pause = 0.2

    def __init__(self, store: Store, client_factory: ClientFactory) -> None:
        self.store = store
        self.client_factory = client_factory
        self.locks: dict[str, asyncio.Lock] = {}

    def lock(self, connection_id: str) -> asyncio.Lock:
        return self.locks.setdefault(connection_id, asyncio.Lock())

    async def ensure_line(
        self,
        client: AHClient,
        connection_id: str,
        export_id: str,
        line: dict[str, Any],
        current: set[str],
        amounts: dict[int, int],
    ) -> str:
        """Makes one line present on the list: skips what is already there, never doubles it.

        A line AH rejects outright is skipped; a transient failure is only retried after
        re-reading the list, so a write AH did store is recognised instead of repeated.
        """
        position, description = line["position"], line["description"]
        product_id, quantity = line["product_id"], line["quantity"]

        def satisfied() -> bool:
            if product_id is not None:
                return amounts.get(product_id, 0) >= quantity
            return normalized(description) in current

        for attempt in range(len(self.retry_delays) + 1):
            if satisfied():
                status = "sent" if attempt else "present"
                self.store.set_line(connection_id, export_id, position, status)
                return status
            self.store.set_line(
                connection_id,
                export_id,
                position,
                "inflight",
                quantity if product_id is not None else None,
            )
            try:
                if product_id is not None:
                    # The list PATCH sets an absolute quantity: raise it to what is needed.
                    await client.lists.add_item(
                        description, quantity=quantity, product_id=product_id
                    )
                else:
                    await client.lists.add_item(description, quantity=1)
            except Exception as error:
                if http_status(error) in LINE_REJECTIONS:
                    # Definitively not written: the line stays pending and the rest continues.
                    self.store.set_line(connection_id, export_id, position, "pending")
                    return "rejected"
                if (
                    not transient(error)
                    or attempt == len(self.retry_delays)
                    or not self.store.is_active(connection_id)
                ):
                    raise
                await asyncio.sleep(self.retry_delays[attempt])
                items = await client.lists.get_list()
                current.clear()
                current.update(normalized(item.description) for item in items if item.quantity > 0)
                amounts.clear()
                amounts.update(product_amounts(items))
                continue
            self.store.set_line(connection_id, export_id, position, "sent")
            if product_id is not None:
                amounts[product_id] = quantity
            else:
                current.add(normalized(description))
            await asyncio.sleep(self.write_pause)
            return "sent"
        raise AssertionError("unreachable")

    async def run(self, connection_id: str, export_id: str) -> None:
        async with self.lock(connection_id):
            job = self.store.job(connection_id, export_id)
            if not job or job["status"] != "pending":
                return
            if not self.store.is_active(connection_id):
                self.store.set_job(connection_id, export_id, "failed", "Verbinding losgekoppeld.")
                return
            self.store.set_job(connection_id, export_id, "running", "AH-lijst wordt bijgewerkt.")
            inflight = False
            completed = 0
            rejected: list[str] = []
            phase = "lijst lezen"
            try:
                async with self.client_factory(connection_id) as client:
                    items = await client.lists.get_list()
                    current = {normalized(item.description) for item in items if item.quantity > 0}
                    amounts = product_amounts(items)
                    for line in job["lines"]:
                        if not self.store.is_active(connection_id):
                            self.store.set_job(
                                connection_id,
                                export_id,
                                "uncertain" if completed else "failed",
                                "Verbinding losgekoppeld; controleer de lijst.",
                            )
                            return
                        inflight = True
                        phase = "regel toevoegen"
                        result = await self.ensure_line(
                            client, connection_id, export_id, line, current, amounts
                        )
                        inflight = False
                        if result == "rejected":
                            rejected.append(line["description"])
                        else:
                            completed += 1
                total = len(job["lines"])
                if not self.store.is_active(connection_id):
                    status, message = "uncertain", f"{completed} van {total} regels bevestigd."
                elif not rejected:
                    status, message = "succeeded", f"{completed} van {total} regels op de lijst."
                else:
                    status = "uncertain" if completed else "failed"
                    message = (
                        f"AH weigerde "
                        f"{len(rejected)} regel{'s' if len(rejected) > 1 else ''}: "
                        f"{'; '.join(rejected)}. Voeg die zelf toe in de AH-app."
                    )
                self.store.set_job(connection_id, export_id, status, message)
            except asyncio.CancelledError:
                self.store.set_job(
                    connection_id,
                    export_id,
                    "uncertain",
                    "Proces onderbroken; controleer de lijst.",
                )
                raise
            except Exception as error:
                if not self.store.is_active(connection_id):
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "uncertain" if completed or inflight else "failed",
                        "Verbinding losgekoppeld; controleer de lijst.",
                    )
                elif completed == 0 and (not inflight or definitive_rejection(error)):
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "failed",
                        f"{safe_error(error, phase)} Er zijn geen toevoegingen bevestigd.",
                    )
                else:
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "uncertain",
                        f"{completed} van {len(job['lines'])} regels bevestigd; resultaat onzeker. "
                        f"{safe_error(error, phase)} Controleer de lijst.",
                    )

    async def inspect(self, connection_id: str, export_id: str) -> bool:
        """Reads AH only. True means missing lines were checked, never that they were resent."""
        async with self.lock(connection_id):
            job = self.store.job(connection_id, export_id)
            if not job or job["status"] != "uncertain":
                return False
            try:
                async with self.client_factory(connection_id) as client:
                    items = await client.lists.get_list()
                present = {normalized(item.description) for item in items if item.quantity > 0}
                amounts = product_amounts(items)
                missing = False
                for line in job["lines"]:
                    if line["status"] in {"sent", "present"}:
                        continue
                    if line["product_id"] is not None:
                        target = line["target_quantity"]
                        confirmed = (
                            target is not None and amounts.get(line["product_id"], 0) >= target
                        )
                    else:
                        confirmed = normalized(line["description"]) in present
                    if confirmed:
                        self.store.set_line(connection_id, export_id, line["position"], "present")
                    else:
                        missing = True
                if not missing:
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "succeeded",
                        "Alle regels zijn bevestigd of in de AH-lijst teruggevonden.",
                    )
                else:
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "uncertain",
                        "Niet alle regels teruggevonden. "
                        "Controleer de AH-lijst vóór bewust opnieuw exporteren.",
                    )
                return missing
            except Exception as error:
                self.store.set_job(
                    connection_id,
                    export_id,
                    "uncertain",
                    f"{safe_error(error, 'lijst lezen')} Er is niets opnieuw verstuurd.",
                )
                return False

    def public(
        self, connection_id: str, export_id: str, verified_absent: bool = False
    ) -> dict[str, Any] | None:
        job = self.store.job(connection_id, export_id)
        if not job:
            return None
        return {
            "export_id": export_id,
            "status": "pending" if job["status"] == "running" else job["status"],
            "completed": sum(line["status"] in {"sent", "present"} for line in job["lines"]),
            "total": len(job["lines"]),
            "message": job["message"],
            "verified_absent": verified_absent,
        }
