# 服务端 0.1.3-preview.1 镜像验收

状态：2026-10-25 已发布 Linux amd64 预览镜像，匿名拉取验证通过。本次未升级任何生产服务器，也未发布客户端 0.1.5 安装包。

| 项目 | 固定引用 |
| --- | --- |
| 版本镜像 | `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.3-preview.1` |
| 提交镜像 | `ghcr.io/i-am-yimin/codex-taskboard:server-a63d8761342f` |
| OCI 索引摘要 | `sha256:a6cee039a851f0cdd5ca963370ad709dd81e79583db55ac73bcf86224e2d4c91` |
| 源码标签 | [`vserver-0.1.3-preview.1`](https://github.com/i-am-yimin/codex-taskboard/tree/vserver-0.1.3-preview.1) |
| 源码提交 | `a63d8761342f15ea11ce42e13ef8bae3f4a354c7` |
| 发布运行 | [40145424631](https://github.com/i-am-yimin/codex-taskboard/actions/runs/40145424631) |

## 已验证

- 固定源码的 [CI 40113830247](https://github.com/i-am-yimin/codex-taskboard/actions/runs/40113830247) 中 `verify`、`container`、`windows-desktop` 均通过。
- 发布沿用 `release` 环境的维护者审批，仅增加本次精确标签允许项；原审批规则和旧版本允许项保留，未使用管理员绕过。
- 发布前隔离部署检查通过：首次初始化、管理员访问、回环监听、重启、密钥保留及数据库备份恢复。构建发布步骤成功，没有覆盖已有镜像版本。
- 发布后通过匿名 OCI Registry 请求下载索引、Linux amd64 清单、配置及全部 10 个镜像层，逐项校验 SHA-256；版本标签与提交号标签的索引摘要相同。
- 镜像版本与 revision 标签对应上述源码，使用非 root 的 `node` 用户；配置中没有数据库密码、会话密钥或管理员凭据。
- BuildKit provenance 与 SPDX SBOM 的摘要、目标平台镜像及源码提交已核对。旧 `server-0.1.2-preview.1` 镜像摘要保持不变。
- 账号主题与主题包的持久化、冲突、隔离和真实生产链路证据见[0.1.5 验收](acceptance-0.1.5.md)。

## 范围与升级

公开拉取检查使用 Registry 接口下载实际镜像内容；本机没有另用 Docker Engine 启动已发布镜像，不将该检查写作生产部署验收。发布前的容器运行证据来自同一固定源码的隔离工作流。

旧客户端继续使用原任务接口。服务启动时执行 `0004_user_themes`，仅新增个人外观和主题表。已有实例按[保留数据升级流程](deployment-openresty.md#保留数据升级到-013-preview1)备份数据库与密钥，再更新应用镜像；不清空数据、不重新初始化账号。单实例切换有短暂断连。

详细回执与下载内容保存在本机忽略目录 `.artifacts/release/2026-10-25-server-0.1.3-preview.1/`，不提交凭据、私有日志或数据备份。
