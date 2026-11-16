# BSCIAMS Permissions

Backend enforcement uses `permissions.py` and the `RolePermissions` table.

## Codes

### Senior
- `senior.view`, `senior.create`, `senior.update`, `senior.archive`

### Documents / follow-up / pension
- `document.view`, `document.manage`
- `followup.view`, `followup.manage`
- `pension.view`, `pension.manage`

### Assistance
- `assistance.view`, `assistance.create`, `assistance.approve`, `assistance.release`

### Programs
- `program.view`, `program.create`, `program.update`, `program.archive`
- `beneficiary.manage`

### Health (sensitive)
- `health.view`, `health.create`, `health.update`
- `health.assessment`, `health.vitals`, `health.home_visit`, `health.referral`

### Reports / admin
- `report.view`, `report.export`
- `staff.manage`, `roles.manage`, `audit.view`, `security.view`
- `backup.create`, `backup.restore`, `settings.manage`, `records.overview`

## Default matrix (summary)

| Area | Administrator | Barangay Staff | Health Worker |
|---|---|---|---|
| System admin | Full | — | — |
| Senior write | View only | Full | View only |
| Assistance approve/release | View only | Yes | — |
| Health clinical modules | View | — | Full |
| Programs | View | Administrative | Health category + attendance |

Sensitive health collections are omitted from `GET /api/records` when the caller lacks `health.view`. Unauthorized sections on `PUT /api/records` are restored from the live database instead of being wiped.
