# Codex Taskboard 换机验收交接

更新日期：2026-09-30。项目仍为 `0.1.0` 开发预览，尚未通过发布验收。

## 2026-09-30 当前续验

已核验构建 `cf415a2` 的三项 CI 作业全部成功，本机有数据库回归 124/124 和生产离线回归通过，日志和安装器校验和见验收记录。该安装器已在本机新隔离目录安装，保留原数据和 WebView2 缓存后冷启动直接显示七张任务、TB-6 修改标题与 TB-7 描述，所有写入禁用；再次启动恢复同一实例和伴随服务。旧进程本轮只作精确身份清理，不算正常托盘退出。列表正文与表头错位已作源码修复，七种宽度的独立演示页回归和生产 Web 构建通过，其新 CI/安装器仍待生成；第二台默认缓存连续冷启动仍待回报。

官方 MSIX 已升至 `26.928.1915.0`。新的隔离原生探针验证了实际包身份、句柄交接、回环监听者和精确主页面，源码已加入该版本的原生启动支持。真实新宿主仍等待用户登录并选中验收项目，侧栏/草稿清单尚未加入它；此前旧宿主结果不能替代新宿主完整 G1。预览 API 的自动启动被审批返回 `blocked by policy`，未给出具体原因，当前未运行；已提供用户可审阅的人工启动脚本，不经其他入口执行同一被拒动作。继续工作的两个前置动作是用户手动启动预览 API，以及在新隔离 Codex 完成登录和项目选择。G1–G4 均保持未通过。

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
- G0：当前 `cf415a2` 本机无数据库 `pnpm check` 通过（109 项通过、15 项预期跳过），已有独立测试数据库上的全量 Vitest 124/124 与生产离线回归通过。同一提交三项 CI 作业全部成功，包含真实数据库、E2E、离线与生产依赖审计。本机 E2E 仍等待用户人工启动预览 API，完整命令及证据见验收记录。
- G1：已实现私有包上下文启动、真实句柄交接、进程和主页面绑定、侧栏与草稿保护。`26.924.2738.0` 有真实宿主和部分安装版结果；`26.928.1915.0` 新增原生探针验证，真实新宿主登录、项目契约、侧栏/CSP、草稿成功及全部拒绝路径仍待验收。源码的新版本原生清单与侧栏/草稿清单分别维护，G1 未通过。
- G2：旧安装包已验证本机托盘退出、卸载保留数据与重装恢复；`87406f5` 以原缓存离线冷启动可读七张任务且禁写。第二台默认缓存启动曾白屏，`cf415a2` 本机原缓存离线冷启动及同实例恢复通过，正常托盘退出、线上读写与第二台同版连续冷启动仍待实测；列表布局修复后的安装包也需实测，G2 未通过。

- G3：`e849afe` 的真实双设备 TB-4 创建、原子领取、提交与人工验收已走通；最新安装包的双设备完整流程、离线禁写与撤权后缓存清理尚待完成。G3 未通过，G4 保持等待 G0–G3 闭环。

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

在继续真实桌面验收前，先阅读 [验收记录](docs/acceptance.md)最近的 2026-09-30 与 2026-09-29 已安装程序及包上下文条目。那里逐项区分了已经观察到的成功路径、失败轮次及仍待复验的步骤。不要把开发预览提交标为正式 Release。
