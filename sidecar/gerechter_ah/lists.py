from __future__ import annotations

from typing import Any

from appie.lists import GET_LIST_PATH, ListsAPI


class CompatibleLists(ListsAPI):
    """Keep python-appie 0.2.2's client, with the original text-add wire format."""

    @staticmethod
    def _add_payload(description: str, quantity: int, product_id: int | None) -> dict[str, Any]:
        payload = ListsAPI._add_payload(description, quantity, product_id)
        # appie-go always sends strikeThrough (AH rejects items without it) and uses PRD even
        # without a product ID. https://github.com/gwillem/appie-go/blob/main/shoppinglist.go
        payload.update(originCode="PRD", strikeThrough=False)
        return payload

    async def add_items(self, items: list[tuple[str, int, int | None]]) -> None:
        """Writes several lines in one PATCH, as appie-go does.

        The response body is not used: python-appie's add_item fails when AH answers without
        an items list, although the write itself succeeded.
        """
        payload = {"items": [self._add_payload(*item) for item in items]}
        await self._client.request("PATCH", GET_LIST_PATH, json=payload)
