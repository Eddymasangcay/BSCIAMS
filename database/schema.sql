-- BSCIMS office registry
-- SQLite 3 for local use. PostgreSQL uses schema.postgres.sql with the same PascalCase tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS StaffAccounts (
  AccountId       INTEGER PRIMARY KEY AUTOINCREMENT,
  Username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  PasswordHash    TEXT    NOT NULL,
  FullName        TEXT    NOT NULL,
  Role            TEXT    NOT NULL CHECK (Role IN ('Administrator', 'Barangay Staff', 'Health Worker')),
  AccountStatus   TEXT    NOT NULL DEFAULT 'Active' CHECK (AccountStatus IN ('Active', 'Disabled'))
);

CREATE TABLE IF NOT EXISTS RolePermissions (
  RolePermissionId INTEGER PRIMARY KEY AUTOINCREMENT,
  RoleName         TEXT NOT NULL CHECK (RoleName IN ('Administrator', 'Barangay Staff', 'Health Worker')),
  PermissionCode   TEXT NOT NULL,
  UNIQUE (RoleName, PermissionCode)
);

CREATE TABLE IF NOT EXISTS SeniorCitizens (
  RecordId         TEXT PRIMARY KEY,
  OscaId           TEXT NOT NULL UNIQUE,
  FirstName        TEXT NOT NULL,
  MiddleName       TEXT,
  LastName         TEXT NOT NULL,
  Sex              TEXT NOT NULL CHECK (Sex IN ('Female', 'Male')),
  Birthdate        TEXT NOT NULL,
  CivilStatus      TEXT,
  ContactNo        TEXT,
  Purok            TEXT,
  HomeAddress      TEXT,
  PensionType      TEXT,
  IsPwd            INTEGER NOT NULL DEFAULT 0 CHECK (IsPwd IN (0, 1)),
  IsIndigent       INTEGER NOT NULL DEFAULT 0 CHECK (IsIndigent IN (0, 1)),
  LivingStatus     TEXT NOT NULL DEFAULT 'Active' CHECK (LivingStatus IN ('Active', 'Deceased', 'Transferred')),
  Portrait         TEXT,
  IdCardImage      TEXT,
  PensionDistributedAt TEXT,
  EmergencyContactName TEXT,
  EmergencyContactNo   TEXT,
  HouseholdNotes       TEXT,
  DateRegistered   TEXT NOT NULL,
  DateUpdated      TEXT
);

CREATE INDEX IF NOT EXISTS IdxSeniorPurok ON SeniorCitizens (Purok);
CREATE INDEX IF NOT EXISTS IdxSeniorStatus ON SeniorCitizens (LivingStatus);
CREATE INDEX IF NOT EXISTS IdxSeniorName ON SeniorCitizens (LastName, FirstName);

CREATE TABLE IF NOT EXISTS SeniorAilments (
  AilmentId    INTEGER PRIMARY KEY AUTOINCREMENT,
  RecordId     TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  AilmentName  TEXT NOT NULL,
  UNIQUE (RecordId, AilmentName)
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

CREATE TABLE IF NOT EXISTS OutreachPrograms (
  ProgramId       TEXT PRIMARY KEY,
  Title           TEXT NOT NULL,
  ProgramType     TEXT NOT NULL,
  ProgramCategory TEXT NOT NULL DEFAULT 'Administrative' CHECK (ProgramCategory IN ('Administrative', 'Health')),
  EventDate       TEXT NOT NULL,
  StartTime       TEXT,
  Venue           TEXT,
  Description     TEXT,
  SlotLimit       INTEGER,
  IsCancelled     INTEGER NOT NULL DEFAULT 0 CHECK (IsCancelled IN (0, 1)),
  DateCreated     TEXT
);

CREATE TABLE IF NOT EXISTS ProgramEnrollees (
  EnrolleeId  INTEGER PRIMARY KEY AUTOINCREMENT,
  ProgramId   TEXT NOT NULL REFERENCES OutreachPrograms (ProgramId) ON DELETE CASCADE,
  RecordId    TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  Attended    INTEGER NOT NULL DEFAULT 0 CHECK (Attended IN (0, 1)),
  UNIQUE (ProgramId, RecordId)
);

CREATE TABLE IF NOT EXISTS AidRequests (
  RequestId       TEXT PRIMARY KEY,
  RecordId        TEXT NOT NULL REFERENCES SeniorCitizens (RecordId) ON DELETE CASCADE,
  AidType         TEXT NOT NULL,
  Amount          REAL NOT NULL CHECK (Amount >= 0),
  Purpose         TEXT,
  Remarks         TEXT,
  RequestStatus   TEXT NOT NULL,
  DateFiled       TEXT NOT NULL,
  DateUpdated     TEXT,
  HandledBy       TEXT
);

CREATE INDEX IF NOT EXISTS IdxAidStatus ON AidRequests (RequestStatus);
CREATE INDEX IF NOT EXISTS IdxAidFiled ON AidRequests (DateFiled);

CREATE TABLE IF NOT EXISTS AidStatusHistory (
  HistoryId       INTEGER PRIMARY KEY AUTOINCREMENT,
  RequestId       TEXT NOT NULL REFERENCES AidRequests (RequestId) ON DELETE CASCADE,
  RequestStatus   TEXT NOT NULL,
  LoggedAt        TEXT NOT NULL,
  LoggedBy        TEXT,
  Notes           TEXT
);

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

CREATE TABLE IF NOT EXISTS ActivityLog (
  LogId        TEXT PRIMARY KEY,
  LoggedAt     TEXT NOT NULL,
  ActorName    TEXT,
  ActorRole    TEXT,
  ActionType   TEXT NOT NULL,
  ModuleName   TEXT,
  Details      TEXT,
  Severity     TEXT,
  IpAddress    TEXT
);

CREATE INDEX IF NOT EXISTS IdxActivityTime ON ActivityLog (LoggedAt);

CREATE TABLE IF NOT EXISTS BackupHistory (
  BackupId      TEXT PRIMARY KEY,
  RanAt         TEXT NOT NULL,
  BackupType    TEXT,
  FileSize      INTEGER,
  CreatedBy     TEXT,
  RecordCount   INTEGER
);

CREATE TABLE IF NOT EXISTS OfficeConfig (
  ConfigId              INTEGER PRIMARY KEY CHECK (ConfigId = 1),
  AutoBackup            INTEGER NOT NULL DEFAULT 1 CHECK (AutoBackup IN (0, 1)),
  BackupFrequency       TEXT NOT NULL DEFAULT 'Daily',
  LogRetention          TEXT NOT NULL DEFAULT '30',
  InAppNotices          INTEGER NOT NULL DEFAULT 1 CHECK (InAppNotices IN (0, 1)),
  EmailAlerts           INTEGER NOT NULL DEFAULT 0 CHECK (EmailAlerts IN (0, 1)),
  TwoFactor             INTEGER NOT NULL DEFAULT 0 CHECK (TwoFactor IN (0, 1)),
  SessionMinutes        TEXT NOT NULL DEFAULT '30',
  StoreVersion          INTEGER NOT NULL DEFAULT 3,
  SeededAt              TEXT,
  ImportedFromBrowser   INTEGER NOT NULL DEFAULT 0 CHECK (ImportedFromBrowser IN (0, 1))
);
