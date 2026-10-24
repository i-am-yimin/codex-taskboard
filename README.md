# Codex Taskboard

[使用手册](#使用手册) · [服务端部署](#部署服务端) · [常见问题](#常见问题) · [English](README.en.md) · [架构](docs/architecture.md) · [开发](docs/development.md) · [验收记录](docs/acceptance.md)

嵌入 Codex 桌面版的任务协作层。把待办、进度与验收放在同一个看板中，让个人多设备和可信团队共享任务；Codex 继续管理原有项目和执行会话。

> Windows 客户端为 **0.1.1 兼容开发预览**，新增 Codex `26.1013.4894.0` 精确版本支持，标签实际安装包已完成旧版数据升级、侧栏、草稿、正常重启及日常安装升级，见 [0.1.1 验收记录](docs/acceptance-0.1.1.md)。服务端独立发布 **0.1.2-preview.1**，不要求同步升级客户端。固定 `v0.1.0`（`f6a363e`）的 G0–G4 范围见 [0.1.0 验收摘要](docs/acceptance-0.1.0.md)。**Windows 安装包未签名，0.1.1 已公开为预发布版。**

已支持浏览器看板、服务端、随包 CLI/伴随服务，以及经验证 Codex 版本中的侧栏内嵌和项目草稿填写。草稿只填入编辑器，由用户决定是否发送。

![看板浅色预览](docs/screenshots/board-light.png)

## 功能

- 自定义工作/个人空间、任务状态列与成员权限。
- 看板、列表、Markdown 详情、评论、检查清单和活动记录。
- PostgreSQL 集中存储，按空间实时通知，版本冲突提示和幂等提交。
- 通过 Skill + `taskctl` 领取、回写和提交验收；桌面可打开项目并填写未发送草稿，能力或目标身份未验证时明确停止。
- 每台设备独立映射已有项目目录；任务可关联多次执行会话。
- 浅色、深色、系统主题，中文界面，邀请制自部署。

## 当前发布状态

服务端与客户端独立维护版本：

| 组件                     | 当前版本          | 发布标识                                                          |
| ------------------------ | ----------------- | ----------------------------------------------------------------- |
| 服务端                   | `0.1.2-preview.1` | 镜像 `server-0.1.2-preview.1`，源码标签 `vserver-0.1.2-preview.1` |
| Windows 客户端 Taskboard | `0.1.1`           | 安装包和源码标签 `v0.1.1`                                         |

服务端版本来自 `apps/server/package.json`；客户端仍沿用原版本文件与发布流程。仅升级其中一端不会自动更改另一端版本，跨端兼容性按 API 和验收记录判断。

**0.1.1 适合个人和可信团队试用，定位为兼容开发预览。** 已完成实际安装升级、侧栏、草稿保护与正常重启保留验证；安装包、Linux 镜像归档、校验和及 GitHub 来源证明已经准备好。[客户端 0.1.1 Release](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.1) 已于 2026-10-21 公开为 **pre-release**，普通访问者无需登录 GitHub 即可下载。

Windows 安装包未签名；真实公网域名的 HTTPS 部署尚未纳入本轮实测，Skill 的独立环境配对也仍需手动处理。当前不声明面向任意 Codex 版本、无需配置即可使用的稳定版。准备正式稳定版前，应完成真实部署试用、备份恢复演练和首次使用流程，代码签名作为分发改进继续推进。

| 你要做什么          | 需要准备什么                                                        |
| ------------------- | ------------------------------------------------------------------- |
| 只看界面            | [源码交互演示](#只预览界面与开发运行)，无需账号和服务器             |
| 浏览器管理任务      | 一台运行 Taskboard 的服务器、HTTPS 地址及 Taskboard 账号            |
| Windows 内嵌 Codex  | 上述服务，再加 Windows x64 客户端、已验证版本的 Codex、本机已有项目 |
| 让 Agent 领取与回写 | 保持 Windows 客户端运行，另行登录随包 CLI，按下文配置调用路径       |

## 使用手册

Taskboard 包含**共享服务端**和**每台设备的客户端**。服务端保存任务、成员与执行摘要；Windows 客户端连接服务端并接入本机 Codex。安装一个 `.exe` 不会自动提供云服务器，也不会获得 Taskboard 账号。

### 1. 准备服务器和账号

已有管理员提供的服务器时，取得类似 `https://board.your-domain.com` 的根地址、账号或邀请链接，直接进入第 2 步。自行使用则先按[部署服务端](#部署服务端)启动一个长期运行的实例，创建首个管理员，再在浏览器中登录并创建空间。默认没有公开注册。

Taskboard 账号和 Codex 账号分别登录。纯浏览器使用无需安装 Windows 客户端；用同一 HTTPS 地址即可管理任务，但浏览器不负责接入本机 Codex。

### 2. 安装并登录 Windows 客户端

1. 下载 [0.1.1 Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.1/Codex.Taskboard_0.1.1_x64-setup.exe)（约 24.7 MB）和 [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.1/SHA256SUMS)，也可从[版本页面](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.1)下载。无需登录 GitHub。GitHub 可能将文件名中的空格改为点号，按内容摘要核验即可。
2. 核对安装器 SHA-256：`e563c9d8c75e674e821ffe301635aee798ebcb0ff0f7d09a5eb99a82c3625c9a`。PowerShell 可运行 `Get-FileHash -Algorithm SHA256 -LiteralPath '下载文件的完整路径'`。当前文件为 `NotSigned`，系统显示的发布者状态应与此一致。
3. 安装后从开始菜单打开 **Codex Taskboard**。客户端自带 Node 运行时，普通使用无需安装 Node.js、pnpm 或 Codex CLI。
4. 在登录页输入服务器根地址，点击“保存服务器”，再填写 Taskboard 邮箱、密码并点击“登录并继续”。密码至少 12 字符。
5. 进入空间，确认右上角显示“已同步”，再开始新建或修改真实任务。

地址使用 HTTPS，不加 `/api/v1`、子路径、查询参数或片段。本机开发可使用 `http://127.0.0.1:47830`；另一台设备上的 `127.0.0.1` 指向它自己，应使用共同可达的 HTTPS 地址。

### 3. 连接本机项目与 Codex

> 源码中的后续改动已新增日常 Codex 接入和连接快捷方式，沿用原登录、项目和会话；首次需正常退出并从连接入口重开一次。该改动尚未打包发布，日常环境及新宿主版本仍待实机验收，见 [ADR 0004](docs/adr/0004-daily-codex-connection.md)。下列步骤对应已发布的 0.1.1 安装包。

1. 先把项目克隆或准备到本机已有目录，例如 `D:\work\my-project`。客户端不会自动克隆仓库。
2. 打开空间右上角“设置”→“连接与设备”，在“本机仓库映射”中保存仓库地址与该目录。任务“仓库”字段使用相同仓库身份，例如 `https://github.com/your-org/my-project`。
3. 点击“启动独立 Codex”。首次在这个独立窗口中自行登录 Codex，并打开对应的本机项目；之后登录和项目配置会保留。
4. 等项目和编辑器加载完成，保持独立窗口可见、编辑器为空，再点击 Taskboard 中的“接入 Codex 侧栏”。
5. 在独立 Codex 左侧点击“任务看板”，可以切换看板/列表并打开任务详情；再次点击入口返回 Codex。

本轮精确验收版本为 Codex `26.1013.4894.0`。独立窗口使用单独的数据目录，日常已有 Codex 窗口不被接管。未知版本、错误项目、弹窗或非空编辑器会拒绝填写草稿；不应通过修改版本清单来跳过检查。更多配置见[桌面说明](docs/desktop.md)。

### 4. 配置 Agent 的任务读写

**看板登录与 CLI 登录相互独立。** 只浏览任务、手动编辑或填写 Codex 草稿时可跳过本步；让 Agent 真正领取、评论和提交结果前，需要在同一 Windows 用户下完成 CLI 登录。

在 PowerShell 执行下面示例，把 `$taskboardRuntime` 换成实际安装目录下的 `runtime`，邮箱换成自己的 Taskboard 邮箱。保持客户端运行。示例通过标准输入传密码，并临时使用 UTF-8 兼容 Windows PowerShell 5：

```powershell
$taskboardRuntime = 'G:\codex-taskboard\Codex Taskboard\runtime'
$taskboardCli = Join-Path $taskboardRuntime 'taskctl.cmd'
$taskboardPassword = Read-Host 'Taskboard 密码' -AsSecureString
$taskboardPreviousEncoding = $OutputEncoding
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [System.Net.NetworkCredential]::new('', $taskboardPassword).Password |
        & $taskboardCli login 'you@your-domain.com'
} finally {
    $OutputEncoding = $taskboardPreviousEncoding
    Remove-Variable taskboardPassword
}
```

成功后可用 `& $taskboardCli --help` 查看命令。读取一张任务使用 `get <任务UUID>`；完整 UUID 在“在 Codex 中打开”产生的草稿首行中，`TB-1` 这类展示编号不能代替 UUID。

**0.1.1 的 Skill 配对限制：** 随包 `install-taskboard-skill.cmd` 只写入默认 `%USERPROFILE%\.codex\skills\taskboard` 并设置用户环境变量；它不自动配置独立 Codex。独立启动器还会清理继承的 `TASKBOARD_*` 变量，因此不能假设该窗口中的 Skill wrapper 已完成配对。本版可直接调用随包 CLI：在任务草稿后追加下面说明，替换其中安装路径，再由你检查并发送：

```text
请先读取 G:\codex-taskboard\Codex Taskboard\runtime\skills\taskboard\SKILL.md。
本机 CLI 是 G:\codex-taskboard\Codex Taskboard\runtime\taskctl.cmd，
请用这个绝对路径调用，不依赖 Skill 中的相对 wrapper 或配对环境变量。
先 get 核对任务与当前版本，再用当前 CODEX_THREAD_ID 领取，
完成工作和验证后提交摘要与验证记录，交给我验收。
```

这条手动配置路线依据随包命令接口；本轮 0.1.1 实机验收覆盖了侧栏和草稿，没有新增验证 Skill 自动发现或 Agent 自动执行。后续版本应补齐独立环境的一键配对。自行安装项目级 Skill 可参考 [OpenAI 官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)，并先确认当前 Codex 确实已加载该 Skill。

### 5. 从任务到完成

1. 在看板中新建任务，填写标题、描述、优先级、验收要求及仓库地址，保存。
2. 打开任务详情，点击“在 Codex 中打开”。它只把任务填成未发送草稿，不会自动领取，也不会发送消息。
3. 核对目标项目和草稿，按上一节提供 CLI 路径，然后由你发送。Agent 应读取最新任务、原子领取，工作中回写进度，完成后提交摘要与验证记录。
4. 任务进入“待验收”后，查看改动和验证结果，再点击“验收并完成”。也可手动使用“领取任务”和“提交结果至待验收”管理流程；同一任务只选择一个执行者，避免重复领取。
5. 如出现版本冲突，先保留草稿并读取最新任务，合并后再保存；不要直接覆盖其他设备的修改。

Taskboard 共享任务内容与执行摘要，完整 Codex 对话仍留在原来的 Codex 环境中，不会跨设备复制。打开历史会话的 `openThread` 当前不可用。

### 6. 多设备、退出与升级

多台设备使用同一服务器地址；同一人可登录自己的账号，不同成员使用邀请获得的独立账号。每台设备分别准备项目目录并保存本机映射，Agent CLI 也分别登录。成员只能访问获授权的空间。

断网后可查看此前已缓存的任务，界面显示“离线缓存”；新建、领取和在线保存暂停，本机草稿不代表已同步。恢复联网后重新核验权限。没有服务器时不能把客户端当成完整离线任务工具。

关闭窗口会收至系统托盘；需要彻底退出时，从托盘菜单选择“退出”。升级前先处理未同步工作、正常退出独立 Codex 和 Taskboard，并备份 `%APPDATA%\CodexTaskboard` 及原安装目录，再运行新安装器。此数据目录包含凭据，应保存在本机受保护位置。服务端数据库需[单独备份](docs/deployment.md#备份与恢复)，客户端备份不能替代服务器备份。

## 部署服务端

推荐的新部署方式：**预构建镜像 → 服务器拉取 → `127.0.0.1:47830` → OpenResty HTTPS 反代**。服务器不需要编译代码；首次打开网页创建管理员，数据库密码和会话密钥自动生成并持久保存。管理员登录后可以查看运行状态和日志、修改账号与日志级别，并验证密码查看密钥。

完整步骤及本机 Bash / PowerShell 构建命令见[镜像与 OpenResty 部署手册](docs/deployment-openresty.md)，配置见 [compose.openresty.yaml](compose.openresty.yaml) 和 [OpenResty 片段](deploy/openresty.conf)。服务端预览标签为 [`vserver-0.1.2-preview.1`](https://github.com/i-am-yimin/codex-taskboard/tree/vserver-0.1.2-preview.1)，部署镜像为 `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.2-preview.1`，支持匿名拉取；发布结果与摘要见[服务端发布流程](https://github.com/i-am-yimin/codex-taskboard/actions/workflows/publish-server-image.yml)。原提交号镜像保留，旧 `0.1.1` 镜像不支持网页初始化。

新部署目录里将上述配置保存为 `compose.yaml`，将 [openresty.env.example](deploy/openresty.env.example) 保存为 `.env`，其中已填固定镜像版本（可选修改仓库和端口），然后执行：

```bash
docker compose pull
docker compose up -d
docker compose logs app
```

配置 OpenResty 后打开 HTTPS 域名，输入日志中的一次性初始化口令并创建管理员。数据库密钥在登录前由容器准备，登录后可以验证查看，页面不直接更改数据库密码。既有 `0.1.1` 数据卷不能直接换用自动生成密码的新配置，迁移说明见上述手册。

### 旧 0.1.1 / Caddy 部署方式

适合维护者在 Linux amd64 上自部署。需要 Docker Engine、Compose plugin、域名及其 DNS 指向服务器，开放 80/443；PostgreSQL 不向公网映射端口。完整备份、升级和回滚步骤见[部署文档](docs/deployment.md)。

以下在服务器的 Bash 中执行，从固定 0.1.1 源码构建。已有仓库时另选新目录，避免覆盖正在运行的部署：

```bash
git clone --branch v0.1.1 --depth 1 https://github.com/i-am-yimin/codex-taskboard.git taskboard-0.1.1
cd taskboard-0.1.1
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，至少设置以下三项，均不要保留示例值：

| 变量                | 内容                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `DOMAIN`            | 已指向服务器的域名，例如 `board.your-domain.com`，不带 `https://`     |
| `POSTGRES_PASSWORD` | 数据库随机密码；使用随机十六进制可避免连接串转义问题                  |
| `SESSION_KEY`       | 64 位十六进制随机值，可用 `openssl rand -hex 32` 生成；部署后保持稳定 |

Compose 根据这些值生成应用的数据库连接和 HTTPS 来源地址；`.env.example` 中的回环 `DATABASE_URL`、`PUBLIC_ORIGIN` 用于源码本机开发。随后构建、迁移并创建首个管理员，把示例邮箱替换成自己的：

```bash
docker compose build app
docker compose up -d db
docker compose run --rm app node dist/migrate.js
read -rsp '管理员密码（至少 12 字符）: ' taskboard_admin_password
printf '\n'
printf '%s' "$taskboard_admin_password" | docker compose run --rm -T app node dist/admin.js bootstrap --email owner@your-domain.com --name Owner
unset taskboard_admin_password
docker compose up -d
docker compose ps
```

打开 `https://你的域名`，检查 HTTPS 证书、登录、创建空间及一张测试任务，再让各客户端连接。首个管理员只能初始化一次。正式长期使用前，还应在独立环境演练数据库备份与恢复。本仓库 CI 验证过内部 CA HTTPS；真实公网证书和服务器网络由实际部署核验。

也可核对发布资产后用 `docker load -i taskboard-linux-amd64.tar` 导入镜像，替代 `docker compose build app`；归档内标签为 `ghcr.io/i-am-yimin/codex-taskboard:0.1.1`。旧草稿发布流程不向 GHCR 推送镜像；新的 **Publish server image** 流程独立手动运行，未运行成功前不要假定镜像存在。

## 常见问题

| 现象                                | 处理方式                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 只有“离线缓存”，不能新建            | 先确认原服务器在线、地址可达，再检查登录。离线缓存不是重新认证成功的证明                                                     |
| 要更换服务器地址                    | 先处理未同步草稿和待提交结果，再在“连接与设备”退出当前设备，回登录页保存新地址。退出会清除该账号的本机缓存、草稿及两类会话   |
| 地址无法编辑                        | 已有会话或显式 `TASKBOARD_UPSTREAM` 启动配置会锁定编辑，先确认当前配置来源                                                   |
| 未检测到 Codex 或版本未验证         | 使用“启动独立 Codex”，在独立窗口登录并打开项目；核对精确版本。浏览器页面无法接入本机 Codex                                   |
| 侧栏接入失败                        | 等项目和编辑器加载完成，保持窗口可见、空编辑器、无弹窗，再检查连接。状态未确认时先看独立窗口，避免反复填写                   |
| 草稿未写入                          | 核对任务仓库与本机映射、当前项目、编辑器是否为空；未知版本与身份不明确时会拒绝                                               |
| 找不到 taskboard Skill 或提示未配对 | 按第 4 节提供随包 CLI 和 Skill 文件绝对路径；0.1.1 不保证独立窗口自动加载默认目录中的 Skill                                  |
| CLI 提示未认证                      | 桌面与 CLI 分别登录，按第 4 节登录同一个账号，并保持 Taskboard 运行                                                          |
| 已安装但启动失败                    | 查看 `%APPDATA%\CodexTaskboard\launcher-diagnostic.txt`；同一用户只运行一个 Taskboard，固定本机端口 47831 不能被其他实例占用 |

## 只预览界面与开发运行

开发环境需要 Node.js 22.16+、pnpm 10.28.0。仅看合成界面可执行：

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

在 Chrome 打开 [交互演示](http://127.0.0.1:4173/?demo=1)，不连接真实账号或 Codex。需要本机真实服务时，另准备 PostgreSQL，按[开发说明](docs/development.md)配置 `.env`、运行迁移并初始化管理员。Windows 安装包的普通使用不需要这些开发依赖。

## 兼容范围

| 组件                   | 首版目标                                | 验证状态                                               |
| ---------------------- | --------------------------------------- | ------------------------------------------------------ |
| 浏览器看板             | Chrome，1280×800 / 1920×1080            | 开发预览验收通过                                       |
| 服务端                 | Linux amd64 / PostgreSQL 16+            | 部署、备份与回滚验收通过；HTTPS 使用内部 CA            |
| 桌面启动器             | Windows x64                             | 0.1.0 双设备基线；0.1.1 本机升级与日常安装验证；未签名 |
| Codex 内嵌             | 26.1013.4894.0；26.1007.9446.0 历史基线 | 按对应候选验证侧栏、草稿及正常重启；未知版本拒绝       |
| Codex CLI / 其他 Agent | 后续版本                                | 首版保留接口                                           |

兼容性按精确宿主版本核验；清单中的其他版本见源码和历史记录，完整门槛结论仅对应上述验收基线。历史会话导航 `openThread` 尚未验证，保持不可用。共享的是任务内容与执行摘要，完整 Codex 会话不会自动跨设备同步。首版不提供自动排队调度、GitHub 数据同步或完整离线编辑。

`v0.1.1` 的标签实际安装包已完成 Codex `26.1013.4894.0` 的侧栏、草稿、正常重启、真实旧 companion 数据升级保留及日常安装升级，具体范围与摘要见 [0.1.1 验收记录](docs/acceptance-0.1.1.md)。此前 `92873ed` 的完整布局验证保留在[历史兼容验收](docs/acceptance-host-26-1013.md)。固定 `v0.1.0` 资产保持，安装包仍未签名。

## 验证与维护

```sh
pnpm exec playwright install chromium
pnpm check
pnpm test:db
pnpm test:e2e
pnpm test:offline
pnpm desktop:diagnose
```

`test:db` 在项目 `.data` 下启动独立本机 PostgreSQL，不使用生产数据库。CI 使用专用 PostgreSQL 服务。桌面诊断无法连接受管理的 Codex 时会明确失败，而非报告兼容。

`test:offline` 需要已构建的 Web 和独立测试数据库，验证缓存页面后真正关闭、断网重开浏览器。离线只读缓存需要此前成功联网访问；联网后重新校验权限，不支持离线领取或保存任务。

欢迎通过 Issue 与 fork PR 参与。主仓库合并、标签和发布由 [@i-am-yimin](https://github.com/i-am-yimin) 维护；自动化只准备构建产物和草稿 Release。参见 [贡献指南](CONTRIBUTING.md) 和 [安全说明](SECURITY.md)。

MIT License。独立实现，产品行为参考 [dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard)，未复制其源码或素材。本项目为社区工具，不代表 OpenAI 官方产品。
