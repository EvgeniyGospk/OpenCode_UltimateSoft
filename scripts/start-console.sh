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

# ── Запуск API (tsx watch = hot-reload) ──
log "Запускаю API (hot-reload) на http://127.0.0.1:$API_PORT ..."
npm --prefix "$API_DIR" run dev 2>&1 &
API_PID=$!

# ── Запуск UI (Vite HMR) ──
log "Запускаю UI  (HMR)        на http://127.0.0.1:$UI_PORT ..."
npm --prefix "$UI_DIR" run dev 2>&1 &
UI_PID=$!

# ── Баннер ──
sleep 1
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
