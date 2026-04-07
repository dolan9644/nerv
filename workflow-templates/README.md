# NERV Workflow Templates

这里存放 NERV 的标准 workflow 模板。

用途：

- 给 `gendo` 一个稳定的草案骨架
- 给 `misato` 一个稳定的 DAG 实例化来源
- 给未来的自动化注册/模板调用留出固定路径

设计原则：

- 模板不是运行时数据库记录
- 模板不是 prompt
- 模板是“可实例化 DAG 草案”

目录约定：

```text
workflow-templates/
  <domain>/
    <subdomain>/
      <template-id>.template.json
```

第一批优先只落：

- `commerce_operations/social_media`
