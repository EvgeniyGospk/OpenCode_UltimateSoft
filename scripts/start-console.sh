#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
API_DIR="$ROOT_DIR/apps/console-api"
UI_DIR="$ROOT_DIR/apps/console-ui"
DEFAULT_UI_POLLING="${DEFAULT_UI_POLLING:-1}"
DEFAULT_UI_POLLING_INTERVAL="${DEFAULT_UI_POLLING_INTERVAL:-200}"
DEFAULT_API_WATCH="${DEFAULT_API_WATCH:-0}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH."
  exit 1
fi

find_port_owner() {
  port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port {print; exit}'
    return
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sed -n '2p'
    return
  fi
}

assert_port_free() {
  port="$1"
  service="$2"

  owner="$(find_port_owner "$port" || true)"
  if [ -n "$owner" ]; then
    echo "Port $port is already in use, cannot start $service."
    echo "Listener: $owner"
    echo "Stop existing process and run: npm run dev:console"
    exit 1
  fi
}

if [ ! -f "$API_DIR/package.json" ] || [ ! -f "$UI_DIR/package.json" ]; then
  echo "Cannot find app manifests in apps/console-api or apps/console-ui."
  exit 1
fi

assert_port_free 4310 "console-api"
assert_port_free 5174 "console-ui"

ensure_deps() {
  target_dir="$1"
  install_flags="${2:-}"

  if [ ! -d "$target_dir/node_modules" ]; then
    echo "Installing dependencies in $target_dir ..."
    if [ -n "$install_flags" ]; then
      npm --prefix "$target_dir" install $install_flags
    else
      npm --prefix "$target_dir" install
    fi
  fi
}

# eslint/plugin peer mismatch in current UI stack may require legacy peer handling
ensure_deps "$API_DIR"
ensure_deps "$UI_DIR" "--legacy-peer-deps"

API_PID=""
UI_PID=""

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [ -n "$UI_PID" ]; then
    kill "$UI_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "Starting console-api on http://127.0.0.1:4310 ..."
if [ "${CONSOLE_API_WATCH:-$DEFAULT_API_WATCH}" = "1" ]; then
  npm --prefix "$API_DIR" run dev &
else
  (
    cd "$API_DIR"
    npx tsx src/index.ts
  ) &
fi
API_PID=$!

echo "Starting console-ui on http://127.0.0.1:5174 ..."
# Use polling watcher by default to avoid ENOSPC on low inotify limits.
CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-$DEFAULT_UI_POLLING}" \
CHOKIDAR_INTERVAL="${CHOKIDAR_INTERVAL:-$DEFAULT_UI_POLLING_INTERVAL}" \
  npm --prefix "$UI_DIR" run dev &
UI_PID=$!

echo "Console is launching."
echo "UI:  http://127.0.0.1:5174"
echo "API: http://127.0.0.1:4310"
echo "Press Ctrl+C to stop both processes."

while :; do
  API_ALIVE=0
  UI_ALIVE=0

  if kill -0 "$API_PID" 2>/dev/null; then
    API_ALIVE=1
  fi

  if kill -0 "$UI_PID" 2>/dev/null; then
    UI_ALIVE=1
  fi

  if [ "$API_ALIVE" -eq 1 ] && [ "$UI_ALIVE" -eq 1 ]; then
    sleep 1
    continue
  fi

  if [ "$API_ALIVE" -eq 0 ] && [ "$UI_ALIVE" -eq 0 ]; then
    wait "$API_PID" 2>/dev/null || true
    wait "$UI_PID" 2>/dev/null || true
    exit 0
  fi

  echo "One service exited. Stopping the remaining process."
  cleanup
  wait "$API_PID" 2>/dev/null || true
  wait "$UI_PID" 2>/dev/null || true
  exit 1
done
