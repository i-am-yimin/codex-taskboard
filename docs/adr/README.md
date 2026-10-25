# 架构决策索引

修改相关能力前先阅读对应决策。改变模块边界、权限、进程归属或持久化方案时，新建递增编号的 ADR，说明背景、决策、取舍与替代方案；保留旧决策的历史。

| ADR | 决策范围 |
| --- | --- |
| [0001 · 任务层](0001-task-layer.md) | 任务看板与 Codex 的职责划分 |
| [0002 · CSP 生命周期](0002-managed-csp-lifecycle.md) | 受管理实例策略的应用、恢复与清理 |
| [0003 · Codex 进程归属](0003-managed-codex-ownership.md) | 原生身份、私有通道与精确页面验证 |
| [0004 · 日常 Codex 连接](0004-daily-codex-connection.md) | 原环境接入、数据保护与能力限制 |
| [0005 · 账号主题](0005-account-themes.md) | 主题模型、同步、离线与冲突 |
| [0006 · 同级工作区视图](0006-peer-workspace-views.md) | 看板与完整会话工作区互斥呈现 |
| [0007 · 协作任务与运行分离](0007-collaborative-task-workflows.md) | 多人责任、人类验收、父子依赖、领取/运行分离和持久通知 |

[返回文档索引](../README.md)
