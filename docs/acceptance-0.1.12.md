# 0.1.12 版本验收

状态：2026-11-05 发布准备，客户端 0.1.12 未签名预发布与独立服务端 0.1.5-preview.2 尚未公开。

## 范围

本版纳入 [PR #26](https://github.com/i-am-yimin/codex-taskboard/pull/26) 的看板、账号菜单、个人设置和后台布局调整。四主题、窄屏分类、菜单键盘与错误重试的行为及合成预览见[布局验收](acceptance-console-layout.md)。服务器刷新网页静态资源与版本，无新增 API、协议、迁移或权限变化。

## 已有证据

功能提交 `25a90b8d4d9686cd2efe417a10aa3f3052666c6d` 的 [CI #186](https://github.com/i-am-yimin/codex-taskboard/actions/runs/41379199822) 已通过 verify、container、windows-desktop：包括真实 PostgreSQL、生产入口、主题、E2E、离线、Windows 原生与 NSIS、容器部署恢复及 HTTPS。本机的 19 项布局/主题/看板 E2E、10 项真实数据库生产页面 E2E和离线冷启动结果另见布局记录。未运行项不视为通过。

## 固定版本发布门禁

版本准备提交、合并提交、精确标签、发布工作流、环境审批、资产校验和、来源证明、最终包/随包运行时与匿名下载的结果将在实际完成后补充。已发布 0.1.11 和 server-0.1.5-preview.1 的标签与资产保持固定。

使用合成账号、独立数据库和隔离配置验收；保护日常 Codex、原 Taskboard 登录和真实草稿。发布镜像不等于升级生产服务器。安装器未签名状态、真实安装和浏览器模拟分别记录。
