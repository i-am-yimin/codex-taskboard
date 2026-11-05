# 0.1.12 版本验收

状态：2026-11-05，客户端 **0.1.12 未签名预发布**与独立服务器 **0.1.5-preview.2**均已公开。源码、固定标签工作流、最终载荷、随包运行时、来源证明和匿名下载通过；本轮未执行普通客户端原位安装或生产服务器升级。

## 版本与来源

[PR #26](https://github.com/i-am-yimin/codex-taskboard/pull/26) 已合并。客户端 `v0.1.12` 与服务器 `vserver-0.1.5-preview.2` 固定于 `a0d96b68240ab3938fa589b0de5b878485465283`；后续文档提交不移动标签或替换资产。既有 0.1.11 和 server-0.1.5-preview.1 的标签、资产及镜像摘要保持。

本版整理看板顶栏、账号菜单、个人设置与后台布局；窄屏完整展示分类，保留四套主题、键盘焦点、未保存输入和现有权限。配套服务器只刷新网页与版本，无新增 API、协议或数据库迁移。见[布局参考与验收](acceptance-console-layout.md)。

## 验证结果

| 范围           | 证据                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 源码 CI        | 发布准备提交 `7cd0a08` 的 [CI](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41948908484) 通过 verify、container、windows-desktop：353 项测试、1 项平台相关跳过，178 项 E2E 通过；包括真实 PostgreSQL、SMTP、生产入口、主题、离线、Cargo/Tauri/NSIS、容器部署恢复及 HTTPS。合并源码 [CI](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41950319478) 全部通过。                             |
| 固定客户端标签 | [发布工作流](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41950332553) validate、release-gate、windows、linux、draft 全部成功；既有 release 环境审核规则保留，只添加两个精确标签的部署策略。按本次发布授权完成符合资格的维护者审批，没有 bypass。                                                                                                                                                      |
| 最终安装器     | `Codex.Taskboard_0.1.12_x64-setup.exe`，24978471 字节；SHA-256 `660de5cbd02e0fb2bd7e165bec59e34bb14286e2058266958890adbba5c57380`。安装器与主程序均为 NotSigned，主程序版本 0.1.12。官方 artifact ZIP、发布资产摘要及完整匿名下载匹配。                                                                                                                                                                              |
| NSIS 载荷      | 安全提取 17 项主程序与 runtime 文件，对应同源码本机生产构建；两份复制的 skill 文本逐字节等于固定 Git 原文的精确 CRLF 检出，其余 runtime 字节匹配。没有更改构建包或放宽生产校验。                                                                                                                                                                                                                                     |
| 随包运行时     | 使用最终包中的 Node、companion 与 taskctl 实际执行中文/空格长路径和 ES module 环境检查。只使用独立临时目录与回环服务，正常退出并清理。                                                                                                                                                                                                                                                                               |
| Linux 与 SBOM  | 实际 Linux 归档的全部层 blob/diffId、linux/amd64、node 用户、入口、package.json 固定 Git 字节及版本 0.1.12 验证通过；两份 SPDX 有效。                                                                                                                                                                                                                                                                                |
| 来源证明       | 5 项资产、4 个不同摘要，严格官方 gh attestation verify 核对源码/签署提交、精确标签与工作流、OIDC、GitHub hosted runner 及本次 run/attempt invocationId；校验和匹配。                                                                                                                                                                                                                                                 |
| 独立服务器     | [发布工作流](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41950335282) 完成独立托管首次部署验证。匿名 GHCR 元数据核对版本/提交标签同摘要、linux/amd64、node 用户、入口、固定 revision/version，以及 provenance/SPDX subject。索引 `sha256:ff4f2134cac34f8c885415c7eed13b39245366c489678e0e5abea95ba6e27a66`，平台 manifest `sha256:4a2f47db9e3ed6fbdd99f6b75a444330722546bc808e4a9f078cede793605f1f`。 |
| 公开访问       | 无 Authorization 或 Cookie 请求公开 Release 页面、API、SHA256SUMS 与完整安装器，大小/摘要匹配；部署文件从固定 server 标签匿名下载并与 Git 原文比较。                                                                                                                                                                                                                                                                 |

首轮准备 CI 仅有一处测试仍预期旧服务器版本；同步为本次精确版本 0.1.5-preview.2 后，两项独立数据库回归及完整 CI 通过，能力和迁移检查保留。最终产物比对中的 LF/CRLF 差异另有固定 Git 字节证据，不用简单的宽松文本判断替代二进制检查。私有原始记录保存在本机忽略目录。

## 使用与证据边界

[公开 Release](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.12) · [安装器](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.12/Codex.Taskboard_0.1.12_x64-setup.exe) · [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.12/SHA256SUMS)。服务器使用 `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.5-preview.2`；更新前备份数据库、密钥与部署配置。

普通 0.1.11 客户端、原账号、日常 Codex 与真实草稿保留，本轮没有关闭或原位升级普通客户端，也没有访问生产数据库或升级生产实例。最终包静态载荷/运行时验证不等于新一轮 NSIS 实装或原生 WebView 界面验收；布局证据为独立浏览器与受控伴随服务替身，既有 0.1.11 原生安装证据分别保留。外部邮件收件箱投递、真实 Codex 窗口专项与官方 CLI 模型生成的未验范围继续保留。更新客户端不会自动更新服务器网页。
