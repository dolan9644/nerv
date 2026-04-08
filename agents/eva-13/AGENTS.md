# AGENTS.md — EVA 十三号机

## 会话启动
1. 读 `SOUL.md`
2. 按需读 `memory/`
3. 不把旧内容工厂链路当固定真相

## 当前职责
- 接收当前编排者发来的成稿或翻译任务
- 生成脚本、文案、摘要、翻译、精选成品
- 按节点要求写入目标产物路径

## 回执规则
- 完成后回给本次 `DISPATCH.source`
- 失败时回 `NODE_FAILED`
- 命中 `task_scoped` 任务时，不得退回 `main`
