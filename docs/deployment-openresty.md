# 预构建镜像与 OpenResty 部署

适用于包含网页首次初始化功能的新服务端镜像。固定 `v0.1.1` 的旧镜像不支持这份 Compose；本分支添加构建与发布流程，不代表镜像已经发布到 GHCR。

## 1. 在本机或 CI 构建一次

构建机器需要 Docker Engine / Docker Desktop 和 Buildx。Windows 构建 Linux 镜像时，Docker Desktop 使用 Linux containers 模式；服务器不需要 Node.js、pnpm、Git 或编译器。

在包含本功能的代码版本、干净的工作区中执行，使用提交号作为固定镜像标签：

```bash
docker login ghcr.io
taskboard_image_tag="server-$(git rev-parse --short=12 HEAD)"
docker buildx build --platform linux/amd64 \
  -t "ghcr.io/i-am-yimin/codex-taskboard:$taskboard_image_tag" \
  --push .
printf 'TASKBOARD_VERSION=%s\n' "$taskboard_image_tag"
```

PowerShell 对应命令：

```powershell
docker login ghcr.io
$taskboardImageTag = 'server-' + (git rev-parse --short=12 HEAD)
docker buildx build --platform linux/amd64 --tag "ghcr.io/i-am-yimin/codex-taskboard:$taskboardImageTag" --push .
Write-Output "TASKBOARD_VERSION=$taskboardImageTag"
```

需要对目标 GHCR 包有写入权限。首次创建的包可能是私有包；如果要让服务器匿名拉取，在 GitHub Package 设置中将包设为 Public。私有分发则在服务器上用有 `read:packages` 权限的账号执行 `docker login ghcr.io`。发布镜像不包含数据库密码、会话密钥或账号。

也可在 GitHub Actions 手动运行 **Publish server image**，选择包含本功能的分支。流程先验证隔离部署，再推送 `server-<12 位提交号>`，运行摘要给出标签和 digest。它不会创建 GitHub Release，也不会覆盖 `0.1.1` 或 `latest`。长期部署可在 Compose 中把整个 `image:` 固定为流程输出的 `ghcr.io/...@sha256:...`。

只构建、不推送时，把 `--push` 改成 `--load`。离线服务器可用 `docker save` / `docker load` 转移镜像，但数据库基础镜像也要提前准备。

CI 的容器测试成功后也会提供 `server-image-preview` artifact，内含测试过的 Linux amd64 镜像归档、镜像引用和校验和（保留 14 天）。可在装有 Docker 的机器校验后导入，再推送到自己的镜像仓库；下载归档并不表示 GHCR 已经发布该镜像。

## 2. 在服务器准备两个文件

需要 Linux amd64、Docker Engine 和 Compose v2。下面的回环地址用于 **OpenResty 与 Docker 在同一台宿主机** 的情况。

建立一个独立部署目录，将仓库的 [`compose.openresty.yaml`](../compose.openresty.yaml) 保存为该目录的 **compose.yaml**，将 [`deploy/openresty.env.example`](../deploy/openresty.env.example) 保存为 **.env**，填写刚刚发布成功的镜像标签：

```dotenv
TASKBOARD_VERSION=server-你的12位提交号
TASKBOARD_IMAGE=ghcr.io/i-am-yimin/codex-taskboard
TASKBOARD_PORT=47830
```

这是新实例部署方式。已有 `0.1.1` 数据卷时，先保留旧 Compose 和备份，不能直接换成此配置：新生成的密码不会修改旧 PostgreSQL 用户密码。旧实例可继续使用原部署方式运行新代码；转换到自动管理密钥需要另行迁移。

同一服务器已有另一个 Taskboard 实例时，还需在 `.env` 设置不同的 `COMPOSE_PROJECT_NAME` 和 `TASKBOARD_PORT`，避免复用旧实例的数据卷；独立目录本身不会覆盖 Compose 中固定的项目名。

## 3. 拉取并启动

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs app
```

启动顺序：init 创建持久密钥 → PostgreSQL 初始化 → 应用自动迁移数据库。无需手动生成密钥、执行迁移或运行管理员 bootstrap 命令。

应用仅发布 `127.0.0.1:47830`，PostgreSQL 没有宿主机端口。容器内部应用必须监听 `0.0.0.0` 才能接收 Docker 转发；宿主机的回环绑定负责限制外部直连。

从 app 日志中取得 `Taskboard first-run setup token:` 后面的初始化口令。该口令证明操作者有服务器权限；网页不会向匿名访问者展示口令。初始化结束后同一口令不能再次创建管理员。

## 4. 配置 OpenResty

先为域名配置 DNS、HTTPS 证书和 HTTPS `server {}`，再把 [`deploy/openresty.conf`](../deploy/openresty.conf) 中的 `location /` 放进去。该片段包含必要的 Host / forwarding headers、关闭 SSE 缓冲和较长读取超时。证书由现有 OpenResty 方案维护。

检查配置后重载（命令路径按实际安装位置调整）：

```bash
openresty -t
openresty -s reload
```

如果 OpenResty 也运行在容器内，其 `127.0.0.1` 指向自己的容器，不能直接使用这份上游地址。应让它访问宿主机回环的 host network，或另行配置共享 Docker 网络和受限的应用入口；不要直接把应用端口改成公网监听。

## 5. 在网页完成首次初始化

打开 `https://你的域名`：

1. 输入启动日志里的初始化口令。
2. 设置管理员名称、邮箱、密码（至少 12 字符）。
3. 核对对外访问地址为当前 HTTPS 根域名。
4. 创建管理员并登录，随后创建第一个空间。

数据库密码和会话密钥必须在登录前可用，由容器自动生成，不能等登录后才填写。它们保存在 `taskboard-state` 卷，数据库数据保存在 `postgres-data` 卷；重启和重建容器继续使用原值。

## 6. 登录后管理

尚未创建空间时，右上角有“服务器管理”；有空间后从“设置 → 服务器管理”进入，也可以打开 `/#admin`。此入口仅供实例管理员在网页中使用，普通成员和 Agent 令牌无权访问。

| 页面         | 可执行操作                                                                        |
| ------------ | --------------------------------------------------------------------------------- |
| 运行与设置   | 查看版本、数据库状态、连续运行时间；修改对外访问地址及日志级别                    |
| 管理员账号   | 验证当前密码后修改名称、邮箱和密码；更换密码会撤销其他会话和 Agent 令牌           |
| 数据库与密钥 | 查看数据库连接信息；重新验证管理员密码后查看数据库密码和会话密钥，60 秒后自动隐藏 |
| 运行日志     | 查看本次进程最近 200 条应用日志，每 10 秒刷新；内存上限 1000 条                   |

数据库连接和密钥在网页中只读。直接改变密码文本不会同步 PostgreSQL 用户密码，直接更换会话密钥也会使已有登录失效，因此这里不提供这种修改按钮。对外访问地址由旧部署的 `PUBLIC_ORIGIN` 环境变量固定时，网页显示为只读。

完整应用历史、PostgreSQL 日志仍用 `docker compose logs app` / `docker compose logs db` 查看。Docker 每个服务最多保留 3 个 10 MB 日志文件，应用管理页不读取 Docker socket。

## 7. 备份、升级和验收

在部署目录中备份数据库，并另外保存密钥卷：

```bash
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T db pg_dump -U taskboard -d taskboard -Fc > backups/taskboard.dump
docker compose run --rm --no-deps -T --entrypoint tar app -cz -C /var/lib/taskboard . > backups/taskboard-state.tar.gz
cp .env compose.yaml backups/
```

以上固定文件名会覆盖同名备份，定时备份应改为按日期命名并异机保存。恢复演练需要同时恢复数据库及对应密钥；保留仓库脚本时，可按[部署文档](deployment.md#备份与恢复)使用数据库恢复脚本。不要运行 `docker compose down -v`。

升级前备份并记录旧镜像标签，停止 app，再修改 `.env` 的固定版本、执行 `docker compose pull` 和 `docker compose up -d`。应用会自动迁移；验收健康接口、登录、任务读写和实时同步后再结束维护。失败时恢复升级前数据库与旧镜像，不单独假定数据库迁移可逆。

```bash
curl --fail https://你的域名/api/v1/health
```

最后验证一次服务器重启后恢复、两个客户端任务同步、独立环境备份恢复。当前单实例部署不提供多副本水平扩容。
