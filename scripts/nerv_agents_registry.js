/**
 * ███ NERV · openclaw.json Agent 注册块 ███
 *
 * 以下是需要追加到 ~/.openclaw/openclaw.json → agents.list[] 的注册配置。
 * 严格对照每个 Agent 的 SOUL.md 工具边界，配置物理级工具限制。
 *
 * 通信：全部通过 sessions_send，agentToAgent 已全局开启。
 * 安全：作战层 Agent 工具严格收敛，sandbox 强制启用。
 * 注意：seele 的 exec 权限在 SOUL.md 中通过绝对禁令硬编码约束（仅 security_probe.js + seele_breaker.js）
 */

import { homedir } from 'os';
import { join } from 'path';

const HOME = homedir();
const NERV_ROOT = join(HOME, '.openclaw', 'nerv');
const w = (name) => join(NERV_ROOT, 'agents', name);

// 共享环境变量 —— 每个 Agent 都需要注入
const NERV_ENV = {
  "NERV_ROOT": NERV_ROOT,
  "NERV_DB_PATH": join(NERV_ROOT, 'data', 'db', 'nerv.db'),
  "NERV_SANDBOX_IO": join(NERV_ROOT, 'data', 'sandbox_io'),
  "NERV_SHARED_DIR": join(NERV_ROOT, 'agents', 'shared'),
  "NERV_MEMORY_QUEUE": join(NERV_ROOT, 'memory_queue')
};

const NERV_AGENTS = [
  // ═══════════════════════════════════════
  // 指挥层（主动 Agent，有 Heartbeat）
  // ═══════════════════════════════════════
  {
    "id": "nerv-misato",
    "name": "葛城美里 · 全局路由",
    "workspace": w('misato'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "misato" },
    "compaction": { "mode": "off" },  // 禁用 compaction，状态全在 nerv.db
    "heartbeat": {
      "every": "5m",
      "target": "none",
      "lightContext": true,
      "isolatedSession": true
    },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send", "memory_search"],
      "deny": ["browser", "edit"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-seele",
    "name": "SEELE · 安全审计",
    "workspace": w('seele'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "seele" },
    "compaction": { "mode": "off" },
    "heartbeat": {
      "every": "30m",
      "target": "none",
      "lightContext": true,
      "isolatedSession": true
    },
    "tools": {
      "allow": ["exec", "read", "sessions_send"],  // exec 仅限 security_probe.js
      "deny": ["write", "edit", "browser"]
    },
    "session": { "visibility": "all" }
  },

  // ═══════════════════════════════════════
  // 编排层（被动 Agent + 特化 Heartbeat）
  // ═══════════════════════════════════════
  {
    "id": "nerv-ritsuko",
    "name": "赤木律子 · 代码编排",
    "workspace": w('ritsuko'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "ritsuko" },
    "compaction": { "mode": "off" },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],
      "deny": ["browser"]
    },
    "sandbox": { "mode": "all", "scope": "agent" },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-shinji",
    "name": "碇真嗣 · 数据编排",
    "workspace": w('shinji'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "shinji" },
    "compaction": { "mode": "off" },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send", "memory_search"],
      "deny": ["browser"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-rei",
    "name": "绫波零 · 记忆守护",
    "workspace": w('rei'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "rei" },
    "compaction": { "mode": "off" },
    "tools": {
      "allow": ["exec", "read", "write", "memory_search", "sessions_send"],
      "deny": ["browser", "edit"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-gendo",
    "name": "碇源堂 · 對外戰略顧問",
    "workspace": w('gendo'),
    "model": {
      "primary": "minimax-cn/MiniMax-M2.7",
      "fallbacks": ["minimax-cn/MiniMax-M2.7-highspeed"]
    },
    "identity": { "name": "gendo" },
    "compaction": { "mode": "off" },
    // 无 heartbeat：被动唤醒（用户/misato 触发）
    "tools": {
      "allow": ["read", "exec", "sessions_send", "memory_search"],
      "deny": ["write", "edit", "browser"]
    },
    "session": { "visibility": "all" }
  },

  // ═══════════════════════════════════════
  // 作战层（一次性电池，Ruthless GC）
  // 全部启用 sandbox，工具严格收敛
  // ═══════════════════════════════════════
  {
    "id": "nerv-asuka",
    "name": "明日香 · 代码调试",
    "workspace": w('asuka-shikinami'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "asuka" },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],
      "deny": ["browser", "edit", "memory_search"]
    },
    "sandbox": { "mode": "all", "scope": "agent" },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-kaworu",
    "name": "渚薰 · 代码审查",
    "workspace": w('kaworu'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "kaworu" },
    "tools": {
      "allow": ["read", "sessions_send"],  // 不能 exec，不能 write
      "deny": ["exec", "write", "edit", "browser"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-mari",
    "name": "真希波 · 爬虫采集",
    "workspace": w('mari'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "mari" },
    "skills": ["rss-fetcher"],
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],
      "deny": ["browser", "edit"]
    },
    "sandbox": { "mode": "all", "scope": "agent" },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva00",
    "name": "EVA-00 · 数据清洗",
    "workspace": w('eva-00'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-00" },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],  // exec 用于 schema_validator.py
      "deny": ["browser", "edit"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva01",
    "name": "EVA-01 · 部署运维",
    "workspace": w('eva-01'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-01" },
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],
      "deny": ["browser", "edit"]
    },
    "sandbox": { "mode": "all", "scope": "agent" },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva02",
    "name": "EVA-02 · 舆情监控",
    "workspace": w('eva-02'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-02" },
    "skills": ["rss-fetcher", "duckduckgo-search"],
    "tools": {
      "allow": ["read", "write", "sessions_send"],
      "deny": ["exec", "browser", "edit"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva03",
    "name": "EVA-03 · 深度搜索+工具发现",
    "workspace": w('eva-03'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-03" },
    "skills": ["tavily-search", "duckduckgo-search"],
    "tools": {
      "allow": ["exec", "read", "write", "sessions_send"],
      "deny": ["browser", "edit"]
    },
    "sandbox": { "mode": "all", "scope": "agent" },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva13",
    "name": "EVA-13 · 文案生成",
    "workspace": w('eva-13'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-13" },
    "skills": ["summarize", "docx-writer"],
    "tools": {
      "allow": ["read", "write", "sessions_send"],
      "deny": ["exec", "browser", "edit"]
    },
    "session": { "visibility": "all" }
  },
  {
    "id": "nerv-eva-series",
    "name": "量产机 · 视觉生成",
    "workspace": w('eva-series'),
    "model": { "primary": "minimax-cn/MiniMax-M2.7-highspeed" },
    "identity": { "name": "eva-series" },
    "skills": ["gemini-image-generate"],
    "tools": {
      "allow": ["write", "sessions_send"],
      "deny": ["exec", "read", "browser", "edit"]
    },
    "session": { "visibility": "all" }
  }
];

// 为每个 Agent 注入环境变量（避免脚本找不到 nerv.db）
const NERV_AGENTS_WITH_ENV = NERV_AGENTS.map(agent => ({
  ...agent,
  "env": NERV_ENV
}));

// 导出供验证
export { NERV_ENV };
export default NERV_AGENTS_WITH_ENV;
