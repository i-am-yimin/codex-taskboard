# Codex Taskboard 客户端 0.1.4（预发布）

在 Taskboard 主界面点击“连接 Codex”，即可打开或接入日常 Codex，沿用原登录、项目和聊天。接入成功后按钮变为“打开 Codex”；之后普通启动 Taskboard 自动恢复侧栏，无需专用快捷方式。可在“连接与设备”关闭自动连接，手动接入保留关闭选择。

- [Windows x64 安装包](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/Codex.Taskboard_0.1.4_x64-setup.exe)
- [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.4/SHA256SUMS)
- [使用手册](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/README.md#使用手册)
- [验收记录](https://github.com/i-am-yimin/codex-taskboard/blob/codex/initial-implementation/docs/acceptance-0.1.4.md)

已经运行但尚未启用连接的 Codex 仍需保存工作并正常退出一次；Taskboard 会等待并自动继续，可取消等待，不会结束你的 Codex。日常模式的草稿仍由用户复制、粘贴并确认发送。

修复无边框主窗口识别，支持恢复最小化与隐藏窗口并保留最大化状态和尺寸。连续打开复用当前侧栏，短暂探测失败只做有界重新校验，避免重复安装导致的生命周期错误。设置保存失败单独提示，并支持仅重试保存；明暗主题提示对比度已核对。

精确验收 Codex 26.1016.8622.0；未知版本或身份验证失败继续拒绝。完整 CI 与固定标签发布流程通过，校验和、严格 GitHub 构建来源证明、Linux 镜像层和 SPDX 已核验。实际发布包完成本机 0.1.4 CI 预览升级、免重新登录、自动恢复、关闭偏好保留、20 次连续打开及正常退出重连验收。原账号、设备、映射、凭据和草稿保持，日常 Codex 进程未重启，真实草稿未写入或发送。首次未启用连接的等待、取消及超时由浏览器回归覆盖，本轮没有退出日常 Codex 重测首次冷启动。

Windows 安装器未签名（NotSigned），本版仍为开发预览，以 pre-release 发布，不设为 latest。客户端自带运行时，首次使用需自己的 Taskboard HTTPS 服务和账号。独立服务端保持 `0.1.2-preview.1`，已有镜像和部署不自动更改。本 Release 的 Linux 归档属于客户端源码标签的构建；旧版标签和资产保持。

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
