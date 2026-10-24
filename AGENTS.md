# Agent 开发入口

本文件适用于整个仓库。修改前阅读 [CONTRIBUTING.md](CONTRIBUTING.md)；它是人工开发和 Agent 共用的开发规范。环境命令见 [docs/development.md](docs/development.md)，架构见 [docs/architecture.md](docs/architecture.md)，安全边界见 [SECURITY.md](SECURITY.md)。

- 先检查工作区与现有改动，保留他人工作；使用 `codex/<topic>` 分支，改动围绕当前任务。
- 沿用仓库配置、模块边界和对应 ADR，不以放宽权限、版本或宿主身份检查修复失败。
- 使用独立测试数据；保护日常 Codex、原登录与真实草稿，测试不指向生产数据库。
- 按改动类型执行相关验证，明确源码、模拟、实机和最终包的证据范围；无法运行的检查如实说明。
- 有用户可见变化时同步维护 `CHANGELOG.md`、相关文档与验收说明；PR 写清最终行为、验证和限制。
- 凭据、数据备份和私有观察资料留在本机忽略目录；已发布标签与资产保持固定，发布遵守用户授权及现有审批流程。
