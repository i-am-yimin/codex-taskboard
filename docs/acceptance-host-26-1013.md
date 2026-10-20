# Codex 26.1013.4894.0 安装版兼容验收

记录日期：2026-10-20。此次验证的是 Windows x64 上的精确宿主版本 `26.1013.4894.0`，候选提交 `92873edce89d4677b7180e9ff82422bd4873fbb3`。候选来自同提交 CI，实际安装后使用随包启动器、伴随服务和前端完成下列检查。源码探针的先前结果单独保留在[宿主验证记录](codex-host-verification.md)。

**安装版兼容验收通过。** 安装、实际宿主交互、覆盖升级、冷启动保留、最终正常退出和日常实例恢复均已核对。脱敏的[结构化判定](acceptance/host-26-1013-verdict.json)保留原始证据文件名与摘要；PR 审阅状态和后续文档提交的 CI 以 GitHub 为准。

## 交付候选

| 项目 | 值 |
| --- | --- |
| 版本 | `0.1.0`，兼容预览候选 |
| 安装器 | `Codex Taskboard_0.1.0_x64-setup.exe` |
| 安装器 SHA-256 | `f918b41b1987d183d37a1521b84644f612ca8b2c384f6f4b952497ea6a0ea997` |
| Authenticode | `NotSigned` |
| 已安装主程序 SHA-256 | `60ce1fd7fb4e151ff08ca8f2971310c987f66e4b4b485916a6d2cc49ba6eb94b` |
| 随包 companion.js SHA-256 | `91557ea52688705d8c9cea1dbeb7b5cc7927d755a83d21505a2e35a3ac3b4c0c` |
| 前端资源 | `index-DSNHa63w.js`、`index-BgQrj1WK.css` |
| 构建 CI | [push 39359178607](https://github.com/i-am-yimin/codex-taskboard/actions/runs/39359178607)、[PR 39359298809](https://github.com/i-am-yimin/codex-taskboard/actions/runs/39359298809)，均成功 |
| CI 安装包归档 | `windows-installer-ci`，artifact ID `12236971382`；ZIP SHA-256 `9218d26fe8ef46fc8bce04a825371cb42f4e21f0d13760df2a3d230f451d774b` |
| 审阅 | [PR #2](https://github.com/i-am-yimin/codex-taskboard/pull/2) |

该候选与已固定的 `v0.1.0` 草稿资产不同。标签仍指向 `f6a363e1779db36c97332725bdc433260c5ef366`；其 Windows 安装器 SHA-256 为 `77d3bfbfd6aa07243ca2ac70fa079d38e3394241e186ff6f25a366ae02e68009`。此次不替换标签或发布资产，也不声明候选有发布来源证明或代码签名。后续文档提交不改变已测试二进制的来源提交。

## 实际安装结果

| 检查 | 结果与范围 | 本机原始证据文件 |
| --- | --- | --- |
| 安装及连接 | NSIS 安装到专用中文、空格路径，退出 0；实际设置页保存服务器地址，合成账号登录后读取 8 张同步任务 | `installation-20261020T030220Z.json`、`desktop-login-first.json` |
| 产品启动入口 | 实际点击“启动独立 Codex”；核验 MSIX 精确版本、进程创建时间、登记目录、监听归属、私有启动收据和唯一精确页面 | `native-installed-baseline.json`、`native-installed-binding.json` |
| 侧栏和任务操作 | 实际点击“接入 Codex 侧栏”，随机 nonce 就绪；真实侧栏开关、看板/列表切换及详情编辑保存成功，TB-1 更新到 version 2 | `native-installed-sidebar-ready.json`、`frame-wide-detail-edit.json` |
| 原生窗口自适应 | 原生页面宽 1280 / 1002 / 742px，内嵌宽 935 / 657 / 397px；详情、列表及紧凑看板可用，筛选器换行，页面与详情未出现非预期横向溢出 | `frame-narrow-detail.json`、`frame-compact-detail.json`、`frame-compact-list.json`、`frame-compact-board.json` |
| 外部重载 | 对归属明确的精确页面执行诊断 `Page.reload` 后，随包适配器自动恢复侧栏和 nonce 就绪 | `installed-external-reload.json` |
| 草稿成功 | 实际点击安装版“在 Codex 中打开”，正确项目的空编辑器准确接收 6 段合成文本；DOM 与 ProseMirror 模型一致，没有发送消息 | `installed-ui-draft.json` |
| 草稿拒绝 | 错误目录映射、合成模态框、重复编辑器结构、非空编辑器及受控页面 URL/片段身份变化均拒绝写入；原内容与侧栏保留，测试变更随后恢复 | `installed-draft-refusals.json`、`installed-ui-draft.json` |
| 实际 CSP 恢复 | 安装前、草稿恢复后、原生重启后分别观察到真实 `frame-src` enforce 事件，探针服务器没有收到请求 | `csp-installed-baseline.json`、`csp-after-installed-ui-draft.json`、`csp-after-installed-native-restart.json` |
| 独立 Codex 正常重启 | 实际文件菜单退出后，进程和监听释放；再次使用安装版启动按钮复用同一登记目录，无需重新登录，项目及完整草稿 DOM/模型哈希保持；精确匹配后清空合成草稿，再次正常退出 | `installed-native-normal-restart.json`、`installed-synthetic-draft-cleanup.json`、`native-final-cleanup.json` |
| Taskboard 托盘 | 隐藏由自动观察确认；用户报告已从托盘恢复、保持显示并正常退出。观察器在用户操作前已超时，未捕获恢复和退出码；随后 OS 独立确认桌面、伴随服务及端口释放 | `tray-lifecycle-observer-v2.json`、`tray-human-and-os-verdict.json` |
| 覆盖升级 | 退出后冻结数据字节；实际安装固定 `v0.1.0` 旧载荷，再由候选 NSIS 覆盖。两个安装器均退出 0，旧主程序确实替换，候选运行文件与首次安装逐字节一致；登录、缓存和本地密钥文件保持 | `post-exit-upgrade-data-baseline.json`、`installed-upgrade-verdict.json` |
| 冷启动保留 | 新进程直接显示“已同步”和 8 张任务；无需重新登录或人工重载，同设备/账号、服务器地址、TB-1 version 2 和仓库映射保留；实际 Windows 首屏另行检查 | `installed-cold-start-verdict.json`、`installed-cold-start.png` |
| 最终退出与日常恢复 | 持有精确进程句柄观察到桌面、随包伴随服务均退出 0，测试端口释放；恢复原程序、默认数据/WebView 和原注册信息，原 3 张离线缓存任务可见，日常 Codex 保持 | `installed-final-exit.json`、`ordinary-restoration-verdict.json`、`ordinary-state-after-restore.json`、`ordinary-restored-ui.json` |

覆盖升级没有运行旧应用：它验证真实 NSIS 载荷替换和候选自身已保存数据的安装、冷启动保留，不扩展为任意旧版本数据库迁移结论。此轮服务器为本机隔离 API/PostgreSQL，账号与任务全部为合成内容；没有重跑双设备同步、公共 HTTPS 或 Linux 发布门槛。原 `v0.1.0` 的[验收范围](acceptance-0.1.0.md)保持原结论。

## 失败记录与解释

未发现需要更换候选二进制的产品缺陷。以下首次失败保留，后续成功没有覆盖这些记录：

- 观察工具初次以 ANSI 读取无 BOM 的 UTF-8 路径、使用过期 UIA 几何信息，以及遗漏跨进程 iframe；分别修正编码、刷新窗口状态、从唯一 owned DOM iframe 核验 frameId 后读取，没有放宽页面归属。
- 草稿观察器最初错误套用 core/CLI 的较长模板。核对产品源码和随包 JS 后，按实际 UI 的三个字段、六段文本验证已有草稿，没有重写草稿或再次触发成功请求。完整草稿 SHA-256 为 `7944831e763a1634f7db7744deedd8cda1df4ea6543022b8d11933aad6d6ffc4`。
- 托盘观察器最初将单实例辅助窗口误认作主窗口；修正后观察到隐藏，等待期间超时。恢复与正常退出采用用户报告，OS 只证明后续进程和端口消失，未冒称自动捕获了恢复或退出码。
- 运行中读取缓存会更新 `savedAt`，因此早期字节守卫拒绝继续。独立诊断确认缓存语义保持，最终在正常退出后重新冻结字节基线，再运行安装器；未删除失败前置检查或忽略数据差异。
- 冷启动观察器第一次在 Tauri bridge 建立前读取能力失败。保留初始化错误，稍后对同一进程重试只读检查即通过；期间没有重载、重新登录或重启应用。
- 首次侧栏接入曾等待约 85 秒，在原有 120 秒预算内完成；后续外部重载恢复约 11 秒。没有推断未经证实的原因，也没有扩大产品超时。

对应原件包括 `observer-first-failure.json`、`frame-observer-first-failure.json`、`installed-ui-draft-first-template-assertion.json`、`ui-prompt-observer-correction.json`、`tray-observer-correction.json`、`tray-lifecycle-observer-v2-timeout-1.json`、`preupgrade-data-guard-observation.json`、`cache-timestamp-diagnostic.json` 和 `cold-start-first-observer-failure.json`。

## 清理与复核

合成 Codex 草稿已清空且测试宿主正常退出；登记的独立登录目录保留，不复制认证资料。保留数据验证后，安装版伴随服务正式退出接口已清除专用测试账号、缓存、草稿、待提交结果及登录凭据。API 正常关闭后，经唯一合成账号与八个任务 ID 核验，仅删除专用合成数据库，再正常停止 PostgreSQL；保留数据库目录。递归目录清理曾被自动审批拒绝，未执行。

最终测试 Taskboard 和随包伴随服务均正常退出 0，测试 WebView 调试端口及 API/PostgreSQL 端口释放。原日常程序已用默认数据和 WebView 目录恢复，原有 3 张离线缓存任务可见；启动前六项受保护文件字节保持，启动后数据语义哈希保持，原二进制/凭据摘要保持，两份注册信息重新导出的字节与备份完全一致。原服务器仍离线，此次没有改动其配置或宣称重新认证成功。日常 Codex 的进程与创建时间保持，独立测试宿主没有进程残留。

全部原始证据保存在本机忽略目录 `.artifacts/acceptance/2026-10-20-installed-92873ed/`，不会提交登录目录、凭据、控制能力、设备/账号标识或含个人信息的原始截图。

源码检查：类型、lint、构建通过；完整无数据库测试 130 通过、15 跳过；适配器定向 50 通过，原生测试 28 通过、5 项显式忽略。同候选的两次 CI 均成功。此报告与原始证据对应精确版本和指定安装包摘要，未知版本仍拒绝。
