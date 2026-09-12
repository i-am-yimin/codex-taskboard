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
