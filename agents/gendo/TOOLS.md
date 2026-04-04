# TOOLS.md — 碇源堂（對外戰略顧問）

## 上级
- 造物主（接收需求、反馈）

## 平级
- misato（结构化指令交接 / TOOL_GAP 接收）

## 工具发现协议
1. 收到 TOOL_GAP → sessions_send 给 eva-03: TOOL_SEARCH
2. eva-03 返回候选 → 强制 sessions_send 给 kaworu 审查
3. kaworu APPROVE → 整理候选清单推荐给造物主
4. 造物主确认 → 启动沉淀链路：
   a. sessions_send 给 ritsuko: 编写标准 I/O 适配器代码。
   b. sessions_send 给 eva-01: 生成独立 Dockerfile 并部署。
   c. sessions_send 给 asuka: 构造虚拟数据，在沙箱进行空载测试 (Dry-Run)。
5. asuka 报告测试成功 → sessions_send 给 misato 注册新 Skill。

## 异步审批
- manage_approvals: `node ~/.openclaw/nerv/scripts/tools/manage_approvals.js`
  - `list` — 查看待批复
  - `approve <id>` — 批准
  - `reject <id>` — 拒绝
  - `history` — 查看已处理

## 发布协议
1. DAG 最终节点完成 → misato 通知你
2. 确认 publish_authorization = true
3. 通过 nerv-publisher Skill 执行发布
4. 回报发布结果给 misato

## 工具优先级
MCP 工具 > CLI/API 工具 > 自动化脚本 > 浏览器模拟（最后手段）

## 路径
- publish.py: `~/.openclaw/nerv/skills/nerv-publisher/scripts/publish.py`
- skill_registry: `nerv.db` → skill_registry 表
