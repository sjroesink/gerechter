from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, TypedDict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class LineInput(TypedDict):
    description: str
    product_id: int | None
    quantity: int


# Columns added after the first release; existing databases receive them at startup.
JOB_LINE_COLUMNS = {
    "product_id": "INTEGER NULL",
    "quantity": "INTEGER NOT NULL DEFAULT 1",
    "target_quantity": "INTEGER NULL",
}


class Store:
    def __init__(self, path: Path, secret: str) -> None:
        if len(secret) < 32:
            raise ValueError("AH_SIDECAR_SECRET must have at least 32 characters")
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.cipher = AESGCM(hashlib.sha256(f"gerechter-ah-v1:{secret}".encode()).digest())
        with self.db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY, household_id TEXT NOT NULL, key_hash TEXT NOT NULL,
                    token BLOB, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    connection_id TEXT NOT NULL REFERENCES connections(id),
                    export_id TEXT NOT NULL, input_hash TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN
                        ('pending','running','succeeded','failed','uncertain')),
                    message TEXT,
                    PRIMARY KEY(connection_id, export_id)
                );
                CREATE TABLE IF NOT EXISTS job_lines (
                    connection_id TEXT NOT NULL, export_id TEXT NOT NULL,
                    position INTEGER NOT NULL, description TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN
                        ('pending','inflight','sent','present','uncertain')),
                    product_id INTEGER NULL,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    target_quantity INTEGER NULL,
                    PRIMARY KEY(connection_id, export_id, position),
                    FOREIGN KEY(connection_id,export_id)
                        REFERENCES jobs(connection_id,export_id)
                );
            """)
            existing = {row["name"] for row in db.execute("PRAGMA table_info(job_lines)")}
            for column, definition in JOB_LINE_COLUMNS.items():
                if column not in existing:
                    db.execute(f"ALTER TABLE job_lines ADD COLUMN {column} {definition}")
        if os.name != "nt":
            path.chmod(0o600)

    @contextmanager
    def db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def is_active(self, connection_id: str) -> bool:
        with self.db() as db:
            return (
                db.execute(
                    "SELECT 1 FROM connections WHERE id=? AND active=1", (connection_id,)
                ).fetchone()
                is not None
            )

    def create_connection(self, connection_id: str, household_id: str, key: str) -> None:
        with self.db() as db:
            db.execute(
                "INSERT INTO connections(id,household_id,key_hash) VALUES(?,?,?)",
                (connection_id, household_id, hashlib.sha256(key.encode()).hexdigest()),
            )

    def authorize(self, connection_id: str, key: str) -> bool:
        with self.db() as db:
            row = db.execute(
                "SELECT key_hash FROM connections WHERE id=? AND active=1", (connection_id,)
            ).fetchone()
        expected = row["key_hash"] if row else "0" * 64
        return (
            secrets.compare_digest(expected, hashlib.sha256(key.encode()).hexdigest())
            and row is not None
        )

    def save_token(self, connection_id: str, payload: str) -> None:
        nonce = secrets.token_bytes(12)
        ciphertext = nonce + self.cipher.encrypt(nonce, payload.encode(), connection_id.encode())
        with self.db() as db:
            changed = db.execute(
                "UPDATE connections SET token=? WHERE id=? AND active=1",
                (ciphertext, connection_id),
            ).rowcount
            if changed != 1:
                raise ValueError("Connection unavailable")

    def load_token(self, connection_id: str) -> str | None:
        with self.db() as db:
            row = db.execute(
                "SELECT token FROM connections WHERE id=? AND active=1", (connection_id,)
            ).fetchone()
        if not row or not row["token"]:
            return None
        value = row["token"]
        return self.cipher.decrypt(value[:12], value[12:], connection_id.encode()).decode()

    def disconnect(self, connection_id: str) -> None:
        with self.db() as db:
            db.execute("UPDATE connections SET active=0,token=NULL WHERE id=?", (connection_id,))
            db.execute(
                "UPDATE jobs SET status='uncertain',"
                "message='Verbinding losgekoppeld; controleer de lijst.' "
                "WHERE connection_id=? AND status IN ('pending','running')",
                (connection_id,),
            )

    def recover_interrupted(self) -> None:
        with self.db() as db:
            db.execute(
                "UPDATE jobs SET status='uncertain',"
                "message='Proces onderbroken; controleer de lijst.' "
                "WHERE status IN ('pending','running')"
            )
            db.execute("UPDATE job_lines SET status='uncertain' WHERE status='inflight'")

    def reserve(self, connection_id: str, export_id: str, lines: list[LineInput]) -> bool:
        if any(line["product_id"] is not None for line in lines):
            hashed: list[Any] = [
                [line["description"], line["product_id"], line["quantity"]] for line in lines
            ]
        else:
            # Text-only exports keep the original hash, so retries across an upgrade still match.
            hashed = [line["description"] for line in lines]
        digest = hashlib.sha256(json.dumps(hashed, ensure_ascii=False).encode()).hexdigest()
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT input_hash FROM jobs WHERE connection_id=? AND export_id=?",
                (connection_id, export_id),
            ).fetchone()
            if row:
                if row["input_hash"] != digest:
                    raise ValueError("Export key already used with other content")
                return False
            db.execute(
                "INSERT INTO jobs VALUES(?,?,?,'pending',NULL)", (connection_id, export_id, digest)
            )
            db.executemany(
                "INSERT INTO job_lines(connection_id,export_id,position,description,status,"
                "product_id,quantity) VALUES(?,?,?,?,'pending',?,?)",
                [
                    (
                        connection_id,
                        export_id,
                        index,
                        line["description"],
                        line["product_id"],
                        line["quantity"],
                    )
                    for index, line in enumerate(lines)
                ],
            )
            return True

    def job(self, connection_id: str, export_id: str) -> dict[str, Any] | None:
        with self.db() as db:
            row = db.execute(
                "SELECT status,message FROM jobs WHERE connection_id=? AND export_id=?",
                (connection_id, export_id),
            ).fetchone()
            if not row:
                return None
            lines = db.execute(
                "SELECT position,description,status,product_id,quantity,target_quantity "
                "FROM job_lines "
                "WHERE connection_id=? AND export_id=? ORDER BY position",
                (connection_id, export_id),
            ).fetchall()
        return {**dict(row), "lines": [dict(line) for line in lines]}

    def set_job(self, connection_id: str, export_id: str, status: str, message: str) -> None:
        with self.db() as db:
            db.execute(
                "UPDATE jobs SET status=?,message=? WHERE connection_id=? AND export_id=?",
                (status, message, connection_id, export_id),
            )

    def set_line(
        self,
        connection_id: str,
        export_id: str,
        position: int,
        status: str,
        target_quantity: int | None = None,
    ) -> None:
        """Status and an optional absolute target are stored in one statement."""
        with self.db() as db:
            db.execute(
                "UPDATE job_lines SET status=?,target_quantity=COALESCE(?,target_quantity) "
                "WHERE connection_id=? AND export_id=? AND position=?",
                (status, target_quantity, connection_id, export_id, position),
            )
