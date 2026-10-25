# 开发交接入口

更新日期：2026-10-25。新开发从 `main` 创建 `codex/<topic>` 分支；开始前检查工作区，阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [Agent 入口](AGENTS.md)。

## 当前版本与证据

| 范围 | 版本与状态 | 依据 |
| --- | --- | --- |
| Windows 客户端 | `0.1.7`，未签名公开预发布 | [0.1.7 验收](docs/acceptance-0.1.7.md)、[更新日志](CHANGELOG.md) |
| 服务端 | `0.1.3-preview.1`，独立发布 | [镜像验收](docs/acceptance-server-0.1.3-preview.1.md) |
| 日常 Codex 宿主 | 本轮精确验收 `26.1016.8622.0` | [桌面技术说明](docs/desktop.md)、[0.1.7 验收](docs/acceptance-0.1.7.md) |

版本状态不能代替正在开发提交的测试结果；固定发布标签和资产保持不变。

## 继续工作

1. 从[文档索引](docs/README.md)找到对应模块的指南、架构与 ADR；环境和命令以[开发指南](docs/development.md)为准。
2. 按 [CONTRIBUTING.md 的验证要求](CONTRIBUTING.md#验证要求)选择检查，使用独立测试数据。真实宿主测试保留日常登录、项目、聊天和草稿。
3. 将本轮结果写入对应版本验收文档或 PR，明确源码、模拟、实机和最终包的证据范围；未执行的检查如实记录。
4. 按[仓库维护流程](docs/maintenance.md)提交和清理分支。新的发布仍需维护者授权及现有审批。

早期换机过程、旧待办和失败轮次已保存在[历史交接记录](docs/archive/handoff-preview-2026-10.md)。各版本结论从[验收索引](docs/acceptance.md)查阅；不再在本文件追加实验流水。
