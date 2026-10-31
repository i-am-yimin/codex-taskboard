# 文档索引

安装和日常使用从[使用手册](user-guide.md)开始；参与开发先读[开发与贡献规范](../CONTRIBUTING.md)。公开客户端为 `0.1.10` 未签名预发布，公开服务端独立为 `0.1.3-preview.1`，版本状态见[更新日志](../CHANGELOG.md)。客户端 `0.1.10` 已公开，整合此前 `0.1.8` 协作能力，配套服务端候选为 `0.1.4-preview.1`，需协作协议 1 与 `0005`—`0009` 迁移；本机候选实装、CI 最终包和服务端部署范围分别见[验收索引](acceptance.md)。兼容与升级步骤见[使用手册](user-guide.md#先核对服务器兼容性)。

[0.1.10 发布与验收](acceptance-0.1.10.md)分别记录本机候选的授权原位安装、缓存导航/刷新/CSP/冷草稿与原账号恢复，以及最终 CI 包的载荷、随包运行时、来源证明和匿名下载；三份后补 CSS、诊断限制及历史配置调查单列于记录。

[0.1.11 验收记录](acceptance-0.1.11.md)统一跟踪用户中心、服务器治理、Codex 窗口恢复与版本准备；账号功能的独立数据库、浏览器及离线验收已完成，本版尚未发布，窗口恢复的安装版复测留到发布后。配套服务器候选为 `0.1.5-preview.1`，操作与备份见[用户中心说明](account-center.md)。

## 使用与部署

| 文档 | 内容 |
| --- | --- |
| [使用手册](user-guide.md) | 安装、登录、任务协作、CLI、多设备与故障处理 |
| [OpenResty 部署](deployment-openresty.md) | 推荐的新实例镜像部署、初始化、备份与升级 |
| [Caddy 与显式配置部署](deployment.md) | 现有部署方式、数据库恢复与迁移 |
| [应用内 Codex 连接](in-app-codex-connection.md) | 连接日常环境、自动恢复与拒绝边界 |
| [本机 Agent 运行](agent-runners.md) | taskctl、专用 CLI profile、权限模式、取消/恢复与证据范围 |
| [主题指南](themes.md) | 外观设置、同步与声明式主题包 |
| [隐私说明](privacy.md) / [安全说明](../SECURITY.md) | 数据存储、安全边界与漏洞报告 |

## 开发与维护

用户中心、账号安全、SMTP 与最高权限接管见[用户中心说明](account-center.md)；0.1.11 的当前验证范围见[验收记录](acceptance-0.1.11.md)。

| 文档 | 内容 |
| --- | --- |
| [开发与贡献规范](../CONTRIBUTING.md) | 模块边界、编码约定、验证和发布要求 |
| [开发指南](development.md) | 环境安装、运行、测试与隔离探针命令 |
| [架构](architecture.md) | 数据流、模块职责与一致性约束 |
| [协作工作流设计](collaborative-workflows-design.md) | 责任、父子/依赖、状态、通知、自动化与 API 契约 |
| [桌面技术说明](desktop.md) | 原生启动、伴随服务、兼容清单与打包 |
| [Codex 更新兼容性改造](codex-compatibility-proposal.md) | 按有限结构契约自动自检；实施进度与真实证据见[验收记录](acceptance-codex-compatibility.md) |
| [官方插件 UI 原型](codex-plugin-ui-probe.md) | 合成 MCP 资源与 global/thread 声明；工具发现与实际宿主 UI 分别验收 |
| [架构决策](adr/README.md) | 已接受设计及其约束 |
| [仓库维护](maintenance.md) | 目录约定、分支生命周期、清理与恢复 |
| [开发交接](../HANDOFF.md) | 当前基线和继续工作的入口 |
| [产品约束](../PRODUCT.md) / [主题设计](../DESIGN.md) | 产品和视觉设计的上下文 |

## 发布与验收

| 文档 | 内容 |
| --- | --- |
| [更新日志](../CHANGELOG.md) | 用户可感知的版本变化 |
| [详细发布说明](release-notes.md) | 安装包、兼容和升级说明 |
| [验收索引](acceptance.md) | 各版本的结论、范围与固定来源 |
| [协作界面验收](acceptance-collaborative-ui.md) | 浏览器模拟交互、主题/动效和截图的证据范围 |
| [部署验证](deployment-verification.md) | 容器、备份恢复与 HTTPS 验证 |
| [历史记录](archive/README.md) | 早期实验与交接过程；不作为当前版本状态 |

## 仓库目录

| 路径 | 职责 |
| --- | --- |
| `apps/web` | React 看板与本机草稿 |
| `apps/server` | API、鉴权、权限、事务与持久化 |
| `apps/companion` | 本机凭据、设备状态与远程代理 |
| `apps/desktop` | Tauri 原生进程、窗口与打包 |
| `packages/core` | 领域契约、输入校验与 Agent 接口 |
| `packages/adapter-codex` | 宿主能力、身份复核与侧栏桥接 |
| `packages/cli` | 机器可读的任务命令 |
| `scripts` / `tests` | 构建、诊断、验证脚本及测试 |
| `deploy` | 反向代理与部署验证配置 |
| `skills/taskboard` | Taskboard Agent 接入说明与命令入口 |
| `.github` | CI、发布工作流、责任人与 Issue / PR 模板 |

本机证据、备份和诊断保存在忽略的 `.artifacts/`，数据保存在忽略的 `.data/`；生成产物遵循现有 `.gitignore`，不提交到源码目录。
