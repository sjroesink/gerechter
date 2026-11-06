from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from cryptography.exceptions import InvalidTag

from gerechter_ah.service import Settings, create_app
from gerechter_ah.store import Store

from .conftest import SECRET, Backend, System, text_line


async def test_server_and_connection_authentication_do_not_touch_ah(system: System):
    response = await system.client.get("/auth-info", headers={"Authorization": ""})
    assert response.status_code == 401
    assert system.backend.calls == []
    connection = await system.connect()
    count = len(system.backend.calls)
    response = await system.client.get(
        f"/connections/{connection['connection_id']}/exports/{uuid4()}",
        headers={"X-Connection-Key": "wrong-key"},
    )
    assert response.status_code == 404
    assert len(system.backend.calls) == count
    health = await system.client.get("/health", headers={"Authorization": ""})
    assert health.json()["experimental"] is True


async def test_pending_status_does_not_wait_for_a_running_ah_write(system: System):
    connection = await system.connect()
    system.backend.write_gate = asyncio.Event()
    eid, _ = await system.start(connection, ["1 Ui"])
    for _ in range(100):
        if system.backend.writes():
            break
        await asyncio.sleep(0.001)
    assert system.backend.writes()
    status = await asyncio.wait_for(system.status(connection, eid, check=True), timeout=0.2)
    assert status.json()["status"] == "pending"
    system.backend.write_gate.set()
    assert (await system.finished(connection, eid))["status"] == "succeeded"


async def test_code_login_encrypts_tokens_per_connection_without_global_token_file(
    system: System, tmp_path, monkeypatch
):
    import appie.auth

    default_path = tmp_path / "must-not-exist.json"
    monkeypatch.setattr(appie.auth, "DEFAULT_TOKEN_PATH", default_path)
    first = await system.connect("appie://login-exit?code=callback-code&state=unused")
    second = await system.connect()
    assert first["connection_id"] != second["connection_id"]
    assert first["connection_key"] != second["connection_key"]
    assert system.backend.calls[0]["body"]["code"] == "callback-code"
    with system.app.state.store.db() as db:
        rows = db.execute("SELECT id,token,key_hash FROM connections").fetchall()
    for row in rows:
        assert b"access-" not in row["token"] and b"refresh-" not in row["token"]
        assert row["key_hash"] not in {first["connection_key"], second["connection_key"]}
        token = json.loads(system.app.state.store.load_token(row["id"]))
        assert token["access_token"] == f"access-{row['id']}"
    assert not default_path.exists()


async def test_real_client_refreshes_expired_tokens_into_encrypted_storage(system: System):
    connection = await system.connect()
    cid = connection["connection_id"]
    stored = json.loads(system.app.state.store.load_token(cid))
    stored["expires_at"] = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    system.app.state.store.save_token(cid, json.dumps(stored))
    eid, _ = await system.start(connection, ["300 g Tomaten"])
    assert (await system.finished(connection, eid))["status"] == "succeeded"
    refreshes = [call for call in system.backend.calls if call["path"].endswith("/refresh")]
    assert len(refreshes) == 1
    assert json.loads(system.app.state.store.load_token(cid))["access_token"] == f"renewed-{cid}"
    assert system.backend.writes()[0]["authorization"] == f"Bearer renewed-{cid}"


async def test_repeated_and_concurrent_export_id_starts_one_write_per_line(system: System):
    connection = await system.connect()
    eid = str(uuid4())
    results = await asyncio.gather(
        system.start(connection, ["300 g Tomaten", "1 Ui"], eid),
        system.start(connection, ["300 g Tomaten", "1 Ui"], eid),
    )
    assert all(response.status_code == 202 for _, response in results)
    assert (await system.finished(connection, eid))["completed"] == 2
    assert len(system.backend.writes()) == 2
    await system.start(connection, ["300 g Tomaten", "1 Ui"], eid)
    assert len(system.backend.writes()) == 2
    _, changed = await system.start(connection, ["Andere inhoud"], eid)
    assert changed.status_code == 409
    assert len(system.backend.writes()) == 2


async def test_duplicate_input_lines_preserve_multiplicity_and_existing_text_is_not_overwritten(
    system: System,
):
    connection = await system.connect()
    cid = connection["connection_id"]
    system.backend.items[cid][" 100 G   TOMATEN "] = 3
    eid, _ = await system.start(connection, ["100 g Tomaten", "1 blik Bonen", "1 blik Bonen"])
    result = await system.finished(connection, eid)
    assert result["status"] == "succeeded" and result["total"] == 2
    assert len(system.backend.writes()) == 1
    assert system.backend.writes()[0]["body"]["items"][0]["description"] == "2× 1 blik Bonen"
    assert system.backend.items[cid][" 100 G   TOMATEN "] == 3


async def test_write_saved_by_ah_without_response_is_recovered_read_only(system: System):
    connection = await system.connect()
    system.backend.failures["300 g Tomaten"] = "timeout-after"
    eid, _ = await system.start(connection, ["300 g Tomaten"])
    assert (await system.finished(connection, eid))["status"] == "uncertain"
    await system.start(connection, ["300 g Tomaten"], eid)
    assert len(system.backend.writes()) == 1
    checked = await system.status(connection, eid, check=True)
    assert checked.json()["status"] == "succeeded" and checked.json()["completed"] == 1
    assert len(system.backend.writes()) == 1
    assert "private-token" not in checked.text


async def test_partial_result_stops_writes_and_only_deliberate_new_export_adds_missing_lines(
    system: System,
):
    connection = await system.connect()
    system.backend.failures["1 Ui"] = "timeout-before"
    eid, _ = await system.start(connection, ["300 g Tomaten", "1 Ui", "2 Eieren"])
    result = await system.finished(connection, eid)
    assert result["status"] == "uncertain" and result["completed"] == 1
    assert len(system.backend.writes()) == 2
    checked = await system.status(connection, eid, check=True)
    assert checked.json()["verified_absent"] is True
    assert len(system.backend.writes()) == 2
    system.backend.failures.clear()
    next_id, _ = await system.start(connection, ["300 g Tomaten", "1 Ui", "2 Eieren"])
    assert (await system.finished(connection, next_id))["completed"] == 3
    descriptions = [call["body"]["items"][0]["description"] for call in system.backend.writes()]
    assert descriptions.count("300 g Tomaten") == 1


async def test_definitive_rejection_or_failed_initial_read_do_not_continue(system: System):
    connection = await system.connect()
    system.backend.failures["1 Ui"] = "reject"
    eid, _ = await system.start(connection, ["1 Ui", "2 Eieren"])
    result = await system.finished(connection, eid)
    assert result["status"] == "failed"
    assert "HTTP 400" in result["message"] and "toevoegen" in result["message"]
    assert len(system.backend.writes()) == 1
    assert "private-token" not in json.dumps(result)
    system.backend.fail_reads = True
    next_id, _ = await system.start(connection, ["Nieuw"])
    read_result = await system.finished(connection, next_id)
    assert read_result["status"] == "failed"
    assert "HTTP 403" in read_result["message"] and "lezen" in read_result["message"]
    assert "private server detail" not in json.dumps(read_result)
    assert len(system.backend.writes()) == 1


async def test_text_payload_preserves_full_description_without_inventing_product(system: System):
    connection = await system.connect()
    description = "Italiaanse kruiden · 1,5 tl (omrekening onbekend; controleer zelf)"
    eid, _ = await system.start(connection, [description])
    result = await system.finished(connection, eid)
    assert result["status"] == "succeeded"
    write = system.backend.writes()[0]
    assert write["path"] == "/mobile-services/shoppinglist/v2/items"
    assert write["body"] == {
        "items": [
            {
                "description": description,
                "quantity": 1,
                "type": "SHOPPABLE",
                "originCode": "PRD",
                "strikeThrough": False,
            }
        ]
    }
    assert system.backend.items[connection["connection_id"]] == {description: 1}


@pytest.mark.parametrize(
    ("status", "expected"),
    [(401, "failed"), (403, "failed"), (408, "uncertain"), (429, "failed"), (500, "uncertain")],
)
async def test_safe_status_diagnostics_keep_uncertainty_and_never_retry(
    system: System, status: int, expected: str
):
    connection = await system.connect()
    system.backend.failures["1 Ui"] = f"reject-{status}"
    eid, _ = await system.start(connection, ["1 Ui", "Niet toevoegen"])
    result = await system.finished(connection, eid)
    assert result["status"] == expected and result["completed"] == 0
    assert f"HTTP {status}" in result["message"] and "toevoegen" in result["message"]
    assert "private-token" not in json.dumps(result)
    assert len(system.backend.writes()) == 1
    await system.start(connection, ["1 Ui", "Niet toevoegen"], eid)
    assert len(system.backend.writes()) == 1


async def test_failed_read_only_inspection_reports_safe_diagnostics(system: System):
    connection = await system.connect()
    system.backend.failures["1 Ui"] = "timeout-before"
    eid, _ = await system.start(connection, ["1 Ui"])
    result = await system.finished(connection, eid)
    assert result["status"] == "uncertain"
    assert "time-out" in result["message"] and "private-token" not in json.dumps(result)
    system.backend.fail_reads = True
    result = (await system.status(connection, eid, check=True)).json()
    assert result["status"] == "uncertain" and result["verified_absent"] is False
    assert "HTTP 403" in result["message"] and "lezen" in result["message"]
    assert "private server detail" not in json.dumps(result)
    assert len(system.backend.writes()) == 1


async def test_connections_and_identical_export_ids_remain_separate(system: System):
    first, second = await system.connect(), await system.connect()
    eid = str(uuid4())
    await system.start(first, ["Eerste huishouden"], eid)
    await system.start(second, ["Tweede huishouden"], eid)
    assert (await system.finished(first, eid))["status"] == "succeeded"
    assert (await system.finished(second, eid))["status"] == "succeeded"
    assert system.backend.items[first["connection_id"]] == {"Eerste huishouden": 1}
    assert system.backend.items[second["connection_id"]] == {"Tweede huishouden": 1}
    forbidden = await system.client.get(
        f"/connections/{second['connection_id']}/exports/{eid}",
        headers={"X-Connection-Key": first["connection_key"]},
    )
    assert forbidden.status_code == 404


async def test_disconnect_removes_tokens_and_prevents_pending_work(system: System):
    connection = await system.connect()
    cid, eid = connection["connection_id"], str(uuid4())
    system.app.state.store.reserve(cid, eid, [text_line("Niet toevoegen")])
    response = await system.client.delete(
        f"/connections/{cid}", headers={"X-Connection-Key": connection["connection_key"]}
    )
    assert response.status_code == 200
    assert system.app.state.store.load_token(cid) is None
    await system.app.state.jobs.run(cid, eid)
    assert len(system.backend.writes()) == 0
    assert (await system.status(connection, eid)).status_code == 404


async def test_disconnect_during_write_preserves_uncertainty_and_stops_following_lines(
    system: System,
):
    connection = await system.connect()
    system.backend.write_gate = asyncio.Event()
    eid, response = await system.start(connection, ["Eerste regel", "Volgende regel"])
    assert response.status_code == 202
    for _ in range(100):
        if system.backend.writes():
            break
        await asyncio.sleep(0.01)
    assert len(system.backend.writes()) == 1
    cid = connection["connection_id"]
    await system.client.delete(
        f"/connections/{cid}", headers={"X-Connection-Key": connection["connection_key"]}
    )
    system.backend.write_gate.set()
    for _ in range(100):
        if system.app.state.store.job(cid, eid)["lines"][0]["status"] == "sent":
            break
        await asyncio.sleep(0.01)
    assert system.app.state.store.job(cid, eid)["status"] == "uncertain"
    assert len(system.backend.writes()) == 1
    assert system.app.state.store.load_token(cid) is None


async def test_bad_login_and_validation_errors_never_echo_code_or_token(system: System):
    response = await system.client.post(
        "/connections", json={"household_id": str(uuid4()), "code": "bad-code"}
    )
    assert response.status_code == 400
    assert "bad-code" not in response.text and "secret response" not in response.text
    response = await system.client.post(
        "/connections",
        json={
            "household_id": "invalid",
            "code": "secret-code-value",
            "token": "secret-token-value",
        },
    )
    assert response.status_code == 422
    assert "secret-code-value" not in response.text and "secret-token-value" not in response.text


async def test_encryption_rejects_wrong_service_key_and_swapped_connection_tokens(system: System):
    first, second = await system.connect(), await system.connect()
    store = system.app.state.store
    with store.db() as db:
        token = db.execute(
            "SELECT token FROM connections WHERE id=?", (first["connection_id"],)
        ).fetchone()["token"]
        db.execute("UPDATE connections SET token=? WHERE id=?", (token, second["connection_id"]))
    with pytest.raises(InvalidTag):
        store.load_token(second["connection_id"])
    wrong = Store(system.settings.database, "other-sidecar-secret-with-at-least-32-characters")
    with pytest.raises(InvalidTag):
        wrong.load_token(first["connection_id"])


async def test_restart_keeps_job_but_does_not_resume_inflight_write(tmp_path):
    backend = Backend()
    settings = Settings(SECRET, tmp_path / "persistent.sqlite")
    app = create_app(settings, backend.transport)
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://sidecar",
            headers={"Authorization": f"Bearer {SECRET}"},
        ) as client,
    ):
        connection = (
            await client.post("/connections", json={"household_id": str(uuid4()), "code": "code"})
        ).json()
    cid, eid = connection["connection_id"], str(uuid4())
    app.state.store.reserve(cid, eid, [text_line("100 g Rijst")])
    app.state.store.set_job(cid, eid, "running", "Gestart")
    app.state.store.set_line(cid, eid, 0, "inflight")
    restarted = create_app(settings, backend.transport)
    async with (
        restarted.router.lifespan_context(restarted),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=restarted),
            base_url="http://sidecar",
            headers={
                "Authorization": f"Bearer {SECRET}",
                "X-Connection-Key": connection["connection_key"],
            },
        ) as client,
    ):
        status = await client.get(f"/connections/{cid}/exports/{eid}")
        assert status.json()["status"] == "uncertain"
        assert backend.writes() == []
        checked = await client.get(f"/connections/{cid}/exports/{eid}?check=true")
        assert checked.json()["verified_absent"] is True
        assert backend.writes() == []


def test_configuration_requires_strong_service_secret(monkeypatch):
    monkeypatch.delenv("AH_SIDECAR_SECRET", raising=False)
    with pytest.raises(ValueError, match="AH_SIDECAR_SECRET"):
        Settings.from_env()
