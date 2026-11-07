from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI

from gerechter_ah.service import Settings, create_app
from gerechter_ah.store import LineInput

SECRET = "sidecar-test-secret-with-at-least-32-characters"
SEARCH_PATH = "/mobile-services/product/search/v2"
PRODUCT_KEYS = {"productId", "quantity", "type", "originCode", "description", "searchTerm"}

# Raw AH search payloads, mapped by python-appie's real ProductsAPI.
CATALOG: list[dict[str, Any]] = [
    {
        "webshopId": 1525,
        "title": "AH Uien",
        "brand": "AH",
        "currentPrice": 1.29,
        "isBonus": False,
        "salesUnitSize": "1 kg",
        "images": [{"url": "https://static.ah.nl/uien.jpg"}],
    },
    {
        "webshopId": 4471,
        "title": "AH Trostomaten",
        "brand": "AH",
        "priceBeforeBonus": 2.49,
        "bonusMechanism": "2e halve prijs",
        "salesUnitSize": "500 g",
        "images": [{"url": "https://static.ah.nl/tomaten.jpg"}],
    },
]


class Backend:
    def __init__(self) -> None:
        self.items: dict[str, dict[str, int]] = defaultdict(dict)
        # product_id -> {"description": ..., "quantity": ...}; the PATCH quantity is absolute.
        self.products: dict[str, dict[int, dict[str, Any]]] = defaultdict(dict)
        self.catalog: list[dict[str, Any]] = [dict(product) for product in CATALOG]
        self.search_failure: str | None = None
        self.calls: list[dict[str, Any]] = []
        self.failures: dict[str, str] = {}
        self.empty_write_response = False
        self.fail_reads = False
        self.write_gate: asyncio.Event | None = None

    def transport(self, connection_id: str) -> httpx.MockTransport:
        async def handle(request: httpx.Request) -> httpx.Response:
            await asyncio.sleep(0)
            body = json.loads(request.content) if request.content else None
            self.calls.append(
                {
                    "connection": connection_id,
                    "method": request.method,
                    "path": request.url.path,
                    "params": dict(request.url.params),
                    "body": body,
                    "authorization": request.headers.get("authorization"),
                }
            )
            if request.url.path.endswith("/auth/token"):
                if body["code"] == "bad-code":
                    return httpx.Response(400, json={"detail": "bad-code secret response"})
                return httpx.Response(
                    200,
                    json={
                        "access_token": f"access-{connection_id}",
                        "refresh_token": f"refresh-{connection_id}",
                        "expires_in": 3600,
                    },
                )
            if request.url.path.endswith("/auth/token/refresh"):
                assert body["refreshToken"] == f"refresh-{connection_id}"
                return httpx.Response(
                    200,
                    json={
                        "access_token": f"renewed-{connection_id}",
                        "refresh_token": f"refresh-{connection_id}",
                        "expires_in": 3600,
                    },
                )
            if request.method == "GET" and request.url.path == SEARCH_PATH:
                if self.search_failure == "timeout":
                    raise httpx.ReadTimeout("private-token timeout", request=request)
                if self.search_failure:
                    return httpx.Response(
                        int(self.search_failure), json={"detail": "private search detail"}
                    )
                query = request.url.params["query"].casefold()
                size = int(request.url.params["size"])
                found = [p for p in self.catalog if query in p["title"].casefold()]
                return httpx.Response(200, json={"products": found[:size]})
            if request.method == "GET":
                if self.fail_reads:
                    return httpx.Response(403, json={"detail": "private server detail"})
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {"description": description, "quantity": quantity}
                            for description, quantity in self.items[connection_id].items()
                        ]
                        + [
                            {
                                "description": product["description"],
                                "quantity": product["quantity"],
                                "productDetails": {
                                    "product": {
                                        "webshopId": product_id,
                                        "title": product["description"],
                                    }
                                },
                            }
                            for product_id, product in self.products[connection_id].items()
                        ]
                    },
                )
            assert request.method == "PATCH"
            if self.write_gate is not None:
                await self.write_gate.wait()
            batch = body["items"]
            for item in batch:
                is_product = "productId" in item
                if is_product and (
                    set(item) != PRODUCT_KEYS
                    or not isinstance(item["productId"], int)
                    or item["type"] != "SHOPPABLE"
                    or item["originCode"] != "PRD"
                ):
                    return httpx.Response(400, json={"detail": "Invalid product payload"})
                if not is_product and (
                    item.get("originCode") != "PRD"
                    or item.get("strikeThrough") is not False
                    or item.get("type") != "SHOPPABLE"
                ):
                    return httpx.Response(400, json={"detail": "Invalid shopping-list payload"})
            # A batch is atomic: one failing line fails the whole request, as a real API would.
            failures = [self.failures.get(item["description"]) for item in batch]
            for item, failure in zip(batch, failures, strict=True):
                if failure == "once-503":
                    del self.failures[item["description"]]
                    return httpx.Response(503, json={"detail": "private-token response body"})
            for failure in failures:
                if failure == "reject":
                    return httpx.Response(400, json={"detail": "private-token response body"})
                if failure and failure.startswith("reject-"):
                    return httpx.Response(
                        int(failure.removeprefix("reject-")),
                        json={"detail": "private-token response body"},
                    )
            if "timeout-before" in failures:
                raise httpx.ReadTimeout("private-token timeout", request=request)
            for item in batch:
                if "productId" in item:
                    self.products[connection_id][item["productId"]] = {
                        "description": item["description"],
                        "quantity": item["quantity"],
                    }
                else:
                    self.items[connection_id][item["description"]] = item["quantity"]
            if "timeout-after" in failures:
                raise httpx.ReadTimeout("private-token timeout", request=request)
            if self.empty_write_response:
                return httpx.Response(200)
            return httpx.Response(200, json={"items": batch})

        return httpx.MockTransport(handle)

    def writes(self) -> list[dict[str, Any]]:
        return [call for call in self.calls if call["method"] == "PATCH"]

    def written(self) -> list[dict[str, Any]]:
        """Every line sent, across batched PATCH requests."""
        return [item for call in self.writes() for item in call["body"]["items"]]


@dataclass
class System:
    app: FastAPI
    client: httpx.AsyncClient
    backend: Backend
    settings: Settings

    async def connect(self, code: str = "test-code") -> dict[str, str]:
        response = await self.client.post(
            "/connections", json={"household_id": str(uuid4()), "code": code}
        )
        assert response.status_code == 201, response.text
        return response.json()

    async def start(
        self,
        connection: dict[str, str],
        lines: list[str],
        export_id: str | None = None,
        products: list[dict[str, Any]] | None = None,
    ):
        export_id = export_id or str(uuid4())
        payload: dict[str, Any] = {"export_id": export_id, "lines": lines}
        if products is not None:
            payload["products"] = products
        response = await self.client.post(
            f"/connections/{connection['connection_id']}/exports",
            json=payload,
            headers={"X-Connection-Key": connection["connection_key"]},
        )
        return export_id, response

    async def search(
        self, connection: dict[str, str], params: dict[str, Any], key: str | None = None
    ) -> httpx.Response:
        return await self.client.get(
            f"/connections/{connection['connection_id']}/products",
            params=params,
            headers={"X-Connection-Key": connection["connection_key"] if key is None else key},
        )

    async def status(self, connection: dict[str, str], export_id: str, check: bool = False):
        return await self.client.get(
            f"/connections/{connection['connection_id']}/exports/{export_id}",
            params={"check": str(check).lower()},
            headers={"X-Connection-Key": connection["connection_key"]},
        )

    async def finished(self, connection: dict[str, str], export_id: str) -> dict[str, Any]:
        for _ in range(100):
            response = await self.status(connection, export_id)
            assert response.status_code == 200
            result = response.json()
            if result["status"] != "pending":
                return result
            await asyncio.sleep(0.01)
        raise AssertionError("Export remained pending")


@pytest.fixture
async def system(tmp_path: Path):
    backend = Backend()
    settings = Settings(SECRET, tmp_path / "appie.sqlite")
    app = create_app(settings, backend.transport)
    app.state.jobs.retry_delays = (0.0, 0.0)
    app.state.jobs.write_pause = 0.0
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://sidecar",
            headers={"Authorization": f"Bearer {SECRET}"},
        ) as client,
    ):
        yield System(app, client, backend, settings)


def text_line(description: str) -> LineInput:
    return {"description": description, "product_id": None, "quantity": 1}
