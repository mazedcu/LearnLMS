#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  LearnwithHasan — undo the last deploy
#
#  Run on the droplet as root:
#    curl -fsSL https://raw.githubusercontent.com/mazedcu/LearnLMS/master/deploy/rollback.sh | bash
#
#  Puts back, from the newest backup deploy.sh made in /root/lms-backups:
#  the code, the website build, the database, .env, nginx and service config.
#  Anything students did after that deploy (new attempts, sign-ups,
#  payments) is lost with the database restore, so the current database
#  is saved first as db-before-rollback.sqlite3.
#  Run again to step back one more deploy.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

APP="${APP:-/var/www/learnwithhasan}"
SERVICE="${SERVICE:-learnwithhasan}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/learnwithhasan}"
UNIT="${UNIT:-/etc/systemd/system/${SERVICE}.service}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/lms-backups}"
APP_PORT="${APP_PORT:-8001}"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run this as root."
[ -d "$APP/backend" ] || die "Can't find the app in $APP."

# Newest backup that hasn't been rolled back yet
BACKUP="$(ls -1d "$BACKUP_ROOT"/*/ 2>/dev/null | grep -v -- '-rolledback/$' | sort | tail -1 || true)"
BACKUP="${BACKUP%/}"
[ -n "$BACKUP" ] && [ -d "$BACKUP" ] || die "No backup found in $BACKUP_ROOT."
NEWEST="$(ls -1d "$BACKUP_ROOT"/*/ | sort | tail -1)"; NEWEST="${NEWEST%/}"
say "Rolling back to the state saved in $BACKUP"

ENV_FILE="$APP/backend/.env"
DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'" || true)"
DB_FILE="$APP/backend/db.sqlite3"
if [[ "$DB_URL" == sqlite:///* ]]; then DB_FILE="/${DB_URL#sqlite:///}"; fi

systemctl stop "$SERVICE" || true

# ── Database ─────────────────────────────────────────────────────────
if [ -f "$BACKUP/db.sqlite3" ] && [ -f "$DB_FILE" ]; then
  cp -a "$DB_FILE" "$BACKUP/db-before-rollback.sqlite3"; chmod 600 "$BACKUP/db-before-rollback.sqlite3"
  owner="$(stat -c '%U:%G' "$DB_FILE")"
  cp "$BACKUP/db.sqlite3" "$DB_FILE"; chown "$owner" "$DB_FILE"
  rm -f "$DB_FILE-journal" "$DB_FILE-wal" "$DB_FILE-shm"
  ok "database restored (current one kept as $BACKUP/db-before-rollback.sqlite3)"
elif [ -f "$BACKUP/db.sql.gz" ]; then
  warn "PostgreSQL: restore by hand with: gunzip -c $BACKUP/db.sql.gz | psql \"\$DATABASE_URL\""
else
  warn "no database in this backup — left as is"
fi

# ── Code ─────────────────────────────────────────────────────────────
cd "$APP"
PREV="$(cat "$BACKUP/prev_commit" 2>/dev/null || echo none)"
if [ "$PREV" != none ] && git cat-file -e "$PREV" 2>/dev/null; then
  git -c advice.detachedHead=false checkout -q -f "$PREV"
  ok "code back at $(git log -1 --format='%h %s')"
elif [ -f "$BACKUP/code.tgz" ]; then
  tar -C "$APP" -xzf "$BACKUP/code.tgz"
  ok "code restored from snapshot"
else
  die "Backup has no code to restore."
fi

# ── Config ───────────────────────────────────────────────────────────
[ -f "$BACKUP/env" ] && cp -a "$BACKUP/env" "$ENV_FILE" && ok ".env"
if [ -f "$BACKUP/nginx-site.conf" ]; then
  cp -a "$BACKUP/nginx-site.conf" "$NGINX_SITE"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx && ok "nginx config" || warn "nginx config restored but nginx -t failed"
fi
if [ -f "$BACKUP/app.service" ]; then
  cp -a "$BACKUP/app.service" "$UNIT"; systemctl daemon-reload; ok "service config"
fi
# The restored service may run as a different user: make sure it can write
U="$(grep -E '^User=' "$UNIT" 2>/dev/null | head -1 | cut -d= -f2)"; U="${U:-root}"
[ -f "$DB_FILE" ] && chown "$U" "$DB_FILE"
[ -d "$APP/backend/media" ] && chown -R "$U" "$APP/backend/media"

# ── Backend packages ─────────────────────────────────────────────────
cd "$APP/backend"
venv/bin/pip install -q -r requirements.txt gunicorn
venv/bin/python manage.py collectstatic --noinput -v0 || true

# ── Website build ────────────────────────────────────────────────────
cd "$APP/frontend"
if [ "$BACKUP" = "$NEWEST" ] && [ -f dist.prev/index.html ]; then
  rm -rf dist.bad; [ -d dist ] && mv dist dist.bad
  mv dist.prev dist; rm -rf dist.bad
  ok "previous website build back in place"
else
  npm ci --no-audit --no-fund --loglevel=error
  rm -rf dist.new
  npx vite build --outDir dist.new --emptyOutDir >/dev/null
  rm -rf dist; mv dist.new dist
  ok "website rebuilt for this version"
fi

# ── Start ────────────────────────────────────────────────────────────
systemctl start "$SERVICE"
code=""
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/courses/" || true)"
  [ "$code" = 200 ] && break; sleep 1
done
mv "$BACKUP" "$BACKUP-rolledback"
if [ "$code" = 200 ]; then
  say "Rolled back — live at $(cd "$APP" && git log -1 --format='%h %s' 2>/dev/null || echo 'restored snapshot')"
  echo "    To go forward again later, run deploy.sh."
else
  journalctl -u "$SERVICE" -n 30 --no-pager || true
  die "Rolled back but the app isn't answering (HTTP ${code:-none})."
fi
