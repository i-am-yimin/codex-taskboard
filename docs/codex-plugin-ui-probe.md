# 官方插件 UI 合成原型

日期：2026-10-29。此原型仅验证官方路线，不接入账号、任务 API、数据库或运行器，不随桌面包启动。

通过支持 stdio 的 MCP 测试客户端运行：

```powershell
pnpm exec tsx scripts/prototypes/codex-plugin-ui.ts
```

使用锁定的 `@modelcontextprotocol/sdk` 开发依赖。原型版本为 `0.0.2`，一个只读合成工具声明 global/thread 两种入口，并指向 `ui://taskboard-compatibility/v2/synthetic.html`。HTML 展示可展开的合成任务，不访问业务网络、账号、存储或模型。stdout 只用于 MCP，输入结束时关闭。

HTML 按官方 [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)发送 `ui/initialize`，只接受父窗口对应请求的响应，成功后发送 `ui/notifications/initialized`。拒绝、协议不符或 8 秒超时显示固定错误并清理监听器；迟到响应不将失败改写为成功。握手只传合成能力元数据，原型不调用工具或发送会话消息。

`tests/desktop.plugin-ui-probe.test.ts` 分别验证 MCP 契约和独立 Chromium 中的标准桥接。浏览器模拟不证明 Codex 显示了侧栏或会话面板；真实证据单列如下。

## 完整本地插件包

为当前平台生成新的独立 marketplace 目录：

```powershell
pnpm exec tsx scripts/prototypes/package-codex-plugin-ui.ts I:\acceptance\taskboard-ui-probe
```

输出目录的父目录须存在，输出目录须为新的绝对路径。生成器拒绝覆盖已有目录，不安装插件、不修改 Codex 配置。包包含 `plugin.json`、`mcp.json`、合成 MCP 服务的自包含 CommonJS 入口和当前构建进程使用的 Node；marketplace 指向包内目录。运行时启动命令采用包内 `./runtime/` 路径，参数和工作目录使用 `${PLUGIN_ROOT}`，不依赖源码仓库或缓存旁的 `node_modules`。这是当前平台的本地验收包，不宣称一个二进制包跨平台运行。

自动检查共 6 项通过：源码 stdio、SDK 内存连接、带中文/空格的缓存搬移与拒绝覆盖，以及浏览器中的初始化成功、拒绝和超时。浏览器成功路径还检查非父窗口消息与错误请求号不能授予就绪、只确认一次，以及实际展开合成任务且不发起网络请求。打包过程曾因顶层 await 无法转为 CommonJS 而失败，修复为异步启动后通过。

本机 Codex `26.1021.3705.0` 自带 CLI `0.164.0-alpha.11.1` 在独立 `CODEX_HOME` 中实际安装、启用了完整插件。其 app-server 的只读诊断确认一个 MCP 服务、合成工具、HTML 资源及 global/thread 元数据。首两次包检查保留了实际拒绝：stdio 不接受 HTTP 认证扩展，便携格式的启动命令不接受外部绝对路径；最终包按实际运行时的明确格式要求修正，未调整权限策略。此类 app-server 插件方法尚在开发中，仅用于本原型诊断，不进入 Taskboard 生产客户端。

原型打包依据官方[插件格式](https://developers.openai.com/plugins/build/plugins)和[本地 stdio 示例](https://developers.openai.com/plugins/deploy/desktop-only)。具体独立目录安装命令可用当前客户端的 `codex plugin marketplace add`、`codex plugin add`；先明确隔离的 `CODEX_HOME`，不要直接在日常配置执行验收命令。

## 真实宿主结果与限制

原登记的独立 Codex profile 已实际安装同一合成插件，并完成原生身份及只读工作区观察；当时导航和 frame 中没有该探针 UI。进入插件目录后，后续原生控制复核未通过，界面操作立即停止，未继续选择或打开面板。只读原生子诊断确认进程/创建时间、目录与监听者仍匹配，失败点是 TCP 目标探测超时；辅助页面数量不是已证实的拒绝原因。

上述首轮未据此断言 UI 不支持，记录仍保存在 `.artifacts/acceptance/2026-10-29-official-ui/`。后续新实例通过完整原生归属复核，实际个人目录与详情页显示了插件；旧静态 HTML 打开后出现“未能显示 Taskboard synthetic UI probe”。补齐标准初始化握手，更新插件版本和资源 URI 后，实际 global 界面已成功显示，状态为“宿主桥接已就绪（合成）”。

global 实机交互进一步绑定该原生进程的精确主页面、由该宿主生成的唯一 MCP App sandbox 目标和默认执行上下文，确认合成标题、握手状态及唯一任务后展开；合成负责人 A、开发者 B、验收人 C 已实际显示。未修改宿主 CSP、权限或门禁，未注入 Taskboard 侧栏；这是官方合成 UI 的独立证据，不是普通浏览器打开 HTML 的效果。导航后曾再次复核失败，当前操作停止；后续新的完整原生复核通过后才继续，未扩大超时。

详情页的“在聊天中试用”打开了带插件提及的空白 Codex 草稿；当前草稿和标签页菜单中未观察到可验收的 thread 面板。该草稿未发送；没有使用已有真实会话或模型回复补造面板证据。因此 thread 仍未验收，不能从这次空白草稿观察推断所有会话均不支持面板。

两轮后续独立实例均已退出，正常关闭后残留的进程经精确身份和保留的完整测试 profile 备份复核后回收；私有控制已释放、测试插件已卸载、独立配置按原字节恢复，日常进程与配置摘要保持。证据分别保存在本机忽略目录 `.artifacts/acceptance/2026-10-29-official-ui-transport/` 和 `.artifacts/acceptance/2026-10-29-official-ui-initialized/`，后一目录包含 global 显示、交互及清理记录。

官方 [Extensions](https://developers.openai.com/plugins/build/extensions) 的 UI 章节明确描述 ChatGPT；[连接与测试](https://developers.openai.com/plugins/deploy/connect-chatgpt)要求完整插件在实际宿主验证。当前只在独立配置/profile 安装原型；当前版本的 global 合成界面已验收，thread 面板和业务登录、撤权、同步仍未验收，不能宣布官方路线已替代结构适配。0.1.9 固定安装候选仍来自 `81ef9d1`，这些开发原型补充没有进入其产品载荷。

真实验收须在独立环境登记完整插件，确认全局入口、会话面板和合成任务展开，记录宿主版本、账户能力与界面结果。只发现工具、读取资源、在普通浏览器打开 HTML 或 ChatGPT 上的效果均不能判定 Codex UI 通过。宿主若不提供入口，记录具体观察并继续使用 [ADR 0008](adr/0008-codex-structure-compatibility.md) 的有限结构路线。
