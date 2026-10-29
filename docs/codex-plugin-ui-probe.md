# 官方插件 UI 合成原型

日期：2026-10-29。此原型仅验证官方路线，不接入账号、任务 API、数据库或运行器，不随桌面包启动。

通过支持 stdio 的 MCP 测试客户端运行：

```powershell
pnpm exec tsx scripts/prototypes/codex-plugin-ui.ts
```

使用锁定的 `@modelcontextprotocol/sdk` 开发依赖。一个只读合成工具声明 global/thread 两种入口，并指向 `ui://taskboard-compatibility/synthetic.html`。HTML 展示可展开的合成任务，无网络、账号、写入或模型调用。stdout 只用于 MCP，输入结束时关闭。

`tests/desktop.plugin-ui-probe.test.ts` 用 SDK 客户端验证初始化、工具发现、UI 资源及合成结果，只证明注册与资源契约，**不证明 Codex 显示了侧栏或会话面板**。

## 完整本地插件包

为当前平台生成新的独立 marketplace 目录：

```powershell
pnpm exec tsx scripts/prototypes/package-codex-plugin-ui.ts I:\acceptance\taskboard-ui-probe
```

输出目录的父目录须存在，输出目录须为新的绝对路径。生成器拒绝覆盖已有目录，不安装插件、不修改 Codex 配置。包包含 `plugin.json`、`mcp.json`、合成 MCP 服务的自包含 CommonJS 入口和当前构建进程使用的 Node；marketplace 指向包内目录。运行时启动命令采用包内 `./runtime/` 路径，参数和工作目录使用 `${PLUGIN_ROOT}`，不依赖源码仓库或缓存旁的 `node_modules`。这是当前平台的本地验收包，不宣称一个二进制包跨平台运行。

单元测试覆盖源码 stdio、SDK 内存连接，以及将插件搬移到带中文/空格的缓存目录、从不相关目录实际启动；重复生成时拒绝覆盖。三项通过。打包过程曾因顶层 await 无法转为 CommonJS 而失败，修复为异步启动后通过。

本机 Codex `26.1021.3705.0` 自带 CLI `0.164.0-alpha.11.1` 在独立 `CODEX_HOME` 中实际安装、启用了完整插件。其 app-server 的只读诊断确认一个 MCP 服务、合成工具、HTML 资源及 global/thread 元数据。首两次包检查保留了实际拒绝：stdio 不接受 HTTP 认证扩展，便携格式的启动命令不接受外部绝对路径；最终包按实际运行时的明确格式要求修正，未调整权限策略。此类 app-server 插件方法尚在开发中，仅用于本原型诊断，不进入 Taskboard 生产客户端。

原型打包依据官方[插件格式](https://developers.openai.com/plugins/build/plugins)和[本地 stdio 示例](https://developers.openai.com/plugins/deploy/desktop-only)。具体独立目录安装命令可用当前客户端的 `codex plugin marketplace add`、`codex plugin add`；先明确隔离的 `CODEX_HOME`，不要直接在日常配置执行验收命令。

## 当前真实 UI 检查的限制

原登记的独立 Codex profile 已实际安装同一合成插件，并完成原生身份及只读工作区观察；当时导航和 frame 中没有该探针 UI。进入插件目录后，后续原生控制复核未通过，界面操作立即停止，未继续选择或打开面板。只读原生子诊断确认进程/创建时间、目录与监听者仍匹配，失败点是 TCP 目标探测超时；辅助页面数量不是已证实的拒绝原因。

因此尚不能断言 Codex 支持或不支持所需 global/thread UI，也没有通过“可打开并使用面板”的验收。CLI 工具/资源成功仍不能替代 UI 成功。原始配置和数据保留，诊断控制及合成插件在结束时清理；清理和日常配置摘要的实际证据保存在本机忽略目录 `.artifacts/acceptance/2026-10-29-official-ui/`。

官方 [Extensions](https://developers.openai.com/plugins/build/extensions) 的 UI 章节明确描述 ChatGPT；[连接与测试](https://developers.openai.com/plugins/deploy/connect-chatgpt)要求完整插件在实际宿主验证。当前只在独立配置/profile 安装原型，日常配置保持原样；实际 Codex global/thread UI 尚未验收，不能宣布官方路线已替代结构适配。0.1.9 固定安装候选仍来自 `81ef9d1`，这些开发原型补充没有进入其产品载荷。

真实验收须在独立环境登记完整插件，确认全局入口、会话面板和合成任务展开，记录宿主版本、账户能力与界面结果。只发现工具、读取资源、在普通浏览器打开 HTML 或 ChatGPT 上的效果均不能判定 Codex UI 通过。宿主若不提供入口，记录具体观察并继续使用 [ADR 0008](adr/0008-codex-structure-compatibility.md) 的有限结构路线。
