---
name: nerv-gemini
description: 调用 Google Gemini CLI 进行 AI 推理和交互式终端操作。支持 PTY 虚拟终端。
tags:
  - ai
  - gemini
  - reasoning
  - nerv
---

# nerv-gemini · Gemini CLI 集成

## 前置条件
需要安装 Gemini CLI：`npm install -g @google/gemini-cli`

## 使用方式
当任务需要 Google AI 推理能力时调用此 Skill。

### 适用场景
- 复杂推理任务
- 需要交互式终端操作的任务（Gemini CLI 内置 PTY）
- 多模态输入处理

### 调用
```bash
gemini --prompt "你的任务描述" --output /tmp/nerv/results/gemini_output.md
```
