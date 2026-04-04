---
name: nerv-obsidian
description: 通过 MCP 连接 Obsidian Vault，实现知识库的读取、搜索和写入。用于 rei（绫波零）的死海文书库管理。
tags:
  - obsidian
  - knowledge-base
  - mcp
  - memory
  - nerv
---

# nerv-obsidian · Obsidian MCP 集成

## 前置条件
- 安装 Obsidian
- 安装 Obsidian MCP 插件 或 Smart Connections 插件

## 使用方式
当 rei 需要检索或写入长期记忆时调用此 Skill。

### 功能
- 🔍 语义搜索 Vault 中的笔记
- 📝 写入新笔记（任务完成后沉淀知识）
- 🔗 发现笔记间的关联

### 调用
通过 MCP 协议连接本地 Obsidian Vault：
```
Vault 路径：~/Library/Mobile Documents/iCloud~md~obsidian/Documents/
```

### 沉淀规则
每个完成的 Pipeline 任务，由 rei 提取以下信息写入 Vault：
- 任务摘要
- 使用的工具和方法
- 关键数据和结论
- 下次同类任务的建议
