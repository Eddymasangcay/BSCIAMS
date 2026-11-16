-- Non-destructive enhancement migration (SQLite).
-- Applied by database.apply_migrations(); safe to re-run via IF NOT EXISTS / column checks.

CREATE TABLE IF NOT EXISTS RolePermissions (
  RolePermissionId INTEGER PRIMARY KEY AUTOINCREMENT,
  RoleName         TEXT NOT NULL CHECK (RoleName IN ('Administrator', 'Barangay Staff', 'Health Worker')),
  PermissionCode   TEXT NOT NULL,
  UNIQUE (RoleName, PermissionCode)
);

CREATE TABLE IF NOT EXISTS SeniorDocuments (
  DocumentId      TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  DocumentType    TEXT NOT NULL,
  DocumentStatus  TEXT NOT NULL DEFAULT 'Missing' CHECK (DocumentStatus IN ('Missing', 'Submitted', 'Verified', 'Rejected')),
  SubmittedAt     TEXT,
  VerifiedAt      TEXT,
  VerifiedBy      TEXT,
  Remarks         TEXT,
  DateUpdated     TEXT
);

CREATE INDEX IF NOT EXISTS IdxDocSenior ON SeniorDocuments (RecordId);
CREATE INDEX IF NOT EXISTS IdxDocStatus ON SeniorDocuments (DocumentStatus);

CREATE TABLE IF NOT EXISTS FollowUpActions (
  FollowUpId      TEXT PRIMARY KEY,
  RecordId        TEXT REFERENCES SeniorCitizens (RecordId) ON DELETE SET NULL,
  RelatedModule   TEXT NOT NULL,
  RelatedId       TEXT,
  Title           TEXT NOT NULL,
  FollowUpStatus  TEXT NOT NULL DEFAULT 'Open' CHECK (FollowUpStatus IN ('Open', 'In Progress', 'Resolved', 'Cancelled')),
  DueDate         TEXT,
  AssignedTo      TEXT,
  Notes           TEXT,
  DateCreated     TEXT NOT NULL,
  DateUpdated     TEXT,
  ResolvedAt      TEXT
);

CREATE INDEX IF NOT EXISTS IdxFollowUpStatus ON FollowUpActions (FollowUpStatus);

CREATE TABLE IF NOT EXISTS SeniorHealthProfiles (
  ProfileId       TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL UNIQUE REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  BloodType       TEXT,
  Allergies       TEXT,
  MedicalHistory  TEXT,
  CurrentMeds     TEXT,
  MobilityNotes   TEXT,
  CareNotes       TEXT,
  UpdatedBy       TEXT,
  DateCreated     TEXT NOT NULL,
  DateUpdated     TEXT
);

CREATE TABLE IF NOT EXISTS HealthAssessments (
  AssessmentId    TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  AssessedAt      TEXT NOT NULL,
  AssessedBy      TEXT,
  GeneralStatus   TEXT,
  Findings        TEXT,
  Recommendations TEXT,
  FollowUpNeeded  INTEGER NOT NULL DEFAULT 0 CHECK (FollowUpNeeded IN (0, 1)),
  DateCreated     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS IdxAssessmentSenior ON HealthAssessments (RecordId);

CREATE TABLE IF NOT EXISTS VitalSigns (
  VitalId         TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  MeasuredAt      TEXT NOT NULL,
  MeasuredBy      TEXT,
  Systolic        REAL,
  Diastolic       REAL,
  PulseRate       REAL,
  TemperatureC    REAL,
  WeightKg        REAL,
  BloodSugar      REAL,
  OxygenSat       REAL,
  Remarks         TEXT,
  DateCreated     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS IdxVitalsSenior ON VitalSigns (RecordId);

CREATE TABLE IF NOT EXISTS HomeVisits (
  VisitId         TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  ScheduledAt     TEXT,
  CompletedAt     TEXT,
  AssignedTo      TEXT,
  VisitStatus     TEXT NOT NULL DEFAULT 'Scheduled' CHECK (VisitStatus IN ('Scheduled', 'Completed', 'Cancelled', 'Missed')),
  Observations    TEXT,
  FollowUpActions TEXT,
  DateCreated     TEXT NOT NULL,
  DateUpdated     TEXT
);

CREATE INDEX IF NOT EXISTS IdxVisitStatus ON HomeVisits (VisitStatus);

CREATE TABLE IF NOT EXISTS MedicalReferrals (
  ReferralId      TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  ReferredAt      TEXT NOT NULL,
  ReferredBy      TEXT,
  Destination     TEXT NOT NULL,
  Reason          TEXT,
  ReferralStatus  TEXT NOT NULL DEFAULT 'Pending' CHECK (ReferralStatus IN ('Pending', 'Completed', 'Cancelled')),
  FollowUpNotes   TEXT,
  DateUpdated     TEXT
);

CREATE INDEX IF NOT EXISTS IdxReferralStatus ON MedicalReferrals (ReferralStatus);
