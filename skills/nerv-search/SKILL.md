---
name: nerv-search
description: 调用 Perplexity 深度搜索 API 进行多源检索、Fact-check 和引用回溯。由 eva-03 专用。
tags:
  - search
  - perplexity
  - fact-check
  - nerv
---

# nerv-search · Perplexity 深度搜索

## 前置条件
需要 Perplexity API Key 或 CLI 工具。

## 使用方式
当 eva-03 需要进行深度搜索和事实验证时调用此 Skill。

### 功能
- 🔍 多源深度搜索（非简单 Google 搜索）
- ✅ 自动交叉验证（Fact-check）
- 📎 返回引用 URL 和可信度评分

### 输出格式
```json
{
  "query": "原始查询",
  "results": [
    {
      "title": "...",
      "summary": "...",
      "url": "https://...",
      "confidence": "high|medium|low"
    }
  ],
  "sources_count": 5
}
```
