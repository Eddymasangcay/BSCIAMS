# PostgreSQL (required primary database)

BSCIAMS uses **PostgreSQL** as the centralized relational database for all three workspaces (Administrator, Barangay Staff, Health Worker).

## Version and driver

| Item | Value |
|---|---|
| DBMS | PostgreSQL |
| Python driver | `psycopg` (v3, binary) |
| Connection | `DATABASE_URL` environment variable |
| SSL | On Render (`RENDER=true`), `sslmode=require` is appended when missing. For local Postgres, set `sslmode` in `DATABASE_URL` if needed (e.g. `sslmode=disable`). |
| Schema files | `database/schema.postgres.sql` |
| Migrations | `database/migrations/*.sql` via `project_resources/pg_migrate.py` |

Developed/tested against PostgreSQL 14+ (Render managed Postgres). Local SQLite is only an offline trial fallback when `DATABASE_URL` is unset, `ALLOW_SQLITE=1` is set, and the app is **not** running on Render.

## Required environment

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
FLASK_SECRET_KEY=long-random-secret
RENDER=true
REQUIRE_POSTGRES=true
```

Never put database credentials in frontend or desktop client code.

## Initialization

1. Provision a PostgreSQL database (local or Render).
2. Set `DATABASE_URL`.
3. Start the app: `gunicorn server:app` or `py -3 server.py`.
4. On startup, `database.init_db()`:
   - Applies `schema.postgres.sql` (`CREATE IF NOT EXISTS`)
   - Runs additive enhancements (`db_enhance`)
   - Applies pending files from `database/migrations/` into `SchemaMigrations`
   - Seeds staff accounts and default role permissions when empty

## Migration commands

Migrations are applied automatically at process start.

To inspect status (authenticated API):

```http
GET /api/db/status
```

Migration files live in `database/migrations/` and are applied in lexical order. They are additive (no drop-database recreates).

## Backup and restore

| Action | API | Tools |
|---|---|---|
| Create backup | `POST /api/db/backup` | `pg_dump` when available, else SQL dump via psycopg |
| List files | `GET /api/db/backups` | Files under `database/backups/` |
| Validate | `POST /api/db/backups/validate` | Size/content checks |
| Restore | `POST /api/db/restore` `{ "fileName": "...", "confirm": true }` | `pg_restore` / `psql` / psycopg |

Backup history is stored in `BackupHistory` (and `BackupArtifacts` when migration 002 has run).

**Important:** Test restores on a separate database before using them against production data.

## Security

- Credentials only via environment variables
- Parameterized queries (`%s` / `?` adapted by the connection wrapper)
- Application RBAC enforced in Flask before store mutations
- Prefer a least-privilege DB user (not a superuser) for the app role

## Entity relationship overview

```mermaid
erDiagram
  StaffAccounts ||--o{ RolePermissions : assigns
  SeniorCitizens ||--o{ SeniorAilments : has
  SeniorCitizens ||--o{ SeniorDocuments : submits
  SeniorCitizens ||--o{ AidRequests : requests
  AidRequests ||--o{ AidStatusHistory : tracks
  SeniorCitizens ||--o{ ProgramEnrollees : enrolls
  OutreachPrograms ||--o{ ProgramEnrollees : includes
  SeniorCitizens ||--o| SeniorHealthProfiles : profile
  SeniorCitizens ||--o{ HealthAssessments : assessed
  SeniorCitizens ||--o{ VitalSigns : measured
  SeniorCitizens ||--o{ HomeVisits : visited
  SeniorCitizens ||--o{ MedicalReferrals : referred
  SeniorCitizens ||--o{ FollowUpActions : followups
  BackupHistory ||--o{ BackupArtifacts : files
```

`SeniorCitizens.RecordId` is the central identity key for assistance, programs, health, documents, and follow-ups.
