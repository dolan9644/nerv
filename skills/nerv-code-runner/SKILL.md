---
name: nerv-code-runner
description: |
  NERV 安全封装的代码执行工具。
  由 ritsuko / asuka / eva-01 使用，强制在 Docker 沙箱内执行。
  禁止宿主机直接 exec。
tags:
  - code-execution
  - sandbox
  - docker
  - nerv
---

# nerv-code-runner · Docker 沙箱代码执行

## 你是什么

你是 NERV 系统的安全代码执行通道。所有代码在 Docker 容器内执行，宿主机零污染。

## 使用方式

### 参数

| 参数 | 必填 | 说明 |
|:-----|:-----|:-----|
| `code_path` | ✅ | 要执行的脚本文件路径 |
| `language` | ✅ | 语言：`python` / `node` / `bash` |
| `test_flag` | ❌ | 是否运行测试：`true` / `false` |
| `timeout_seconds` | ❌ | 超时时间（默认 60 秒） |

### 调用示例

```
使用 nerv-code-runner 执行以下 Python 脚本：
code_path: /tmp/nerv/scripts/data_processor.py
language: python
test_flag: true
timeout_seconds: 120
```

## 执行逻辑

```bash
docker run --rm \
  --network none \
  --memory 512m \
  --cpus 1.0 \
  -v /tmp/nerv/scripts:/scripts:ro \
  -v /tmp/nerv/results:/results \
  -w /scripts \
  python:3.12-slim \
  timeout ${timeout_seconds} python /scripts/${script_name}
```

## 安全限制

- ✅ `--rm`：容器随用随毁
- ✅ `--network none`：无网络访问（防数据外泄）
- ✅ `--memory 512m`：内存上限
- ✅ 脚本目录只读挂载（`:ro`）
- ✅ timeout 强制超时
- ❌ 不挂载宿主机 home 目录
- ❌ 不挂载 ~/.openclaw/
- ❌ 不使用 `--privileged`
