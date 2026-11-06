from __future__ import annotations

from typing import Any

from appie.lists import ListsAPI


class CompatibleLists(ListsAPI):
    """Keep python-appie 0.2.2's client, with the original text-add wire format."""

    @staticmethod
    def _add_payload(description: str, quantity: int, product_id: int | None) -> dict[str, Any]:
        payload = ListsAPI._add_payload(description, quantity, product_id)
        if product_id is None:
            # appie-go uses PRD even without a product ID, and includes strikeThrough.
            # https://github.com/gwillem/appie-go/blob/main/shoppinglist.go
            payload.update(originCode="PRD", strikeThrough=False)
        return payload
