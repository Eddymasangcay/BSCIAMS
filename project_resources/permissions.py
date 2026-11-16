"""Role-based permission codes and defaults for BSCIAMS.

Frontend navigation uses the same codes. Backend enforcement is authoritative.
"""

from __future__ import annotations

ALL_PERMISSIONS = (
    # Senior registry
    "senior.view",
    "senior.create",
    "senior.update",
    "senior.archive",
    # Documents / follow-ups / pension monitoring (staff ops)
    "document.view",
    "document.manage",
    "followup.view",
    "followup.manage",
    "pension.view",
    "pension.manage",
    # Assistance
    "assistance.view",
    "assistance.create",
    "assistance.approve",
    "assistance.release",
    # Programs (administrative + health category filtering)
    "program.view",
    "program.create",
    "program.update",
    "program.archive",
    "beneficiary.manage",
    # Health (sensitive)
    "health.view",
    "health.create",
    "health.update",
    "health.assessment",
    "health.vitals",
    "health.home_visit",
    "health.referral",
    # Reports
    "report.view",
    "report.export",
    # Administration
    "staff.manage",
    "roles.manage",
    "audit.view",
    "security.view",
    "backup.create",
    "backup.restore",
    "settings.manage",
    "records.overview",
)

# Default matrix: Administrator is supervisory (mostly read on ops + full system admin).
DEFAULT_ROLE_PERMISSIONS = {
    "Administrator": [
        "senior.view",
        "document.view",
        "followup.view",
        "pension.view",
        "assistance.view",
        "program.view",
        "health.view",
        "report.view",
        "report.export",
        "staff.manage",
        "roles.manage",
        "audit.view",
        "security.view",
        "backup.create",
        "backup.restore",
        "settings.manage",
        "records.overview",
    ],
    "Barangay Staff": [
        "senior.view",
        "senior.create",
        "senior.update",
        "senior.archive",
        "document.view",
        "document.manage",
        "followup.view",
        "followup.manage",
        "pension.view",
        "pension.manage",
        "assistance.view",
        "assistance.create",
        "assistance.approve",
        "assistance.release",
        "program.view",
        "program.create",
        "program.update",
        "program.archive",
        "beneficiary.manage",
        "report.view",
        "report.export",
    ],
    "Health Worker": [
        "senior.view",
        "program.view",
        "program.create",
        "program.update",
        "beneficiary.manage",
        "health.view",
        "health.create",
        "health.update",
        "health.assessment",
        "health.vitals",
        "health.home_visit",
        "health.referral",
        "report.view",
        "report.export",
    ],
}

# Office HTML pages -> required permission (any one grants access).
PAGE_PERMISSIONS = {
    "Dashboard": ["senior.view", "health.view", "records.overview", "report.view"],
    "AdminDashboard": ["staff.manage", "audit.view", "records.overview", "security.view"],
    "ReportsAnalytics": ["report.view"],
    "SeniorRegistry": ["senior.view"],
    "PrintSeniorId": ["senior.view"],
    "ProgramManagement": ["program.view"],
    "AssistanceManagement": ["assistance.view"],
    "DocumentVerification": ["document.view"],
    "PensionMonitoring": ["pension.view"],
    "FollowUpManagement": ["followup.view"],
    "BeneficiaryManagement": ["beneficiary.manage", "program.view"],
    "HealthDashboard": ["health.view"],
    "HealthProfiles": ["health.view"],
    "HealthAssessments": ["health.assessment", "health.view"],
    "VitalSigns": ["health.vitals", "health.view"],
    "HomeVisits": ["health.home_visit", "health.view"],
    "MedicalReferrals": ["health.referral", "health.view"],
    "HealthPrograms": ["program.view", "health.view"],
    "HealthReports": ["report.view", "health.view"],
    "AuditTrail": ["audit.view"],
    "SecurityMonitoring": ["security.view", "audit.view"],
    "StaffAccounts": ["staff.manage"],
    "RolePermissions": ["roles.manage"],
    "DatabaseBackup": ["backup.create", "settings.manage"],
    "OfficeRecords": ["records.overview", "senior.view"],
}

# Store sections and write permissions needed to mutate them via PUT /api/records.
STORE_WRITE_RULES = {
    "seniors": ("senior.create", "senior.update", "senior.archive"),
    "programs": ("program.create", "program.update", "program.archive"),
    "assistance": ("assistance.create", "assistance.approve", "assistance.release"),
    "documents": ("document.manage",),
    "followups": ("followup.manage",),
    "healthProfiles": ("health.create", "health.update"),
    "healthAssessments": ("health.assessment",),
    "vitalSigns": ("health.vitals",),
    "homeVisits": ("health.home_visit",),
    "medicalReferrals": ("health.referral",),
    "backups": ("backup.create",),
    "settings": ("settings.manage",),
    "logs": ("audit.view",),  # clients may append via activity; bulk replace needs audit
}

SENSITIVE_STORE_KEYS = (
    "healthProfiles",
    "healthAssessments",
    "vitalSigns",
    "homeVisits",
    "medicalReferrals",
)


def role_has_permission(role: str, permission: str, granted: set[str] | None = None) -> bool:
    if not role or not permission:
        return False
    codes = granted if granted is not None else set(DEFAULT_ROLE_PERMISSIONS.get(role, []))
    if "*" in codes:
        return True
    return permission in codes


def role_has_any(role: str, permissions, granted: set[str] | None = None) -> bool:
    return any(role_has_permission(role, p, granted) for p in permissions)


def page_allowed(role: str, page: str, granted: set[str] | None = None) -> bool:
    needed = PAGE_PERMISSIONS.get(page)
    if not needed:
        return False
    return role_has_any(role, needed, granted)


def filter_store_for_role(store: dict, role: str, granted: set[str] | None = None) -> dict:
    """Return a copy of the office store with unauthorized sensitive sections removed."""
    out = dict(store)
    if not role_has_permission(role, "health.view", granted):
        for key in SENSITIVE_STORE_KEYS:
            out.pop(key, None)
        # Strip detailed conditions from seniors for non-health viewers who also lack senior health context
        # Keep SeniorAilments list on registry for staff who manage seniors; only strip deep health modules.
    if not role_has_any(role, ("document.view", "document.manage"), granted):
        out.pop("documents", None)
    if not role_has_any(role, ("followup.view", "followup.manage"), granted):
        out.pop("followups", None)
    if not role_has_any(role, ("assistance.view", "assistance.create"), granted):
        # Admin/staff overview may still see assistance; if no view, hide
        if not role_has_permission(role, "records.overview", granted):
            out["assistance"] = []
    if not role_has_any(role, ("backup.create", "backup.restore", "settings.manage"), granted):
        out.pop("backups", None)
        # settings still returned as read-only session timeout for UI; strip write-sensitive flags later if needed
    if not role_has_permission(role, "audit.view", granted):
        out["logs"] = []
    return out


def unauthorized_store_writes(payload: dict, existing: dict, role: str, granted: set[str] | None = None):
    """Return list of section names the role may not mutate."""
    blocked = []
    for section, perms in STORE_WRITE_RULES.items():
        if section not in payload:
            continue
        new_val = payload.get(section)
        old_val = existing.get(section)
        if new_val == old_val:
            continue
        # Normalize empty defaults
        if new_val is None:
            continue
        if section == "logs" and isinstance(new_val, list) and isinstance(old_val, list):
            # Allow append-only growth without audit.view write; bulk shrink/replace needs audit
            if len(new_val) >= len(old_val):
                continue
        if not role_has_any(role, perms, granted):
            blocked.append(section)
    return blocked
