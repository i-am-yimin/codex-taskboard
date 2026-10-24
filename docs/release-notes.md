# Codex Taskboard 客户端 0.1.4（发版准备）

Taskboard 主界面新增“连接 Codex”，可直接打开或连接日常 Codex，并接入侧栏。成功后按钮变为“打开 Codex”。主界面与设置页共享连接状态及正在进行的请求，不需要额外创建或使用连接快捷方式。

首次接入成功后记住自动连接选择，之后普通启动 Taskboard 即可恢复侧栏。可在“连接与设备”关闭，显式关闭后手动连接不会重新启用。未开启连接的已运行 Codex 仍需正常退出一次：Taskboard 内会显示等待说明，退出后自动继续；可取消等待，不结束用户进程。

保留日常登录、项目和聊天，复用已有原生身份检查、宿主版本清单、侧栏 nonce/CSP 验证和完整错误说明。日常模式的任务草稿仍需手动粘贴；独立测试环境保留在折叠项中。

修复接入后再次点击“打开 Codex”无法识别无边框主窗口的问题，支持恢复最小化并保留最大化状态。修复自动连接选择保存失败时提示被连接成功状态覆盖的问题，增加独立的保存失败提示和“重试保存”。

0.1.4 尚未公开发版。浏览器回归、打包检查、完整 CI、真实安装和同进程重连分别验证；校验和、来源证明及公开下载属于固定标签发版门槛。独立服务端保持 `0.1.2-preview.1`，旧版标签和资产保持。

以下保留 0.1.3 的公开发布说明。

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
