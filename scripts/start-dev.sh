#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LARAVEL_PID=""
REALTIME_PID=""
FRONTEND_PID=""
FRONTEND_PORT=5173

cleanup() {
  if [[ -n "$LARAVEL_PID" ]] && kill -0 "$LARAVEL_PID" 2>/dev/null; then
    kill "$LARAVEL_PID" 2>/dev/null || true
  fi
  if [[ -n "$REALTIME_PID" ]] && kill -0 "$REALTIME_PID" 2>/dev/null; then
    kill "$REALTIME_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

api_ready() {
  curl -sf --max-time 2 "http://127.0.0.1:4000/api/health" >/dev/null 2>&1 \
    || curl -sf --max-time 2 "http://on-prem.x-dcb.net:4000/api/health" >/dev/null 2>&1
}

realtime_ready() {
  curl -sf --max-time 2 "http://127.0.0.1:4001/health" >/dev/null 2>&1
}

frontend_ready() {
  local port="${1:-$FRONTEND_PORT}"
  curl -sf --max-time 2 "http://127.0.0.1:${port}/" >/dev/null 2>&1 \
    || curl -sf --max-time 2 "http://on-prem.x-dcb.net:${port}/" >/dev/null 2>&1
}

# Free a TCP port if something is listening but not serving HTTP (hung PHP/Vite).
free_port_if_stuck() {
  local port="$1"
  local probe_url="$2"
  if curl -sf --max-time 2 "$probe_url" >/dev/null 2>&1; then
    return 0
  fi
  if ss -tlnH "sport = :${port}" 2>/dev/null | grep -q ":${port}"; then
    echo "Port ${port} is occupied but not responding — freeing it..."
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 1
  fi
}

echo ""
echo "NMP Ticketing - starting Laravel API + frontend"
echo ""

if [[ ! -f "$ROOT/laravel/.env" ]]; then
  echo "ERROR: laravel/.env missing"
  exit 1
fi
if [[ ! -f "$ROOT/frontend/.env" ]] && [[ -f "$ROOT/frontend/.env.example" ]]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
  echo "Created frontend/.env"
fi

# Shared upload dir + public symlink for artisan serve
mkdir -p "$ROOT/backend/uploads"
if [[ ! -e "$ROOT/laravel/public/uploads" ]]; then
  ln -sfn "$ROOT/backend/uploads" "$ROOT/laravel/public/uploads"
fi

# Recover hung Laravel (listen queue full / zombie php -S child).
free_port_if_stuck 4000 "http://127.0.0.1:4000/api/health"

if ! api_ready; then
  echo "Seeding database (MySQL nmp_ticketing)..."
  (
    cd "$ROOT/laravel"
    php artisan nmp:seed
    php artisan nmp:rbac-seed
  ) || {
    echo ""
    echo "ERROR: Seed failed. Start MySQL first, then re-run this script."
    exit 1
  }

  echo "Starting Laravel API on :4000..."
  (
    cd "$ROOT/laravel"
    echo "LARAVEL - keep this process running"
    php artisan serve --host=0.0.0.0 --port=4000
  ) &
  LARAVEL_PID=$!

  echo "Waiting for API on port 4000..."
  ready=false
  for _ in $(seq 1 45); do
    sleep 1
    if api_ready; then
      ready=true
      break
    fi
  done
  if [[ "$ready" != true ]]; then
    echo "ERROR: API did not start. Check MySQL and Laravel logs."
    exit 1
  fi
  echo "API ready: http://127.0.0.1:4000/api/health"
else
  echo "API already running: http://127.0.0.1:4000"
fi

if [[ -f "$ROOT/backend/src/realtime-server.ts" ]]; then
  if ! realtime_ready; then
    echo "Starting realtime sidecar on :4001..."
    (
      cd "$ROOT/backend"
      # Load JWT from laravel/.env when unset (HS256 needs >= 32 bytes for php-jwt)
      if [[ -z "${JWT_SECRET:-}" ]] && [[ -f "$ROOT/laravel/.env" ]]; then
        JWT_SECRET="$(grep -E '^JWT_SECRET=' "$ROOT/laravel/.env" | head -1 | cut -d= -f2-)"
      fi
      export JWT_SECRET="${JWT_SECRET:-change-me-in-production-nmp-ticketing}"
      export REALTIME_INTERNAL_SECRET="${REALTIME_INTERNAL_SECRET:-$JWT_SECRET}"
      export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
      export MYSQL_USER="${MYSQL_USER:-root}"
      export MYSQL_PASSWORD="${MYSQL_PASSWORD:-2026nmpict}"
      export MYSQL_DATABASE="${MYSQL_DATABASE:-nmp_ticketing}"
      echo "REALTIME - keep this process running"
      bun src/realtime-server.ts
    ) &
    REALTIME_PID=$!
    for _ in $(seq 1 20); do
      sleep 1
      if realtime_ready; then
        echo "Realtime ready: http://127.0.0.1:4001/health"
        break
      fi
    done
  else
    echo "Realtime already running: http://127.0.0.1:4001"
  fi
fi

frontend_needs_build() {
  local stamp="$ROOT/frontend/.nmp-onprem-build-stamp"
  [[ -f "$stamp" ]] || return 0
  [[ -d "$ROOT/frontend/dist" || -d "$ROOT/frontend/.output" ]] || return 0
  local newer
  newer="$(find "$ROOT/frontend/src" "$ROOT/frontend/public" "$ROOT/frontend/vite.config.ts" \
    "$ROOT/frontend/package.json" "$ROOT/frontend/tsconfig.json" \
    -newer "$stamp" \( -type f -o -type d \) -print -quit 2>/dev/null || true)"
  [[ -n "$newer" ]]
}

free_port_if_stuck "$FRONTEND_PORT" "http://127.0.0.1:${FRONTEND_PORT}/"

if [[ "${NMP_VITE_DEV:-}" != "1" ]]; then
  # Recycle preview so HTML always matches current hashed assets (avoids 404 storms).
  if ss -tlnH "sport = :${FRONTEND_PORT}" 2>/dev/null | grep -q ":${FRONTEND_PORT}"; then
    echo "Restarting bundled frontend on :${FRONTEND_PORT} so assets match..."
    fuser -k "${FRONTEND_PORT}/tcp" 2>/dev/null || true
    sleep 1
  fi
fi

if ! frontend_ready "$FRONTEND_PORT"; then
  echo "Starting frontend on :${FRONTEND_PORT}..."
  (
    cd "$ROOT/frontend"
    echo "FRONTEND - keep this process running"
    # Bundled preview is what museum users open (fast). Unbundled Vite is
    # NMP_VITE_DEV=1 only — same APIs/proxies, hundreds of extra JS files.
    if [[ "${NMP_VITE_DEV:-}" == "1" ]]; then
      bun run dev
    else
      if [[ "${NMP_REBUILD:-}" == "1" ]] || frontend_needs_build; then
        echo "Building frontend bundle (once; later opens stay fast)..."
        rm -rf "$ROOT/frontend/dist"
        bun run build
        date -Iseconds > "$ROOT/frontend/.nmp-onprem-build-stamp"
      else
        echo "Using existing frontend bundle"
      fi
      bun run preview
    fi
  ) &
  FRONTEND_PID=$!

  echo "Waiting for frontend on port $FRONTEND_PORT..."
  fe_ready=false
  for _ in $(seq 1 240); do
    sleep 1
    if frontend_ready "$FRONTEND_PORT"; then
      fe_ready=true
      break
    fi
    # If Vite exited (e.g. strictPort conflict), stop waiting early.
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      break
    fi
  done
  if [[ "$fe_ready" != true ]]; then
    echo "ERROR: Frontend did not start on port ${FRONTEND_PORT}."
    echo "  Free the port (fuser -k ${FRONTEND_PORT}/tcp) and re-run."
    exit 1
  fi
  echo "Frontend ready: http://127.0.0.1:${FRONTEND_PORT}/"
else
  echo "Frontend already running on port $FRONTEND_PORT"
fi

echo ""
echo "Open in browser:"
echo "  http://127.0.0.1:${FRONTEND_PORT}/"
echo "  Sign in: http://127.0.0.1:${FRONTEND_PORT}/login"
echo "  Use your museum username/email (org users linked to PAMANA)."
echo "  Example (if in PAMANA): resty.morancil"
echo "  Fast bundled frontend is the default. Slow unbundled Vite: NMP_VITE_DEV=1"
echo ""
echo "API:      http://127.0.0.1:4000/api/health"
echo "Realtime: http://127.0.0.1:4001/health (socket.io)"
echo ""
echo "Press Ctrl+C to stop services started by this script."
echo ""

wait
