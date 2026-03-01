#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start-console.sh — запуск консоли OpenCode (API + UI)
#
# Использование:
#   ./scripts/start-console.sh          — обычный запуск
#   npm run dev:console                 — то же через package.json
#
# Фичи:
#   • API (бэкенд)  — tsx watch, авто-перезапуск при изменениях
#   • UI  (фронт)   — Vite dev server с HMR
#   • .env создаётся автоматически из .env.example
#   • Зависимости ставятся при первом запуске
#   • Ctrl+C корректно гасит оба процесса
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Цвета ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()  { printf "${CYAN}[console]${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}[  ok  ]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[ warn ]${NC} %s\n" "$*"; }
err()  { printf "${RED}[error ]${NC} %s\n" "$*"; }

# ── Пути ──
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
API_DIR="$ROOT_DIR/apps/console-api"
UI_DIR="$ROOT_DIR/apps/console-ui"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

# ── Порты (берём из .env или дефолты) ──
API_PORT="${CONSOLE_API_PORT:-4310}"
UI_PORT="${VITE_PORT:-5174}"

# ── Проверка npm ──
if ! command -v npm >/dev/null 2>&1; then
  err "npm не найден. Установи Node.js: https://nodejs.org"
  exit 1
fi

# ── .env: автосоздание ──
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    ok ".env создан из .env.example"
  else
    warn ".env.example не найден, создаю минимальный .env"
    cat > "$ENV_FILE" <<'EOF'
CONSOLE_API_HOST=127.0.0.1
CONSOLE_API_PORT=4310
VITE_CONSOLE_API_BASE_URL=http://127.0.0.1:4310
EOF
    ok ".env создан с дефолтами"
  fi
else
  ok ".env уже существует"
fi

# Подгружаем переменные из .env (без перезаписи уже заданных)
set -a
# shellcheck disable=SC1090
. "$ENV_FILE" 2>/dev/null || true
set +a

# Обновляем порты после загрузки .env
API_PORT="${CONSOLE_API_PORT:-4310}"

# ── Освобождение занятых портов ──
free_port() {
  local port="$1" name="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti TCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v ss >/dev/null 2>&1; then
    # ss не даёт PID напрямую без root, пробуем через fuser
    if command -v fuser >/dev/null 2>&1; then
      pids=$(fuser "$port/tcp" 2>/dev/null || true)
    fi
  fi

  if [ -z "$pids" ]; then
    return 0
  fi

  warn "Порт $port занят ($name) — убиваю процессы: $pids"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done

  # Ждём до 3 секунд пока порт освободится
  local waited=0
  while [ "$waited" -lt 3 ]; do
    sleep 1
    waited=$((waited + 1))
    local still=""
    if command -v lsof >/dev/null 2>&1; then
      still=$(lsof -ti TCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    fi
    if [ -z "$still" ]; then
      ok "Порт $port освобождён"
      return 0
    fi
  done

  # Не помогло — SIGKILL
  warn "Порт $port не освободился, SIGKILL..."
  for pid in $pids; do
    kill -9 "$pid" 2>/dev/null || true
  done
  sleep 1

  local final=""
  if command -v lsof >/dev/null 2>&1; then
    final=$(lsof -ti TCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  fi
  if [ -n "$final" ]; then
    err "Не удалось освободить порт $port. Убей вручную: kill -9 $final"
    exit 1
  fi
  ok "Порт $port освобождён (SIGKILL)"
}

free_port "$API_PORT" "console-api"
free_port "$UI_PORT"  "console-ui"

# ── Установка зависимостей ──
install_if_needed() {
  local dir="$1" name="$2" flags="${3:-}"
  if [ ! -d "$dir/node_modules" ]; then
    log "Ставлю зависимости: $name ..."
    if [ -n "$flags" ]; then
      npm --prefix "$dir" install $flags --silent 2>&1
    else
      npm --prefix "$dir" install --silent 2>&1
    fi
    ok "Зависимости $name установлены"
  fi
}

# Корневой workspace
install_if_needed "$ROOT_DIR" "workspace (root)"
# API и UI (на случай если workspace не подтянул)
install_if_needed "$API_DIR" "console-api"
install_if_needed "$UI_DIR"  "console-ui" "--legacy-peer-deps"

# ── Фикс inotify лимита (для file watchers) ──
CURRENT_WATCHES=$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 0)
DESIRED_WATCHES=524288
if [ "$CURRENT_WATCHES" -lt "$DESIRED_WATCHES" ]; then
  if command -v sudo >/dev/null 2>&1; then
    log "Увеличиваю лимит inotify watchers ($CURRENT_WATCHES -> $DESIRED_WATCHES)..."
    sudo sysctl -q fs.inotify.max_user_watches=$DESIRED_WATCHES 2>/dev/null && \
      ok "inotify лимит увеличен" || {
        warn "Не удалось увеличить inotify лимит — включаю polling для Vite"
        export VITE_USE_POLLING=1
      }
  else
    warn "sudo не доступен, лимит watchers мал ($CURRENT_WATCHES) — включаю polling"
    export VITE_USE_POLLING=1
  fi
fi

# ── PID-ы и cleanup ──
API_PID=""
UI_PID=""

cleanup() {
  echo ""
  log "Останавливаю процессы..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true
  [ -n "$UI_PID" ] && kill "$UI_PID" 2>/dev/null && wait "$UI_PID" 2>/dev/null || true
  ok "Всё остановлено"
}
trap cleanup INT TERM EXIT

# ── Auto-detect OpenCode server (for jobs worker) ──
detect_opencode_server() {
  # Look for a running opencode-cli serve process and extract its env
  local oc_pid=""
  oc_pid=$(pgrep -u "$(id -u)" -f 'opencode.*serve.*--port' 2>/dev/null | head -1) || true
  if [ -z "$oc_pid" ]; then
    oc_pid=$(pgrep -u "$(id -u)" -f 'opencode-cli.*serve' 2>/dev/null | head -1) || true
  fi

  if [ -n "$oc_pid" ] && [ -d "/proc/$oc_pid/environ" ] 2>/dev/null || [ -r "/proc/$oc_pid/environ" ]; then
    local oc_user oc_pass oc_port
    oc_user=$(tr '\0' '\n' < "/proc/$oc_pid/environ" 2>/dev/null | grep '^OPENCODE_SERVER_USERNAME=' | cut -d= -f2-) || true
    oc_pass=$(tr '\0' '\n' < "/proc/$oc_pid/environ" 2>/dev/null | grep '^OPENCODE_SERVER_PASSWORD=' | cut -d= -f2-) || true

    # Extract --port from command line
    oc_port=$(tr '\0' ' ' < "/proc/$oc_pid/cmdline" 2>/dev/null | grep -oP '(?<=--port )\d+' || true)
    if [ -z "$oc_port" ]; then
      # Try /proc/PID/cmdline differently
      oc_port=$(cat "/proc/$oc_pid/cmdline" 2>/dev/null | xargs -0 printf '%s\n' | grep -A1 '^--port$' | tail -1) || true
    fi

    if [ -n "$oc_port" ] && [ -n "$oc_user" ] && [ -n "$oc_pass" ]; then
      export OPENCODE_SERVER_URL="http://127.0.0.1:${oc_port}"
      export OPENCODE_SERVER_USERNAME="$oc_user"
      export OPENCODE_SERVER_PASSWORD="$oc_pass"
      ok "OpenCode server found: PID=$oc_pid port=$oc_port"
      return 0
    fi
  fi

  # Fallback: check if env vars are already set
  if [ -n "${OPENCODE_SERVER_URL:-}" ]; then
    ok "OpenCode server URL from env: $OPENCODE_SERVER_URL"
    return 0
  fi

  warn "OpenCode server not detected — jobs will fail until OPENCODE_SERVER_URL is set"
  return 1
}

detect_opencode_server || true

# ── Запуск API (tsx watch = hot-reload) ──
log "Запускаю API (hot-reload) на http://127.0.0.1:$API_PORT ..."
npm --prefix "$API_DIR" run dev 2>&1 &
API_PID=$!

# ── Запуск UI (Vite HMR) ──
log "Запускаю UI  (HMR)        на http://127.0.0.1:$UI_PORT ..."
npm --prefix "$UI_DIR" run dev 2>&1 &
UI_PID=$!

# ── Ждём пока сервисы поднимутся ──
API_BASE="http://127.0.0.1:$API_PORT"
UI_BASE="http://127.0.0.1:$UI_PORT"

log "Жду запуска сервисов..."
READY=0
for i in $(seq 1 30); do
  api_ok=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/api/v1/health" 2>/dev/null || echo "000")
  ui_ok=$(curl -sf -o /dev/null -w "%{http_code}" "$UI_BASE/" 2>/dev/null || echo "000")
  if [ "$api_ok" = "200" ] && [ "$ui_ok" = "200" ]; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 0 ]; then
  err "Сервисы не поднялись за 30 секунд!"
  [ "$api_ok" != "200" ] && err "  API ($API_BASE) — HTTP $api_ok"
  [ "$ui_ok"  != "200" ] && err "  UI  ($UI_BASE)  — HTTP $ui_ok"
  cleanup
  exit 1
fi

# ── Smoke-тесты эндпоинтов ──
SMOKE_PASS=0
SMOKE_FAIL=0
SMOKE_ERRORS=""

smoke_test() {
  local method="$1" path="$2" expect_code="$3" label="$4" body="${5:-}"

  local url="${API_BASE}${path}"
  local actual_code

  if [ "$method" = "GET" ]; then
    actual_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  else
    actual_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" "$url" 2>/dev/null || echo "000")
  fi

  if [ "$actual_code" = "$expect_code" ]; then
    printf "  ${GREEN}PASS${NC}  %-6s %-35s %s\n" "$method" "$path" "$actual_code"
    SMOKE_PASS=$((SMOKE_PASS + 1))
  else
    printf "  ${RED}FAIL${NC}  %-6s %-35s expected=%s got=%s\n" "$method" "$path" "$expect_code" "$actual_code"
    SMOKE_FAIL=$((SMOKE_FAIL + 1))
    SMOKE_ERRORS="${SMOKE_ERRORS}\n  ${RED}FAIL${NC} $method $path (expected $expect_code, got $actual_code)"
  fi
}

echo ""
log "Smoke-тесты API эндпоинтов..."
echo ""

# ── GET (read-only) эндпоинты ──
smoke_test GET  "/api/v1/health"            200 "Health check"
smoke_test GET  "/api/v1/profiles"          200 "List profiles"
smoke_test GET  "/api/v1/profiles/active"   200 "Active profile"
smoke_test GET  "/api/v1/agents"            200 "List agents"
smoke_test GET  "/api/v1/agents/sync-status" 200 "Agent sync status"
smoke_test GET  "/api/v1/providers"         200 "List providers"
smoke_test GET  "/api/v1/backups"           200 "List backups"
smoke_test GET  "/api/v1/jobs"              200 "List jobs"

# ── Валидация (должны вернуть 4xx, а не 500) ──
smoke_test POST "/api/v1/jobs"              400 "Create job — no body"
smoke_test PUT  "/api/v1/agents/test-key"   400 "Update agent — no body"
smoke_test PUT  "/api/v1/providers/test-key" 400 "Update provider — no body"
smoke_test GET  "/api/v1/jobs/nonexistent-id" 404 "Get job — not found"

# ── UI ──
ui_code=$(curl -s -o /dev/null -w "%{http_code}" "$UI_BASE/" 2>/dev/null || echo "000")
if [ "$ui_code" = "200" ]; then
  printf "  ${GREEN}PASS${NC}  %-6s %-35s %s\n" "GET" "UI /" "$ui_code"
  SMOKE_PASS=$((SMOKE_PASS + 1))
else
  printf "  ${RED}FAIL${NC}  %-6s %-35s expected=200 got=%s\n" "GET" "UI /" "$ui_code"
  SMOKE_FAIL=$((SMOKE_FAIL + 1))
fi

echo ""
SMOKE_TOTAL=$((SMOKE_PASS + SMOKE_FAIL))

if [ "$SMOKE_FAIL" -eq 0 ]; then
  ok "Все $SMOKE_TOTAL smoke-тестов прошли"
else
  err "$SMOKE_FAIL из $SMOKE_TOTAL smoke-тестов упали:"
  printf "$SMOKE_ERRORS\n"
  echo ""
  warn "Приложение запущено, но есть ошибки в эндпоинтах ^^"
fi

# ── Баннер ──
echo ""
printf "${BOLD}╔══════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║${NC}  ${GREEN}OpenCode Console запущена${NC}                    ${BOLD}║${NC}\n"
printf "${BOLD}║${NC}                                              ${BOLD}║${NC}\n"
printf "${BOLD}║${NC}  UI:   ${CYAN}http://127.0.0.1:%-5s${NC}                ${BOLD}║${NC}\n" "$UI_PORT"
printf "${BOLD}║${NC}  API:  ${CYAN}http://127.0.0.1:%-5s${NC}                ${BOLD}║${NC}\n" "$API_PORT"
printf "${BOLD}║${NC}                                              ${BOLD}║${NC}\n"
printf "${BOLD}║${NC}  ${YELLOW}Ctrl+C${NC} — остановить                         ${BOLD}║${NC}\n"
printf "${BOLD}║${NC}  Изменения в коде подхватываются автоматически${BOLD}║${NC}\n"
printf "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"
echo ""

# ── Мониторинг процессов ──
while true; do
  api_alive=0; ui_alive=0
  kill -0 "$API_PID" 2>/dev/null && api_alive=1
  kill -0 "$UI_PID"  2>/dev/null && ui_alive=1

  if [ "$api_alive" -eq 1 ] && [ "$ui_alive" -eq 1 ]; then
    sleep 2
    continue
  fi

  if [ "$api_alive" -eq 0 ] && [ "$ui_alive" -eq 0 ]; then
    warn "Оба процесса завершились"
    exit 0
  fi

  if [ "$api_alive" -eq 0 ]; then
    err "API процесс упал! Останавливаю UI..."
  else
    err "UI процесс упал! Останавливаю API..."
  fi
  cleanup
  exit 1
done
