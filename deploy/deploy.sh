#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  LearnwithHasan — update the live server to the latest master
#
#  Run on the droplet as root (DigitalOcean web console):
#    curl -fsSL https://raw.githubusercontent.com/mazedcu/LearnLMS/master/deploy/deploy.sh | bash
#
#  What it does, in order:
#    1. Backs up .env, the database and server config to /root/lms-backups/<time>/
#    2. Updates the code to origin/master (keeps .env, venv, media, database)
#    3. Installs Python packages, runs migrations, collects static files
#    4. Builds the frontend into a separate folder, then swaps it in
#       (a failed build never takes the site down)
#    5. Raises the nginx upload limit to 2 GB and gunicorn timeout to 300 s,
#       editing the live config in place (keeps your HTTPS/certbot settings)
#    6. Replaces a publicly known SECRET_KEY with a random one
#    7. Restarts the app and checks it answers
#
#  Safe to run again; every step is idempotent.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

APP="${APP:-/var/www/learnwithhasan}"
REPO="${REPO:-https://github.com/mazedcu/LearnLMS.git}"
BRANCH="${BRANCH:-master}"
SERVICE="${SERVICE:-learnwithhasan}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/learnwithhasan}"
UNIT="${UNIT:-/etc/systemd/system/${SERVICE}.service}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/lms-backups}"
APP_PORT="${APP_PORT:-8001}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_ROOT/$STAMP"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run this as root (the DigitalOcean console logs in as root)."
[ -d "$APP/backend" ] && [ -d "$APP/frontend" ] || die "Can't find the app in $APP (expected backend/ and frontend/)."
command -v git >/dev/null || { say "Installing git"; apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git; }

# ── 1. Backup ────────────────────────────────────────────────────────
say "Backing up to $BACKUP"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP_ROOT" "$BACKUP"
[ -f "$APP/backend/.env" ] && cp -a "$APP/backend/.env" "$BACKUP/env" && ok ".env"
[ -f "$NGINX_SITE" ] && cp -a "$NGINX_SITE" "$BACKUP/nginx-site.conf" && ok "nginx config"
[ -f "$UNIT" ] && cp -a "$UNIT" "$BACKUP/app.service" && ok "systemd unit"

DB_URL="$(grep -E '^DATABASE_URL=' "$APP/backend/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'" || true)"
if [ -z "$DB_URL" ] || [[ "$DB_URL" == sqlite* ]]; then
  DB_FILE="$APP/backend/db.sqlite3"
  if [[ "$DB_URL" == sqlite:///* ]]; then DB_FILE="/${DB_URL#sqlite:///}"; fi
  if [ -f "$DB_FILE" ]; then
    # Online-safe copy via SQLite's backup API
    python3 - "$DB_FILE" "$BACKUP/db.sqlite3" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1]); dst = sqlite3.connect(sys.argv[2])
with dst: src.backup(dst)
PY
    ok "SQLite database ($(du -h "$BACKUP/db.sqlite3" | cut -f1))"
  else
    warn "No SQLite database found at $DB_FILE"
  fi
elif [[ "$DB_URL" == postgres* ]]; then
  if command -v pg_dump >/dev/null; then
    pg_dump "$DB_URL" | gzip > "$BACKUP/db.sql.gz" && ok "PostgreSQL dump"
  else
    die "Database is PostgreSQL but pg_dump isn't installed; install postgresql-client and re-run."
  fi
fi
tar -C "$APP" --exclude=venv --exclude=node_modules --exclude=media --exclude=staticfiles \
    --exclude=dist --exclude=dist.new --exclude=.git -czf "$BACKUP/code.tgz" . && ok "code snapshot"
chmod 600 "$BACKUP"/*   # backups include .env secrets

# ── 2. Code ──────────────────────────────────────────────────────────
say "Updating code to $BRANCH"
cd "$APP"
if [ ! -d .git ]; then
  # First run: turn the folder into a git checkout so future deploys are one pull.
  git init -q
  git remote add origin "$REPO"
  ok "converted $APP into a git checkout"
fi
origin="$(git remote get-url origin)"
shopt -s nocasematch
[[ "$origin" == *mazedcu/learnlms* ]] || die "git remote is '$origin', not the LearnLMS repo."
shopt -u nocasematch
git fetch -q --depth 50 origin "$BRANCH"
# Local edits to tracked files are kept in the code backup above, then replaced.
git -c advice.detachedHead=false checkout -q -B "$BRANCH" "origin/$BRANCH" -f
git reset -q --hard "origin/$BRANCH"
ok "now at $(git log -1 --format='%h %s')"

# Old helper scripts that contained a plaintext admin password
for f in "$APP/update_remote.sh" "$APP/backend/update_admin.py" /root/update_remote.sh /root/update_admin.py; do
  if [ -f "$f" ]; then rm -f "$f"; ok "removed old password script $f"; fi
done

# ── 3. Secret key ────────────────────────────────────────────────────
ENV_FILE="$APP/backend/.env"
if [ -f "$ENV_FILE" ] && grep -Eq "^SECRET_KEY=['\"]?(super_secret_key|dev-secret-key-change-in-production|your-secret-key-here)['\"]?\s*$" "$ENV_FILE"; then
  say "Replacing the publicly known SECRET_KEY"
  NEW_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
  sed -i -E "s|^SECRET_KEY=.*$|SECRET_KEY='${NEW_KEY}'|" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "new random key set (everyone will need to sign in again once)"
fi

# ── 4. Backend ───────────────────────────────────────────────────────
say "Backend: packages, migrations, static files"
cd "$APP/backend"
[ -x venv/bin/python ] || python3 -m venv venv
venv/bin/pip install -q --upgrade pip >/dev/null
venv/bin/pip install -q -r requirements.txt gunicorn
venv/bin/python manage.py migrate --noinput
venv/bin/python manage.py collectstatic --noinput -v0
venv/bin/python manage.py check
ok "backend ready"

# ── 5. Frontend (build aside, then swap) ─────────────────────────────
say "Frontend: build"
cd "$APP/frontend"
command -v npm >/dev/null || die "npm isn't installed on this server."
npm ci --no-audit --no-fund --loglevel=error
rm -rf dist.new
npx vite build --outDir dist.new --emptyOutDir >/dev/null
[ -f dist.new/index.html ] || die "Frontend build produced no index.html; the live site was not changed."
rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv dist.new dist
rm -rf dist.old
ok "frontend swapped in"

# ── 6. nginx + gunicorn limits ───────────────────────────────────────
say "Server limits for large uploads"
if [ -f "$NGINX_SITE" ]; then
  changed=0
  if ! grep -q 'client_max_body_size' "$NGINX_SITE"; then
    sed -i '/^\s*server_name\b/a\    client_max_body_size 2G;' "$NGINX_SITE"; changed=1
  fi
  if ! grep -q 'proxy_read_timeout' "$NGINX_SITE"; then
    sed -i "/proxy_pass http:\/\/127.0.0.1:${APP_PORT};/a\        proxy_read_timeout 600s;\n        proxy_send_timeout 600s;" "$NGINX_SITE"; changed=1
  fi
  if [ "$changed" = 1 ]; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx && ok "nginx: uploads up to 2 GB, 10-minute timeouts"
    else
      cp -a "$BACKUP/nginx-site.conf" "$NGINX_SITE"
      warn "nginx rejected the change, restored the previous config:"; nginx -t || true
    fi
  else
    ok "nginx already configured"
  fi
else
  warn "No nginx site at $NGINX_SITE — skipped (set NGINX_SITE=... and re-run)"
fi

if [ -f "$UNIT" ]; then
  if grep -q 'gunicorn' "$UNIT" && ! grep -q -- '--timeout' "$UNIT"; then
    sed -i -E '/^ExecStart=/ s/gunicorn( |$)/gunicorn --timeout 300 /' "$UNIT"
    systemctl daemon-reload
    ok "gunicorn timeout 300 s"
  else
    ok "gunicorn already configured"
  fi
fi

# ── 7. Restart + health check ────────────────────────────────────────
say "Restarting $SERVICE"
systemctl restart "$SERVICE"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/courses/" || true)"
  [ "$code" = 200 ] && break
  sleep 1
done
if [ "$code" = 200 ]; then
  ok "API answering (HTTP 200)"
else
  warn "API returned HTTP ${code:-none}. Recent logs:"
  journalctl -u "$SERVICE" -n 30 --no-pager || true
  die "Deploy finished but the app isn't healthy. Backup: $BACKUP"
fi

say "Done — live at $(cd "$APP" && git log -1 --format='%h %s')"
echo "    Backup: $BACKUP"
