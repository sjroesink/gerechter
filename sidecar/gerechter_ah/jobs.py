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
    # AH drops the "·" separator from stored text items, so it never decides a match.
    text = unicodedata.normalize("NFKC", value).casefold().replace("·", " ")
    return " ".join(text.split())


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
    write_pause = 0.5
    batch_size = 25

    def __init__(self, store: Store, client_factory: ClientFactory) -> None:
        self.store = store
        self.client_factory = client_factory
        self.locks: dict[str, asyncio.Lock] = {}

    def lock(self, connection_id: str) -> asyncio.Lock:
        return self.locks.setdefault(connection_id, asyncio.Lock())

    async def write_lines(
        self,
        client: AHClient,
        connection_id: str,
        export_id: str,
        lines: list[dict[str, Any]],
        current: set[str],
        amounts: dict[int, int],
    ) -> None:
        """Puts lines on the list in one PATCH, like appie-go; never doubles what is there.

        Lines already on the list are skipped. If AH rejects a batch, its lines are written one
        by one so only the rejected line stays off (pending). A transient failure is retried only
        after re-reading the list, so a write AH did store is recognised instead of repeated.
        """

        def satisfied(line: dict[str, Any]) -> bool:
            if line["product_id"] is not None:
                return amounts.get(line["product_id"], 0) >= line["quantity"]
            return normalized(line["description"]) in current

        for attempt in range(len(self.retry_delays) + 1):
            todo = []
            for line in lines:
                if satisfied(line):
                    status = "sent" if attempt else "present"
                    self.store.set_line(connection_id, export_id, line["position"], status)
                else:
                    todo.append(line)
            if not todo:
                return
            for line in todo:
                target = line["quantity"] if line["product_id"] is not None else None
                self.store.set_line(connection_id, export_id, line["position"], "inflight", target)
            try:
                # The list PATCH sets an absolute product quantity: raise it to what is needed.
                await client.lists.add_items(
                    [(line["description"], line["quantity"], line["product_id"]) for line in todo]
                )
            except Exception as error:
                if http_status(error) in LINE_REJECTIONS:
                    if len(todo) == 1:
                        # Definitively not written: the line stays pending and the rest continues.
                        self.store.set_line(
                            connection_id, export_id, todo[0]["position"], "pending"
                        )
                        return
                    for line in todo:
                        self.store.set_line(connection_id, export_id, line["position"], "pending")
                    for line in todo:
                        await self.write_lines(
                            client, connection_id, export_id, [line], current, amounts
                        )
                    return
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
                lines = todo
                continue
            for line in todo:
                self.store.set_line(connection_id, export_id, line["position"], "sent")
                if line["product_id"] is not None:
                    amounts[line["product_id"]] = line["quantity"]
                else:
                    current.add(normalized(line["description"]))
            return

    def progress(self, connection_id: str, export_id: str) -> tuple[int, int, list[str]]:
        lines = self.store.job(connection_id, export_id)["lines"]
        done = sum(line["status"] in {"sent", "present"} for line in lines)
        pending = [line["description"] for line in lines if line["status"] == "pending"]
        return done, len(lines), pending

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
            phase = "lijst lezen"
            try:
                async with self.client_factory(connection_id) as client:
                    items = await client.lists.get_list()
                    current = {normalized(item.description) for item in items if item.quantity > 0}
                    amounts = product_amounts(items)
                    lines = job["lines"]
                    for start in range(0, len(lines), self.batch_size):
                        if not self.store.is_active(connection_id):
                            done = self.progress(connection_id, export_id)[0]
                            self.store.set_job(
                                connection_id,
                                export_id,
                                "uncertain" if done else "failed",
                                "Verbinding losgekoppeld; controleer de lijst.",
                            )
                            return
                        if start:
                            await asyncio.sleep(self.write_pause)
                        inflight = True
                        phase = "regels toevoegen"
                        await self.write_lines(
                            client,
                            connection_id,
                            export_id,
                            lines[start : start + self.batch_size],
                            current,
                            amounts,
                        )
                        inflight = False
                done, total, rejected = self.progress(connection_id, export_id)
                if not self.store.is_active(connection_id):
                    status, message = "uncertain", f"{done} van {total} regels bevestigd."
                elif not rejected:
                    status, message = "succeeded", f"{done} van {total} regels op de lijst."
                else:
                    status = "uncertain" if done else "failed"
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
                done, total, _ = self.progress(connection_id, export_id)
                if not self.store.is_active(connection_id):
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "uncertain" if done or inflight else "failed",
                        "Verbinding losgekoppeld; controleer de lijst.",
                    )
                elif done == 0 and (not inflight or definitive_rejection(error)):
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
                        f"{done} van {total} regels bevestigd; resultaat onzeker. "
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
                    cause = (job["message"] or "").split(" Controle: ")[0]
                    self.store.set_job(
                        connection_id,
                        export_id,
                        "uncertain",
                        f"{cause} Controle: niet alle regels teruggevonden op de AH-lijst.".strip(),
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
