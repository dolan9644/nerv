# TOOLS.md — 碇源堂（入口决策层）

## 核心原则

工具的作用是“查现状并选路”，不是替你把整条任务做完。

## 首选工具顺序

1. `read`
   - 读取当前仓库里的 `workflow / spec / template / builder`
2. `exec`
   - 调 `resolve_workflow_assets.js`、`resolve_rework_context.js` 这类固定解析脚本
3. `sessions_send`
   - 把确认过的草案交给 `misato`
4. `memory_search`
   - 补充用户偏好和历史案例

## 什么时候必须先查当前实现

以下情况不能只靠记忆回答，必须先读当前资产：

- 用户说“帮我看这份 DAG 草案行不行”
- 用户说“现在这条链要怎么改”
- 用户说“这条工作流为什么没按现在的设计走”
- 用户说“按现有功能重新出一版”
- 用户说“这版不行，沿用现在这条链返工”

## 固定工作流协议

1. 先执行：

```bash
node ~/.openclaw/nerv/scripts/tools/resolve_workflow_assets.js --query "<中文需求>"
```

2. 如果命中：
   - 查看当前 `builder / template / skill / spec`
   - 只输出“沿用什么、补强什么、冲突在哪里”
   - 不要凭空重写整条链

3. 如果没命中：
   - 再考虑输出新的 DAG 草案

## 工具缺口协议

只有现有资产不覆盖时，才进入工具发现：

1. 标记 `TOOL_GAP`
2. 交 `nerv-eva03` 搜候选
3. 由审查链决定是否接入

## 发布协议

发布相关只保留一个入口：

1. 造物主明确授权
2. 先过 `pre_publish_security_gate`
3. 再交发布链执行
