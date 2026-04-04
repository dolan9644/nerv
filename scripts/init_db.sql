-- ███████████████████████████████████████████████████████████████
-- ██  NERV 本部战术作战系统 · 核心数据库初始化              ██
-- ██  nerv.db — SQLite WAL Mode                             ██
-- ██  v4.0 · 2026-04-04                                     ██
-- ███████████████████████████████████████████████████████████████

PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════════
-- agents：Agent 注册表及实时状态
-- 由 install.sh 初始化，由 Spear/Heartbeat 更新
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agents (
  agent_id        TEXT PRIMARY KEY,
  status          TEXT DEFAULT 'IDLE' CHECK(status IN ('IDLE','RUNNING','ERROR','CIRCUIT_BROKEN')),
  current_task_id TEXT,
  last_heartbeat  INTEGER,
  registered_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ═══════════════════════════════════════════════════════════════
-- tasks：每个用户任务的根记录（旨意）
-- 由 misato 创建，对应 DAG 的根节点
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  task_id         TEXT PRIMARY KEY,
  initiator_id    TEXT NOT NULL,                    -- 飞书 user_id / CLI 来源
  intent          TEXT NOT NULL,                    -- 任务意图描述
  priority        INTEGER DEFAULT 0,               -- 0=normal, 1=high, 2=urgent
  status          TEXT DEFAULT 'PENDING'
    CHECK(status IN (
      'PENDING',       -- 等待 misato 分解 DAG
      'RUNNING',       -- DAG 已分解，节点执行中
      'PAUSED',        -- 人工挂起（Adam 审批等待）
      'DONE',          -- 所有 DAG 节点完成
      'FAILED',        -- 不可恢复失败
      'CANCELLED'      -- 用户手动取消
    )),
  dag_json        TEXT,                             -- 原始 DAG 结构 JSON（misato 生成）
  result_summary  TEXT,                             -- 最终汇总结果
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ═══════════════════════════════════════════════════════════════
-- dag_nodes：DAG 分解后的每个执行节点
-- 由 misato 创建，由各 Agent 更新状态
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dag_nodes (
  node_id         TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  agent_id        TEXT NOT NULL,                    -- 分配给哪个 Agent
  description     TEXT,                             -- 节点任务描述
  status          TEXT DEFAULT 'PENDING'
    CHECK(status IN (
      'PENDING',         -- 等待前置依赖完成
      'RUNNING',         -- 正在执行
      'DONE',            -- 执行成功
      'FAILED',          -- 执行失败
      'BLOCKED',         -- 前置节点失败，无法执行
      'CIRCUIT_BROKEN'   -- seele 强制熔断
    )),
  result_path     TEXT,                             -- 执行结果文件路径
  retry_count     INTEGER DEFAULT 0,                -- 当前重试次数
  max_retries     INTEGER DEFAULT 3,                -- 最大允许重试次数
  depth           INTEGER DEFAULT 0,                -- 在 DAG 中的深度层级
  error_log       TEXT,                             -- 最近一次错误信息
  started_at      INTEGER,                          -- 实际开始时间
  completed_at    INTEGER,                          -- 实际完成时间
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════════
-- dag_edges：节点间依赖关系
-- from_node 完成后才能触发 to_node
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dag_edges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         TEXT NOT NULL,
  from_node       TEXT NOT NULL,                    -- 前置节点
  to_node         TEXT NOT NULL,                    -- 后置节点
  UNIQUE(task_id, from_node, to_node),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════════
-- audit_logs：全链路审计日志
-- 所有 Agent 操作均记录在此，MAGI 面板实时拉取
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         TEXT,
  node_id         TEXT,
  agent_id        TEXT NOT NULL,
  action          TEXT NOT NULL,                    -- DISPATCH / EXECUTE / COMPLETE / FAIL / RETRY / CIRCUIT_BREAK
  detail          TEXT,                             -- JSON 格式的详细信息
  duration_ms     INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ═══════════════════════════════════════════════════════════════
-- skill_registry：MARDUK 引擎扫描的 Skill 索引
-- 由 MARDUK 扫描脚本自动填充
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS skill_registry (
  skill_name      TEXT PRIMARY KEY,
  description     TEXT,                             -- Skill 描述（用于语义匹配）
  path            TEXT NOT NULL,                    -- Skill 绝对路径
  tags            TEXT,                             -- JSON 数组：标签分类
  compatible_agents TEXT,                           -- JSON 数组：可使用此 Skill 的 Agent ID
  pattern         TEXT,                             -- URL 匹配正则，例如 '*.douyin.com/*'（discovered 类专用）
  source_type     TEXT DEFAULT 'native'             -- 'native'（原生内置）或 'discovered'（EVA-03 自动发现）
    CHECK(source_type IN ('native', 'discovered')),
  adapter_path    TEXT,                             -- 适配器脚本路径（discovered 类专用）
  dockerfile_path TEXT,                             -- Docker 构建文件路径（discovered 类专用）
  last_used_at    INTEGER,                          -- 时间戳：最近一次被路由匹配使用
  vector          BLOB,                             -- 嵌入向量（LanceDB 可选）
  scanned_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ═══════════════════════════════════════════════════════════════
-- 索引：高频查询优化
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_dag_nodes_task     ON dag_nodes(task_id);
CREATE INDEX IF NOT EXISTS idx_dag_nodes_status   ON dag_nodes(status);
CREATE INDEX IF NOT EXISTS idx_dag_nodes_agent    ON dag_nodes(agent_id);
CREATE INDEX IF NOT EXISTS idx_dag_edges_task     ON dag_edges(task_id);
CREATE INDEX IF NOT EXISTS idx_dag_edges_from     ON dag_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_dag_edges_to       ON dag_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_audit_task         ON audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent        ON audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_skill_source_type  ON skill_registry(source_type);
CREATE INDEX IF NOT EXISTS idx_skill_last_used    ON skill_registry(last_used_at);

-- ═══════════════════════════════════════════════════════════════
-- NERV 初始武装包 (Seed Skills)
-- 提供系统的基础生存与抓取能力，避免冷启动瘫痪
-- native 类型：Rei GC 不可触碰，唯有造物主可删除
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO skill_registry 
  (skill_name, description, path, tags, compatible_agents, pattern, source_type)
VALUES 
  (
    'rss-fetcher', 
    'RSS/Atom 订阅源解析与结构化抓取', 
    '~/.openclaw/skills/rss-fetcher', 
    '["crawler", "feed"]', 
    '["nerv-mari", "nerv-eva02"]', 
    NULL, 
    'native'
  ),
  (
    'media-ninja', 
    '通用多媒体与网页回退抓取工具(Fallback)', 
    '~/.openclaw/skills/media-ninja', 
    '["crawler", "media", "fallback"]', 
    '["nerv-mari"]', 
    NULL, 
    'native'
  );

-- ═══════════════════════════════════════════════════════════════
-- pending_approvals：异步审批队列
-- gendo 提交待批复事项后 Session 正常结束（非阻塞）
-- 造物主上线后批量审批；adam_notifier 推送飞书卡片
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pending_approvals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       TEXT NOT NULL,
  approval_type TEXT NOT NULL CHECK(approval_type IN ('TOOL_DEPLOY','PUBLISH','CRON_CREATE')),
  payload       TEXT NOT NULL,                        -- JSON: 候选工具/发布内容/Cron 配置
  requested_by  TEXT NOT NULL,                        -- 'nerv-gendo'
  status        TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  resolved_at   INTEGER,
  resolved_by   TEXT                                  -- '造物主' / 'nerv-gendo'
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_type   ON pending_approvals(approval_type);

-- ═══════════════════════════════════════════════════════════════
-- harness_stats：物理护城河脚本自报告统计
-- 由 schema_validator.py / seele_breaker.js / adapter_lint.js
-- 在执行完毕后静默写入（零 LLM 侵入、零 Token 损耗）
-- MAGI 面板读取此表绘制"防毒墙拦截统计"
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS harness_stats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  harness_type  TEXT NOT NULL CHECK(harness_type IN (
    'schema_validator',    -- EVA-00 字段白名单校验
    'adapter_lint',        -- Ritsuko AST 契约校验
    'seele_breaker'        -- Seele 物理熔断器
  )),
  task_id       TEXT,                                -- 关联 task（可为空，独立调用时）
  result        TEXT NOT NULL CHECK(result IN ('PASS','FAIL','AUTO_REJECT')),
  detail        TEXT,                                -- JSON: rejected_count / lint_errors / breaker_alerts
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_harness_type     ON harness_stats(harness_type);
CREATE INDEX IF NOT EXISTS idx_harness_result   ON harness_stats(result);
CREATE INDEX IF NOT EXISTS idx_harness_created  ON harness_stats(created_at);
