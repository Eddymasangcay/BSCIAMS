"""PostgreSQL backup and restoration for BSCIAMS.

Prefers pg_dump / pg_restore / psql when available. Falls back to a SQL dump
generated through psycopg so Render free instances still get usable backups.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote

import database

BACKUP_DIR = Path(database.DB_DIR) / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


class BackupError(RuntimeError):
    pass


def _now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_dsn():
    url = database._postgres_dsn()
    if not url:
        raise BackupError("DATABASE_URL is not configured. PostgreSQL is required for backups.")
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "dbname": (parsed.path or "/").lstrip("/") or "postgres",
        "url": url,
    }


def _env_with_password(dsn):
    env = os.environ.copy()
    if dsn["password"]:
        env["PGPASSWORD"] = dsn["password"]
    return env


def which_tool(name):
    return shutil.which(name)


def create_postgres_backup(created_by="System"):
    """Create a PostgreSQL backup file and record history.

    Returns dict: id, ts, type, size, by, records, fileName, format, path, method
    """
    if not database.using_postgres():
        raise BackupError("PostgreSQL backups require DATABASE_URL.")

    dsn = _parse_dsn()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_id = f"BK-{uuid.uuid4().hex[:10].upper()}"
    method = "pg_dump"
    path = BACKUP_DIR / f"bsciams-{stamp}-{backup_id}.dump"
    fmt = "custom"

    try:
        if which_tool("pg_dump"):
            cmd = [
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "--no-acl",
                "--dbname", dsn["url"],
                "--file", str(path),
            ]
            # Prefer URL form; also pass discrete args for compatibility
            result = subprocess.run(
                cmd,
                env=_env_with_password(dsn),
                capture_output=True,
                text=True,
                timeout=180,
            )
            if result.returncode != 0:
                raise BackupError(result.stderr.strip() or "pg_dump failed.")
        else:
            method = "psycopg-sql"
            fmt = "sql"
            path = BACKUP_DIR / f"bsciams-{stamp}-{backup_id}.sql"
            _sql_dump_via_psycopg(path)
    except BackupError:
        raise
    except Exception as exc:
        raise BackupError(str(exc)) from exc

    if not path.is_file() or path.stat().st_size < 1:
        raise BackupError("Backup file was not created.")

    store = database.dump_store()
    records = len(store.get("seniors") or []) + len(store.get("programs") or []) + len(store.get("assistance") or [])
    size = path.stat().st_size
    entry = {
        "id": backup_id,
        "ts": _now(),
        "type": "Manual",
        "size": size,
        "by": created_by,
        "records": records,
        "fileName": path.name,
        "format": fmt,
        "path": str(path),
        "method": method,
        "status": "Completed",
    }
    _record_backup(entry)
    return entry


def _sql_dump_via_psycopg(path: Path):
    import psycopg

    with psycopg.connect(database._postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            lines = [
                "-- BSCIAMS PostgreSQL logical backup",
                f"-- CreatedAt: {_now()}",
                "BEGIN;",
                "SET session_replication_role = replica;",
            ]
            for table in tables:
                qtable = '"' + table.replace('"', '""') + '"'
                lines.append(f"\n-- Table {table}")
                lines.append(f"DELETE FROM {qtable};")
                cur.execute(f"SELECT * FROM {qtable}")
                cols = [desc.name for desc in cur.description]
                qcols = ", ".join('"' + c.replace('"', '""') + '"' for c in cols)
                for row in cur.fetchall():
                    values = []
                    for val in row:
                        values.append(_sql_literal(val))
                    lines.append(f"INSERT INTO {qtable} ({qcols}) VALUES ({', '.join(values)});")
            lines.append("SET session_replication_role = DEFAULT;")
            lines.append("COMMIT;")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def restore_postgres_backup(file_name, created_by="System", confirm=False):
    if not confirm:
        raise BackupError("Restoration requires explicit confirmation.")
    if not database.using_postgres():
        raise BackupError("PostgreSQL restore requires DATABASE_URL.")

    path = BACKUP_DIR / Path(file_name).name
    if not path.is_file():
        raise BackupError("Backup file was not found.")

    dsn = _parse_dsn()
    suffix = path.suffix.lower()
    try:
        if suffix == ".dump" and which_tool("pg_restore"):
            cmd = [
                "pg_restore",
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-acl",
                "--dbname", dsn["url"],
                str(path),
            ]
            result = subprocess.run(
                cmd,
                env=_env_with_password(dsn),
                capture_output=True,
                text=True,
                timeout=300,
            )
            # pg_restore may return non-zero with warnings; fail only if stderr looks fatal and db unreachable
            if result.returncode != 0 and "error" in (result.stderr or "").lower():
                raise BackupError(result.stderr.strip() or "pg_restore failed.")
        elif suffix == ".sql":
            if which_tool("psql"):
                cmd = ["psql", dsn["url"], "-v", "ON_ERROR_STOP=1", "-f", str(path)]
                result = subprocess.run(
                    cmd,
                    env=_env_with_password(dsn),
                    capture_output=True,
                    text=True,
                    timeout=300,
                )
                if result.returncode != 0:
                    raise BackupError(result.stderr.strip() or "psql restore failed.")
            else:
                _sql_restore_via_psycopg(path)
        else:
            raise BackupError("Unsupported backup format. Use .dump or .sql.")
    except BackupError:
        raise
    except Exception as exc:
        raise BackupError(str(exc)) from exc

    entry = {
        "id": f"BK-{uuid.uuid4().hex[:10].upper()}",
        "ts": _now(),
        "type": "Restore point",
        "size": path.stat().st_size,
        "by": created_by,
        "records": 0,
        "fileName": path.name,
        "format": suffix.lstrip("."),
        "path": str(path),
        "method": "restore",
        "status": "Restored",
    }
    store = database.dump_store()
    entry["records"] = (
        len(store.get("seniors") or [])
        + len(store.get("programs") or [])
        + len(store.get("assistance") or [])
    )
    _record_backup(entry)
    return entry


def _sql_restore_via_psycopg(path: Path):
    import psycopg

    sql = path.read_text(encoding="utf-8")
    with psycopg.connect(database._postgres_dsn()) as conn:
        conn.execute(sql)
        conn.commit()


def list_backup_files():
    files = []
    for path in sorted(BACKUP_DIR.glob("bsciams-*"), reverse=True):
        if path.is_file():
            files.append({
                "fileName": path.name,
                "size": path.stat().st_size,
                "modifiedAt": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
                "format": path.suffix.lstrip("."),
            })
    return files


def validate_backup_file(file_name):
    path = BACKUP_DIR / Path(file_name).name
    if not path.is_file():
        return {"ok": False, "error": "File not found."}
    size = path.stat().st_size
    if size < 10:
        return {"ok": False, "error": "File is empty or too small."}
    if path.suffix.lower() == ".sql":
        head = path.read_text(encoding="utf-8", errors="ignore")[:400]
        if "BSCIAMS" not in head and "INSERT INTO" not in head and "BEGIN" not in head:
            return {"ok": False, "error": "SQL backup content looks invalid."}
    return {"ok": True, "fileName": path.name, "size": size, "format": path.suffix.lstrip(".")}


def _record_backup(entry):
    with database._WRITE_LOCK, database.connect() as conn:
        conn.execute(
            """
            INSERT INTO BackupHistory (
                BackupId, RanAt, BackupType, FileSize, CreatedBy, RecordCount
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (BackupId) DO UPDATE SET
                RanAt = excluded.RanAt,
                BackupType = excluded.BackupType,
                FileSize = excluded.FileSize,
                CreatedBy = excluded.CreatedBy,
                RecordCount = excluded.RecordCount
            """,
            (
                entry["id"],
                entry["ts"],
                entry["type"],
                entry["size"],
                entry["by"],
                entry["records"],
            ),
        )
        # Optional artifact table (created by migration 002)
        try:
            conn.execute(
                """
                INSERT INTO BackupArtifacts (
                    ArtifactId, BackupId, FileName, FilePath, Format, Status, CreatedAt, CreatedBy, ErrorMessage
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """,
                (
                    f"ART-{uuid.uuid4().hex[:10].upper()}",
                    entry["id"],
                    entry.get("fileName") or "",
                    entry.get("path") or "",
                    entry.get("format") or "sql",
                    entry.get("status") or "Completed",
                    entry["ts"],
                    entry.get("by") or "",
                    "",
                ),
            )
        except Exception:
            pass
