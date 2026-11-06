from __future__ import annotations

import asyncio
import os
import secrets
from collections import Counter
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

import httpx
from appie import AHClient
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from .auth import make_client
from .jobs import Jobs
from .store import Store


@dataclass(frozen=True)
class Settings:
    secret: str
    database: Path

    @classmethod
    def from_env(cls) -> Settings:
        secret = os.environ.get("AH_SIDECAR_SECRET", "")
        if len(secret) < 32:
            raise ValueError("AH_SIDECAR_SECRET must have at least 32 characters")
        return cls(secret, Path(os.environ.get("AH_DATABASE", "/data/appie.sqlite")))


class ConnectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    household_id: UUID
    code: Annotated[SecretStr, Field(min_length=1, max_length=4096)]


class ExportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    export_id: UUID
    lines: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=2000)]],
        Field(min_length=1, max_length=500),
    ]


def extract_code(value: str) -> str:
    value = value.strip()
    if "://" in value:
        value = parse_qs(urlparse(value).query).get("code", [""])[0]
    if not value or any(char.isspace() for char in value):
        raise HTTPException(400, "Ongeldige AH-aanmeldcode.")
    return value


def create_app(
    settings: Settings | None = None,
    transport_factory: Callable[[str], httpx.AsyncBaseTransport | None] | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    store = Store(settings.database, settings.secret)
    jobs = Jobs(
        store,
        lambda connection_id: make_client(
            store, connection_id, transport_factory(connection_id) if transport_factory else None
        ),
    )
    tasks: set[asyncio.Task[None]] = set()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        store.recover_interrupted()
        yield
        pending = list(tasks)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.store = store
    app.state.jobs = jobs

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_request, _error):
        return JSONResponse({"detail": "Ongeldige invoer."}, status_code=422)

    @app.exception_handler(Exception)
    async def internal_error(_request, _error):
        return JSONResponse(
            {"detail": "Interne sidecarfout; er zijn geen geheimen teruggegeven."}, status_code=500
        )

    def server_auth(authorization: Annotated[str | None, Header()] = None) -> None:
        if not secrets.compare_digest(
            (authorization or "").encode(), f"Bearer {settings.secret}".encode()
        ):
            raise HTTPException(401, "Ongeldige servertoegang.")

    def connection_auth(connection_id: str, key: str | None) -> None:
        if not store.authorize(connection_id, key or ""):
            raise HTTPException(404, {"code": "connection_not_found"})

    router = APIRouter(dependencies=[Depends(server_auth)])

    @app.get("/health")
    async def health():
        return {"status": "ok", "experimental": True, "client": "python-appie", "version": "0.2.2"}

    @router.get("/auth-info")
    async def auth_info():
        return {"authorization_url": AHClient.authorize_url, "experimental": True}

    @router.post("/connections", status_code=201)
    async def connect(body: ConnectionInput):
        code = extract_code(body.code.get_secret_value())
        connection_id, key = str(uuid4()), secrets.token_urlsafe(32)
        store.create_connection(connection_id, str(body.household_id), key)
        try:
            async with jobs.client_factory(connection_id) as client:
                await client.auth.login_with_code(code)
        except Exception:
            store.disconnect(connection_id)
            raise HTTPException(400, "AH-aanmelding mislukt. Vraag een nieuwe code aan.") from None
        return {"connection_id": connection_id, "connection_key": key}

    @router.delete("/connections/{connection_id}")
    async def disconnect(
        connection_id: UUID, key: Annotated[str | None, Header(alias="X-Connection-Key")] = None
    ):
        connection_auth(str(connection_id), key)
        store.disconnect(str(connection_id))
        return {"disconnected": True}

    @router.post("/connections/{connection_id}/exports", status_code=202)
    async def export(
        connection_id: UUID,
        body: ExportInput,
        key: Annotated[str | None, Header(alias="X-Connection-Key")] = None,
    ):
        cid, eid = str(connection_id), str(body.export_id)
        connection_auth(cid, key)
        try:
            counts = Counter(body.lines)
            lines = [f"{count}× {line}" if count > 1 else line for line, count in counts.items()]
            if any(len(line) > 2000 for line in lines):
                raise HTTPException(422, "Een gegroepeerde boodschappenregel is te lang.")
            fresh = store.reserve(cid, eid, lines)
        except ValueError:
            raise HTTPException(
                409, "Deze exportsleutel is al met andere inhoud gebruikt."
            ) from None
        if fresh:
            task = asyncio.create_task(jobs.run(cid, eid))
            tasks.add(task)
            task.add_done_callback(tasks.discard)
        return jobs.public(cid, eid)

    @router.get("/connections/{connection_id}/exports/{export_id}")
    async def status(
        connection_id: UUID,
        export_id: UUID,
        check: bool = False,
        key: Annotated[str | None, Header(alias="X-Connection-Key")] = None,
    ):
        cid, eid = str(connection_id), str(export_id)
        connection_auth(cid, key)
        job = store.job(cid, eid)
        if not job:
            raise HTTPException(404, {"code": "export_not_found"})
        absent = await jobs.inspect(cid, eid) if check and job["status"] == "uncertain" else False
        return jobs.public(cid, eid, absent)

    app.include_router(router)
    return app
