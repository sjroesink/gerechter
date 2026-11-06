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
    def __init__(self, store: Store, client_factory: ClientFactory) -> None:
        self.store = store
        self.client_factory = client_factory
        self.locks: dict[str, asyncio.Lock] = {}

    def lock(self, connection_id: str) -> asyncio.Lock:
        return self.locks.setdefault(connection_id, asyncio.Lock())

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
                        description = line["description"]
                        product_id = line["product_id"]
                        if product_id is not None:
                            # The list PATCH sets an absolute quantity: add to what is present.
                            target = amounts.get(product_id, 0) + line["quantity"]
                            self.store.set_line(
                                connection_id, export_id, line["position"], "inflight", target
                            )
                            inflight = True
                            phase = "regel toevoegen"
                            await client.lists.add_item(
                                description, quantity=target, product_id=product_id
                            )
                            self.store.set_line(connection_id, export_id, line["position"], "sent")
                            inflight = False
                            amounts[product_id] = target
                        elif normalized(description) in current:
                            self.store.set_line(
                                connection_id, export_id, line["position"], "present"
                            )
                        else:
                            self.store.set_line(
                                connection_id, export_id, line["position"], "inflight"
                            )
                            inflight = True
                            phase = "regel toevoegen"
                            await client.lists.add_item(description, quantity=1)
                            self.store.set_line(connection_id, export_id, line["position"], "sent")
                            inflight = False
                            current.add(normalized(description))
                        completed += 1
                status = "succeeded" if self.store.is_active(connection_id) else "uncertain"
                self.store.set_job(
                    connection_id,
                    export_id,
                    status,
                    f"{completed} van {len(job['lines'])} regels aanwezig of bevestigd.",
                )
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
