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

SECRET = "sidecar-test-secret-with-at-least-32-characters"


class Backend:
    def __init__(self) -> None:
        self.items: dict[str, dict[str, int]] = defaultdict(dict)
        self.calls: list[dict[str, Any]] = []
        self.failures: dict[str, str] = {}
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
                    },
                )
            assert request.method == "PATCH"
            if self.write_gate is not None:
                await self.write_gate.wait()
            item = body["items"][0]
            if (
                item.get("originCode") != "PRD"
                or item.get("strikeThrough") is not False
                or item.get("type") != "SHOPPABLE"
            ):
                return httpx.Response(400, json={"detail": "Invalid shopping-list payload"})
            description = item["description"]
            failure = self.failures.get(description)
            if failure == "reject":
                return httpx.Response(400, json={"detail": "private-token response body"})
            if failure and failure.startswith("reject-"):
                return httpx.Response(
                    int(failure.removeprefix("reject-")),
                    json={"detail": "private-token response body"},
                )
            if failure == "timeout-before":
                raise httpx.ReadTimeout("private-token timeout", request=request)
            self.items[connection_id][description] = item["quantity"]
            if failure == "timeout-after":
                raise httpx.ReadTimeout("private-token timeout", request=request)
            return httpx.Response(200, json={"items": [item]})

        return httpx.MockTransport(handle)

    def writes(self) -> list[dict[str, Any]]:
        return [call for call in self.calls if call["method"] == "PATCH"]


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
        self, connection: dict[str, str], lines: list[str], export_id: str | None = None
    ):
        export_id = export_id or str(uuid4())
        response = await self.client.post(
            f"/connections/{connection['connection_id']}/exports",
            json={"export_id": export_id, "lines": lines},
            headers={"X-Connection-Key": connection["connection_key"]},
        )
        return export_id, response

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
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://sidecar",
            headers={"Authorization": f"Bearer {SECRET}"},
        ) as client,
    ):
        yield System(app, client, backend, settings)
