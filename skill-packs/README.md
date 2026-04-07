# NERV Skill Packs

这里存放 NERV 的领域能力包定义。

设计原则：

- skill pack 不是新 Agent
- skill pack 不是 runtime 配置文件
- skill pack 是可复用的能力说明，供：
  - `gendo` 结构化草案参考
  - `misato` 路由与模板实例化参考
  - README / 文档 / 未来自动化注册使用

目录约定：

```text
skill-packs/
  <domain>/
    <subdomain>/
      <pack-name>.md
```

第一批优先只落：

- `commerce_operations/social_media`

当某个 pack 被真实 workflow 验证后，才允许把稳定边界回写进 SOUL。
