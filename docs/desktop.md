# Windows 桌面版

桌面版是 Windows x64 的 Tauri 启动器。它在当前用户范围安装，使用安装资源目录中自带的 Node 运行时启动本机伴随服务，因此不要求安装系统 Node 或 Codex CLI。共享任务数据存放在服务器；本机凭据和仓库映射保存在 `%APPDATA%\CodexTaskboard`。卸载保留数据并重装恢复已在隔离测试目录实机通过，正式用户目录未参与该试验。

## 当前可用流程

运行 `pnpm desktop:build` 前会构建 Web、服务端命令和桌面运行时。`pnpm desktop:prepare` 会在 `apps/desktop/runtime` 生成安装器要打包的内容，包括 Node、伴随服务、CLI 和 Taskboard Skill。`pnpm desktop:bundle` 使用 Node 直接调用 Tauri CLI，并保留 Cargo 的 `--locked` 参数边界。

安装完成后，桌面窗口通过本机伴随服务访问远程任务服务器。桌面 Web UI 使用一次性的本机能力令牌和浏览器会话代理；`taskctl` 使用独立的当前用户 DPAPI 凭据，不能调用浏览器会话接口。

桌面事件通过伴随服务 SSE 转发，连接携带本机能力凭据，退出或断开时关闭上游订阅；远程不可达时缓存只读。两台真实 Windows 桌面窗口已验证任务创建、领取和结果提交无需刷新即可出现在第二台；用户反馈为“很快”，尚未取得精确延迟计时。

启动器先等待伴随服务完成初始化，并携带本次启动的能力凭据检查健康接口。每次网络探测限时 250ms，首次启动最多等待 30 秒，以容纳 Windows 凭据初始化。界面在成功后显示；运行时缺失、子进程提前退出、端口冲突或超时会显示错误，并保存到 `%APPDATA%\CodexTaskboard\launcher-diagnostic.txt`。`pnpm desktop:diagnose` 会读取该失败记录。

旧安装版曾在 WebView2 默认目录中保留页面 Service Worker，升级后可能在启动时返回旧版入口文件并白屏。当前源码不再为桌面版注册该 worker，并让旧 worker 更新时退出和重新加载页面；此修复等待新版安装包在第二台真实默认目录中复验。该迁移只处理页面资源缓存，不清除本地登录、仓库映射或未发送草稿。

随包 CLI 位于安装器资源目录的 `runtime\taskctl.cmd`。开发阶段可验证其可执行性：

```powershell
apps\desktop\runtime\taskctl.cmd --help
```

该命令使用 `%APPDATA%\CodexTaskboard` 中的 CLI 配对密钥。常用操作包括 `list`、`get`、`claim --version`、`comment`、`link`、`release --version` 和 `submit --version`。对网络超时后的同一写操作，复用 `--idempotency-key <uuid>`。

PowerShell 调用 `.cmd` 并传入 JSON 时，CMD 会剥离参数内的双引号。`create`、`update` 等 JSON 写操作请直接调用同目录的随包 `node.exe` 和 `taskctl.js`，例如 `& "$runtime\node.exe" "$runtime\taskctl.js" create $spaceId $payloadJson`；这样 PowerShell 会保留 JSON 参数。`$runtime` 为安装目录中的 `runtime` 路径。

浏览器与 Agent 使用独立会话。首次使用 CLI，先启动伴随服务，再通过标准输入登录（密码不会成为进程参数）：

```powershell
$taskboardPassword = Read-Host 'Taskboard 密码' -AsSecureString
[System.Net.NetworkCredential]::new('', $taskboardPassword).Password | apps\desktop\runtime\taskctl.cmd login owner@example.com
Remove-Variable taskboardPassword
```

最新源码的桌面登录页提供“任务看板服务器”设置：输入服务器根地址（例如 `https://taskboard.example.com`），点击“保存服务器”，再使用管理员创建或邀请获得的账号登录。其他设备填写相同地址即可连接同一实例；成员只能看到获授权的空间。保存地址本身不会验证远程连接，实际连通性和账号验证在登录时完成。

地址要求 HTTPS；本机开发允许回环 HTTP，例如 `http://127.0.0.1:47830`。不支持带用户名、密码、子路径、查询参数或片段的 URL。配置保存在本机伴随服务的数据目录，重启后继续使用，不写入网页存储。

配置优先级是代码启动选项 `upstream`、`TASKBOARD_UPSTREAM` 环境变量、已保存地址、默认本机地址。显式启动配置会锁定界面编辑。已有浏览器或 CLI 登录时也不能更换地址；仍可登录当前服务器。`taskctl logout` 会撤销当前设备的两类会话并清除该账号的本机缓存、草稿和待提交结果，因此应先处理未同步工作，再退出并更换地址。保存新地址不会自动退出或删除数据。当前已生成的旧安装包尚不包含此设置页，使用最新源码构建后才可使用。

连接页预览：[浅色](screenshots/desktop-connection-light.png) · [深色](screenshots/desktop-connection-dark.png) · [窄窗口](screenshots/desktop-connection-narrow.png)。截图来自完整生产 Web 页面及隔离的桌面连接模拟，不使用真实账户，也不代表安装后的 Tauri 程序已通过验收。

`runtime\install-taskboard-skill.cmd` 是明确的 Skill 安装操作。它只在 `%USERPROFILE%\.codex\skills\taskboard` 不存在时复制随包 Skill；如果同名用户 Skill 已存在，它会退出而不会覆盖。

## Codex 桌面集成状态

设置页的“启动独立 Codex”使用独立 profile 和 Codex 数据目录，不接管用户已有实例。启动器只接受列入隔离启动清单的 MSIX 版本，并逐次核对进程句柄、回环监听者和精确页面。`26.924.2738.0` 已在新版安装包中通过侧栏、窄窗口与未发送草稿的成功及部分拒绝路径；完整 G1 门槛仍在[验收记录](acceptance.md)中跟踪。

侧栏、项目发现与草稿还有独立的宿主版本清单和页面检查。版本、进程归属、项目身份或空白编辑器不能确认时，界面保持不可用；草稿不会自动发送或领取任务。`openThread` 尚未验证会话路由，保持不可用。完整安装版 G1 验收状态见[验收记录](acceptance.md)。

`pnpm desktop:diagnose` 只探测指定回环 CDP 端点，并输出 `probe-only`、`unavailable` 或诊断信息；它不会注入页面，也不能单独证明宿主兼容。程序不修改 Codex 安装文件或用户原有实例。

## 0.1.0 开发预览验证（2026-09-08）

NSIS 已实际生成：`apps/desktop/src-tauri/target/release/bundle/nsis/Codex Taskboard_0.1.0_x64-setup.exe`，24,401,145 bytes，SHA-256 `45263CB7B1F71AE0CE8F0C114E68B7B9B7B486D98A2F2E9F8403BAE50C6D9AAB`，未签名。Tauri final release 打包耗时 17 分 40 秒；CRT 缺少 PDB 警告为非致命警告。

安装器已以 `currentUser /S /NS` 安装到隔离的中文、带空格目录 `.artifacts/nsis-smoke-1788855766733/`。安装前未发现旧注册、快捷方式、Run 项或伴随数据；安装后程序、Node、伴随服务、卸载器和 0.1.0 注册路径均已核对，Node hash 与随包副本一致。证据为 `.artifacts/nsis-install-verification.json`。安装进程 PID 19776 已退出，但初始 60 秒等待返回 pending，未取得最终安装器退出码。

自动审批曾拒绝启动已安装 exe 的整条验证命令，原因仅为 `blocked by policy`，未提供具体理由；该命令没有执行，也未绕过。其后用户手动启动了已安装程序：launcher `16436`、随包 Node `23256` 和 WebView2 `24500` 的精确路径、父子关系、创建时间均已复核，`127.0.0.1:47831` 的唯一监听者为该 Node。真实 `%APPDATA%\CodexTaskboard` 已创建，目前无启动失败诊断。真实窗口显示登录页，能够从最小化状态恢复；未取得该已安装窗口的 IPC 健康调用、服务器认证、任务读写或多设备验收证据。托盘退出、卸载及数据保留仍未验收。

安装后的 EXE 与编译产物大小相同，仅 Tauri 的包类型标记有三个字节不同（`UNK` → `NSS`）；按锁定版本的 Tauri 定义归一化标记后，其余字节完全一致。这是 NSIS 打包行为，不代表运行验收通过，也不解除自动审批拒绝。

后续源码增加了内嵌页面就绪握手、受控 CSP 恢复流程及桌面服务器地址设置，独立 Chromium 验证见 [桌面宿主验证记录](codex-host-verification.md)。上方安装包生成在这些增量之前，未重新打包，不包含这些增量。

安装器已构建并完成隔离静默安装的文件、注册及用户手动启动检查，但完整安装后功能、卸载和数据保留验收仍未完成；它仍是 0.1.0 开发预览，不能声明已发布或 Codex 内嵌可用。服务器设置的源码验证与实际安装包验证分别记录，不能以演示页或组件测试代替真实 Tauri 验收。
