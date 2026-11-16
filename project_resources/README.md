# Project resources

Supporting and backend library files for BSCIAMS.

| Item | Description |
|---|---|
| `database.py` | PostgreSQL/SQLite storage layer |
| `db_enhance.py` | Schema enhancements and extended collections |
| `permissions.py` | RBAC codes and page rules |
| `pg_migrate.py` | Versioned PostgreSQL migrations |
| `pg_backup.py` | PostgreSQL backup/restore helpers |
| `requirements.txt` | Python dependencies |
| `Procfile` | Gunicorn process definition (uses `--chdir ..`) |
| `RENDER_DEPLOYMENT_GUIDE.md` | Render dashboard settings |
| `docs/` | PostgreSQL, permissions, database, and UI notes |

Flask entry point: repository root `server.py` (adds this folder to `sys.path`).  
Data schemas and migrations: repository root `database/`.
