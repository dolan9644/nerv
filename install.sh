#!/usr/bin/env bash
set -euo pipefail
NERV_ROOT="${HOME}/.openclaw/nerv"
OC_CONFIG="${HOME}/.openclaw/openclaw.json"
OC_CONFIG_BAK="${OC_CONFIG}.pre-nerv.bak"
NERV_MARKER="${NERV_ROOT}/.nerv_installed"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[NERV]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

log "NERV v6 安装开始"
command -v openclaw &>/dev/null || error "未检测到 OpenClaw CLI"
command -v node &>/dev/null || error "未检测到 Node.js"

if [ -f "${NERV_MARKER}" ]; then
  read -p "已安装，覆盖？(y/N) " -n1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

log "备份 openclaw.json"
cp "${OC_CONFIG}" "${OC_CONFIG_BAK}"

log "初始化 nerv.db"
mkdir -p "${NERV_ROOT}/data/db"
command -v sqlite3 &>/dev/null && sqlite3 "${NERV_ROOT}/data/db/nerv.db" < "${NERV_ROOT}/scripts/init_db.sql"

log "注入 Agent 配置..."
node << 'EOF'
const fs=require('fs'),path=require('path');
const OC=path.join(process.env.HOME,'.openclaw','openclaw.json');
const NR=path.join(process.env.HOME,'.openclaw','nerv');
const w=n=>path.join(NR,'agents',n);
const c=JSON.parse(fs.readFileSync(OC,'utf-8'));
if(!c.agents)c.agents={};
if(!c.agents.list)c.agents.list=[];
c.agents.list=c.agents.list.filter(a=>!a.id.startsWith('nerv-'));
const IDS=['nerv-misato','nerv-seele','nerv-ritsuko','nerv-shinji','nerv-rei','nerv-asuka','nerv-kaworu','nerv-mari','nerv-eva02','nerv-eva03','nerv-eva00','nerv-eva13','nerv-eva01','nerv-gendo','nerv-eva-series'];
const A=[
{id:'nerv-misato',name:'葛城美里',workspace:w('misato'),identity:{name:'葛城美里'},heartbeat:{every:'5m',target:'none',lightContext:true,isolatedSession:true},tools:{allow:['exec','read','write','edit','sessions_send','sessions_list','sessions_history','web_search'],deny:['apply_patch','canvas','nodes']}},
{id:'nerv-seele',name:'SEELE',workspace:w('seele'),identity:{name:'SEELE'},tools:{allow:['read','sessions_send','sessions_list','sessions_history'],deny:['exec','write','edit','browser','canvas','nodes','cron']}},
{id:'nerv-ritsuko',name:'赤木律子',workspace:w('ritsuko'),identity:{name:'赤木律子'},tools:{allow:['exec','read','write','edit','apply_patch','sessions_send','sessions_list','sessions_history'],deny:['browser','canvas','nodes']}},
{id:'nerv-shinji',name:'碇真嗣',workspace:w('shinji'),identity:{name:'碇真嗣'},tools:{allow:['exec','read','write','edit','sessions_send','sessions_list','sessions_history','web_search','browser'],deny:['canvas','nodes']}},
{id:'nerv-rei',name:'绫波零',workspace:w('rei'),identity:{name:'绫波零'},tools:{allow:['read','write','sessions_send','sessions_list','sessions_history'],deny:['exec','edit','browser','canvas','nodes','cron']}},
{id:'nerv-asuka',name:'式波明日香',workspace:w('asuka-shikinami'),identity:{name:'式波明日香'},tools:{allow:['exec','read','write','edit','apply_patch','sessions_send'],deny:['browser','canvas','nodes','cron']}},
{id:'nerv-kaworu',name:'渚薰',workspace:w('kaworu'),identity:{name:'渚薰'},tools:{allow:['read','sessions_send'],deny:['exec','write','edit','browser','canvas','nodes','cron']}},
{id:'nerv-eva01',name:'EVA-01',workspace:w('eva-01'),identity:{name:'EVA-01'},tools:{allow:['exec','read','write','sessions_send'],deny:['edit','browser','canvas','nodes']}},
{id:'nerv-mari',name:'真希波',workspace:w('mari'),identity:{name:'真希波'},tools:{allow:['read','write','browser','web_search','sessions_send'],deny:['exec','edit','canvas','nodes','cron']}},
{id:'nerv-eva02',name:'EVA-02',workspace:w('eva-02'),identity:{name:'EVA-02'},tools:{allow:['read','web_search','sessions_send'],deny:['exec','write','edit','browser','canvas','nodes','cron']}},
{id:'nerv-eva03',name:'EVA-03',workspace:w('eva-03'),identity:{name:'EVA-03'},tools:{allow:['read','write','web_search','sessions_send'],deny:['exec','edit','browser','canvas','nodes','cron']}},
{id:'nerv-eva00',name:'EVA-00',workspace:w('eva-00'),identity:{name:'EVA-00'},tools:{allow:['read','write','sessions_send'],deny:['exec','edit','browser','canvas','nodes','cron']}},
{id:'nerv-eva13',name:'EVA-13',workspace:w('eva-13'),identity:{name:'EVA-13'},tools:{allow:['read','write','sessions_send'],deny:['exec','edit','browser','canvas','nodes','cron']}},
{id:'nerv-gendo',name:'碇源堂',workspace:w('gendo'),identity:{name:'碇源堂'},tools:{allow:['read','sessions_send'],deny:['exec','write','edit','browser','canvas','nodes','cron']}},
{id:'nerv-eva-series',name:'量产机',workspace:w('eva-series'),identity:{name:'量产机'},tools:{allow:['read','write','sessions_send'],deny:['exec','edit','browser','canvas','nodes','cron']}}
];
c.agents.list.push(...A);
if(!c.tools)c.tools={};
if(!c.tools.agentToAgent)c.tools.agentToAgent={enabled:true,allow:[]};
c.tools.agentToAgent.enabled=true;
const existing=new Set(c.tools.agentToAgent.allow||[]);
IDS.forEach(id=>existing.add(id));
c.tools.agentToAgent.allow=[...existing];
if(!c.session)c.session={};
c.session.visibility='all';
fs.writeFileSync(OC,JSON.stringify(c,null,2));
console.log('Done:'+A.length+' agents');
EOF

log "配置备份脚本..."
mkdir -p "${NERV_ROOT}/data/backups"
cat > "${NERV_ROOT}/scripts/lilith_backup.sh" << 'BK'
#!/usr/bin/env bash
DB="${HOME}/.openclaw/nerv/data/db/nerv.db"
DIR="${HOME}/.openclaw/nerv/data/backups"
D=$(date +%Y%m%d)
mkdir -p "$DIR"
[ -f "$DB" ] && cp "$DB" "$DIR/nerv_$D.db" && find "$DIR" -name "nerv_*.db" -mtime +7 -delete
BK
chmod +x "${NERV_ROOT}/scripts/lilith_backup.sh"

log "注册 NERV Cron Jobs..."
node << 'CRON_EOF'
const fs=require('fs'),path=require('path');
const CRON_FILE=path.join(process.env.HOME,'.openclaw','cron','jobs.json');
let data={jobs:[]};
try{data=JSON.parse(fs.readFileSync(CRON_FILE,'utf-8'));}catch(e){}
if(!data.jobs)data.jobs=[];

const NERV_CRON_IDS=['nerv-spear-sync','nerv-security-probe','nerv-memory-purify'];
data.jobs=data.jobs.filter(j=>!NERV_CRON_IDS.includes(j.id));

data.jobs.push(
  {id:'nerv-spear-sync',agentId:'nerv-misato',name:'NERV · Spear 状态对齐',description:'每 5 分钟执行 DAG 孤儿节点检测 + 漏调度回收 + 环路熔断',enabled:true,schedule:{kind:'cron',expr:'*/5 * * * *',tz:'Asia/Shanghai'},sessionTarget:'isolated',wakeMode:'now',payload:{kind:'agentTurn',message:'静默执行 Spear 状态对齐。执行: node ~/.openclaw/nerv/scripts/spear_sync.js。读取 JSON 输出。如果 orphans/missedDispatches/circuitBreaks 任一非空，对每个异常节点执行 sessions_send 通知对应 Agent 重新认领。如果全部为空，回复 HEARTBEAT_OK。执行结束后 MUST 立即 sessions.clear 销毁全部上下文。',timeoutSeconds:120},delivery:{mode:'none'}},
  {id:'nerv-security-probe',agentId:'nerv-seele',name:'NERV · SEELE 安全巡检',description:'每 30 分钟执行安全探针，检测未授权执行与路径越界',enabled:true,schedule:{kind:'cron',expr:'*/30 * * * *',tz:'Asia/Shanghai'},sessionTarget:'isolated',wakeMode:'now',payload:{kind:'agentTurn',message:'静默执行安全巡检。执行: node ~/.openclaw/nerv/scripts/security_probe.js --window 30。读取 JSON 输出。如果 anomalies 数组为空，回复 HEARTBEAT_OK。如果有异常：按 severity 严重程度，对 CRITICAL 级别的立即用 write 工具写入 sandbox_io/seele_alert_<timestamp>.json 并 sessions_send 通知 misato；对 HIGH 级别的写入审计日志。执行结束后 MUST 立即 sessions.clear。',timeoutSeconds:120},delivery:{mode:'none'}},
  {id:'nerv-memory-purify',agentId:'nerv-rei',name:'NERV · REI 记忆提纯',description:'每天凌晨 3:00 执行 memory_queue 分页消费与提纯',enabled:true,schedule:{kind:'cron',expr:'0 3 * * *',tz:'Asia/Shanghai'},sessionTarget:'isolated',wakeMode:'now',payload:{kind:'agentTurn',message:'静默执行记忆提纯。执行: node ~/.openclaw/nerv/scripts/memory_purify.js --batch-size 100。读取控制台输出的统计数据。如果 total_processed > 0，将统计摘要写入 memory_queue/purify_report_<date>.md。执行结束后 MUST 立即 sessions.clear。',timeoutSeconds:600},delivery:{mode:'none'}}
);

fs.writeFileSync(CRON_FILE,JSON.stringify(data,null,2));
console.log('Done: 3 NERV cron jobs registered');
CRON_EOF

cat > "${NERV_MARKER}" << MK
{"installed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","version":"6.1","agents":15,"cron_jobs":4,"backup":"${OC_CONFIG_BAK}"}
MK

echo ""
log "✅ NERV v6.1 安装完成（15 Agent + A2A + 4 Cron Jobs）"
log "下一步: openclaw gateway restart"
