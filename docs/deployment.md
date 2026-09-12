# 部署、备份与升级

## Linux Docker Compose

需求：Linux amd64、Docker Engine + Compose plugin、指向服务器的域名，开放 80/443。数据库不映射公网端口。配置文件必须限制读取权限。

```sh
cp .env.example .env
# 设置 DOMAIN、POSTGRES_PASSWORD（建议使用随机十六进制，避免 URL 转义问题）
# SESSION_KEY 使用 openssl rand -hex 32 生成
docker compose build
docker compose up -d db
docker compose run --rm app node dist/migrate.js
docker compose run --rm -T app node dist/admin.js bootstrap --email owner@example.com --name Owner
docker compose up -d
```

管理员密码经标准输入提供，至少 12 字符。初始化只在没有实例管理员时成功。进入域名登录，创建空间，然后生成邀请链接交给可信成员。不要将示例域名或密码用于实际部署。

尚未发布镜像时使用 `docker compose build`；正式发布后可使用固定版本镜像。默认单个 API 实例，不宣称支持多副本水平扩容。SSE 需要代理即时转发，示例 Caddy 已配置。

Compose 设置 `TRUST_PROXY=1`，仅信任紧邻应用的一跳 Caddy，并且应用不映射宿主机端口。直接运行 API 时不设置此变量；不要在公开 API 端口前使用这一配置，否则客户端可能伪造来源地址。镜像标签不带 `v`（例如 `0.1.0`），Git 标签带 `v`。

## 备份与恢复

```sh
sh scripts/backup.sh /secure/backups
sh scripts/restore.sh /secure/backups/taskboard-TIMESTAMP-RANDOM.dump --confirm-restore
```

备份命令成功后打印实际文件路径，名称含时间与随机后缀，允许并发运行；失败会清理临时文件。恢复时使用成功输出中的完整路径。

恢复会替换数据库内容，先备份当前实例。脚本先检查归档可读性，然后停止应用、删除并重建 taskboard 数据库、单事务导入备份，因此备份之后新增的表也会移除。失败时保留应用停止状态，检查错误并重新恢复后再启动。数据库备份之外还应安全保管部署环境变量；凭据不要随数据库公开分发。定期在独立环境演练恢复。

## 升级与回滚

1. 阅读版本说明及迁移要求，记录当前镜像版本。
2. 备份并校验文件，停止应用写入。
3. 拉取指定版本镜像（或从对应标签构建），执行迁移。
4. 启动应用，检查健康接口并验证登录、读取任务及 SSE。
5. 失败时停止应用，恢复升级前数据库备份和对应版本镜像。

`docker compose down` 保留卷。不要使用 `down -v`，除非明确要删除数据。

## 维护者发布设置

可在装有 Docker Engine、Compose、curl 和 jq 的 Linux 开发机运行 `sh scripts/check-deployment.sh`。它使用新生成的测试项目和独立数据卷，忽略工作区 `.env`，构建后验证首次管理员、登录、任务写入、备份与恢复。恢复检查同时验证备份后新增的表被移除。退出时仅清理本次测试项目的容器和卷，诊断与备份保留在 `.artifacts/deployment-test-*`。这不是公共域名 HTTPS 验收，也不连接现有生产部署。

仓库 ruleset 限制主分支直接写入与 tag 创建，只授予维护者；启用必需 CI、禁止强制推送。发布环境仅允许维护者审批。独立维护者不配置无法完成的“必须由另一个人批准”的规则。外部 PR 使用只读 token，不能读取发布密钥；工作流不使用 `pull_request_target` 执行 PR 代码。
