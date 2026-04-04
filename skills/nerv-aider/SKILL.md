---
name: nerv-aider
description: 调用 Aider 进行 Git-native 代码编辑。自动 commit、多文件编辑、版本控制集成。
tags:
  - ai
  - aider
  - git
  - code-editing
  - nerv
---

# nerv-aider · Aider 集成

## 前置条件
需要安装 Aider：`pip install aider-chat`

## 使用方式
当任务需要 Git-native 的代码修改（自动 commit、多文件编辑）时调用此 Skill。

### 适用场景
- 需要保持 Git 历史完整的代码修改
- 多文件原子级编辑
- 代码重构（保持 commit 粒度精细）

### 调用
```bash
cd /path/to/repo && aider --message "重构 auth 模块..." --auto-commits
```
