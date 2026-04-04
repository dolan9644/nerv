---
name: nerv-codex
description: 调用 OpenAI Codex CLI 进行高效代码生成和批量代码修改。速度快，Token 消耗低。
tags:
  - ai
  - codex
  - code-generation
  - nerv
---

# nerv-codex · Codex CLI 集成

## 前置条件
需要安装 Codex CLI：`npm install -g @openai/codex`

## 使用方式
当任务需要快速代码生成或批量代码修改时调用此 Skill。

### 适用场景
- 快速代码生成（比 Claude Code 更快）
- 批量文件修改
- 代码审查自动化

### 调用
```bash
codex --prompt "实现一个 REST API..." --output /tmp/nerv/results/
```
