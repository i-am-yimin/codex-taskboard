# 参与贡献

欢迎通过 Issue 讨论问题和提出建议，也欢迎从 fork 提交 PR。主仓库的写入、合并、标签和发布由 @i-am-yimin 维护；自动化不代替维护者发布。

1. 使用 Node.js 22.16+、pnpm 10.28.0，执行 `pnpm install --frozen-lockfile`。
2. 新建 `codex/<topic>` 分支；修改之前阅读 [架构](docs/architecture.md)。
3. 修改权限、事务或同步逻辑时增加覆盖真实业务边界的测试。
4. 运行 `pnpm check`；涉及界面时运行 `pnpm test:e2e` 并附截图。
5. 提交遵循 Conventional Commits，例如 `fix(server): reject stale task claims`。
6. PR 描述问题、最终行为、验证结果和已知限制。不要提交真实任务数据、令牌或本机路径。

新 Agent 接入实现 `AgentAdapter`；不要让业务核心依赖宿主 DOM。修改 API 或持久化格式应同步更新 OpenAPI、迁移和兼容文档。开发用模拟模式必须明确标注，不能作为实机兼容性证据。

本项目独立实现。参考项目只提供产品启发，请勿复制其代码、图标或截图作为本项目素材。
