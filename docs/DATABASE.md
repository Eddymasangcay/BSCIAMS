# Database structure (enhanced)

Central registry: **`SeniorCitizens`** (`RecordId`, unique `OscaId`).

## Existing tables (retained)

- `StaffAccounts`, `SeniorCitizens`, `SeniorAilments`
- `OutreachPrograms`, `ProgramEnrollees`
- `AidRequests`, `AidStatusHistory`
- `ActivityLog`, `BackupHistory`, `OfficeConfig`

## Added / extended

- `RolePermissions` — role → permission codes
- `SeniorDocuments` — requirement checklist / verification
- `FollowUpActions` — open operational follow-ups
- `SeniorHealthProfiles`, `HealthAssessments`, `VitalSigns`, `HomeVisits`, `MedicalReferrals`
- `OutreachPrograms.ProgramCategory` — `Administrative` | `Health` (avoids duplicating program tables)
- `ProgramEnrollees.Attended` — attendance flag
- Senior emergency contact / household note columns

Migrations: `database/migrations/001_enhance_rbac_health.sql` applied additively by `db_enhance.apply_schema_enhancements()` during `database.init_db()`.

Health programs reuse `OutreachPrograms` where `ProgramCategory = 'Health'` (also inferred from `ProgramType = 'Health'`).
