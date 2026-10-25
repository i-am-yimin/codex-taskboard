# Codex Taskboard 客户端 0.1.6（验收候选）

准备日期：2026-10-25。修复打开任务看板后切换会话仍覆盖聊天的问题；点击 Codex 侧栏中的会话、项目或“新聊天”时自动收起，保留看板未保存内容和宿主焦点。包含此前 0.1.5 的主题与账号外观功能。

Windows x64 NSIS 本机验收已完成：0.1.5 覆盖升级、冷启动、原登录与数据保留，以及 Codex `26.1016.8622.0` 中的五条导航路径通过；未提交任务内容可在重新打开看板后继续。安装器未签名，仍为开发预览；尚未创建公开 Release 或发布标签。摘要、源提交与证据范围见[0.1.6 验收记录](acceptance-0.1.6.md)。服务端版本与已发布客户端资产保持原样。

## Codex Taskboard 服务端 0.1.3-preview.1

发布日期：2026-10-25。Linux amd64 镜像已公开，新增个人外观和声明式主题包的账号同步。客户端独立版本化，本次没有发布 Windows 0.1.5 安装包，也不自动升级已有服务器。

```bash
docker pull ghcr.io/i-am-yimin/codex-taskboard:server-0.1.3-preview.1
```

不可变镜像引用：`ghcr.io/i-am-yimin/codex-taskboard@sha256:a6cee039a851f0cdd5ca963370ad709dd81e79583db55ac73bcf86224e2d4c91`。提交号镜像为 `server-a63d8761342f`，源码标签为 [`vserver-0.1.3-preview.1`](https://github.com/i-am-yimin/codex-taskboard/tree/vserver-0.1.3-preview.1)。

### 功能与兼容

- 外观选择与主题包按账号保存，支持版本冲突、幂等重试、内容去重，以及删除正在使用的主题时原子回退。
- 启动自动执行 `0004_user_themes`，仅新增主题相关表；原任务、账号、密钥和已有客户端接口保留。
- 浏览器和 0.1.5 客户端候选可使用账号主题同步；0.1.4 客户端继续使用原任务功能。

### 升级与验证

已有实例先备份数据库、密钥和配置，在原部署目录更新镜像版本。无需重新初始化管理员；单实例切换期间有短暂断连。本次仅新增表，程序回退可保留新增表，数据库恢复则会撤销备份后的数据。

[发布工作流](https://github.com/i-am-yimin/codex-taskboard/actions/runs/40145424631)及固定源码 CI 通过；匿名下载并校验全部 10 个镜像层，两个镜像标签摘要一致，provenance 与 SPDX SBOM 已核对。生产服务器尚未升级。完整范围见[镜像验收](acceptance-server-0.1.3-preview.1.md)，操作见[部署与升级](deployment-openresty.md)。

## Codex Taskboard 客户端 0.1.4（预发布）

发布日期：2026-10-24。本次为 Windows 客户端更新。在 Taskboard 主界面直接打开或连接日常 Codex，沿用原登录、项目和聊天，无需专用连接快捷方式。版本摘要见[更新日志](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/CHANGELOG.md)。

- [Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/Codex.Taskboard_0.1.4_x64-setup.exe)
- [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/SHA256SUMS)
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/docs/user-guide.md)
- [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/docs/acceptance-0.1.4.md)

### 新增

- **主界面直接连接**：点击“连接 Codex”，打开或接入日常 Codex；成功后按钮变为“打开 Codex”。主界面和设置页共享连接状态及正在进行的请求。
- **启动时自动恢复**：首次成功接入后记住自动连接选择，普通启动 Taskboard 即可恢复侧栏。可在“设置 → 连接与设备”关闭，手动连接不会重新开启已关闭的选项。
- **首次连接等待**：运行中的 Codex 尚未启用连接时，Taskboard 等待用户保存工作并正常退出，然后自动继续。支持取消、五分钟超时提示和重试，不会强制结束 Codex。

### 修复

- 修复无边框主窗口识别失败导致再次打开被拒绝的问题，支持恢复最小化和隐藏的原窗口，并保留最大化状态与窗口尺寸。
- 修复连续打开时重复安装侧栏导致“适配器生命周期已激活”的间歇错误。有效侧栏直接复用，正在进行的安装或页面恢复会被等待，短暂探测失败只做有界重新校验。
- 修复自动连接设置保存失败的提示被连接成功状态覆盖的问题。独立显示“设置未保存”，并提供仅重试保存选择的操作，不会重新接入或安装侧栏。
- 改善设置保存失败提示的明暗主题文字对比度。

### 使用与兼容

- 已运行但未启用连接的 Codex 仍需保存工作并正常退出一次，再由 Taskboard 自动继续。若以后从其他入口打开了未启用连接的 Codex，仍需按应用内提示退出一次。
- 本轮精确验收 Codex `26.1016.8622.0`；未知版本或身份验证失败继续拒绝。日常模式的任务草稿仍由用户复制、粘贴并确认发送，独立测试环境保留在设置折叠项中。
- Windows 安装器未签名（NotSigned），本版为开发预览，以 pre-release 发布，不设为 latest。客户端自带运行时，首次使用需自己的 Taskboard HTTPS 服务和账号。
- 独立服务端保持 `0.1.2-preview.1`，已有镜像和部署不自动更改。本 Release 的 Linux 归档属于客户端源码标签的构建；旧版标签和资产保持。

### 验证与交付

- 完整 CI 与固定标签发布流程通过；校验和、严格 GitHub 构建来源证明、Linux 镜像层和 SPDX 已核验，公开页面、Windows 安装包与校验和已完成匿名下载核验。
- 实际发布包完成本机 0.1.4 CI 预览到固定标签安装包的升级、免重新登录、自动恢复、关闭偏好保留、20 次连续打开及正常退出重连验收。原账号、设备、映射、凭据和草稿保持，日常 Codex 进程未重启，真实草稿未写入或发送。
- 首次未启用连接的等待、取消、五分钟超时和重试由浏览器回归覆盖；本轮没有退出日常 Codex 重测首次冷启动。完整范围见上述验收记录。

来源提交：`a8ed9f4631856b22c37a2e77d883b3135cd256f9`。Windows 安装器 SHA-256：`317fbaef9e25b36d29b0dbcf16d7abb191f5e2d17f609998aabb1523f9314db0`。

## Codex Taskboard 客户端 0.1.3（预发布）

本版可以接入日常 Codex，沿用原登录、项目和聊天。首次未启用连接时，请保存工作并正常退出 Codex，再从“Codex（任务看板连接）”入口打开；以后使用这个入口，已打开的日常环境会被直接复用，无需另开独立环境。

- [Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.3/Codex.Taskboard_0.1.3_x64-setup.exe)
- [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.3/SHA256SUMS)
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/README.md#使用手册)

Windows 安装器未签名（NotSigned），本版为开发预览，不设为 latest。客户端自带运行时。首次使用请在登录页填写自己的 HTTPS 服务端根地址并保存，再登录 Taskboard。

伴随服务和 CLI 改用明确的 .cjs 入口，修复本机 Node 在较长中文安装路径中的模块识别问题。Windows CI 和标签构建都验证实际随包运行时在 ES module 上级目录、缺少就近运行时清单时仍能执行。0.1.2 的实际安装首次启动失败，因此保留草稿，原标签与资产保持。

保留日常 Codex 连接入口、首次工作区挂载等待、并发接入共享安装、隐藏 iframe 就绪响应及完整原生拒绝说明。精确支持 Codex 26.1016.8622.0；保留进程、MSIX、用户、会话、回环监听者、唯一页面、nonce 和 CSP 校验。日常模式使用手动复制草稿，由用户确认发送；独立测试环境保留自动草稿能力。

完整 CI、固定标签构建、校验和及严格 GitHub 来源证明已通过。实际发布安装器已验证 0.1.1 升级、首次免登录、8 张合成任务和旧修改保留，以及日常 G: 安装升级、原账号与映射保留、真实侧栏、并发接入、看板正常退出和重开复用同一 Codex、CSP 恢复；真实用户草稿未被修改或发送。

客户端版本为 0.1.3。独立服务端保持 0.1.2-preview.1，继续使用镜像 `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.2-preview.1`，见[部署手册](https://github.com/i-am-yimin/codex-taskboard/blob/vserver-0.1.2-preview.1/docs/deployment-openresty.md)。本 Release 的 Linux 归档属于客户端源码标签的独立构建，不替代已有服务端发布。旧标签和资产保持。

来源提交：`69c865bbdc5458834a2b0debddc56a283e1dac38`。Windows 安装器 SHA-256：`07948800bb32757e2acd904b9b6c28d41e8931334bf666b56696565200ba3f9d`。
