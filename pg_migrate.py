"""Versioned PostgreSQL migrations for BSCIAMS.

Applies additive SQL files from database/migrations/ in lexical order.
Records applied IDs in SchemaMigrations. Never drops the database.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent / "database" / "migrations"


def _checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def list_migration_files():
    """Only PostgreSQL migration scripts (*_postgres.sql).

    SQLite-oriented files such as 001_enhance_rbac_health.sql are applied by
    db_enhance for local SQLite and must never run against Postgres.
    """
    if not MIGRATIONS_DIR.is_dir():
        return []
    return sorted(
        p for p in MIGRATIONS_DIR.glob("*_postgres.sql")
        if p.is_file() and not p.name.startswith("_")
    )


def ensure_migration_table(conn):
    conn.raw.execute(
        """
        CREATE TABLE IF NOT EXISTS "SchemaMigrations" (
          "MigrationId"   TEXT PRIMARY KEY,
          "AppliedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "Checksum"      TEXT,
          "Notes"         TEXT
        )
        """
    )


def applied_ids(conn):
    ensure_migration_table(conn)
    rows = conn.raw.execute('SELECT "MigrationId" FROM "SchemaMigrations"').fetchall()
    return {row["MigrationId"] if isinstance(row, dict) else row[0] for row in rows}


def apply_pending_migrations(conn):
    """Apply pending *.sql migrations on a live PostgreSQL connection."""
    if not getattr(conn, "postgres", False):
        return []
    ensure_migration_table(conn)
    done = applied_ids(conn)
    applied = []
    for path in list_migration_files():
        mid = path.stem
        if mid in done:
            continue
        sql = path.read_text(encoding="utf-8")
        # Split on semicolons carefully enough for our migration style
        statements = []
        buf = []
        for line in sql.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("--"):
                continue
            buf.append(line)
            if stripped.endswith(";"):
                statements.append("\n".join(buf).strip().rstrip(";").strip())
                buf = []
        if buf:
            statements.append("\n".join(buf).strip().rstrip(";").strip())
        for stmt in statements:
            if stmt:
                conn.raw.execute(stmt)
        conn.raw.execute(
            """
            INSERT INTO "SchemaMigrations" ("MigrationId", "Checksum", "Notes")
            VALUES (%s, %s, %s)
            ON CONFLICT ("MigrationId") DO NOTHING
            """,
            (mid, _checksum(sql), f"Applied from {path.name}"),
        )
        applied.append(mid)
    return applied


def migration_status(conn):
    files = [p.stem for p in list_migration_files()]
    done = sorted(applied_ids(conn)) if getattr(conn, "postgres", False) else []
    pending = [m for m in files if m not in set(done)]
    return {"applied": done, "pending": pending, "files": files}
