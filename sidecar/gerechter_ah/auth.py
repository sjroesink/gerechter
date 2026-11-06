from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import httpx
from appie import AHClient
from appie.auth import AHAuthClient
from appie.models import StoredToken, TokenResponse

from .lists import CompatibleLists
from .store import Store


class EncryptedAuth(AHAuthClient):
    def __init__(self, store: Store, connection_id: str, client: httpx.AsyncClient) -> None:
        self.store = store
        self.connection_id = connection_id
        super().__init__(http_client=client)

    def load_tokens(self) -> StoredToken | None:
        payload = self.store.load_token(self.connection_id)
        return StoredToken.model_validate_json(payload) if payload else None

    def save_tokens(self, token: TokenResponse) -> StoredToken:
        stored = StoredToken.from_token_response(
            token, expires_at=datetime.now(UTC) + timedelta(seconds=token.expires_in)
        )
        self.store.save_token(self.connection_id, stored.model_dump_json())
        self._stored_token = stored
        return stored


@asynccontextmanager
async def make_client(
    store: Store, connection_id: str, transport: httpx.AsyncBaseTransport | None = None
) -> AsyncIterator[AHClient]:
    async with httpx.AsyncClient(
        base_url="https://api.ah.nl", timeout=20, transport=transport
    ) as http:
        auth = EncryptedAuth(store, connection_id, http)
        async with AHClient(http_client=http, auth_client=auth) as client:
            client.lists = CompatibleLists(client)
            yield client
