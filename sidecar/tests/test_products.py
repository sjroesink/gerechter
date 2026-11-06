from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
from uuid import uuid4

import pytest

from gerechter_ah.store import Store

from .conftest import SEARCH_PATH, SECRET, System, text_line


def product(product_id: int, quantity: int, description: str) -> dict[str, object]:
    return {"product_id": product_id, "quantity": quantity, "description": description}


def searches(system: System) -> list[dict[str, object]]:
    return [call for call in system.backend.calls if call["path"] == SEARCH_PATH]


async def test_search_returns_normalized_products_and_drops_non_https_images(system: System):
    connection = await system.connect()
    system.backend.catalog.append(
        {
            "webshopId": 99,
            "title": "Biologische Uien",
            "description": "ignored",
            "imageUrl": "http://insecure.example/uien.jpg",
            "unrelated": "private field",
        }
    )
    response = await system.search(connection, {"query": "  uien  ", "limit": 5})
    assert response.status_code == 200, response.text
    assert response.json() == {
        "products": [
            {
                "id": 1525,
                "title": "AH Uien",
                "brand": "AH",
                "price": 1.29,
                "is_bonus": False,
                "bonus_label": None,
                "unit_size": "1 kg",
                "image_url": "https://static.ah.nl/uien.jpg",
            },
            {
                "id": 99,
                "title": "Biologische Uien",
                "brand": None,
                "price": None,
                "is_bonus": None,
                "bonus_label": None,
                "unit_size": None,
                "image_url": None,
            },
        ]
    }
    assert searches(system)[0]["params"]["query"] == "uien"
    assert searches(system)[0]["params"]["size"] == "5"
    bonus = await system.search(connection, {"query": "tomaten"})
    assert bonus.json()["products"][0]["is_bonus"] is True
    assert bonus.json()["products"][0]["bonus_label"] == "2e halve prijs"
    assert searches(system)[1]["params"]["size"] == "20"
    assert system.backend.writes() == []


async def test_search_requires_server_and_connection_keys_without_touching_ah(system: System):
    connection = await system.connect()
    count = len(system.backend.calls)
    response = await system.client.get(
        f"/connections/{connection['connection_id']}/products",
        params={"query": "uien"},
        headers={"Authorization": "", "X-Connection-Key": connection["connection_key"]},
    )
    assert response.status_code == 401
    wrong = await system.search(connection, {"query": "uien"}, key="wrong-key")
    assert wrong.status_code == 404
    assert wrong.json() == {"detail": {"code": "connection_not_found"}}
    missing = await system.client.get(
        f"/connections/{connection['connection_id']}/products", params={"query": "uien"}
    )
    assert missing.status_code == 404
    await system.client.delete(
        f"/connections/{connection['connection_id']}",
        headers={"X-Connection-Key": connection["connection_key"]},
    )
    disconnected = await system.search(connection, {"query": "uien"})
    assert disconnected.status_code == 404
    assert len(system.backend.calls) == count


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"query": "   "},
        {"query": "x" * 101},
        {"query": "uien", "limit": 0},
        {"query": "uien", "limit": 31},
        {"query": "uien", "limit": "veel"},
    ],
)
async def test_search_rejects_invalid_input(system: System, params: dict[str, object]):
    connection = await system.connect()
    response = await system.search(connection, params)
    assert response.status_code == 422
    assert response.json() == {"detail": "Ongeldige invoer."}
    assert searches(system) == []


@pytest.mark.parametrize(
    ("failure", "expected"),
    [("500", "HTTP 500"), ("401", "HTTP 401"), ("timeout", "time-out")],
)
async def test_search_failure_is_generic_502(system: System, failure: str, expected: str):
    connection = await system.connect()
    system.backend.search_failure = failure
    response = await system.search(connection, {"query": "uien"})
    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "search_failed"
    assert detail["message"].startswith("AH: producten zoeken mislukt")
    assert expected in detail["message"]
    assert "private" not in response.text


async def test_search_waits_for_running_export_on_the_same_connection(system: System):
    connection = await system.connect()
    system.backend.write_gate = asyncio.Event()
    eid, _ = await system.start(connection, ["1 Ui"])
    for _ in range(100):
        if system.backend.writes():
            break
        await asyncio.sleep(0.001)
    search = asyncio.create_task(system.search(connection, {"query": "uien"}))
    await asyncio.sleep(0.05)
    assert not search.done() and searches(system) == []
    system.backend.write_gate.set()
    assert (await search).status_code == 200
    assert (await system.finished(connection, eid))["status"] == "succeeded"


async def test_product_payload_uses_product_id_and_absolute_quantity(system: System):
    connection = await system.connect()
    eid, response = await system.start(connection, [], products=[product(1525, 2, "AH Uien")])
    assert response.status_code == 202, response.text
    result = await system.finished(connection, eid)
    assert result["status"] == "succeeded" and result["completed"] == 1 and result["total"] == 1
    assert system.backend.writes()[0]["body"] == {
        "items": [
            {
                "productId": 1525,
                "quantity": 2,
                "type": "SHOPPABLE",
                "originCode": "PRD",
                "description": "AH Uien",
                "searchTerm": "AH Uien",
            }
        ]
    }
    line = system.app.state.store.job(connection["connection_id"], eid)["lines"][0]
    assert line["product_id"] == 1525 and line["quantity"] == 2
    assert line["target_quantity"] == 2 and line["status"] == "sent"


async def test_product_already_on_list_gets_quantities_added(system: System):
    connection = await system.connect()
    cid = connection["connection_id"]
    system.backend.products[cid][1525] = {"description": "AH Uien", "quantity": 1}
    eid, _ = await system.start(connection, [], products=[product(1525, 2, "AH Uien")])
    assert (await system.finished(connection, eid))["status"] == "succeeded"
    assert len(system.backend.writes()) == 1
    assert system.backend.writes()[0]["body"]["items"][0]["quantity"] == 3
    assert system.backend.products[cid][1525]["quantity"] == 3


async def test_product_lines_with_the_same_id_are_merged_and_capped(system: System):
    connection = await system.connect()
    cid = connection["connection_id"]
    eid, _ = await system.start(
        connection,
        [],
        products=[
            product(1525, 2, "AH Uien"),
            product(4471, 60, "AH Trostomaten"),
            product(1525, 3, "Uien (tweede gerecht)"),
            product(4471, 60, "AH Trostomaten"),
        ],
    )
    result = await system.finished(connection, eid)
    assert result["status"] == "succeeded" and result["total"] == 2
    bodies = [call["body"]["items"][0] for call in system.backend.writes()]
    assert [(b["productId"], b["quantity"], b["description"]) for b in bodies] == [
        (1525, 5, "AH Uien"),
        (4471, 99, "AH Trostomaten"),
    ]
    assert system.backend.products[cid][1525]["quantity"] == 5


async def test_mixed_export_writes_text_and_product_lines(system: System):
    connection = await system.connect()
    cid = connection["connection_id"]
    system.backend.items[cid]["Verse kruiden"] = 1
    eid, _ = await system.start(
        connection,
        ["Verse kruiden", "1 blik Bonen", "1 blik Bonen"],
        products=[product(1525, 2, "AH Uien")],
    )
    result = await system.finished(connection, eid)
    assert result == {
        "export_id": eid,
        "status": "succeeded",
        "completed": 3,
        "total": 3,
        "message": "3 van 3 regels aanwezig of bevestigd.",
        "verified_absent": False,
    }
    bodies = [call["body"]["items"][0] for call in system.backend.writes()]
    assert bodies == [
        {
            "description": "2× 1 blik Bonen",
            "quantity": 1,
            "type": "SHOPPABLE",
            "originCode": "PRD",
            "strikeThrough": False,
        },
        {
            "productId": 1525,
            "quantity": 2,
            "type": "SHOPPABLE",
            "originCode": "PRD",
            "description": "AH Uien",
            "searchTerm": "AH Uien",
        },
    ]
    statuses = [line["status"] for line in system.app.state.store.job(cid, eid)["lines"]]
    assert statuses == ["present", "sent", "sent"]


@pytest.mark.parametrize(
    "payload",
    [
        {"lines": [], "products": []},
        {"lines": []},
        {"products": []},
        {},
        {"products": [product(0, 1, "Ui")]},
        {"products": [product(1, 0, "Ui")]},
        {"products": [product(1, 100, "Ui")]},
        {"products": [product(1, 1, "")]},
        {"products": [product(1, 1, "x" * 2001)]},
        {"products": [product(1, 1.5, "Ui")]},
        {"products": [product("1", 1, "Ui")]},
        {"products": [{**product(1, 1, "Ui"), "price": 1.29}]},
        {"products": [product(1, 1, "Ui")] * 501},
        {"lines": [""]},
    ],
)
async def test_export_rejects_empty_or_invalid_input(system: System, payload: dict[str, object]):
    connection = await system.connect()
    response = await system.client.post(
        f"/connections/{connection['connection_id']}/exports",
        json={"export_id": str(uuid4()), **payload},
        headers={"X-Connection-Key": connection["connection_key"]},
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Ongeldige invoer."}
    assert system.backend.writes() == []


async def test_export_id_reuse_with_other_products_is_rejected(system: System):
    connection = await system.connect()
    eid, _ = await system.start(connection, ["Zout"], products=[product(1525, 2, "AH Uien")])
    assert (await system.finished(connection, eid))["status"] == "succeeded"
    _, same = await system.start(connection, ["Zout"], eid, [product(1525, 2, "AH Uien")])
    assert same.status_code == 202
    for changed in (
        [product(1525, 3, "AH Uien")],
        [product(4471, 2, "AH Uien")],
        [product(1525, 2, "Uien")],
        [],
    ):
        _, response = await system.start(connection, ["Zout"], eid, changed)
        assert response.status_code == 409
    assert len(system.backend.writes()) == 2


async def test_failure_after_a_product_write_is_uncertain_and_stops(system: System):
    connection = await system.connect()
    system.backend.failures["AH Trostomaten"] = "timeout-before"
    eid, _ = await system.start(
        connection,
        [],
        products=[
            product(1525, 1, "AH Uien"),
            product(4471, 2, "AH Trostomaten"),
            product(77, 1, "AH Knoflook"),
        ],
    )
    result = await system.finished(connection, eid)
    assert result["status"] == "uncertain" and result["completed"] == 1
    assert "time-out" in result["message"] and "private-token" not in json.dumps(result)
    assert [call["body"]["items"][0]["productId"] for call in system.backend.writes()] == [
        1525,
        4471,
    ]
    lines = system.app.state.store.job(connection["connection_id"], eid)["lines"]
    assert [(line["status"], line["target_quantity"]) for line in lines] == [
        ("sent", 1),
        ("inflight", 2),
        ("pending", None),
    ]
    checked = await system.status(connection, eid, check=True)
    assert checked.json()["status"] == "uncertain"
    assert checked.json()["verified_absent"] is True
    assert len(system.backend.writes()) == 2


async def test_rejected_first_product_write_fails_without_further_writes(system: System):
    connection = await system.connect()
    system.backend.failures["Uit assortiment"] = "reject"
    eid, _ = await system.start(
        connection, [], products=[product(5, 1, "Uit assortiment"), product(6, 1, "Ander")]
    )
    result = await system.finished(connection, eid)
    assert result["status"] == "failed" and "HTTP 400" in result["message"]
    assert len(system.backend.writes()) == 1


async def test_inspection_confirms_product_only_at_or_above_target(system: System):
    connection = await system.connect()
    cid = connection["connection_id"]
    system.backend.products[cid][1525] = {"description": "AH Uien", "quantity": 1}
    system.backend.failures["AH Uien"] = "timeout-after"
    eid, _ = await system.start(connection, [], products=[product(1525, 2, "AH Uien")])
    assert (await system.finished(connection, eid))["status"] == "uncertain"
    assert system.app.state.store.job(cid, eid)["lines"][0]["target_quantity"] == 3
    system.backend.products[cid][1525]["quantity"] = 2
    lower = (await system.status(connection, eid, check=True)).json()
    assert lower["status"] == "uncertain" and lower["verified_absent"] is True
    assert lower["completed"] == 0
    system.backend.products[cid][1525]["quantity"] = 4
    higher = (await system.status(connection, eid, check=True)).json()
    assert higher["status"] == "succeeded" and higher["completed"] == 1
    assert len(system.backend.writes()) == 1


async def test_inspection_does_not_confirm_product_without_target(system: System):
    connection = await system.connect()
    cid, eid = connection["connection_id"], str(uuid4())
    store = system.app.state.store
    store.reserve(cid, eid, [{"description": "AH Uien", "product_id": 1525, "quantity": 1}])
    store.set_job(cid, eid, "uncertain", "Proces onderbroken; controleer de lijst.")
    system.backend.products[cid][1525] = {"description": "AH Uien", "quantity": 5}
    checked = (await system.status(connection, eid, check=True)).json()
    assert checked["status"] == "uncertain" and checked["verified_absent"] is True
    assert system.backend.writes() == []


OLD_SCHEMA = """
    CREATE TABLE connections (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL, key_hash TEXT NOT NULL,
        token BLOB, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
    );
    CREATE TABLE jobs (
        connection_id TEXT NOT NULL REFERENCES connections(id),
        export_id TEXT NOT NULL, input_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN
            ('pending','running','succeeded','failed','uncertain')),
        message TEXT,
        PRIMARY KEY(connection_id, export_id)
    );
    CREATE TABLE job_lines (
        connection_id TEXT NOT NULL, export_id TEXT NOT NULL,
        position INTEGER NOT NULL, description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN
            ('pending','inflight','sent','present','uncertain')),
        PRIMARY KEY(connection_id, export_id, position),
        FOREIGN KEY(connection_id,export_id)
            REFERENCES jobs(connection_id,export_id)
    );
"""


def test_existing_database_from_previous_schema_is_upgraded_in_place(tmp_path):
    path = tmp_path / "old.sqlite"
    cid, eid = str(uuid4()), str(uuid4())
    old_hash = hashlib.sha256(json.dumps(["100 g Rijst"]).encode()).hexdigest()
    db = sqlite3.connect(path)
    db.executescript(OLD_SCHEMA)
    db.execute("INSERT INTO connections(id,household_id,key_hash) VALUES(?,?,?)", (cid, "h", "x"))
    db.execute("INSERT INTO jobs VALUES(?,?,?,'uncertain','Oud')", (cid, eid, old_hash))
    db.execute("INSERT INTO job_lines VALUES(?,?,0,'100 g Rijst','sent')", (cid, eid))
    db.commit()
    db.close()

    store = Store(path, SECRET)
    Store(path, SECRET)  # Opening twice must not try to add the columns again.
    with store.db() as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(job_lines)")}
    assert {"product_id", "quantity", "target_quantity"} <= columns
    assert store.job(cid, eid) == {
        "status": "uncertain",
        "message": "Oud",
        "lines": [
            {
                "position": 0,
                "description": "100 g Rijst",
                "status": "sent",
                "product_id": None,
                "quantity": 1,
                "target_quantity": None,
            }
        ],
    }
    # A retry of a text-only export after the upgrade still matches its original hash.
    assert store.reserve(cid, eid, [text_line("100 g Rijst")]) is False
    with pytest.raises(ValueError):
        store.reserve(cid, eid, [{"description": "100 g Rijst", "product_id": 1, "quantity": 1}])
    new_eid = str(uuid4())
    assert store.reserve(
        cid, new_eid, [{"description": "AH Uien", "product_id": 1525, "quantity": 2}]
    )
    store.set_line(cid, new_eid, 0, "inflight", 3)
    store.recover_interrupted()
    line = store.job(cid, new_eid)["lines"][0]
    assert (line["status"], line["product_id"], line["quantity"], line["target_quantity"]) == (
        "uncertain",
        1525,
        2,
        3,
    )
