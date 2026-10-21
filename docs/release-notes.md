# Codex Taskboard 0.1.1 兼容开发预览

此版本增加 Codex `26.1013.4894.0` 的精确版本支持，继续逐次验证原生进程归属、项目身份和空编辑器；未知版本保持拒绝。Windows x64 安装包未签名（`NotSigned`），[客户端 0.1.1](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.1) 已于 2026-10-21 公开为预发布版，普通访问者无需登录 GitHub 即可下载。

[下载 Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.1/Codex.Taskboard_0.1.1_x64-setup.exe)（约 24.7 MB）及 [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.1/SHA256SUMS)。匿名完整下载安装器及校验和的 SHA-256 与原验收值一致；公开发布没有重建二进制或移动标签。客户端与服务端独立版本，新服务端部署使用 `server-0.1.2-preview.1`，见[部署手册](deployment-openresty.md)；此 Release 的 Linux 归档属于旧 `v0.1.1` 构建。

固定 `v0.1.1`（`c71eb870829371835e2b4ea9f3125f120f552d1e`）新安装包已重新完成真实旧 companion 数据的 0.1.0→0.1.1 安装升级、首次启动保留、正式侧栏与草稿入口、外部重载、CSP 恢复和正常宿主重启。日常安装也已升级，原三张离线缓存任务、凭据及配置保留。详见 [0.1.1 验收](acceptance-0.1.1.md)及[结构化判定](acceptance/v0.1.1-verdict.json)。此前 `92873ed` 三种原生宽度的完整记录仍见[历史验收](acceptance-host-26-1013.md)，本轮布局冒烟覆盖 742 / 1920px。

固定 `v0.1.0` 标签和五项草稿资产保持原验收范围；此次不重新声明双设备、公网 HTTPS 或 Linux 镜像回滚验收。Linux amd64 镜像仍经过 CI 的隔离部署、备份恢复与内部 CA HTTPS 检查。

五项资产已核对 `SHA256SUMS` 和严格 GitHub 构建来源证明。Windows 安装器 SHA-256：`e563c9d8c75e674e821ffe301635aee798ebcb0ff0f7d09a5eb99a82c3625c9a`。下载后仍应核验；GitHub 可能将 Windows 文件名中的空格改为点号，摘要不受改名影响。Linux 归档可用 `docker load` 导入。升级前从托盘正常退出 Taskboard 并备份本机数据。

一次侧栏接入未观察到看板就绪并安全回退，保持独立窗口可见后重试通过；原因未确认，未修改产品超时。原始失败记录保留。测试草稿、合成账号、缓存和专用数据库均已清理，测试服务正常停止。
