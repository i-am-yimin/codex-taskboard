# Codex Taskboard 换机验收交接

更新日期：2026-09-29。项目仍为 `0.1.0` 开发预览，尚未通过发布验收。

## 获取当前进展

远端仓库为 `https://github.com/i-am-yimin/codex-taskboard.git`，验收工作分支为 `codex/initial-implementation`。新机器执行：

```sh
git clone https://github.com/i-am-yimin/codex-taskboard.git
cd codex-taskboard
git switch --track origin/codex/initial-implementation
pnpm install --frozen-lockfile
```

如果新机器已有该分支，在干净工作树中执行 `git fetch origin`，再更新到 `origin/codex/initial-implementation`。先用 `git status` 检查当地未提交修改，避免覆盖它们。

需要 Node.js `22.16+`、pnpm `10.28.0`。真实服务需要 PostgreSQL `16+`；Windows 桌面构建需要 Rust stable、MSVC C++ 工具链、Windows SDK 和 WebView2。示例配置从 `.env.example` 复制到本机 `.env`，按 [部署说明](docs/deployment.md)填写本机数据库和会话密钥。

## 验收状态

- [开发预览验收记录](docs/acceptance.md)保存按日期排列的实际结果；[闭环验收计划](docs/closure-acceptance.md)给出 G0–G4 的通过条件；[进程归属设计](docs/adr/0003-managed-codex-ownership.md)解释桌面启动器和适配器的安全边界。
- G0 本机基础检查曾通过。本次换机交接的 `pnpm check` 退出码 0：类型检查、Lint、生产构建通过；Vitest 101 通过、15 项数据库用例按无数据库配置跳过。仍须在本次固定提交和另一台机器上复验数据库及浏览器测试，并核对同一提交的 CI 作业。
- G1 已实现包上下文辅助启动、私有句柄交接、真实进程和页面绑定、隔离宿主侧栏及草稿保护。2026-09-26 的已安装版本曾通过侧栏交互，草稿实际写入且未发送；多段落确认修复之后，还没有在重新安装的新包上完成成功回执及所有拒绝路径的闭环。新 Codex 版本 `26.924.1866.0` 的原生启动和隔离宿主已经验证，已安装产品的草稿及正常退出重启仍需复验。G1 未通过。
- G2 已有 NSIS 安装和隔离测试数据的局部验证；托盘正常退出、卸载与重装等完整流程未通过。G3 的真实双设备任务生命周期和 G4 发布门槛未通过。

换机后的首要任务是复验固定提交的基础检查，然后在新机器的隔离账号或测试数据目录安装同一提交生成的程序，继续 [闭环验收计划](docs/closure-acceptance.md)中的 G1、G2。不要沿用上台机器的 PID、CDP target、进程归属记录或 Codex 会话。切换宿主版本后重新核对页面标记、CSP、项目身份和草稿行为。

## 常用命令

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:db
pnpm test:e2e
pnpm test:offline
pnpm desktop:prepare
pnpm desktop:bundle
```

`pnpm test` 在没有 `TEST_DATABASE_URL` 时会跳过数据库集成测试。`pnpm test:db` 仅使用项目独立的 `*_test` 数据库；浏览器测试也需要先启动独立测试数据库。步骤见 [闭环验收计划](docs/closure-acceptance.md)。桌面代码、真实 Codex 宿主和 NSIS 安装器要在 Windows 上检查。

## 本机证据与数据

`.artifacts/acceptance/` 中的原始日志、截图、诊断程序和安装包按验收计划留在原机器，没有推送到 Git。仓库文档记录必要的结果、校验和和剩余步骤。`.env`、数据库、设备凭据、Codex profile、未发送草稿及其他用户数据也不随仓库迁移；另一台机器需要自己的隔离测试环境。

在继续真实桌面验收前，先阅读 [验收记录](docs/acceptance.md)最近的 2026-09-26 已安装程序与包上下文条目。那里逐项区分了已经观察到的成功路径、失败轮次及仍待复验的步骤。不要把开发预览提交标为正式 Release。
