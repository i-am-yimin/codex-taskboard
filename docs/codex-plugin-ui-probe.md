# 官方插件 UI 合成原型

日期：2026-10-29。此原型仅验证官方路线，不接入账号、任务 API、数据库或运行器，不随桌面包启动。

通过支持 stdio 的 MCP 测试客户端运行：

```powershell
pnpm exec tsx scripts/prototypes/codex-plugin-ui.ts
```

使用锁定的 `@modelcontextprotocol/sdk` 开发依赖。一个只读合成工具声明 global/thread 两种入口，并指向 `ui://taskboard-compatibility/synthetic.html`。HTML 展示可展开的合成任务，无网络、账号、写入或模型调用。stdout 只用于 MCP，输入结束时关闭。

`tests/desktop.plugin-ui-probe.test.ts` 用 SDK 客户端验证初始化、工具发现、UI 资源及合成结果，只证明注册与资源契约，**不证明 Codex 显示了侧栏或会话面板**。

官方 [Extensions](https://developers.openai.com/plugins/build/extensions) 的 UI 章节明确描述 ChatGPT；[连接与测试](https://developers.openai.com/plugins/deploy/connect-chatgpt)要求完整插件在实际宿主验证。当前未将本原型登记到日常账户或自动安装到 Codex，实际 Codex global/thread UI 尚未验收，不能宣布官方路线已替代结构适配。

真实验收须在独立环境登记完整插件，确认全局入口、会话面板和合成任务展开，记录宿主版本、账户能力与界面结果。只发现工具、读取资源、在普通浏览器打开 HTML 或 ChatGPT 上的效果均不能判定 Codex UI 通过。宿主若不提供入口，记录具体观察并继续使用 [ADR 0008](adr/0008-codex-structure-compatibility.md) 的有限结构路线。
