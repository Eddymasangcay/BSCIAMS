# BSCIAMS (Experimental Enhancement)

**Barangay Senior Citizen Information and Assistance Management System** — experimental development build with separate Administrator, Barangay Staff, and Health Worker workspaces, backend-enforced permissions, and extended health/document modules.

> This repository is the **enhanced experimental copy**. The original trial project remains separate and should not be overwritten by this work.

## Stack

- **Backend:** Flask (`server.py`) with session authentication
- **Database:** SQLite locally (`database/bscims.db`) or PostgreSQL via `DATABASE_URL`
- **Frontend:** HTML/CSS/JS office UI (`html/`, `css/`, `js/`)
- **Shared API:** both web and any future desktop shell should call the same Flask endpoints (no direct DB access from clients)

## Quick start (Windows)

```powershell
cd "F:\Windows Files\Desktop\PROJECTS\BSCIAMS-Enhanced"
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
py -3 server.py
```

Open `http://127.0.0.1:5000`.

On first run the app applies additive migrations, seeds role permissions, and (if empty) demo staff accounts.

## Demo accounts (change for production)

| Username | Password | Role |
|---|---|---|
| emasangcay | Admin@123 | Administrator |
| jencampi | Admin@123 | Administrator |
| jecab | Staff@123 | Barangay Staff |
| kmorta | Staff@123 | Barangay Staff |
| vrosalita | Health@123 | Health Worker |

## Role workspaces

### Administrator
Staff Accounts, Role & Permissions, Audit Trail, Security Monitoring, Backup & Settings, Office Records Overview (read-only ops), Reports.

Administrators do **not** receive unrestricted write access to senior/assistance/health operational records by default.

### Barangay Staff
Senior Registry, Document Verification, Assistance, Pension Monitoring (recordkeeping only), Programs & Events, Beneficiaries, Follow-ups, Senior ID, Reports.

### Health Worker
Health Dashboard, Health Profiles, Assessments, Vital Signs, Home Visits, Referrals, Health Programs/Attendance, Health Reports.

Health modules are **documentation tools only** — not for diagnosis or prescribing. Health Workers do not receive assistance approve/release permissions by default.

## Permissions

Granular codes (examples): `senior.view`, `senior.create`, `assistance.approve`, `health.vitals`, `staff.manage`, `backup.restore`, …

- Defaults live in `permissions.py` and are seeded into `RolePermissions`
- Admins can adjust grants under **Role & Permissions** (`PUT /api/permissions/<role>`)
- Navigation is filtered in the UI; **page routes and `/api/records` are enforced on the server**

## Environment

See `.env.example`:

- `FLASK_SECRET_KEY` — required for shared/deployed environments
- `DATABASE_URL` — optional PostgreSQL
- `PORT` / `RENDER` — hosting helpers

SQLite database files are gitignored. Ship schema via `database/schema.sql` / `schema.postgres.sql` and migrations under `database/migrations/`.

## Architecture notes

```
Web UI ──┐
         ├── Flask API (auth + RBAC) ── SQLite / PostgreSQL
Desktop ─┘  (future shell; same API)
```

Desktop support in this experimental pass means: keep one centralized backend and database. A native/Electron client is out of scope; a future desktop shell should authenticate against `/api/auth/*` and use `/api/records` (and permission APIs) instead of embedding DB credentials.

## Testing checklist (smoke)

1. Login/logout for each role; Health Worker lands on `/HealthDashboard`
2. Direct URL to another role’s page redirects home
3. Staff can open Document Verification; Health Profiles redirects away
4. Health Worker can open Health Profiles; Assistance redirects away
5. Admin cannot wipe seniors via `PUT /api/records` without write grants
6. Role & Permissions page loads and saves for Administrators
7. Existing Senior Registry / Assistance / Programs still load with preserved sample data

Automated smoke (from project root):

```powershell
py -3 -c "from server import app; c=app.test_client(); print(c.post('/api/auth/login', json={'username':'jecab','password':'Staff@123'}).status_code)"
```

## Known limitations

- No native desktop application binary yet
- Some newer module forms use lightweight prompts for speed of demonstration; polish to full modals as needed
- Backup/restore remains file/settings oriented as in the prior build
- Seed passwords are for instructor evaluation only

## License / academic use

Prepared as an experimental enhancement for course evaluation before instructor approval of the proposed system structure.
