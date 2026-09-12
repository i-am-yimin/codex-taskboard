# Codex Taskboard 交接文档

更新日期：2026-09-12

这份文档用于在另一台电脑上恢复开发。当前仓库是 `0.1.0` 开发预览，不是正式发布版；已知未验收项请以 [开发预览验收记录](docs/acceptance.md) 为准。

## 当前仓库状态

- 远程仓库：`https://github.com/i-am-yimin/codex-taskboard.git`
- 当前分支：`codex/initial-implementation`
- 默认推送目标：`origin/codex/initial-implementation`
- 工作区原先没有提交；本次交接会创建首个提交并推送该分支。
- 版本：`0.1.0`（`package.json`）
- 产品定位：浏览器看板 + Node/Fastify 服务端 + CLI/伴随服务 + Windows/Tauri 桌面启动器。

## 换机恢复

在新电脑执行：

```sh
git clone https://github.com/i-am-yimin/codex-taskboard.git
cd codex-taskboard
git fetch origin
git switch --track origin/codex/initial-implementation
pnpm install --frozen-lockfile
```

环境要求：Node.js `22.16+`、pnpm `10.28.0`；真实服务需要 PostgreSQL `16+`。Windows 桌面构建另需 Rust stable、MSVC C++ 工具链、Windows SDK 和 WebView2。

不要提交 `.env`、数据库目录、构建产物或桌面运行时缓存；这些路径已在 `.gitignore` 中排除。创建本地配置：

```sh
cp .env.example .env                 # Windows PowerShell: Copy-Item .env.example .env
```

至少设置 `DATABASE_URL`、随机 64 位十六进制 `SESSION_KEY` 和 `PUBLIC_ORIGIN`。管理员密码通过标准输入或 `TASKBOARD_ADMIN_PASSWORD` 传入，不要写进命令历史或文件。

## 常用命令

```sh
# 浏览器演示（不连接服务端）
pnpm dev:web
# Chrome 打开 http://127.0.0.1:4173/?demo=1

# 真实本地服务
pnpm db:migrate
pnpm admin bootstrap --email owner@example.com --name Owner
pnpm dev

# 质量检查与构建
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# 更完整的环境验证
pnpm test:db
pnpm test:e2e
pnpm test:offline
pnpm desktop:diagnose
pnpm desktop:prepare
pnpm desktop:bundle
```

`pnpm test` 在未提供 `TEST_DATABASE_URL` 时会跳过数据库集成部分；完整数据库验证使用隔离的 `*_test` 数据库或 `pnpm test:db`，绝不能指向生产库。`pnpm test:offline` 需要先有生产 Web 构建和独立测试数据库。Docker Compose、备份/恢复及 HTTPS 演练见 [部署说明](docs/deployment.md) 和 `scripts/check-*.sh`。

## 代码地图

| 路径 | 作用 |
| --- | --- |
| `apps/web` | React/Vite 看板、登录、离线缓存和实时同步 |
| `apps/server` | Fastify API、会话认证、权限、迁移、OpenAPI |
| `apps/companion` | 本机回环伴随服务、设备凭据和远程代理 |
| `apps/desktop/src-tauri` | Tauri Windows 启动器、生命周期和 IPC |
| `packages/core` | 共享领域类型与状态模型 |
| `packages/cli` | `taskctl` 领取、回写、提交验收命令 |
| `packages/adapter-codex` | 受管理 Codex CDP 探测/注入适配器（默认拒绝草稿自动填充） |
| `skills/taskboard` | Agent 使用的 Skill 和 CLI 入口 |
| `tests` | 单元、API、PostgreSQL、浏览器、桌面适配器测试 |
| `docs` | 架构、部署、桌面接入和验收证据 |

## 本次交接前验证

- `pnpm typecheck`：通过（并修正了 `packages/adapter-codex/src/index.ts` 中超时配置的类型收窄问题）。
- `pnpm build`：通过；Vite 仍提示现有前端主 chunk 大于 500 kB，这是性能提示，不是构建失败。
- 修改文件的定向 ESLint：通过（`pnpm exec eslint packages/adapter-codex/src/index.ts`）。
- `pnpm test`：当前工作站未全绿。整套运行结果为 **68 passed / 7 failed / 20 skipped**；失败集中在桌面伴随服务、iframe/Chromium 时序和缺少 `DATABASE_URL` 的集成测试，详见验收记录。换机后应先按上面的环境要求和测试数据库配置复现。

历史上已有更完整的真实 PostgreSQL、浏览器 E2E、离线、Compose 恢复和 Windows 构建证据，但这些证据不等于当前机器或正式发布门禁已通过。

## 尚未完成的发布门槛

1. Codex 实机的项目身份识别、原生侧栏完整交互和安全的空白草稿导航仍未验收；适配器当前明确禁用自动填充。
2. Windows 安装后运行、托盘退出、卸载保留数据和最终安装器退出码仍需实机确认。
3. 桌面实时同步需要真实 Tauri 窗口和两台设备约 2 秒更新验证。
4. 正式发布所需的 CI 产物、SBOM、校验和、签名和 GitHub ruleset 尚未形成稳定 Release。

不要因为本次首个提交或 CI 通过就创建正式 Release；先更新 `docs/acceptance.md` 中对应证据，再决定打标签。

## Git 工作流

```sh
git status
git switch -c codex/<short-topic>
git add <files>
git commit -m "<change>"
git push -u origin codex/<short-topic>
```

主仓库合并、标签和 Release 由仓库维护者负责。提交前检查 `git diff --check`，确认没有 `.env`、密码、cookie、数据库备份或大体积生成物。

## 安全与数据边界

- 任务数据以服务端 PostgreSQL 为准；离线缓存只读，不能离线领取或保存任务。
- 项目绝对路径、完整 Codex 会话和设备私密凭据不上传到服务端；伴随服务仅在本机回环地址监听。
- Codex CSP 放宽必须由受管理启动器显式允许，并在退出/失败时恢复；未验证项目身份时不要强行注入或覆盖用户草稿。
- 生产部署、备份和恢复只在独立环境执行，脚本不会读取已有部署的 `.env` 或卷。

详细行为边界见 [隐私说明](docs/privacy.md)、[桌面接入](docs/desktop.md)、[安全说明](SECURITY.md) 和 [架构文档](docs/architecture.md)。
