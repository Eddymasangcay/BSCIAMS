-- Track applied PostgreSQL migrations (additive, safe to re-run via IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "SchemaMigrations" (
  "MigrationId"   TEXT PRIMARY KEY,
  "AppliedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "Checksum"      TEXT,
  "Notes"         TEXT
);

CREATE TABLE IF NOT EXISTS "BackupArtifacts" (
  "ArtifactId"    TEXT PRIMARY KEY,
  "BackupId"      TEXT REFERENCES "BackupHistory" ("BackupId") ON DELETE SET NULL,
  "FileName"      TEXT NOT NULL,
  "FilePath"      TEXT NOT NULL,
  "Format"        TEXT NOT NULL DEFAULT 'sql',
  "Status"        TEXT NOT NULL DEFAULT 'Completed'
    CHECK ("Status" IN ('Completed', 'Failed', 'Validated', 'Restored')),
  "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "CreatedBy"     TEXT,
  "ErrorMessage"  TEXT
);

CREATE INDEX IF NOT EXISTS "IdxBackupArtifactsCreated" ON "BackupArtifacts" ("CreatedAt");
