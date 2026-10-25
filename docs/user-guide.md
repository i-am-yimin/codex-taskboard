# 使用手册

适用客户端 **0.1.4**，服务端独立为 **0.1.2-preview.1**。更新日期：2026-10-24。

[下载](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.4) · [服务端部署](deployment-openresty.md) · [更新日志](../CHANGELOG.md)

## 0.1.5 开发版：外观与主题

新增四套主题、可导入主题包和账号同步，操作见[主题使用与制作](themes.md)。此功能尚未发布；下方 0.1.4 下载与既有操作仍有效。

## 开始之前

Taskboard 保存共享任务，Codex 保留本机项目和聊天。安装客户端不会创建云服务器或 Taskboard 账号。

- 已有服务器：向管理员取得 HTTPS 根地址和账号，或先在浏览器接受邀请。邀请会过期且只能使用一次。
- 自己部署：按[部署文档](deployment-openresty.md)启动服务，配置 HTTPS，并在网页创建首个管理员。
- 只用浏览器：登录同一 HTTPS 地址即可管理任务；浏览器不负责打开或接入本机 Codex。

Windows 包为未签名预发布版，本轮日常 Codex 精确验收版本为 `26.1016.8622.0`。Taskboard 与 Codex 分别登录，普通使用无需另装 Node.js、pnpm 或 Codex CLI。

## 安装与登录

1. 下载 [Windows x64 0.1.4 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/Codex.Taskboard_0.1.4_x64-setup.exe)和 [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/SHA256SUMS)，核对摘要后安装，无需登录 GitHub。
2. 打开 **Codex Taskboard**，填写服务器根地址，点击 **“保存服务器”**。
3. 输入 Taskboard 邮箱与密码，点击 **“登录并继续”**。选择或创建空间，确认 **“已同步”** 后再修改任务；团队成员由管理员邀请加入。

服务器地址形如 `https://board.example.com`，不加 `/api/v1`、子路径、查询参数或片段。本机开发允许 `http://127.0.0.1:47830`；其他设备不能用这个地址访问你的电脑。保存地址不代表已联网成功。

安装器 SHA-256：`317fbaef9e25b36d29b0dbcf16d7abb191f5e2d17f609998aabb1523f9314db0`。可用 PowerShell 的 `Get-FileHash -Algorithm SHA256 -LiteralPath '下载文件的完整路径'` 核对；签名状态为 `NotSigned`。

## 连接 Codex

在 Taskboard 主界面点击 **“连接 Codex”**：

- 已启用连接：接入原来的日常 Codex；没有运行时，由 Taskboard 打开日常环境。
- 正在运行但未启用连接：保存工作并正常退出 Codex 一次，Taskboard 等待后自动继续，不会强制结束进程。
- 暂不连接：点击 **“取消等待”**；五分钟未完成也会结束等待，准备好后重新连接。

看到 Codex 左侧的 **“任务看板”** 即接入成功，点击可切换看板与 Codex。主界面按钮变为 **“打开 Codex”**，可返回或恢复原窗口，无需专用快捷方式。

看板打开时，点击 Codex 侧栏中的会话、项目或“新聊天”，看板会自动收起；键盘激活入口、宿主切换选中会话及页面前进/后退也会收起。再次点击“任务看板”可继续原来的操作，未保存内容会保留。0.1.6 本机验收包已包含此修复，公开客户端安装包尚未更新；验证范围见[0.1.6 验收记录](acceptance-0.1.6.md)。

首次成功后，普通启动 Taskboard 可自动恢复侧栏。在 **“设置 → 连接与设备”** 可关闭 **“启动 Taskboard 时自动连接日常 Codex”**，手动连接仍保留关闭选择。若后来从其他入口启动了未启用连接的 Codex，仍需按提示正常退出一次。

连接按钮只在 Windows Taskboard 主窗口显示，浏览器和内嵌看板不显示。更多边界见[应用内连接说明](in-app-codex-connection.md)。

## 准备项目

先准备已有本机目录，再到 **“设置 → 连接与设备 → 本机仓库映射”** 填写仓库地址和目录，点击 **“保存映射”**。例如 `https://github.com/example/project` 对应 `D:\work\project`。

映射不会自动克隆仓库，也不会替你切换日常 Codex 的项目。每台设备分别保存映射，并自行打开正确项目。

## 处理任务

1. 新建任务，写清标题、需求、验收条件、优先级与仓库地址，保存。
2. 手动流程中点击 **“领取任务”**，把标题、需求和验收条件手动复制到正确的 Codex 项目，核对后发送。
3. 完成后回到任务详情，点击 **“提交结果至待验收”**，填写完成说明和验证记录。
4. 有编辑权限的成员核对结果，点击 **“验收并完成”**。

**日常模式不会自动填草稿，也没有一键复制任务草稿的按钮。** “在 Codex 中打开”仅在已验证的独立测试环境可自动填写未发送草稿。日常模式出现草稿未写入提示时，按上面的手动流程处理；自动填写也不会发送消息或领取任务。

版本冲突时先保留本地内容，展开 **“查看服务器最新内容”**，核对后再合并或放弃本地编辑。若由 Agent 通过 CLI 领取，不要再手动领取同一任务。

## 多人协作与离线

多设备使用同一 HTTPS 地址，分别登录并映射本机目录。空间所有者或管理员在 **“设置 → 成员”** 邀请成员，分配管理员、编辑者或只读角色；只读成员不能领取或修改任务。

**“离线缓存”** 只供浏览已缓存任务。离线不能新建、领取或在线保存；详情与结果草稿可保存在本机，但尚未同步，活动、评论和执行记录不在离线缓存内。联网后核对权限、版本与同步状态，再保存或提交。

任务和执行摘要可共享，完整 Codex 聊天与本机源代码不会自动跨设备同步。

## 退出与升级

- **关闭窗口**：收起到托盘。**托盘 → 退出**：结束 Taskboard，日常 Codex 继续运行。
- **升级客户端**：保存未同步工作，正常退出 Taskboard，备份 `%APPDATA%\CodexTaskboard` 与原安装目录，再运行新安装器。保留原 WebView 资料，不需清缓存。已启用连接的日常 Codex 可保持打开；独立测试环境先保存草稿并正常退出。
- **升级后检查**：核对版本、原账号、任务、映射和连接。异常时先保留诊断及当前数据，不删除目录重装。客户端备份含敏感凭据，不能替代[服务端数据库与密钥备份](deployment-openresty.md#7-备份升级和验收)。
- **更换服务器**：先保存或导出本机草稿和待提交结果，再在 **“连接与设备 → 退出当前设备”** 返回登录页，保存新地址并登录。此操作会清除该账号的本机缓存、草稿及两类会话，与托盘退出不同；显式启动配置锁定地址时先处理配置来源。

## Agent CLI

此步骤可选，只做手动执行和验收时可跳过。桌面与 CLI 独立登录，CLI 使用时保持 Taskboard 运行。以下为路径示例，替换为实际安装目录下的 `runtime`；密码通过标准输入传递：

```powershell
$taskboardRuntime = 'C:\Apps\Codex Taskboard\runtime'
$taskboardCli = Join-Path $taskboardRuntime 'taskctl.cmd'
$taskboardPassword = Read-Host 'Taskboard 密码' -AsSecureString
$taskboardPreviousEncoding = $OutputEncoding
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [System.Net.NetworkCredential]::new('', $taskboardPassword).Password |
        & $taskboardCli login 'you@example.com'
} finally {
    $OutputEncoding = $taskboardPreviousEncoding
    Remove-Variable taskboardPassword
}
& $taskboardCli --help
```

`get`、`claim`、`submit` 等命令使用完整任务 UUID，`TB-1` 只是展示编号。当前日常界面没有一键复制 UUID 或生成可复制草稿的入口；没有完整 ID 时先走手动流程。管理员可从已授权的服务端 API 响应确认空间和任务 UUID；已知空间 UUID 时可用 `list <空间UUID>` 查询任务 ID，再 `get <任务UUID>` 核对最新版本。

让 Agent 读取随包 `runtime\skills\taskboard\SKILL.md`，并明确提供 `runtime\taskctl.cmd` 绝对路径。读取、按当前版本领取、回写和提交应由同一执行者完成，未知 ID、版本或配对状态时不要猜测。参数与 PowerShell JSON 注意事项见[桌面说明](desktop.md#当前可用流程)。

随包 Skill 安装器仅写入默认用户 Skill 目录，不保证独立 Codex 自动加载或配对；本轮未新增验证 Skill 自动发现与 Agent 自动执行，侧栏已连接不等于 Agent 已登录。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 找不到“连接 Codex” | 从 Windows Taskboard 主窗口操作，浏览器与内嵌看板不显示此按钮 |
| 一直等待 Codex 退出 | 保存工作后正常退出 Codex；可取消，超时后准备好再点“重新连接” |
| 版本未验证或侧栏接入失败 | 核对精确宿主版本和完整错误，工作区加载完成后到设置中“检测连接”；不靠反复启动绕过身份拒绝 |
| 提示 `unsent draft`，但聊天输入框已空 | 先保存并关闭 Codex 侧边打开的文档/代码编辑器标签，再点“重新连接”。当前重载保护也会计入这些编辑器的正文，不要为此删除文档内容 |
| “Codex 已接入，设置未保存” | 当前连接可用；检查本机存储后点“重试保存”，无需重新安装侧栏 |
| 日常模式没有自动填写草稿 | 手动复制需求到正确项目，自动填写仅面向已验证的独立测试环境 |
| 离线缓存或不能保存 | 检查服务、网络与登录，恢复“已同步”并核对版本后再提交 |
| CLI 未认证或 Skill 未配对 | 单独登录 CLI 并提供实际路径，桌面登录和侧栏接入不等于 CLI 配对 |
| 服务器地址不能编辑 | 已有会话或显式配置会锁定；先保护草稿，再按“退出与升级”更换，不直接删凭据 |
| 启动失败或端口冲突 | 查看 `%APPDATA%\CodexTaskboard\launcher-diagnostic.txt`，确认未重复运行 Taskboard，本机端口 47831 需可用；不强制结束不明进程 |

报告问题时附客户端版本、Codex 版本、步骤和完整错误，去除账号、令牌与个人目录。已验证范围见 [0.1.4 验收记录](acceptance-0.1.4.md)。
