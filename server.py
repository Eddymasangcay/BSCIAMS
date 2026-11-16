"""BSCIAMS web server.

Serves role workspaces, enforces backend permissions, and stores office records
in PostgreSQL (required centralized database via DATABASE_URL).
"""

import os
import sys
from datetime import timedelta

from urllib.parse import urlparse

from flask import Flask, jsonify, redirect, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
RESOURCES_DIR = os.path.join(BASE_DIR, "project_resources")
if RESOURCES_DIR not in sys.path:
    sys.path.insert(0, RESOURCES_DIR)

import database
import db_enhance
import permissions

HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

_flask_secret = os.environ.get("FLASK_SECRET_KEY")
_is_production = (
    os.environ.get("RENDER") == "true"
    or os.environ.get("FLASK_ENV") == "production"
    or os.environ.get("ENV") == "production"
)
if _is_production and not _flask_secret:
    raise RuntimeError(
        "FLASK_SECRET_KEY must be set in production. "
        "Configure a long random secret via environment variable."
    )
app.secret_key = _flask_secret or "bscims-local-dev-only-not-for-production"

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RENDER") == "true",
    SESSION_COOKIE_PATH="/",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
)

database.init_db()

PUBLIC_API = {
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/activity",
}

OFFICE_PAGES = frozenset(permissions.PAGE_PERMISSIONS.keys())


def _office_name(path):
    name = path.strip("/")
    if name.startswith("html/"):
        name = name[5:]
    if name.endswith(".html"):
        name = name[:-5]
    return name


def _redirect_keep_query(path):
    query = request.query_string.decode("utf-8")
    if query:
        return redirect(f"{path}?{query}")
    return redirect(path)


def _send_html(directory, filename):
    response = send_from_directory(directory, filename)
    response.headers["Cache-Control"] = "no-store"
    return response


def _origin_allowed():
    origin = request.headers.get("Origin")
    if not origin:
        return True
    origin_host = (urlparse(origin).hostname or "").lower()
    request_host = (request.host or "").split(":")[0].lower()
    return bool(origin_host) and origin_host == request_host


def _require_login():
    if "user" not in session:
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    return None


def _current_account():
    user = session.get("user") or {}
    return database.get_staff(user.get("username"))


def _granted():
    account = _current_account()
    if not account:
        return set()
    return db_enhance.permission_set_for(account["role"])


def _require_permission(*codes):
    blocked = _require_login()
    if blocked:
        return blocked
    account = _current_account()
    if not account or account["status"] != "Active":
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    granted = db_enhance.permission_set_for(account["role"])
    if not permissions.role_has_any(account["role"], codes, granted):
        return jsonify(ok=False, errors={"form": "You do not have permission for this action."}), 403
    return None


def _require_admin_staff_manage():
    return _require_permission("staff.manage")


def _workspace_home(role):
    if role == "Health Worker":
        return "/HealthDashboard"
    if role == "Administrator":
        return "/AdminDashboard"
    return "/Dashboard"


def _merge_protected_sections(payload, existing, role, granted):
    """Keep unseen/unwritable sections from the live store so PUT cannot wipe them."""
    merged = dict(payload)
    protected = (
        "documents",
        "followups",
        "healthProfiles",
        "healthAssessments",
        "vitalSigns",
        "homeVisits",
        "medicalReferrals",
        "backups",
        "settings",
        "logs",
        "seniors",
        "programs",
        "assistance",
    )
    for section in protected:
        write_perms = permissions.STORE_WRITE_RULES.get(section)
        if not write_perms:
            continue
        can_write = permissions.role_has_any(role, write_perms, granted)
        if section not in merged or not can_write:
            if section in existing:
                merged[section] = existing[section]
    # Preserve version/seededAt if omitted
    merged.setdefault("version", existing.get("version", 3))
    merged.setdefault("seededAt", existing.get("seededAt"))
    return merged


@app.before_request
def guard_request():
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not _origin_allowed():
        return jsonify(ok=False, errors={"form": "This request was blocked."}), 403

    page = _office_name(request.path)
    if page in OFFICE_PAGES:
        if "user" not in session:
            return redirect("/OfficeLanding")
        account = _current_account()
        if not account or account["status"] != "Active":
            session.clear()
            session.modified = True
            return redirect("/OfficeLanding?signedout=1")
        granted = db_enhance.permission_set_for(account["role"])
        if not permissions.page_allowed(account["role"], page, granted):
            return redirect(_workspace_home(account["role"]))

    if "user" in session and request.path.startswith("/api/"):
        account = _current_account()
        if not account or account["status"] != "Active":
            session.clear()
            session.modified = True
            return jsonify(ok=False, errors={"form": "Please sign in."}), 401

    if request.path.startswith("/api/") and request.path not in PUBLIC_API:
        blocked = _require_login()
        if blocked:
            return blocked
    return None


@app.get("/")
@app.get("/OfficeLanding")
@app.post("/OfficeLanding")
def login_page():
    return _send_html(BASE_DIR, "OfficeLanding.html")


@app.get("/OfficeLanding.html")
@app.get("/Main.html")
def login_page_legacy():
    return _redirect_keep_query("/OfficeLanding")


@app.get("/css/<path:filename>")
def styles(filename):
    if not filename.endswith(".css"):
        return ("Not found", 404)
    return _send_html(CSS_DIR, filename)


@app.get("/js/<path:filename>")
def scripts(filename):
    if not filename.endswith(".js"):
        return ("Not found", 404)
    return _send_html(JS_DIR, filename)


@app.get("/html/<path:filename>")
def pages_legacy(filename):
    name = _office_name(filename)
    if name in OFFICE_PAGES:
        return _redirect_keep_query(f"/{name}")
    return ("Not found", 404)


@app.get("/<name>")
def office_page(name):
    if name.endswith(".html"):
        stem = name[:-5]
        if stem == "OfficeLanding":
            return _redirect_keep_query("/OfficeLanding")
        if stem in OFFICE_PAGES:
            return _redirect_keep_query(f"/{stem}")
        return ("Not found", 404)
    if name not in OFFICE_PAGES:
        return ("Not found", 404)
    return _send_html(HTML_DIR, f"{name}.html")


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    account = database.authenticate(data.get("username"), data.get("password"))
    if account and account.get("disabled"):
        return jsonify(ok=False, errors={"form": "This account is disabled. Contact your administrator."}), 403
    if not account:
        return jsonify(ok=False, errors={"form": "Invalid username or password."}), 401
    session.clear()
    granted = db_enhance.permission_set_for(account["role"])
    session["user"] = {
        "username": account["username"],
        "name": account["name"],
        "role": account["role"],
        "permissions": sorted(granted),
        "home": _workspace_home(account["role"]),
    }
    session.permanent = bool(data.get("remember"))
    return jsonify(ok=True, user=session["user"])


@app.post("/api/auth/logout")
def logout():
    session.clear()
    session.modified = True
    response = jsonify(ok=True)
    response.delete_cookie(
        app.config.get("SESSION_COOKIE_NAME", "session"),
        path=app.config.get("SESSION_COOKIE_PATH") or "/",
        secure=bool(app.config.get("SESSION_COOKIE_SECURE")),
        httponly=True,
        samesite=app.config.get("SESSION_COOKIE_SAMESITE") or "Lax",
    )
    return response


@app.get("/api/auth/me")
def current_user():
    user = session.get("user")
    if not user:
        return jsonify(ok=False), 401
    account = database.get_staff(user.get("username"))
    if not account or account["status"] != "Active":
        session.clear()
        session.modified = True
        return jsonify(ok=False), 401
    granted = db_enhance.permission_set_for(account["role"])
    live = {
        "username": account["username"],
        "name": account["name"],
        "role": account["role"],
        "permissions": sorted(granted),
        "home": _workspace_home(account["role"]),
    }
    session["user"] = live
    return jsonify(ok=True, user=live)


@app.get("/api/records")
def get_records():
    account = _current_account()
    if not account:
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    granted = db_enhance.permission_set_for(account["role"])
    store = database.dump_store()
    filtered = permissions.filter_store_for_role(store, account["role"], granted)
    if permissions.role_has_permission(account["role"], "health.view", granted):
        database.append_activity(
            {
                "action": "Access",
                "module": "Health Records",
                "details": f"{account['name']} viewed health-related office records",
                "user": account["name"],
                "role": account["role"],
                "severity": "Info",
            },
            ip=request.remote_addr,
        )
    return jsonify(filtered)


@app.put("/api/records")
def put_records():
    account = _current_account()
    if not account:
        return jsonify(ok=False, errors={"form": "Please sign in."}), 401
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify(ok=False, errors={"form": "Invalid record payload."}), 400
    granted = db_enhance.permission_set_for(account["role"])
    existing = database.dump_store()
    blocked = permissions.unauthorized_store_writes(payload, existing, account["role"], granted)
    # Ignore blocked sections by restoring existing values instead of hard-failing partial UI saves
    if blocked:
        for section in blocked:
            if section in existing:
                payload[section] = existing[section]
    payload = _merge_protected_sections(payload, existing, account["role"], granted)
    still_blocked = permissions.unauthorized_store_writes(payload, existing, account["role"], granted)
    if still_blocked:
        return jsonify(
            ok=False,
            errors={"form": f"You cannot modify: {', '.join(still_blocked)}."},
        ), 403
    try:
        store = database.load_store(payload, imported=False)
    except database.StoreError as exc:
        return jsonify(ok=False, errors={"form": str(exc)}), 400
    filtered = permissions.filter_store_for_role(store, account["role"], granted)
    return jsonify(ok=True, store=filtered)


@app.get("/api/permissions")
def permissions_matrix():
    blocked = _require_permission("roles.manage")
    if blocked:
        return blocked
    return jsonify(
        ok=True,
        permissions=list(permissions.ALL_PERMISSIONS),
        roles=db_enhance.get_role_permissions(),
        defaults=permissions.DEFAULT_ROLE_PERMISSIONS,
    )


@app.put("/api/permissions/<role>")
def permissions_update(role):
    blocked = _require_permission("roles.manage")
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    codes = data.get("permissions")
    if not isinstance(codes, list):
        return jsonify(ok=False, errors={"form": "Permissions must be a list."}), 400
    try:
        matrix = db_enhance.set_role_permissions(role, codes)
    except ValueError as exc:
        return jsonify(ok=False, errors={"form": str(exc)}), 400
    account = _current_account()
    database.append_activity(
        {
            "action": "Update",
            "module": "Role & Permissions",
            "details": f"Updated permissions for {role}",
            "user": account["name"],
            "role": account["role"],
            "severity": "Warning",
        },
        ip=request.remote_addr,
    )
    return jsonify(ok=True, role=role, permissions=matrix)


@app.get("/api/staff")
def staff_list():
    blocked = _require_admin_staff_manage()
    if blocked:
        return blocked
    return jsonify(ok=True, staff=database.list_staff())


@app.post("/api/staff")
def staff_create():
    blocked = _require_admin_staff_manage()
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(ok=False, errors={"form": "Invalid staff payload."}), 400
    try:
        account = database.create_staff(
            data.get("username"),
            data.get("password"),
            data.get("name"),
            data.get("role"),
        )
    except database.StaffError as exc:
        return jsonify(ok=False, errors=exc.errors), 400
    return jsonify(ok=True, staff=account), 201


@app.patch("/api/staff/<username>")
def staff_update(username):
    blocked = _require_admin_staff_manage()
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(ok=False, errors={"form": "Invalid staff payload."}), 400
    actor = (session.get("user") or {}).get("username") or ""
    if actor.lower() == username.lower() and data.get("status") == "Disabled":
        return jsonify(ok=False, errors={"form": "You cannot disable the account you are signed in with."}), 400
    password = data.get("password")
    if password == "":
        password = None
    try:
        account = database.update_staff(
            username,
            name=data.get("name"),
            role=data.get("role"),
            status=data.get("status"),
            password=password,
        )
    except database.StaffError as exc:
        status = 404 if exc.errors.get("form") == "That staff account was not found." else 400
        return jsonify(ok=False, errors=exc.errors), status
    if actor.lower() == account["username"].lower():
        granted = db_enhance.permission_set_for(account["role"])
        session["user"] = {
            "username": account["username"],
            "name": account["name"],
            "role": account["role"],
            "permissions": sorted(granted),
            "home": _workspace_home(account["role"]),
        }
        session.modified = True
    return jsonify(ok=True, staff=account)


@app.post("/api/activity")
def public_activity():
    entry = request.get_json(silent=True) or {}
    if not isinstance(entry, dict):
        return jsonify(ok=False, errors={"form": "Invalid activity payload."}), 400
    if entry.get("action") != "Failed Login":
        blocked = _require_login()
        if blocked:
            return blocked
    database.append_activity(entry, ip=request.remote_addr)
    return jsonify(ok=True)


@app.get("/api/db/status")
def db_status():
    blocked = _require_login()
    if blocked:
        return blocked
    info = {
        "ok": True,
        "engine": database.engine_name(),
        "postgresRequired": database.require_postgres() or database.using_postgres(),
        "usingPostgres": database.using_postgres(),
    }
    if database.using_postgres():
        import pg_migrate
        with database.connect() as conn:
            info["migrations"] = pg_migrate.migration_status(conn)
            row = conn.execute("SELECT current_database() AS db, current_user AS usr").fetchone()
            info["database"] = row["db"]
            info["dbUser"] = row["usr"]
    return jsonify(info)


@app.post("/api/db/backup")
def db_backup_create():
    blocked = _require_permission("backup.create")
    if blocked:
        return blocked
    if not database.using_postgres():
        return jsonify(ok=False, errors={"form": "PostgreSQL backups require DATABASE_URL."}), 400
    import pg_backup
    account = _current_account()
    try:
        entry = pg_backup.create_postgres_backup(created_by=account["name"])
    except pg_backup.BackupError as exc:
        database.append_activity(
            {
                "action": "Backup",
                "module": "Database Backup",
                "details": f"PostgreSQL backup failed: {exc}",
                "user": account["name"],
                "role": account["role"],
                "severity": "Critical",
            },
            ip=request.remote_addr,
        )
        return jsonify(ok=False, errors={"form": str(exc)}), 500
    database.append_activity(
        {
            "action": "Backup",
            "module": "Database Backup",
            "details": f"PostgreSQL backup created ({entry.get('fileName')}, {entry.get('method')})",
            "user": account["name"],
            "role": account["role"],
            "severity": "Info",
        },
        ip=request.remote_addr,
    )
    return jsonify(ok=True, backup=entry)


@app.get("/api/db/backups")
def db_backup_list():
    blocked = _require_permission("backup.create", "backup.restore")
    if blocked:
        return blocked
    import pg_backup
    return jsonify(ok=True, files=pg_backup.list_backup_files(), history=database.dump_store().get("backups") or [])


@app.post("/api/db/backups/validate")
def db_backup_validate():
    blocked = _require_permission("backup.create", "backup.restore")
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    import pg_backup
    result = pg_backup.validate_backup_file(data.get("fileName") or "")
    status = 200 if result.get("ok") else 400
    return jsonify(result), status


@app.post("/api/db/restore")
def db_backup_restore():
    blocked = _require_permission("backup.restore")
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if not data.get("confirm"):
        return jsonify(ok=False, errors={"form": "Confirmation is required before restore."}), 400
    import pg_backup
    account = _current_account()
    try:
        entry = pg_backup.restore_postgres_backup(
            data.get("fileName") or "",
            created_by=account["name"],
            confirm=True,
        )
    except pg_backup.BackupError as exc:
        database.append_activity(
            {
                "action": "Restore",
                "module": "Database Backup",
                "details": f"PostgreSQL restore failed: {exc}",
                "user": account["name"],
                "role": account["role"],
                "severity": "Critical",
            },
            ip=request.remote_addr,
        )
        return jsonify(ok=False, errors={"form": str(exc)}), 500
    database.append_activity(
        {
            "action": "Restore",
            "module": "Database Backup",
            "details": f"PostgreSQL restored from {entry.get('fileName')}",
            "user": account["name"],
            "role": account["role"],
            "severity": "Critical",
        },
        ip=request.remote_addr,
    )
    return jsonify(ok=True, backup=entry)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    print(f"BSCIAMS is running at http://{host}:{port}")
    if database.using_postgres():
        print("Database: PostgreSQL (DATABASE_URL) [required primary engine]")
    else:
        print(f"Database: SQLite fallback ({database.DB_PATH}) — set DATABASE_URL for PostgreSQL")
    app.run(host=host, port=port, debug=False)
