#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NERV_ROOT="${HOME}/.openclaw/nerv"
OC_CONFIG="${HOME}/.openclaw/openclaw.json"
CRON_FILE="${HOME}/.openclaw/cron/jobs.json"
NERV_MARKER="${NERV_ROOT}/.nerv_installed"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[NERV]${NC} $1"; }
warn()  { echo -e "${YELLOW}[NERV·WARN]${NC} $1"; }
error() { echo -e "${RED}[NERV·ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${RED}███ NERV 卸载 ███${NC}"
echo ""

if [ ! -f "${NERV_MARKER}" ]; then
  error "未检测到 NERV 安装标记。"
fi

echo "即将执行以下操作："
echo "  1. 从 openclaw.json 移除所有 nerv-* Agent"
echo "  2. 卸载 NERV 的系统级维护调度（LaunchAgents）"
echo "  3. 从 cron/jobs.json 移除 NERV 托管的 OpenClaw Cron"
echo "  4. 删除 ${NERV_ROOT}/data/ 目录（含 DB、备份、运行时产物）"
echo "  5. 保留源码目录，除非你二次确认完全删除"
echo ""
read -p "确认卸载？(y/N) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { log "取消卸载。"; exit 0; }

log "移除运行时配置中的 NERV Agent / Cron"
node "${NERV_ROOT}/scripts/sync_runtime_config.js" --remove >/dev/null
node "${NERV_ROOT}/scripts/install_system_scheduler.js" --remove >/dev/null || warn "系统级维护调度卸载失败，请手动检查 ~/Library/LaunchAgents/com.nerv.*.plist"

if [ -d "${NERV_ROOT}/data" ]; then
  rm -rf "${NERV_ROOT}/data"
  log "✅ 已删除 NERV data 目录"
fi

rm -f "${NERV_MARKER}"

echo ""
read -p "是否完全删除 ${NERV_ROOT} 目录？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "${NERV_ROOT}"
  log "✅ 已完全删除 NERV 目录"
else
  log "已保留源码目录"
fi

echo ""
log "███ NERV 卸载完成 ███"
log "请重启 Gateway 使配置生效：openclaw restart"
log "openclaw.json 与 cron/jobs.json 的历史备份未被自动删除。"
