# 发布记录

## Codex Taskboard 客户端 0.1.11（待发布）

准备日期：2026-10-31。用户中心、服务器治理与已准备的 Codex 窗口恢复修复统一归入 0.1.11。当前为开发候选，尚未发布；发布日期和下载地址待实际发布后补充，公开客户端及已安装版本仍为 0.1.10。

### 用户中心

右上角账号菜单提供“个人设置、服务器管理（有权限时）、退出登录”；没有加入空间也可维护账号。

- 修改允许重名的显示名称，更换、裁剪和移除头像；支持不超过 2 MiB 的 JPG、PNG、WebP，服务端生成去除元数据的 256×256 WebP。
- 手机、微信和 QQ 均选填，逐项选择仅自己或当前共同空间成员可见；联系方式不作为登录凭据，私有资料不进入持久离线缓存。
- 保留邮箱与密码登录，增加邮箱验证、更换邮箱、修改密码、忘记密码，以及设备最近活跃和撤销入口。更换邮箱需当前密码并确认新邮箱，确认前旧邮箱有效；修改密码或邮箱后撤销其他会话及全部 Agent 令牌，找回密码后撤销所有会话。
- 主题中心迁入个人设置，沿用四套主题、明暗模式、布局、主题包及原来的离线、预览撤销和跨设备冲突处理。资料保存失败保留输入，离开未保存页面时提示。

### 服务器最高权限后台

沿用独立于空间角色的 `instanceAdmin` 身份，支持多名最高管理员。后台增加用户搜索、空间归属、邀请发送/撤销/重发、账号停用/恢复、恢复邮件、最高权限分配、SMTP 与邮件队列、空间治理和持久审计，保留已有运行设置、日志与密钥功能。

- 始终保持邀请制。不能停用自己；并发治理也必须保留最后一名有效最高管理员；停用空间所有者前必须转移所有权，恢复账号不恢复旧令牌。
- 接管空间须再次验证管理员密码并填写原因，授权绑定当前网页会话和指定空间，30 分钟后失效，可提前退出；不改变真实成员关系，不绕过任务状态机、人工验收或本机运行边界。
- 接管任务内容、空间元数据和草稿不写入离线快照；退出、失效或撤权清理相关界面和查询。后台与接管只供网页登录会话使用，桌面/侧栏提供前往服务器网页的入口，Agent 不获得这些权限。
- SMTP 密码只显示“已设置”，可替换或清除；环境变量配置优先并锁定管理页。邮件通过加密事务发件箱有界重试，区分待发送、SMTP 已接受和发送失败；SMTP 接受不表示已进入收件箱。

### Codex 窗口恢复

当新版 Codex 在同一进程内保留隐藏 Chromium 窗口时，0.1.10 会把它与真正的日常主窗口一起计数，点击“连接 Codex / 打开 Codex”可能误报“无法唯一确认可恢复的主窗口”。在 Codex `26.1027.3384.0` 的只读诊断中已确认此触发条件。

本版优先恢复唯一可见主窗口，包含已最小化的窗口；保留最大化状态，隐藏窗口保持隐藏。多个可见主窗口继续拒绝，全部隐藏时仍要求候选唯一。进程句柄、创建时间、安装包、用户/会话、监听者、精确页面及输入前后重枚举检查保持，错误提示区分无候选、多个可见候选和多个隐藏候选。

### 兼容、部署与备份

配套服务器候选为 `0.1.5-preview.1`，需要 `accountCenter: 1` 和 `0010_account_center` 增量迁移。升级保留原账号、权限、任务、主题和有效会话；历史邮箱标记待验证，不强制阻断已有用户登录。旧服务端禁用不支持的新能力并提示升级，原主题设置保留。客户端安装不会自动升级服务器或生产数据库。

邮件服务新增独立 `TASKBOARD_ENCRYPTION_KEY`；托管初始化生成并持久保留 `encryption-key`。SMTP 密码和待发邮件正文使用 AES-256-GCM 加密，备份必须同时保存数据库和该密钥。密钥丢失后旧密文不可恢复，重新配置 SMTP 需显式替换或清除密码。SMTP 未配置或不可用时，已有登录和管理员 CLI 恢复继续可用。操作见[用户中心与部署说明](account-center.md)。

### 验证状态与后续安排

用户中心已通过 `pnpm check`、13 项账号真实数据库测试、21 项服务器/初始化/安全回归、桌面与紧凑窗口共 8 项 E2E、主题与 360px 检查、生产构建离线流程及 Windows 随包脚本运行时检查。跳过项、初轮失败与重跑、测试替身和证据边界详见[0.1.11 验收记录](acceptance-0.1.11.md)。

窗口恢复的原生窗口/进程模块独立复验 12 项通过、2 项辅助入口忽略；完整 Cargo/Tauri、只读诊断及最终安装包分别记录。按既有安排，安装版功能复测留到 0.1.11 发布后，覆盖可见/最小化/最大化恢复、隐藏窗口不显示、重复连接、歧义与归属变化拒绝。镜像、原生包、真实 SMTP 投递和生产部署不得用用户中心源码结果代替；发布仍执行既有 CI 与审批门禁。

官方 global/thread UI 合成原型继续作为开发工具，不纳入产品运行时。本次未创建或移动公开标签、上传发布资产，也未替换本机安装版。

[更新日志](../CHANGELOG.md) · [验收记录](acceptance-0.1.11.md) · [窗口诊断与修复范围](acceptance-codex-window-restore.md)

## Codex Taskboard 客户端 0.1.10（未签名预发布）

发布日期：2026-10-30。

Windows x64 未签名预发布。客户端自带运行时，首次使用需要自己的 Taskboard HTTPS 服务和账号。

[下载安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.10/Codex.Taskboard_0.1.10_x64-setup.exe) · [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.10/SHA256SUMS) · [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/user-guide.md)

本版整合此前未公开的 0.1.8、0.1.9 与 0.1.10：

- 多人职责、明确验收人、父子与依赖、人工确认的拆分/需求/决策提案，以及领取、运行、提交和验收的完整任务流。
- 个人任务、提及、持久收件箱、稍后/静音、系统提醒请求、自动规则和等待区间统计。
- Codex CLI / Claude Code 的专用配置和本机运行面板；原创接力标识、克制动效、键盘操作与窄窗口适配。
- Codex 完整原生身份后的有限结构自检，改善当前/缓存会话切换、多编辑器、刷新恢复和草稿保护。

新协作需要服务器协作协议 1 与 0005—0009 迁移。公开独立服务端镜像仍为 0.1.3-preview.1；客户端安装不会自动升级服务器。旧服务器保留只读看板和本机草稿。Linux 归档属于本客户端标签构建，不是新的独立 server tag，也不表示生产已升级。

固定标签源码 CI、独立 PostgreSQL、生产入口、外观、浏览器/离线、Windows 原生测试/标准 NSIS 和容器部署恢复/HTTPS 门禁均通过。源码 CI 为 333 项通过、1 项跳过，浏览器 158 项通过；生产依赖审计按既有 high 阈值通过，源码 CI 仍记录 5 low / 5 moderate，不是零风险报告。全部五项资产、校验和、严格 GitHub 来源证明、Linux 层摘要和 SPDX 已核验。CI 最终安装器已独立提取，web 载荷与最终源码的独立生产构建逐文件一致，Node、companion 与 CLI 等运行文件和本机候选字节相同；两份技能文本与固定标签源码的精确 CRLF 检出一致；实际运行随包 companion/CLI 的中文长路径及 ES module 场景通过。

证据范围：本机早前候选已完成授权原位安装、独立 Codex 26.1021.3705.0 产品入口、缓存导航/同一 iframe、完整视图、刷新/CSP、未提交任务草稿、冷重开和原账号恢复。发布阶段另补三份 CSS 的极窄表单、清单及复选框溢出修正，由独立浏览器和最终 web 载荷核验；宿主适配器、原生及服务逻辑不变。未对当前普通安装执行 CI 最终包原位重装，也不宣称已完成该 CI 包的新一轮实机界面验收；两者分别记录。最终包主程序和安装器均 NotSigned。

官方 CLI 登录后的模型生成、真实取消/续接仍未验收；日常 Codex 不自动填写或发送聊天。系统提醒请求不等于弹窗可见。官方 global/thread UI 只为开发合成原型，不进入产品包。历史日常 config.toml 变化仍未归因，本次维护前后摘要一致。

固定来源：`c9ecd09098541cd38b19b3c4fcaf178f3e194aba`。

安装器 SHA-256：`c84b36b9c4eff4d81bb0c631cf3526fd0d06ee2bbc8e77ba6f450d7da38880b1`。

[发布工作流](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41049789530) · [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/acceptance-0.1.10.md) · [更新日志](https://github.com/i-am-yimin/codex-taskboard/blob/main/CHANGELOG.md)

## Codex Taskboard 客户端 0.1.8（本机候选，未公开发布）

2026-10-28：Windows x64 未签名候选已在本机完成原位安装、旧草稿保留、真实窄窗口、键盘操作、冷重开与正常退出验收。配套服务端 `0.1.4-preview.1` 已在授权指定实例完成 0005—0009 迁移、原账号/会话/主题保留及实际客户端连通，协作入口恢复；不是新的公共镜像或安装包发布。

- 支持任务多人职责、明确验收人、父子与依赖、人工确认的拆分/需求/决策提案，以及成果与验证限制。
- 增加个人任务视图、持久收件箱、稍后提醒、规则与统计；系统提醒记录请求回执，显示仍取决于操作系统。
- 采用原创接力卡片标识，改善拖拽、重排、抽屉、请求反馈、窄窗口和快速键盘取消，兼容减少动态效果。
- 区分领取、真实本机运行、提交和人工验收；修复运行器请求预算与实时连接退出清理。官方 Codex CLI/Claude 登录后的模型生成、取消及续接仍另行验收，不由受控子进程证据代替。

固定产品源码为 `149580ba33307075295e2f0c45416401341bdd4a`，本机安装器 SHA256 为 `044427f449a3c0645b5641c92981c77da66a19d84f094b1fd81c8d4960d2c9a8`。完整验证、失败记录、回退和限制见 [0.1.8 验收](acceptance-0.1.8.md)。既有标签、资产和公开下载保持固定，没有创建新的公开下载链接。日常 Codex 未重启或请求接入，未启用的首次桌面连接仍按原流程由用户保存工作后正常重开。

## Codex Taskboard 客户端 0.1.7（预发布）

修复从会话打开任务看板时，会话标题栏、工具栏穿透看板，以及会话和看板同时选中的问题。任务看板与完整会话工作区现在作为同级页面切换。

- 点击“任务看板”进入看板，再次点击保持当前页；点击具体会话切回。
- 切换保留双方视图和同一个 iframe；退出 Taskboard 恢复完整原生工作区、导航状态与临时样式。
- 沿用四套主题、声明式主题包与账号外观同步；日常 Codex 不自动填写或发送草稿。

[Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.7/Codex.Taskboard_0.1.7_x64-setup.exe) · [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.7/SHA256SUMS) · [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/user-guide.md) · [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/acceptance-0.1.7.md)

固定标签源码 CI、应用与独立数据库、浏览器、离线、Windows 原生和容器部署门禁通过。全部五项发布资产的校验和、严格 GitHub 来源证明、Linux 层摘要与 SPDX 已核验。

本机已安装该固定标签最终包，主程序与随包运行时全部匹配独立提取的 NSIS 内容。真实 Codex 26.1016.8622.0 的已有会话、同一会话、Enter 切换、新聊天、项目五条导航，重复选择看板、完整标题栏隐藏、单一当前页、正常退出清理和冷启动自动重连检查通过。原账号、凭据、数据与日常 Codex 进程保持；真实账号未创建测试任务或填写聊天。非空未提交任务和聊天草稿的保留由此前 0.1.7 生产构建的独立合成浏览器场景验证，证据范围分别记录。

Windows 安装器为 NotSigned 未签名开发预发布，不设为 latest。首次使用需自己的 Taskboard HTTPS 服务和账号。未知宿主版本或身份验证失败继续拒绝，日常草稿由用户复制、粘贴并确认发送。

独立服务端保持 0.1.3-preview.1，本次不升级生产服务器。Linux 归档属于客户端标签构建；既有发布标签与资产保持固定。

来源提交：`06350a6daa4d99e515918964e6686063d87532d8`。安装器 SHA-256：`467d4ac47eb54ab1c7452879e8b1181c61206a559c6e5a78b4862dae5fed7db2`。

## Codex Taskboard 客户端 0.1.6（预发布）

用户复验补充（2026-10-25）：本版没有实现完整的同级视图切换，从会话进入看板仍可能出现固定标题栏穿透及双重选中。原发布资产保持固定，修正进展见 [0.1.7 修复与发布验收](acceptance-0.1.7.md)。

修复打开任务看板后切换会话仍覆盖聊天的问题。点击 Codex 侧栏中的会话、项目或“新聊天”，以及键盘选择或宿主页面导航时，看板自动收起；重新打开后保留未提交内容，不抢回宿主焦点。

- [Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.6/Codex.Taskboard_0.1.6_x64-setup.exe)
- [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.6/SHA256SUMS)
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/user-guide.md)
- [主题指南](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/themes.md)
- [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/acceptance-0.1.6.md)

本版同时公开此前 0.1.5 的四套主题、明暗与布局选择、声明式 JSON 主题包导入导出及账号外观同步。支持即时预览、应用、取消和恢复默认；跨设备冲突由用户选择。旧服务端保留本机外观，账号同步需要服务端 0.1.3-preview.1 的 0004_user_themes 迁移。

固定标签的应用、数据库、浏览器、离线、Windows 原生及容器部署门禁通过；全部资产的校验和、严格 GitHub 来源证明、Linux 层摘要和 SPDX 已核验。最终发布安装器已覆盖本机 0.1.6 验收包，普通启动无需重新登录并自动恢复侧栏，原账号、设备、映射、凭据与草稿保持。真实 Codex 26.1016.8622.0 的已有会话、同一会话、Enter 切换、新聊天及项目导航五条路径通过；原日常 Codex 进程及编辑器保持。未提交合成任务保留已在本机候选的五条导航中验证，最终包复验使用原账号且未修改真实任务。

Windows 安装器未签名（NotSigned），以开发预发布交付，不设为 latest。客户端自带运行时，首次使用需自己的 Taskboard HTTPS 服务和账号。未知宿主版本及身份验证失败继续拒绝；日常草稿由用户复制、粘贴并确认发送。

独立服务端保持 `0.1.3-preview.1`，本次不升级生产服务器。本 Release 的 Linux 归档属于客户端标签构建，独立服务端镜像与既有发布标签、资产保持固定。

来源提交：`c1d43068935aa18b13198b3441008104bb4acf68`。Windows 安装器 SHA-256：`9cd07f165d8838e02d260c18a258fcbbbbf1740274d3d256aac52ea833f874b2`。

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

发布日期：2026-10-24。本次为 Windows 客户端更新。在 Taskboard 主界面直接打开或连接日常 Codex，沿用原登录、项目和聊天，无需专用连接快捷方式。版本摘要见[更新日志](https://github.com/i-am-yimin/codex-taskboard/blob/main/CHANGELOG.md)。

- [Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/Codex.Taskboard_0.1.4_x64-setup.exe)
- [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/SHA256SUMS)
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/user-guide.md)
- [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/main/docs/acceptance-0.1.4.md)

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
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/main/README.md#使用手册)

Windows 安装器未签名（NotSigned），本版为开发预览，不设为 latest。客户端自带运行时。首次使用请在登录页填写自己的 HTTPS 服务端根地址并保存，再登录 Taskboard。

伴随服务和 CLI 改用明确的 .cjs 入口，修复本机 Node 在较长中文安装路径中的模块识别问题。Windows CI 和标签构建都验证实际随包运行时在 ES module 上级目录、缺少就近运行时清单时仍能执行。0.1.2 的实际安装首次启动失败，因此保留草稿，原标签与资产保持。

保留日常 Codex 连接入口、首次工作区挂载等待、并发接入共享安装、隐藏 iframe 就绪响应及完整原生拒绝说明。精确支持 Codex 26.1016.8622.0；保留进程、MSIX、用户、会话、回环监听者、唯一页面、nonce 和 CSP 校验。日常模式使用手动复制草稿，由用户确认发送；独立测试环境保留自动草稿能力。

完整 CI、固定标签构建、校验和及严格 GitHub 来源证明已通过。实际发布安装器已验证 0.1.1 升级、首次免登录、8 张合成任务和旧修改保留，以及日常 G: 安装升级、原账号与映射保留、真实侧栏、并发接入、看板正常退出和重开复用同一 Codex、CSP 恢复；真实用户草稿未被修改或发送。

客户端版本为 0.1.3。独立服务端保持 0.1.2-preview.1，继续使用镜像 `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.2-preview.1`，见[部署手册](https://github.com/i-am-yimin/codex-taskboard/blob/vserver-0.1.2-preview.1/docs/deployment-openresty.md)。本 Release 的 Linux 归档属于客户端源码标签的独立构建，不替代已有服务端发布。旧标签和资产保持。

来源提交：`69c865bbdc5458834a2b0debddc56a283e1dac38`。Windows 安装器 SHA-256：`07948800bb32757e2acd904b9b6c28d41e8931334bf666b56696565200ba3f9d`。
