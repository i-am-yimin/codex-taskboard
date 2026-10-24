# Windows 桌面版

> 当前状态（2026-10-24）：[客户端 0.1.4 Release](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.4) 已公开为未签名预发布。固定标签 `v0.1.4` / `a8ed9f4` 的实际安装包通过应用内连接、自动恢复、连续打开及原数据保留验收，见 [0.1.4 验收](acceptance-0.1.4.md)。操作见 [README 使用手册](../README.md#使用手册)。

桌面版是 Windows x64 的 Tauri 启动器。它在当前用户范围安装，使用安装资源目录中自带的 Node 运行时启动本机伴随服务，因此不要求安装系统 Node 或 Codex CLI。共享任务数据存放在服务器；本机凭据和仓库映射保存在 `%APPDATA%\CodexTaskboard`。卸载保留数据并重装恢复已在隔离测试目录实机通过，正式用户目录未参与该试验。

## 当前可用流程

运行 `pnpm desktop:build` 前会构建 Web、服务端命令和桌面运行时。`pnpm desktop:prepare` 会在 `apps/desktop/runtime` 生成安装器要打包的内容，包括 Node、伴随服务、CLI 和 Taskboard Skill。`pnpm desktop:bundle` 使用 Node 直接调用 Tauri CLI，并保留 Cargo 的 `--locked` 参数边界。

安装完成后，桌面窗口通过本机伴随服务访问远程任务服务器。桌面 Web UI 使用一次性的本机能力令牌和浏览器会话代理；`taskctl` 使用独立的当前用户 DPAPI 凭据，不能调用浏览器会话接口。

桌面事件通过伴随服务 SSE 转发，连接携带本机能力凭据，退出或断开时关闭上游订阅；远程不可达时缓存只读。两台真实 Windows 桌面窗口已验证任务创建、领取和结果提交无需刷新即可出现在第二台；用户反馈为“很快”，尚未取得精确延迟计时。

启动器先等待伴随服务完成初始化，并携带本次启动的能力凭据检查健康接口。每次网络探测限时 250ms，首次启动最多等待 30 秒，以容纳 Windows 凭据初始化。界面在成功后显示；运行时缺失、子进程提前退出、端口冲突或超时会显示错误，并保存到 `%APPDATA%\CodexTaskboard\launcher-diagnostic.txt`。`pnpm desktop:diagnose` 会读取该失败记录。

0.1.2 源码提供维护参数 `--quit-taskboard`：同一用户调用已安装程序时，通知当前 Taskboard 走与托盘退出相同的正常收尾流程；未运行时直接退出，不启动伴随服务或 Codex。退出请求优先于连接参数。自动化升级仍应先确认编辑已保存并备份本机数据。

旧安装版曾在 WebView2 默认目录中保留页面 Service Worker，升级后可能在启动时返回旧版入口文件并白屏。当前源码不再为桌面版注册该 worker，并让旧 worker 更新时退出和重新加载页面；已验收安装包在第二台真实默认目录中的升级和首屏恢复已通过，详见 G2 记录。该迁移只处理页面资源缓存，不清除本地登录、仓库映射或未发送草稿。

随包 CLI 位于安装器资源目录的 `runtime\taskctl.cmd`。开发阶段可验证其可执行性：

```powershell
apps\desktop\runtime\taskctl.cmd --help
```

该命令使用 `%APPDATA%\CodexTaskboard` 中的 CLI 配对密钥。常用操作包括 `list`、`get`、`claim --version`、`comment`、`link`、`release --version` 和 `submit --version`。对网络超时后的同一写操作，复用 `--idempotency-key <uuid>`。

PowerShell 调用 `.cmd` 并传入 JSON 时，CMD 会剥离参数内的双引号。`create`、`update` 等 JSON 写操作请直接调用同目录的随包 `node.exe` 和 `taskctl.cjs`，例如 `& "$runtime\node.exe" "$runtime\taskctl.cjs" create $spaceId $payloadJson`；这样 PowerShell 会保留 JSON 参数。`$runtime` 为安装目录中的 `runtime` 路径。

浏览器与 Agent 使用独立会话。首次使用 CLI，先启动伴随服务，再通过标准输入登录（密码不会成为进程参数）：

```powershell
$taskboardPassword = Read-Host 'Taskboard 密码' -AsSecureString
[System.Net.NetworkCredential]::new('', $taskboardPassword).Password | apps\desktop\runtime\taskctl.cmd login owner@example.com
Remove-Variable taskboardPassword
```

已验收安装包的桌面登录页提供“任务看板服务器”设置：输入服务器根地址（例如 `https://taskboard.example.com`），点击“保存服务器”，再使用管理员创建或邀请获得的账号登录。其他设备填写相同地址即可连接同一实例；成员只能看到获授权的空间。保存地址本身不会验证远程连接，实际连通性和账号验证在登录时完成。

地址要求 HTTPS；本机开发允许回环 HTTP，例如 `http://127.0.0.1:47830`。不支持带用户名、密码、子路径、查询参数或片段的 URL。配置保存在本机伴随服务的数据目录，重启后继续使用，不写入网页存储。

配置优先级是代码启动选项 `upstream`、`TASKBOARD_UPSTREAM` 环境变量、已保存地址、默认本机地址。显式启动配置会锁定界面编辑。已有浏览器或 CLI 登录时也不能更换地址；仍可登录当前服务器。`taskctl logout` 会撤销当前设备的两类会话并清除该账号的本机缓存、草稿和待提交结果，因此应先处理未同步工作，再退出并更换地址。保存新地址不会自动退出或删除数据。`v0.1.0` 安装包已包含此设置页。

连接页预览：[浅色](screenshots/desktop-connection-light.png) · [深色](screenshots/desktop-connection-dark.png) · [窄窗口](screenshots/desktop-connection-narrow.png)。截图来自完整生产 Web 页面及隔离的桌面连接模拟，不使用真实账户，也不代表安装后的 Tauri 程序已通过验收。

`runtime\install-taskboard-skill.cmd` 是明确的 Skill 安装操作。它只在 `%USERPROFILE%\.codex\skills\taskboard` 不存在时复制随包 Skill；如果同名用户 Skill 已存在，它会退出而不会覆盖。

该脚本不自动配置独立 Codex 的数据目录。当前独立启动器会移除继承的 `TASKBOARD_*` 环境变量，因此默认 Skill wrapper 所需的 `TASKBOARD_TASKBOARD_RUNTIME` 不保证存在；仅运行脚本或重启窗口不能证明配对成功。可让 Agent 读取随包 `runtime\skills\taskboard\SKILL.md`，并明确使用 `runtime\taskctl.cmd` 的绝对路径，操作范例见 [README 第 4 步](../README.md#4-配置-agent-的任务读写)。本轮未验证 Skill 自动发现与 Agent 自动执行，一键配对应在后续版本补齐。

## Codex 桌面集成状态

**0.1.4 已发布：** 在 Taskboard 主界面点击“连接 Codex”，直接打开或接入日常环境。已经运行但未启用连接时，应用内等待用户保存工作并正常退出一次后继续。接入成功后，普通启动 Taskboard 即可恢复侧栏，不依赖专用快捷方式；设置页可关闭自动连接，手动连接保留关闭选择。“打开 Codex”复用当前侧栏并恢复最小化或隐藏的原窗口。日常模式仍由用户手动粘贴草稿，独立环境保留兼容测试用途。精确支持 26.1016.8622.0，身份和版本校验保持，见[应用内接入说明](in-app-codex-connection.md)与 [0.1.4 验收记录](acceptance-0.1.4.md)。

设置页的“启动独立 Codex”使用独立 profile 和 Codex 数据目录，不接管用户已有实例。启动器只接受列入隔离启动清单的 MSIX 版本，并逐次核对进程句柄、回环监听者和精确页面。当前完整 G1 实机基线为 `26.1007.9446.0`：已验证侧栏开关、自适应看板和详情、未发送草稿的成功与拒绝路径、原生窗口退出和重启，以及受管理登录信息保留。其他精确版本的阶段性证据保留在[验收记录](acceptance.md)，不自动扩大为版本范围。

侧栏、项目发现与草稿还有独立的宿主版本清单和页面检查。版本、进程归属、项目身份或空白编辑器不能确认时，界面保持不可用；草稿不会自动发送或领取任务。`openThread` 尚未验证会话路由，保持不可用。已验收候选的完整 G1 结果见[验收摘要](acceptance-0.1.0.md)。

2026-10-20 的 `92873ed` 后续兼容候选已在实际 NSIS 安装版验证精确版本 `26.1013.4894.0`：产品按钮启动、真实侧栏与任务交互、三种原生窗口宽度、nonce 就绪、外部重载及实际 CSP 恢复、草稿成功和拒绝、正常原生退出/重启保留，以及安装器覆盖升级后的 Taskboard 冷启动保留。托盘恢复为用户报告，退出后的进程和端口由 OS 核对；未冒称自动捕获恢复。安装包仍为 `NotSigned`。具体结果、观察器失败及范围见[安装版兼容验收](acceptance-host-26-1013.md)；`v0.1.0` 已固定资产和原验收范围保持。

`pnpm desktop:diagnose` 只探测指定回环 CDP 端点，并输出 `probe-only`、`unavailable` 或诊断信息；它不会注入页面，也不能单独证明宿主兼容。程序不改写 Codex 安装文件；仅在归属校验通过后接入日常窗口，退出时撤销 DOM/CSP 更改。

## 早期开发预览验证（2026-09-08，历史）

以下只记录早期安装包及当时尚未完成的检查；当前 `v0.1.0` 的结论和资产摘要见文件顶部链接。

NSIS 已实际生成：`apps/desktop/src-tauri/target/release/bundle/nsis/Codex Taskboard_0.1.0_x64-setup.exe`，24,401,145 bytes，SHA-256 `45263CB7B1F71AE0CE8F0C114E68B7B9B7B486D98A2F2E9F8403BAE50C6D9AAB`，未签名。Tauri final release 打包耗时 17 分 40 秒；CRT 缺少 PDB 警告为非致命警告。

安装器已以 `currentUser /S /NS` 安装到隔离的中文、带空格目录 `.artifacts/nsis-smoke-1788855766733/`。安装前未发现旧注册、快捷方式、Run 项或伴随数据；安装后程序、Node、伴随服务、卸载器和 0.1.0 注册路径均已核对，Node hash 与随包副本一致。证据为 `.artifacts/nsis-install-verification.json`。安装进程 PID 19776 已退出，但初始 60 秒等待返回 pending，未取得最终安装器退出码。

自动审批曾拒绝启动已安装 exe 的整条验证命令，原因仅为 `blocked by policy`，未提供具体理由；该命令没有执行，也未绕过。其后用户手动启动了已安装程序：launcher `16436`、随包 Node `23256` 和 WebView2 `24500` 的精确路径、父子关系、创建时间均已复核，`127.0.0.1:47831` 的唯一监听者为该 Node。真实 `%APPDATA%\CodexTaskboard` 已创建，目前无启动失败诊断。真实窗口显示登录页，能够从最小化状态恢复；未取得该已安装窗口的 IPC 健康调用、服务器认证、任务读写或多设备验收证据。托盘退出、卸载及数据保留仍未验收。

安装后的 EXE 与编译产物大小相同，仅 Tauri 的包类型标记有三个字节不同（`UNK` → `NSS`）；按锁定版本的 Tauri 定义归一化标记后，其余字节完全一致。这是 NSIS 打包行为，不代表运行验收通过，也不解除自动审批拒绝。

后续源码增加了内嵌页面就绪握手、受控 CSP 恢复流程及桌面服务器地址设置，独立 Chromium 验证见 [桌面宿主验证记录](codex-host-verification.md)。上方安装包生成在这些增量之前，未重新打包，不包含这些增量。

安装器已构建并完成隔离静默安装的文件、注册及用户手动启动检查，但完整安装后功能、卸载和数据保留验收仍未完成；它仍是 0.1.0 开发预览，不能声明已发布或 Codex 内嵌可用。服务器设置的源码验证与实际安装包验证分别记录，不能以演示页或组件测试代替真实 Tauri 验收。
