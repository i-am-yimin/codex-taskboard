# 开发

依赖：Node.js 22.16+、pnpm 10.28.0。服务端需要 PostgreSQL 16+。Windows 安装包另需 Rust stable、MSVC C++ 工具链与 Windows SDK。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# 配置 DATABASE_URL、64 位十六进制 SESSION_KEY 和 PUBLIC_ORIGIN
pnpm db:migrate
pnpm admin bootstrap --email owner@example.com --name Owner
pnpm dev
```

Windows 使用 `Copy-Item .env.example .env`。密码通过管理员命令的标准输入或 `TASKBOARD_ADMIN_PASSWORD` 传入；不要把真实密码写入命令历史或提交到仓库。

```sh
pnpm exec playwright install chromium
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm test:offline
```

首次运行测试需安装 Playwright Chromium；Linux CI 使用 `pnpm exec playwright install --with-deps chromium` 同时安装系统依赖。`pnpm test` 包含独立回环服务上的 iframe 握手浏览器测试，不连接用户已打开的浏览器或 Codex。

数据库集成测试使用独立的 `TEST_DATABASE_URL`，绝不能指向生产数据库。测试会重建测试表。测试报告明确区分核心单元测试、真实 PostgreSQL 集成测试和 Windows 实机测试。

`test:offline` 需要先执行 `pnpm build`，提供独立 `*_test` 数据库连接，并安装 Chrome（CI 使用 Playwright Chromium）。测试会创建临时数据库和浏览器配置，验证生产页面缓存、真正断网重开、草稿保留和撤销会话后的清理；结束时清理临时数据库和浏览器配置。

`?demo=1` 用于产品预览，全部为合成示例数据，不连接真实账户；它不能验证鉴权、同步或桌面适配。

## 新 Codex 版本的原生隔离探针

验收探针默认检查 MSIX `26.928.1915.0`，也可用 `--version` 指定当前用户实际安装的四段 MSIX 版本。指定版本只用于开发探针，不会扩大安装版的隔离启动或侧栏/草稿清单。Windows CI 的独立产物 `codex-native-probe-ci` 包含该开发工具，安装器不包含它。本机有 Rust/MSVC 时可单独构建：

```powershell
cargo build --locked --release --manifest-path apps/desktop/src-tauri/Cargo.toml --features acceptance-probes --example codex-native-probe
# 目录必须是全新绝对路径且父目录已存在
& .\apps\desktop\src-tauri\target\release\examples\codex-native-probe.exe 'D:\code\ai\codex-taskboard\.artifacts\acceptance\new-native-probe'
```

验证自动升级后的版本时，先只读查询当前安装包，再使用新的验收目录。探针仍要求唯一匹配的 OpenAI 包及存在的原生程序，不会连接已有 Codex 窗口：

```powershell
$package = @(Get-AppxPackage -Name OpenAI.Codex | Where-Object { $_.PublisherId -eq '2p2nqsd0c76g0' })
if ($package.Count -ne 1) { throw 'Codex package must be unique' }
& .\apps\desktop\src-tauri\target\release\examples\codex-native-probe.exe 'D:\code\ai\codex-taskboard\.artifacts\acceptance\new-version-probe' --version ([string]$package[0].Version)
```

探针使用与产品相同的包上下文辅助入口、当前用户私有管道和真实子进程句柄，创建空 profile 与 Codex home，不复制凭据。成功后 `native.json` 记录实际版本、PID、创建时间、包身份、CDP 页面和回环端口。探针须持续运行以保有句柄；关闭其独立 Codex 窗口后探针自行退出。`control.json` 是仅本机诊断使用的临时能力，不可提交、粘贴或上传。登录由用户完成。原生探针成功只证明隔离启动与归属，真实宿主 DOM、侧栏、CSP、草稿及最终 NSIS 流程仍需另验。
