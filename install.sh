#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NERV_ROOT="${HOME}/.openclaw/nerv"
OC_CONFIG="${HOME}/.openclaw/openclaw.json"
OC_CONFIG_BAK="${OC_CONFIG}.pre-nerv.bak"
CRON_FILE="${HOME}/.openclaw/cron/jobs.json"
CRON_FILE_BAK="${CRON_FILE}.pre-nerv.bak"
NERV_MARKER="${NERV_ROOT}/.nerv_installed"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[NERV]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

log "NERV 安装开始"
command -v openclaw &>/dev/null || error "未检测到 OpenClaw CLI"
command -v node &>/dev/null || error "未检测到 Node.js"
command -v python3 &>/dev/null || error "未检测到 python3"

if [ "${SCRIPT_DIR}" != "${NERV_ROOT}" ]; then
  log "检测到安装源不在标准路径，开始自举同步到 ${NERV_ROOT}"
  mkdir -p "$(dirname "${NERV_ROOT}")"
  if command -v rsync &>/dev/null; then
    rsync -a \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude 'data' \
      --exclude '.nerv_installed' \
      "${SCRIPT_DIR}/" "${NERV_ROOT}/"
  else
    mkdir -p "${NERV_ROOT}"
    for entry in "${SCRIPT_DIR}"/* "${SCRIPT_DIR}"/.[!.]* "${SCRIPT_DIR}"/..?*; do
      [ -e "${entry}" ] || continue
      base="$(basename "${entry}")"
      case "${base}" in
        .git|node_modules|data|.nerv_installed)
          continue
          ;;
      esac
      cp -R "${entry}" "${NERV_ROOT}/"
    done
  fi
  exec "${NERV_ROOT}/install.sh" "$@"
fi

if [ -f "${NERV_MARKER}" ]; then
  read -p "已安装，覆盖同步运行时配置？(y/N) " -n1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

mkdir -p "${NERV_ROOT}/data/db" "${NERV_ROOT}/data/backups" "$(dirname "${CRON_FILE}")"

if [ -f "${OC_CONFIG}" ] && [ ! -f "${OC_CONFIG_BAK}" ]; then
  log "备份 openclaw.json"
  cp "${OC_CONFIG}" "${OC_CONFIG_BAK}"
fi

if [ -f "${CRON_FILE}" ] && [ ! -f "${CRON_FILE_BAK}" ]; then
  log "备份 cron/jobs.json"
  cp "${CRON_FILE}" "${CRON_FILE_BAK}"
fi

log "初始化 canonical nerv.db"
if command -v sqlite3 &>/dev/null; then
  sqlite3 "${NERV_ROOT}/data/db/nerv.db" < "${NERV_ROOT}/scripts/init_db.sql"
else
  warn "未检测到 sqlite3，跳过 schema 初始化；首次脚本访问时会由 db.js 自动补表。"
fi

log "锁定 DB 布局并创建 legacy 兼容链接"
python3 "${NERV_ROOT}/scripts/ensure_db_layout.py" --fix >/dev/null

log "同步 NERV 运行时配置"
node "${NERV_ROOT}/scripts/sync_runtime_config.js" >/dev/null

log "刷新 Skill 注册表"
node "${NERV_ROOT}/scripts/skill_scanner.js" --json >/dev/null

log "安装系统级维护调度"
node "${NERV_ROOT}/scripts/install_system_scheduler.js" >/dev/null

log "执行安装后验证"
node "${NERV_ROOT}/scripts/post_install_validate.js" >/dev/null || warn "安装后验证返回异常，请检查 data/runtime/install_validation.json"

cat > "${NERV_MARKER}" << MK
{"installed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","version":"8.0","agents":15,"system_jobs":5,"openclaw_backup":"${OC_CONFIG_BAK}","cron_backup":"${CRON_FILE_BAK}"}
MK

echo ""
log "✅ NERV 安装完成"
log "已锁定 DB canonical 路径: ${NERV_ROOT}/data/db/nerv.db"
log "已同步 15 个 Agent 与 5 个系统级维护任务"
log "已写入安装验证快照: ${NERV_ROOT}/data/runtime/install_validation.json"
log "建议重启 Gateway 使配置完全生效: openclaw restart"
