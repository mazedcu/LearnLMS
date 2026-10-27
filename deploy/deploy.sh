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
#    7. Restarts the app and checks it answers (API and the site through nginx)
#
#  Safe to run again; every step is idempotent.
#  Undo the last deploy:
#    curl -fsSL https://raw.githubusercontent.com/mazedcu/LearnLMS/master/deploy/rollback.sh | bash
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
    --exclude=dist --exclude=dist.new --exclude=dist.prev --exclude=.git -czf "$BACKUP/code.tgz" . && ok "code snapshot"
chmod 600 "$BACKUP"/*   # backups include .env secrets

# ── 2. Code ──────────────────────────────────────────────────────────
say "Updating code to $BRANCH"
cd "$APP"
PREV_COMMIT="$(git rev-parse -q --verify HEAD 2>/dev/null || true)"
echo "${PREV_COMMIT:-none}" > "$BACKUP/prev_commit"
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
if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" != "$(git rev-parse HEAD)" ] && git cat-file -e "$PREV_COMMIT" 2>/dev/null; then
  echo "    Going live:"
  git log --format='      • %s' "$PREV_COMMIT..HEAD" | head -40
elif [ -z "$PREV_COMMIT" ]; then
  echo "    Going live (latest changes):"
  git log --format='      • %s' -12
fi

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

# Links in emails point at the real site, not localhost
if [ -f "$ENV_FILE" ] && ! grep -q '^FRONTEND_URL=' "$ENV_FILE"; then
  scheme=http
  [ -f "$NGINX_SITE" ] && grep -q 'listen 443' "$NGINX_SITE" && scheme=https
  echo "FRONTEND_URL=${scheme}://learnwithhasan.xyz" >> "$ENV_FILE"
  ok "email links use ${scheme}://learnwithhasan.xyz"
fi

# ── 4. Backend ───────────────────────────────────────────────────────
say "Backend: packages, migrations, static files"
cd "$APP/backend"
[ -x venv/bin/python ] || python3 -m venv venv
venv/bin/pip install -q --upgrade pip >/dev/null
venv/bin/pip install -q -r requirements.txt gunicorn
# --fake-initial: tables created before their migration was committed (the
# video library) are marked as applied instead of failing with "already exists".
venv/bin/python manage.py migrate --noinput --fake-initial
venv/bin/python manage.py collectstatic --noinput -v0
venv/bin/python manage.py check
ok "backend ready"

# ── 5. Frontend (build aside, then swap) ─────────────────────────────
say "Frontend: build"
cd "$APP/frontend"
# Vite 8 needs Node 20.19+ or 22.12+; install Node 22 LTS if the server's is older.
node_ok() {
  command -v node >/dev/null && command -v npm >/dev/null || return 1
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>22?0:1)'
}
if ! node_ok; then
  say "Installing Node.js 22 (found: $(node -v 2>/dev/null || echo none))"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl gnupg >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  hash -r
  node_ok || die "Couldn't install a new enough Node.js (have $(node -v 2>/dev/null || echo none)). The live site was not changed."
fi
ok "Node $(node -v)"
npm ci --no-audit --no-fund --loglevel=error
rm -rf dist.new
npx vite build --outDir dist.new --emptyOutDir >/dev/null
[ -f dist.new/index.html ] || die "Frontend build produced no index.html; the live site was not changed."
# Android app: GitHub builds it unsigned; we sign it here with the server's own
# key (made on the first run, kept in $ANDROID_KEY_DIR) and serve it at
# /app/learnwithhasan.apk. Every update carries the same signature, so phones
# update the app in place.
ANDROID_KEY_DIR="${ANDROID_KEY_DIR:-/root/lms-android-key}"
android_app() {
  local ks="$ANDROID_KEY_DIR/learnwithhasan-release.jks" pw="$ANDROID_KEY_DIR/password"
  local tmp; tmp="$(mktemp -d)"
  local base="https://github.com/mazedcu/LearnLMS/releases/latest"
  curl -fsSL --max-time 180 -o "$tmp/unsigned.apk" "$base/download/learnwithhasan-unsigned.apk" || { rm -rf "$tmp"; return 1; }
  [ "$(head -c 2 "$tmp/unsigned.apk")" = "PK" ] || { rm -rf "$tmp"; return 1; }
  if ! command -v apksigner >/dev/null || ! command -v keytool >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq apksigner >/dev/null 2>&1 \
      || { apt-get update -qq >/dev/null 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq apksigner >/dev/null 2>&1; } \
      || { rm -rf "$tmp"; return 2; }
  fi
  if [ ! -f "$ks" ]; then
    mkdir -p "$ANDROID_KEY_DIR"; chmod 700 "$ANDROID_KEY_DIR"
    python3 -c 'import secrets; print(secrets.token_urlsafe(24))' > "$pw"; chmod 600 "$pw"
    keytool -genkeypair -keystore "$ks" -storetype PKCS12 -alias learnwithhasan -keyalg RSA -keysize 4096 \
      -validity 36500 -storepass:file "$pw" -keypass:file "$pw" \
      -dname "CN=LearnwithHasan, O=Radon Academy, C=BD" >/dev/null 2>&1 || { rm -rf "$tmp"; return 3; }
    chmod 600 "$ks"
    ok "made the app signing key in $ANDROID_KEY_DIR (keep a copy somewhere safe)"
  fi
  apksigner sign --ks "$ks" --ks-key-alias learnwithhasan --ks-pass "file:$pw" --key-pass "file:$pw" \
    --out "$tmp/signed.apk" "$tmp/unsigned.apk" >/dev/null 2>&1 || { rm -rf "$tmp"; return 4; }
  apksigner verify "$tmp/signed.apk" >/dev/null 2>&1 || { rm -rf "$tmp"; return 4; }
  mkdir -p dist.new/app
  mv "$tmp/signed.apk" dist.new/app/learnwithhasan.apk
  chmod 644 dist.new/app/learnwithhasan.apk
  rm -rf "$tmp"
  cp -a "$ANDROID_KEY_DIR" "$BACKUP/android-key"   # the key travels with every backup
  local tag; tag="$(curl -fsSI --max-time 30 "$base" | tr -d '\r' | sed -n 's|^[Ll]ocation: .*/tag/||p' | tail -1)"
  ok "Android app ${tag#android-} signed, at /app/learnwithhasan.apk ($(du -h dist.new/app/learnwithhasan.apk | cut -f1))"
}
if android_app; then :; else
  rc=$?
  case $rc in
    1) why="no app build on GitHub yet";;
    2) why="couldn't install apksigner";;
    3) why="couldn't make the signing key";;
    *) why="signing failed";;
  esac
  if [ -f dist/app/learnwithhasan.apk ]; then
    mkdir -p dist.new/app && cp dist/app/learnwithhasan.apk dist.new/app/
    warn "Android app not updated ($why); kept the current one"
  else
    warn "Android app skipped ($why) — the download link stays hidden"
  fi
fi
# Keep the previous build as dist.prev so rollback.sh can put it back instantly
rm -rf dist.prev
[ -d dist ] && mv dist dist.prev
mv dist.new dist
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
  # Internal location nginx uses to serve video-library streams for the app
  # (X-Accel-Redirect), so viewers don't hold gunicorn workers.
  if ! grep -q 'location /protected-media/' "$NGINX_SITE" && grep -qE '^\s*location /media/' "$NGINX_SITE"; then
    sed -i -E "/^\s*location \/media\/ \{/i\    location /protected-media/ {\n        internal;\n        alias ${APP}/backend/media/;\n    }\n" "$NGINX_SITE"; changed=1
  fi
  nginx_ok=1
  if [ "$changed" = 1 ]; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx && ok "nginx: 2 GB uploads, 10-minute timeouts, fast video streaming"
    else
      nginx_ok=0
      cp -a "$BACKUP/nginx-site.conf" "$NGINX_SITE"
      warn "nginx rejected the change, restored the previous config:"; nginx -t || true
    fi
  else
    ok "nginx already configured"
  fi
  # Turn the app's nginx hand-off on only when nginx has the location
  if [ -f "$ENV_FILE" ]; then
    sed -i '/^MEDIA_ACCEL_REDIRECT=/d' "$ENV_FILE"
    if [ "$nginx_ok" = 1 ] && grep -q 'location /protected-media/' "$NGINX_SITE"; then
      echo "MEDIA_ACCEL_REDIRECT=True" >> "$ENV_FILE"
      ok "video streams served by nginx"
    else
      warn "video streams stay on the app (nginx location missing)"
    fi
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

# ── 6b. Run the app as a normal user instead of root ─────────────────
APP_USER="${APP_USER:-www-data}"
PREV_USER=""
if [ -f "$UNIT" ] && id "$APP_USER" >/dev/null 2>&1; then
  say "App account: $APP_USER (not root)"
  B="$APP/backend"
  mkdir -p "$B/media" "$B/.cache"
  chown -R "$APP_USER:$APP_USER" "$B/media" "$B/.cache"
  if [ -n "${DB_FILE:-}" ] && [ -f "$DB_FILE" ]; then
    # SQLite writes the file and creates journal files next to it
    chown "$APP_USER:$APP_USER" "$DB_FILE"
    chgrp "$APP_USER" "$(dirname "$DB_FILE")" && chmod g+rwx "$(dirname "$DB_FILE")"
  fi
  if [ -f "$ENV_FILE" ]; then chown "root:$APP_USER" "$ENV_FILE"; chmod 640 "$ENV_FILE"; fi

  can() { runuser -u "$APP_USER" -- test "$@"; }
  if can -r "$ENV_FILE" && can -w "$B/media" && can -w "$B/.cache" \
     && { [ -z "${DB_FILE:-}" ] || ! [ -f "$DB_FILE" ] || { can -w "$DB_FILE" && can -w "$(dirname "$DB_FILE")"; }; }; then
    PREV_USER="$(grep -E '^User=' "$UNIT" | head -1 | cut -d= -f2)"
    if [ "$PREV_USER" != "$APP_USER" ]; then
      if grep -qE '^User=' "$UNIT"; then
        sed -i -E "s/^User=.*/User=$APP_USER/" "$UNIT"
      else
        sed -i "/^\[Service\]/a User=$APP_USER" "$UNIT"
      fi
      systemctl daemon-reload
      ok "service will run as $APP_USER"
    else
      PREV_USER=""   # nothing changed, nothing to roll back
      ok "already running as $APP_USER"
    fi
  else
    warn "$APP_USER can't write everything it needs — staying on the current user"
  fi
fi

# ── 7. Restart + health check ────────────────────────────────────────
health() {
  for i in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/courses/" || true)"
    [ "$code" = 200 ] && return 0
    sleep 1
  done
  return 1
}
say "Restarting $SERVICE"
systemctl restart "$SERVICE"
if ! health && [ -n "$PREV_USER" ]; then
  warn "App didn't start as $APP_USER — switching back to ${PREV_USER:-root}"
  sed -i -E "s/^User=.*/User=${PREV_USER:-root}/" "$UNIT"
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  health || true
fi
if [ "$code" = 200 ]; then
  ok "API answering (HTTP 200) as $(grep -E '^User=' "$UNIT" 2>/dev/null | cut -d= -f2 || echo '?')"
else
  warn "API returned HTTP ${code:-none}. Recent logs:"
  journalctl -u "$SERVICE" -n 30 --no-pager || true
  die "Deploy finished but the app isn't healthy. Backup: $BACKUP"
fi

# The public site through nginx (warn only: DNS/HTTPS setups vary)
site="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: learnwithhasan.xyz' http://127.0.0.1/ || true)"
case "$site" in
  200|301|302|308) ok "site answering through nginx (HTTP $site)";;
  *) warn "site through nginx returned HTTP ${site:-none} — check: nginx -t && systemctl status nginx";;
esac

say "Done — live at $(cd "$APP" && git log -1 --format='%h %s')"
echo "    Backup: $BACKUP"
echo "    Undo:   curl -fsSL https://raw.githubusercontent.com/mazedcu/LearnLMS/master/deploy/rollback.sh | bash"
