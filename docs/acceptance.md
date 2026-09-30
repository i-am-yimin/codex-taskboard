# 开发预览验收记录

更新日期：2026-09-30。工作分支：`codex/initial-implementation`。下方保留早期审计、实现和实机验证记录。

**本记录不是首版发布通过证明。浏览器协作、部分 Codex 内嵌和 Windows 安装版流程、隔离 HTTP Compose 恢复演练及内部 CA HTTPS 演练已验证；G1–G4 的完整门槛仍未通过。** 2026-09-09 的开发预览快照保留在后半部分；当前提交、推送和换机步骤见根目录 [交接文档](../HANDOFF.md)。本项目仍未打标签或发布正式 Release。

下一轮逐项通过条件见 [闭环验收计划](closure-acceptance.md)。该计划不改变下述历史结果。

## 2026-09-30：eef388d 安装包与新宿主源码接入检查

已重新读取精确提交 `eef388dd25e11eb7e6df0104e85572829fc89dbc` 的 CI run `36701763981`：verify、container、windows-desktop 均 completed/success，Windows 作业于 2026-09-30T10:29:52Z 完成。包含生产 API、E2E、离线回归、生产依赖审计、隔离 Compose 恢复和内部 CA HTTPS，以及 Rust 测试、NSIS 构建和独立原生探针。提交后的 Node 24.19.0 / pnpm 10.28.0 冻结安装退出 0，没有依赖修改。

精确 head 的 windows-installer-ci artifact ID 为 11090477196。实际 ZIP 为 24,633,188 字节，SHA-256 为 `840D9CF8BD7B8FEAC883538221B07124D392F1B176D5BEC8BFB48169640263FA`，与 GitHub artifact digest 一致；ZIP 只有预期安装器。安装器为 24,644,829 字节，SHA-256 为 `071543982A040F03ED4378890A3D4AB798CFA55ECBED5CB35D918D2FC5B92587`，签名 NotSigned。安装器已通过 Taildrop 发给用户指定的在线 codex-server，传输退出 0；尚未收到取回、安装和默认缓存连续冷启动结果。本机仍运行 cf415a2，eef388d 尚未安装。证据位于 .artifacts/acceptance/2026-09-30-ci-eef388d/ 的 ci-observed.json、artifact-verification.json、frozen-install.log 和 second-device-taildrop.json/log。

对实际安装版按钮创建的 Codex 26.928.1915.0 宿主继续运行源码适配器诊断。每次检查均重新验证 PID 2172、精确创建 FILETIME、官方包路径、回环 52777 的所有者、精确 target 和随包伴随服务的 native control。候选版本只在各个独立诊断进程中临时加入清单，生产源码与随包伴随服务清单未改变。五项拒绝检查（错误已有目录、不存在目录、错误页面绑定、未验证版本、失效进程归属）均返回预期失败，所选项目、空编辑器、弹窗和注入计数保持一致。

无 CSP bypass 的内嵌安装实际收到 enforce/frame-src 策略事件，握手失败后入口与 iframe 完整移除，主页面样式及项目、编辑器保持一致。启用适配器受控 reload 的独立源码诊断已完成真实生产前端 nonce 握手；正常 dispose 后再次收到 enforce/frame-src 事件，证明 CSP 已恢复。另一轮在空编辑器及精确归属检查后外部重载原生页面，实际 document timeOrigin 改变，适配器重新完成握手；随后 dispose 再次确认策略恢复。三次诊断最终均无入口或 iframe 残留，项目与空编辑器保持不变。初次握手辅助脚本因组装漏掉变量而在连接前失败，已保留 helper-failure.log 并修正；实际运行结果另有完整日志。

证据位于 .artifacts/acceptance/2026-09-30-resume/ 的 installed-host-negative-contract.json/log、installed-host-csp-failure.json/log、installed-host-csp-handshake.json/log、installed-host-csp-external-reload.json/log 及对应 check-installed-host-*.ts。这些结果属于新宿主的源码接入及清理证据，握手使用真实预览前端；未测试登录后的看板内部交互、实际窗口自适应、草稿成功/已有内容拒绝或同一新安装包完整流程。当前 Taskboard 仍在登录页；登录交由用户手动完成。G1–G4 保持未通过，尚未扩展新版本侧栏/草稿支持清单。

## 2026-09-30：会话失效的实时界面修复与本机完整回归

用户已用修正后的脚本人工启动预览 API。回环 47830 的实际 Node PID 36200、启动时间与手工启动一致，HTTP 与 Tailscale HTTPS 健康接口均返回 200、数据库 ok；未执行此前被审批拒绝的自动预览启动。已有安装版 cf415a2 在联网恢复时出现“创建你的第一个任务空间”，没有恢复原任务。检查发现 revoke 回调直接调用 api.me() 后只清持久缓存，没有更新 React Query 的账号查询。新增真实生产离线回归断言“撤销当前设备后，不刷新即显示登录页”在修复前失败，并抓到相同首次建空间界面；源码已改为重新验证活跃账号查询，账号确认期间显示加载状态。

修复后生产构建、完整 pnpm check 退出 0（109 项通过、15 项预期数据库跳过），已有独立 *_test 数据库上的 Vitest 124/124 通过，pnpm test:offline 退出 0，新增实时登录页断言及既有离线冷启动、草稿保留、禁写、重连与撤权后缓存清理均实际执行。使用 webServer:[] 的验收配置，在用户已启动的同一 HTTPS API 上运行原 tests/e2e 两种宽度的全部 8 项用例，退出 0；配置不启动或重启 API，浏览器使用独立测试上下文。两项真实 PostgreSQL 协作用例执行同步、冲突草稿保留、重载读回和生命周期，六项演示/布局用例单独标明，不能代替真实双设备或安装版结果。E2E 前后 API 的精确 PID/创建时间一致，原“桌面隔离验收”七张任务前后状态摘要 SHA-256 均为 31366b0aa36b4a2595ceb2b1161291eb9c45572b7ba05e96fba593c9d41d7e9a。

证据位于 .artifacts/acceptance/2026-09-30-resume/：offline-live-auth-before.log/png、offline-live-auth-after.log/png、build-live-auth-fix.log、check-live-auth-fix.log、test-db-live-auth-fix.log、e2e-existing-api.config.ts、e2e-live-auth-fix.log、e2e-live-auth-results/report 与三份 preview-*-auth-regression.json。源码修复尚未在新 Windows 安装包中复验；当前已安装的 cf415a2 仍包含该故障，不能以源码回归关闭 G2/G3。

独立 Codex 的项目随后由用户选中。只读实机复查确认 PID 2172、精确创建 FILETIME、回环 52777 与 target 0C9F06FA781A80889E55CD3B095B8056 前后一致；唯一选中项目、composer 的“切换项目：codex-taskboard”和空白 P→BR 编辑器匹配。读取该独立 Codex home 的项目数据库后，实际可见项目 ID 唯一映射到当前仓库；已安装 Taskboard 的仓库映射也匹配。经随包伴随服务的真实 /v1/codex/probe 重新检查 native control 后，明确返回新宿主 26.928.1915.0 尚未通过页面验收。证据在 .artifacts/acceptance/2026-09-30-ci-cf415a2/ 的 installed-project-shape.json、installed-project-input.json、installed-project-mapping.json。项目契约子项已确认；侧栏/CSP 和草稿完整流程仍待实测，宿主清单保持不变。G1–G4 仍未通过。

## 2026-09-30：人工 API 脚本运行时修正与已登录宿主复查

用户人工运行预览 API 脚本时，实际选择了固定路径 E:\nodejs\node.exe（本机 v18.18.0），在最低版本检查阶段停止。已保留原脚本副本，将当前脚本改为本机已验证的 Codex primary runtime Node v24.19.0，补充路径、版本与读取失败诊断；PowerShell AST 静态解析和独立版本验证均通过。只执行语法和 --version 检查，未自动执行此前被审批拒绝的 API 启动动作；预览 API 仍需用户重新运行修正后的同一脚本。修正与验证位于 .artifacts/acceptance/2026-09-30-resume/，不影响现有隔离预览数据库。

后续用户在 Windows PowerShell 5.1 重跑时，UTF-8 无 BOM 中硬编码的中文用户名被按本机代码页误读，导致运行时路径乱码。现已移除脚本中的中文路径字面量，改用 USERPROFILE 动态构造运行时目录，源码保持 ASCII 并保存为 UTF-8 BOM。新增 ValidateOnly 模式仅验证运行时后返回，实机 Windows PowerShell 5.1.26100.9444 用该模式成功定位 Node v24.19.0；验证时 API 仍未启动。保留修复前脚本副本，证据见同目录 start-preview-api-encoding-validation.json。

用户确认登录后，在 2026-09-30T09:43:07Z 对实际已安装程序创建的 Codex PID 2172、回环 52777、target 0C9F06FA781A80889E55CD3B095B8056 做只读复查。检查前后通过 Get-Process 的精确创建 FILETIME、官方包路径、回环监听者及页面绑定比对；CIM 的时间值仅精确到微秒，不能替代完整创建 FILETIME。新宿主已有唯一 shell、原生侧栏 nav、主内容 main 和唯一空白消息编辑器（P→BR），无弹窗或 Taskboard 注入；项目节点为 0，项目选择按钮仍为“选择项目”。登录已生效，项目尚未选中；还不能把此结果记为项目身份、侧栏或草稿通过，也未扩展侧栏/草稿版本清单。证据在 .artifacts/acceptance/2026-09-30-ci-cf415a2/ 的 installed-project-shape.json 与 installed-project-boundaries.json。G1–G4 保持未通过。

## 2026-09-30：原安装版离线冷启动与宿主升级阻塞

继续固定已安装源码提交 `87406f547b13306f8ca76cb41f574a0902736f6d`，文档 HEAD 为 `132d8adfe1aef17098182534b091ed1c9b93044d`。续验开始时旧 Taskboard、伴随服务、受管理 Codex、测试 API 和独立测试数据库进程均不在，不能把未知退出方式记为正常托盘退出。恢复原独立测试数据库后，以原隔离数据和 WebView2 目录启动同一已安装程序，主 PID 37392、随包 Node PID 22376 的父子关系一致且独占回环 47831；测试 API 的 47830 未启动。真实窗口没有白屏，直接显示“桌面隔离验收”的七张缓存任务与“离线缓存”。页面明确显示缓存未验证登录/权限、全部写入暂停；“新建任务”和各列“添加任务”均禁用。打开 TB-7 后读回描述“安装版创建后修改并保存；验证重启后仍可读取。”，描述、归档、保存、领取、在 Codex 中打开及发送评论均禁用。临时搜索已清空。该项是本机已安装程序的离线冷启动与禁写证据；不代替第二台默认缓存冷启动或联网恢复。当前只读状态证据位于 `.artifacts/acceptance/2026-09-30-resume/taskboard-offline-accessibility.txt`。

只读核对当前官方 MSIX 为 `26.928.1915.0`。在同一安装版“连接与设备”实际点击“启动独立 Codex”，窗口显示“当前 Codex 安装包版本未列入隔离启动清单”，未创建受管理 Codex。正式原生隔离启动清单仍限 `26.924.2738.0`，侧栏/草稿清单也尚未加入此新版本。新版本必须先完成原生包上下文、进程句柄/监听者/精确页面归属实测，再做真实宿主 DOM、侧栏、CSP 与草稿流程；不能直接扩清单沿用旧版结果。

恢复测试 API 的自动启动命令在执行前被审批返回 `blocked by policy`，未给出具体原因；未改用其他入口执行同一被拒操作。Tailscale Serve 保持原 443→47830 配置，API 不在时 HTTPS 测试入口不可用。已准备人工可审阅启动脚本 `.artifacts/acceptance/2026-09-30-resume/start-preview-api.ps1`，仅启动现有隔离预览数据库上的 API，不重置验收数据。脚本 PowerShell 静态解析无错误，尚未执行。第二台 `87406f5` 默认缓存与开始菜单连续冷启动回报仍待收集；G1–G4 保持未通过。

原生探针提交 `92d1cde03108c0449e3e7adff7bac5b5cb914497` 的 [CI #36685003327](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36685003327) 中 Windows Rust 测试、NSIS 构建与独立探针编译均成功，`container` 也成功。独立探针 ZIP SHA-256 为 `A0A87398B4FEC135F327F9D7F238F683BCA3B1289BBCC1259B29DC3AEFAD01FB`，exe SHA-256 为 `4C1BE93DBB34F14DD6DCD247920A524DFC6F878DA56E996A1C14635341ED4A55`。本机使用全新验收目录实际运行探针，探针 PID 40768 持有 Codex PID 42936 的真实进程句柄；创建时间、官方包 `26.928.1915.0`、独立 profile/Codex home、回环 60965 的监听者与唯一 `app://-/index.html` 主页面绑定一致，认证 native control 返回有效。只读 CDP 形状检查前后重新验证 native ownership，当前窗口尚无选中项目或消息编辑器；未操作登录。证据在 `.artifacts/acceptance/2026-09-30-native-26.928.1915/native.json` 与 `host-shape.json`。据此源码原生启动清单保留 `26.924.2738.0` 并加入 `26.928.1915.0`，报告实际被选中的安装包版本，多个匹配安装包明确拒绝。侧栏/草稿清单尚未加入新版本；探针成功不能替代已安装启动器与完整 G1 验收。

同一 CI 的 `verify` 在类型检查、全量数据库测试、生产 API、E2E 与离线测试通过后，因生产依赖审计失败而整体失败，不记作 G0 通过。官方注册表复查报告 `brace-expansion` 5.0.9 的两项 high 和相关 moderate，以及 `fast-uri` 3.1.7/4.1.4 的 moderate，共 6 项。随后只对受影响传递版本范围固定最小补丁 `brace-expansion` 5.0.12、`fast-uri` 3.1.8/4.1.5；冻结安装退出 0，官方注册表生产审计退出 0、各严重性均 0。补丁后的 Node 24.19.0 / pnpm 10.28.0 `pnpm check` 退出 0，109 项通过、15 项数据库依赖用例按预期跳过，Web/服务端构建成功。本机默认 npm 镜像缺少 audit 端点，首次镜像审计失败只记为端点不可用，正式结果使用显式官方 registry。新提交的完整 CI 与安装包实测仍待完成。

只读 PostgreSQL `BEGIN READ ONLY` 查询另存 `.artifacts/acceptance/2026-09-30-resume/persisted-tasks.json`，七张任务保留，TB-4 为版本 4、已完成，TB-7 为版本 2且描述与真实窗口读回一致；未重建或重置预览数据库。

固定源码提交 `cf415a215b2b5be48bc4c39ee39345dbb8f41ff2` 的 [CI #36687594367](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36687594367) 中 `verify`、`container`、`windows-desktop` 均已成功；包含修复后的生产依赖审计、数据库/E2E/离线回归、Compose 恢复与内部 CA HTTPS 演练、Windows 原生选择拒绝回归和 NSIS 构建。安装包 ZIP 为 24,631,117 字节、SHA-256 `D505C2052E9092458EC918950A9258D11024EDC260F4EF2E8C7E059AA02A0852`；内含未签名 NSIS 安装器 24,642,754 字节、SHA-256 `E080D5DBFACF29BFABD2A43448DB01F0E347834D4877AC870637E152C9C08A40`。首次 Node 下载在保存文件前超时，复核目标目录未生成文件后重试下载，校验 ZIP 与 CI digest 一致并核对唯一安装器及其签名状态；未把下载超时误判为构建失败。产物和来源记录保存在 `.artifacts/acceptance/2026-09-30-ci-cf415a2/`，下载核对时此安装包尚未安装运行；随后本机安装结果见下段。

同一源码提交在本机现有独立 `taskboard_test` 数据库上执行 `pnpm exec vitest run`，124 项全量通过、没有跳过，退出 0；随后 `pnpm test:offline` 退出 0，生产构建的独立数据库与 headless Chrome 实际验证离线冷重启、草稿保留、禁写、重连和撤权。原测试数据库服务正在运行，因此此次使用其连接执行 Vitest，没有重复启动 `pnpm test:db` 宏。测试结束后只读查询对比先前快照，原 `taskboard_preview` 中七张验收任务的标题、版本、状态与 TB-7 描述完全相同；离线测试的 47834 监听已释放。日志分别为 `.artifacts/acceptance/2026-09-30-resume/vitest-real-db-cf415a2.log`、`offline-cf415a2.log` 与 `persisted-tasks-after-regression.json`。本机 E2E 会自动调用先前被审批拒绝的 `live-preview.ts` 启动动作，故未通过该入口执行同一被拒操作；联网实机仍等待用户手动启动预览 API。真实新 Codex 登录/项目选择、两台最新安装包和完整 G1–G4 门槛仍未关闭。

## 2026-09-30：cf415a2 本机安装与离线冷启动续验

旧测试窗口的缓存看板与无编辑表单状态先由真实 UI 确认；再核对旧 exe 路径、PID/创建时间与注册目标，仅为升级清理停止旧桌面 PID 37392。其随包 Node PID 22376 自行退出，47831 释放，原生 Codex 探针和其隔离宿主保持运行。这是精确身份的测试进程清理，不记为托盘正常退出。使用上述 CI 安装器以当前用户静默安装到新隔离目录，安装器退出 0，exe 存在且 HKCU 卸载注册指向新目录，原 state.json 和三个 DPAPI 文件哈希保持一致；未检查旧目录是否被删除。安装证据在 `.artifacts/acceptance/2026-09-30-ci-cf415a2/` 的 data-before-upgrade.json、old-test-cleanup.json、cleanup-result.json 与 install-result.json。

随后保留原测试数据目录及原 WebView2 缓存启动刚安装的 cf415a2；桌面 PID 27220、随包 Node PID 10496 的安装路径及父子关系一致，47831 唯一监听者为该 Node。API 47830 不在。真实窗口首次加载没有刷新，直接显示原空间和七张缓存任务，TB-6 修改标题保留；页面显示“离线缓存”和未验证权限提示，新建任务及各列添加任务禁用。打开 TB-7，描述准确读回“安装版创建后修改并保存；验证重启后仍可读取。”，标题/描述编辑、归档、保存、领取、在 Codex 中打开及发送评论均禁用。第一次尝试直接点击屏幕外 TB-7 被 Computer Use 的边界检查拒绝；重新观察后通过可见的列表行打开，无任务内容改动。installed-launch.json、installed-processes.json、installed-offline-cold-start.txt/png、installed-offline-tb7.txt/png 保存了此轮结果。

点击窗口关闭后原桌面和伴随进程保持运行；再次以同一环境启动，第二个短暂 launcher 退出，原 PID 27220/10496、端口监听者及窗口 ID 均保持，真实 UI 恢复同一列表和七张任务。证据 installed-close-to-tray.json、installed-restore-launch.json、installed-single-instance-restore.json、installed-restore.txt/png。未将这项恢复测试算作正常托盘退出或完整重启，通知区域托盘退出仍待实测。本轮离线冷启动不代替线上读写、第二台默认缓存冷启动或完整 G2。

实际列表 UI 暴露正文按钮按内容收缩，导致同一列的正文与表头错位；原截图为 installed-list-column-misalignment.png。修复仅令 .list-row 占满列表宽度，保留既有窄内嵌列表折行规则。独立 Chrome 的纯前端演示页重现旧样式错位，然后核对 1322/980/480px 普通宽度及 935/715/480/185px 内嵌宽度：可见表格列对齐，185px 按原规则堆叠，无横向溢出或页面异常，API 请求为 0。脚本和结果在 `.artifacts/acceptance/2026-09-30-resume/` 的 check-list-layout.mjs、list-layout-result.json 与截图。首次样式格式检查失败；修正编辑范围并格式化后检查退出 0，最终 Web 生产构建退出 0，日志 web-list-layout-build.log。该演示页结果是前端布局回归，不能替代真实 Codex iframe 或已安装修复版；新 CI/安装器仍待生成。

原生宿主只读核验于 2026-09-30T08:52:47Z 再次通过原包、持有句柄、监听者和精确页面绑定，但仍无 shell/选中项目/编辑器。预览 API 仍未启动，原被审批拒绝动作未换入口执行。G1–G4 保持未通过。

## 2026-09-30：安装版新宿主原生启动与 c1a3fcc 产物核验

在 cf415a2 已安装程序的真实“连接与设备”界面点击“启动独立 Codex”，正常创建官方包 26.928.1915.0 的隔离宿主，界面回执为“受管理 Codex 已启动；登录并选中项目后，可接入 Codex 侧栏”。再次点击同一按钮回执为“受管理 Codex 已在运行”，该分支实际执行原生 held handle、创建时间、包身份、TCP 监听者与精确页面的 verify。只读进程核对新宿主 PID 2172、active.json 的创建 ticks、包路径、回环 52777 的所有者和唯一 app://-/index.html 页面一致；精确 targetId 为 0C9F06FA781A80889E55CD3B095B8056。检测连接明确返回“Codex 26.928.1915.0 尚未完成页面验收，仅可隔离启动”。未改变宿主清单或 CSP，也未操作登录。安装版原生启动/重复启动是局部通过，完整 G1 仍未通过。

证据在 `.artifacts/acceptance/2026-09-30-ci-cf415a2/` 的 installed-native-launch.txt/png、installed-native-reuse.txt/png、installed-native-identity.json、installed-native-targets.json、installed-host-not-yet-approved.txt/png、installed-host-shape.json 与 installed-native-inspection-boundaries.json。只读形状检查前后的 OS PID、创建时间和监听者相同；页面仍无项目 shell、选中项目、消息编辑器或 Taskboard 注入节点。诊断工具首次在 REPL 导入 ws 失败，随后生成的脚本有字符串语法错误；均未连接目标。改用已确认 Node 24.19.0 的原生 WebSocket、修正字符串并通过 node --check 后，最终只读检查退出 0。原探针及其旧隔离窗口保持运行，不将其当作这次产品创建的宿主。

列表对齐修复源码 c1a3fccbcd50d44c5dcfa2541d7166d58a61d1a3 的 CI #36693823092 中 verify、container、windows-desktop 三项均成功，含真实数据库、生产 API、E2E、离线、依赖审计、Compose 恢复/内部 CA HTTPS、Windows Rust 和 NSIS 构建。Windows artifact 11087206289 的 ZIP 为 24,630,197 字节，SHA-256 A81FD22CF3F22E42BB574A2BA2CC9EC39435D378073CC0D66EF0F0D76DA5B46F，与 CI digest 一致；唯一安装器 24,641,821 字节，SHA-256 D396802D7A1A1BD642AC6769C72A0AE9D3C23611198412C818C372CD973BB565，NotSigned。下载/解包未运行安装器；记录在 `.artifacts/acceptance/2026-09-30-ci-c1a3fcc/artifact-verification.json`。

确认第二台 codex-server 的 Tailscale 身份和在线状态后，以 codex-taskboard-c1a3fcc-setup.exe 名称发送同一哈希安装器，Taildrop 返回 0，记录 second-device-taildrop.json；尚无对方取件、安装或默认缓存冷启动结果。当前本机仍运行 cf415a2 及其原生受管理宿主，预览 API 47830 未运行，联网读写、真实新宿主项目/侧栏/草稿、最新安装包和两台设备完整 G1–G4 门槛保持待验。

## 2026-09-29：安装版窄窗口与双设备续验（进行中）

实时状态回归提交 `e849afec186e449767a6d5981dd68c8f93484fa0` 的 [CI #36558154348](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36558154348) 中 `verify`（含真实 PostgreSQL 双会话 E2E 的领取后 2 秒内跨会话更新断言）、`container`、`windows-desktop` 均成功。Windows ZIP 为 24,615,315 字节，SHA-256 `147325F272B7F294AE3E0B08ADBBD8C7BD25997261D0A13529439B0ABCBE06F6`；内含未签名 NSIS 安装器 24,626,950 字节，SHA-256 `EC4E627D264610A4A5CD26D2B9A5D531FFB247BEAEDC50CE491B66634703AD5B`。旧 `6c8e41a` 版经托盘正常退出，主程序、随包 Node 和端口 47831 释放；卸载器静默退出 0，隔离安装目录消失，`state.json` 与三个 DPAPI 文件 SHA-256 保持一致。新包静默安装到另一个隔离目录退出 0；启动后主 PID 18168 的随包 Node PID 32736 独占 47831，本机窗口显示原“桌面隔离验收”空间及 TB-1～TB-3，随包 CLI 联网读取三张任务成功。这通过了本机卸载保留数据与重装恢复，不代替第二台桌面和最终发布验收。该安装器也已在 `codex-server` 安装，后续结果见下。

第二台旧 `6c8e41a` 安装版在登录页出现“伴随服务发生未知错误”，再次打开后整个 WebView2 内容区白屏；窗口截图保存在忽略目录 `.artifacts/acceptance/2026-09-29-ci-e849afe/codex-server-white-screen.png`。白屏时主 PID 25908、伴随服务 PID 4460 与父子关系和已安装包内 `runtime/node.exe` 路径一致，五个 WebView2 子进程已创建，未带凭据的本机 `/health` 返回预期 401；随包 Node 的 HTTPS 健康 GET 为 200，空登录 POST 为 422。当前证据不能把故障归因于 DNS、TLS 或伴随服务未启动。随后使用新包与全新 WebView2 缓存复验，保留旧版截图与进程归属信息。

第二台从托盘退出旧版后安装 `e849afe`，以全新 `WEBVIEW2_USER_DATA_FOLDER` 启动看到登录页；用同一合成账号登录后，用户确认显示原“桌面隔离验收”空间及三张任务。旧版白屏在这次新包与新缓存组合下消失，尚未单独区分安装包和缓存各自的作用；后续仓库映射和任务生命周期结果见下。

第二台随后从 Windows 开始菜单使用默认 WebView2 目录启动 `e849afe`，仍然整页白屏。只读 CDP 诊断定位到 `http://tauri.localhost/` 的旧 Service Worker：白屏页已完成加载但根节点有 0 个子元素，引用旧安装包的 `/assets/index-DbCPrsHL.js`；一次页面重载后引用当前包的 `/assets/index-D0gCUo5y.js`，根节点变为 1，用户确认页面恢复。两次资源请求均报告 200，故不能仅凭状态码排除旧页面资源。源码已改为桌面端不再注册页面 Service Worker，已安装旧 worker 更新时自行注销并重载当前页面；本地模拟旧 worker 和旧页面缓存的浏览器回归验证新页面恢复且本地草稿键保留。修复后的 Windows 安装包仍需第二台默认目录和开始菜单实机复验，白屏门槛尚未关闭。

Service Worker 修复提交 `5014512778292abdb26a9a39bd3d35379fe37b7e` 的 [CI #36566220586](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36566220586) 中 `verify`、`container`、`windows-desktop` 均成功。安装包 ZIP 为 24,620,817 字节、SHA-256 `B1EA14B23231E25CFEAD95902413A93913838F928E159337172E4C7031255C36`；内含未签名 NSIS 安装器 24,632,446 字节、SHA-256 `38430DE1B3A72E6EABDA3830E2628C434EA554B2950C23F654E87312BDF19A6E`。产物已核对并经 Taildrop 传往 `codex-server`。用户保留默认 WebView2 目录安装后从开始菜单启动，**仍然白屏**；安装目录 `runtime/web/index.html` 已引用新 `index-CiuZShYw.js`，在白屏窗口按一次刷新立即恢复看板；托盘退出后再次从开始菜单冷启动仍白屏。故旧 worker 的更新/注销流程不足以保证持续冷启动可用，G2 白屏门槛未通过。后续原生启动器加入仅在页面加载完成且 React 根节点仍为空时的一次刷新探针，不触及登录或草稿数据；浏览器模拟旧 worker 的回归 2/2 通过，新安装包实机结果仍待验证。

原生冷启动恢复提交 `75f8a868efdf45226618aa65435580fc227363cb` 的 [CI #36573516980](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36573516980) 中 `verify`、`container`、`windows-desktop` 均成功。Windows ZIP 为 24,626,990 字节、SHA-256 `59E19950B38E60B2EB2B76AD9F66EE1D02AD4C10A25317D5F7EADD491A79DE1F`；内含未签名 NSIS 安装器 24,638,611 字节、SHA-256 `C15A9A2863F4E4F43E42446FAA51226C3FDCA6DCD518DAA897C360804426F873`。安装器已核对并经 Taildrop 发送到第二台；待默认缓存、开始菜单直接冷启动实机结果。该提交的本地无数据库套件 108 通过、15 项数据库测试按预期跳过，类型检查与 lint 退出 0。

本机 `75f8a86` 已静默安装到独立目录，并以原隔离数据与 WebView2 目录直接启动。随包 Node 是该安装版主进程的子进程且独占 47831；真实窗口显示“已同步”、六张原任务和 TB-6 已修改标题。一次托盘退出后主进程、Node 与端口均释放；再次指定该安装版启动时，另一份旧验收安装目录中的实例占用了单实例与端口，清理该测试实例后再次启动 `75f8a86`，真实窗口仍直接显示六张任务及 TB-6 保存标题。这证明本机数据恢复；第二台保留默认缓存的冷启动仍待实测。此前 `e7db5ff` 托盘退出后主进程已消失，但其随包 Node PID 31620 仍占 47831；确认父 PID 不存在及路径属于隔离测试目录后结束该孤儿进程，端口释放。这一次退出清理异常单独保留，不以本机 `75f8a86` 的成功覆盖。

本机 `75f8a86` 的“启动独立 Codex”在上次受管理窗口（PID 34244，包上下文 Codex `26.924.2738.0`）仍存活时，显示“上次独立 Codex 仍在运行，可能含未发送草稿”，未再创建新实例。这是重复启动的安全拒绝；待用户核对旧窗口空编辑器并正常关闭后，继续同一安装包的宿主成功路径。

为防止主进程意外退出时伴随服务残留，提交 `87406f547b13` 让随包 Node 每秒核对启动它的桌面进程；仅在 Windows 报告该进程不存在时，关闭服务并退出，最多等待 5 秒。Windows 上以真实子进程和回环监听端口验证父进程结束后子进程退出、端口拒绝连接，Node 24 与随包 Node 22 各 1/1 通过；类型检查与聚焦 lint 退出 0。本机沿用独立 `taskboard_test` 数据库设置 `TEST_DATABASE_URL`，直接执行 `vitest run`，19 个文件的 124 项测试全通过且无跳过。[CI #36578991194](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36578991194) 的 `verify`（含生产检查、浏览器 E2E 和离线回归）、`container`、`windows-desktop` 均成功。安装包 ZIP 为 24,625,762 字节、SHA-256 `E1E1EAF3A8A2060141E4BF896981D45E76FE09071A74EE5A79D5E04DA35A8B3F`；内含未签名 NSIS 安装器 24,637,398 字节、SHA-256 `8CF6F1D7F600315377DD2B94C58B62DD3B34BBD31B6FC031388C4B29ACAD052E`。源码测试与 CI 结果不能代替下述已安装程序实测。

在同一源码提交上再次使用 Node `24.19.0` 与项目指定的 pnpm `10.28.0` 执行 `pnpm install --frozen-lockfile` 和 `pnpm check`，均退出 0；类型检查、lint、无数据库 Vitest 109 通过且 15 项数据库用例按预期跳过，Web 与服务端构建成功。用现有独立 `taskboard_test` 数据库执行 `pnpm test:offline` 也退出 0，覆盖生产构建的离线冷重启、草稿保留、只读、重连与设备撤权；脚本使用新建的独立数据库，结束后删除它。机器上另有 Node 18 的 `corepack.cmd`，首次安装依赖虽退出 0 却发出引擎版本警告；上述正式记录使用 Node 24 直接运行 Corepack，并确认子进程为 Node 24。独立测试数据库服务仍被本机测试 API 使用，未为重复运行 `pnpm test:db` 而停止它；该提交的数据库全量 124 项及 CI 浏览器结果见前段。

本机 `87406f5` 安装器静默安装到另一独立目录退出 0；以原隔离数据与 WebView2 目录启动，主 PID 20452 的随包 Node PID 34728 独占 47831，真实窗口显示“已同步”、六张原任务及 TB-6 保存标题。人为终止这一测试主进程后，随包 Node 在约 0.28 秒内自行退出，47831 释放；再次启动同一安装版，真实窗口仍直接显示六张任务和 TB-6 标题。这是已安装程序的异常退出清理与数据恢复证据；托盘正常退出、第二台默认缓存冷启动和离线写入仍待复验。

对同一 `87406f5` 隔离目录再次终止主进程，Node 与 47831 自行释放；未留安装文件句柄。静默卸载器退出 0、安装目录消失；`agent-token.dpapi`、`browser-session.dpapi`、`cli-key.dpapi` 三个测试凭据文件哈希保持一致。`state.json` 在主进程终止与卸载步骤之间发生一次同长度重写，未取得逐步快照，故不把其哈希变化归因于卸载器，也不声称字节级不变。相同安装器重装到原隔离目录退出 0，启动后仍自动登录、显示六张任务和 TB-6 保存标题；用户数据在操作层面保留。托盘正常退出仍待单独确认。

在重装后的 `87406f5` 真实窗口创建 TB-7「G2 87406f5 安装版读写验收 2026-09-29」，编辑描述为「安装版创建后修改并保存；验证重启后仍可读取。」并保存。窗口显示七张任务及“任务已保存”，未保存标记消失。关闭窗口后主进程 PID 34456、随包 Node PID 11360 和 47831 监听继续存在；再次启动同一安装版恢复原窗口而未产生第二个主实例，TB-7 描述从任务详情中重新读回。这验证关闭到托盘及同实例恢复，完整托盘退出后的进程释放和冷启动读回仍待单独确认。最终安装器已按上述哈希核对并经 Taildrop 传往 `codex-server`，第二台默认 WebView2 缓存冷启动结果待回报。

同一 `87406f5` 真实窗口在“连接与设备”点击“启动独立 Codex”时，检测到旧隔离宿主仍在运行，明确提示“上次独立 Codex 仍在运行，可能含未发送草稿；请在该窗口处理草稿并关闭后重试”。只读进程核对显示仍只有原主 PID 34244，没有新建第二个隔离主进程。设置弹窗随后关闭，原看板仍为“已同步”、七张任务。待用户在旧隔离窗口核对空编辑器并正常关闭后，才能复验此安装版的成功启动与完整 G1 路径。

第二台随后在已安装桌面窗口把同一仓库标识映射到该设备自己的现有检出目录，界面报告保存成功。本机 `e849afe` 随包 CLI 于 `2026-09-29T11:29:59Z` 创建 TB-4（版本 1）；第二台桌面窗口未刷新便自动出现。第一次通过 `taskctl.cmd` 从 PowerShell 传 JSON 因 CMD 剥离内部引号而在本机解析阶段退出 25，没有写入；改用随包 `node.exe taskctl.js` 传同一 JSON 与幂等键成功。`2026-09-29T11:32:17Z` 本机 CLI 领取 TB-4，版本 1→2，另一条旧版本领取返回 `VERSION_CONFLICT`、退出 23；第二台桌面未刷新自动移入“进行中”。`2026-09-29T11:33:31Z` 本机 CLI 提交结果摘要和验证记录，版本 2→3；第二台桌面未刷新自动移入“待验收”。用户在第二台桌面核对摘要及验证记录后点击验收，看到“已完成”；本机 CLI 复查服务器版本 4、完成状态和非空摘要/验证记录。用户对三次桌面同步均报告“很快”，未做精确秒表计时，因此只记为实时可见，不声称实机小于 2 秒；CI E2E 则有两秒断言。第二台桌面的离线禁写和设备撤权缓存边界尚待验收，G3 保持未通过。

本机暂时停用 Tailscale Serve 测试入口 `2026-09-29T11:49:09Z` 至 `11:49:39Z`，在同一脚本的 `finally` 恢复原 443→47830 代理；恢复后普通 HTTPS 健康接口为 200。第二台已安装桌面窗口在未刷新时显示离线，恢复后自动回到已同步且 TB-4 仍在“已完成”。用户当时未观察写入按钮，故“离线禁写”实机结果暂不记通过；设备撤权后缓存清理也仍待验收。

第二次暂停 Serve 入口约 30 秒后，第二台没有显示离线。此操作可能保留了暂停前建立的 SSE 连接，不能作为断线禁写证据。源码检查又发现实时流报错时界面可停留在“正在同步”、写入按钮仍可用；后续修复为未确认实时连接时暂停写入，并在 25 秒无服务端心跳时主动断线重连。该修复的聚焦实时流回归 5/5、完整无数据库套件 107 通过且 15 项数据库测试按预期跳过，类型检查、lint 和 Node 24 Web 构建均退出 0；新包和第二台断线实机复验尚待执行。

修复提交 `e7db5ff8d353c64aa3f4933f967155b493f92578` 的 [CI #36569706059](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36569706059) 中 `verify`、`container`、`windows-desktop` 均成功。Windows ZIP 为 24,619,796 字节、SHA-256 `57E61FAC759BAE633CDE6A4742EF71E225278ED44FAFF26F314DE37AC883CD5C`；内含未签名 NSIS 安装器 24,631,428 字节、SHA-256 `5B2FFD1682B6F777CE9026FBFEBC9EF18D2EF3120E25D85DEC7889AB570F5ABD`。产物已核对并经 Taildrop 发往第二台，实机结果待补。独立 PostgreSQL 双浏览器协作 E2E 在该提交上使用实际信任的 Tailscale HTTPS 来源和绕过本机代理的浏览器启动参数，桌面及紧凑视口各 1/1 通过；此前直接使用 `127.0.0.1:4173` 的尝试因预览服务只信任 HTTPS 来源，登录接口返回 `ORIGIN_FORBIDDEN` 而各超时一次，随后未改源码、改用正确来源重跑通过。两次失败不计为产品功能回归结果。

本机从 `e849afe` 托盘退出后，主进程、伴随服务和 47831 端口均释放。`e7db5ff` 安装器静默安装到独立目录退出 0；以原隔离数据和原 WebView2 目录启动后，主 PID 25264、随包 Node PID 31620 的父子关系和 47831 监听归属一致。真实已安装窗口直接显示五张原任务、状态为“已同步”；经窗口创建 TB-6「G2 新版安装读写验收 2026-09-29」，再改标题并保存，界面显示六张任务、修改后的 TB-6 和“任务已保存”，未保存草稿标记消失。点击窗口关闭后，原主进程、随包 Node 和端口保持运行；再次启动同一 exe 恢复原窗口而未创建第二个主实例，TB-6 的保存标题仍可读。本轮尚未执行托盘退出重启、卸载及第二台对同包的离线禁写实测，G2/G3 不关闭。

本机 `e849afe` 安装版启动新的独立 Codex `26.924.2738.0`：主 PID 34244 独占字面回环 CDP 端口 49893，唯一主页面 `app://-/index.html` 的目标 ID 为 `8D8039F7BDBB1A1D101CB0CA0003BB9E`，另有非主 `detached-window` 页面。只读项目 ID `0e509ef5-4459-4425-bc06-bbbda4e24836` 在该隔离实例数据库中唯一映射当前仓库，编辑器起初为空。用户打开安装版侧栏入口后，在 Codex 480px 最小视口下原侧栏自动收起，iframe 为 424px；独立截图、布局读数和筛选器边界显示单列、无横向溢出且可读。展开原侧栏时窗口为 722px、iframe 为 666px、两列；再次缩到 480px 时侧栏自动收起，iframe 返回 424px。因此本次真实宿主未产生 185px iframe，185px 只保留独立浏览器回归证据。

同一安装版探测报告 `embedded=true`、`draft=true`，仓库映射与当前检出一致。为任务指定未映射仓库的草稿请求返回 `opened=false`，当前项目和空编辑器未变；对已映射 TB-2 提交 37 字、含两个空行的五段未发送草稿返回 `opened=true`，同文档重复请求返回 `opened=false`。只读 CDP 核对同一项目、唯一编辑器的五段长度 `[14,0,14,0,5]`，重建原文完全匹配、无弹窗、注入节点为零。用户手动清空草稿后只读核对唯一编辑器恢复为空、项目不变、无弹窗及注入节点。之后将同一仓库映射临时改为另一现有目录，正确仓库任务的打开请求被拒绝；映射在 `finally` 恢复，CDP 复核当前项目和空编辑器仍未改变。当前安装版仍需页面漂移、会话切换等拒绝路径及 CSP 恢复的完整实机门槛，G1 保持未通过。

用户从本机 `e849afe` 安装版托盘点击“退出”后，主 PID 18168、随包 Node PID 32736 和字面回环端口 47831 均释放。受管理测试 Codex PID 34244 保留，但只读检查确认仍是同一项目、唯一空编辑器且无注入节点。再次以原隔离数据和 WebView2 目录启动，主 PID 33916、随包 Node PID 28264 的父子关系与安装路径匹配；随包 CLI 联网读取四张任务，TB-4 版本 4 位于“已完成”。用户确认窗口也直接显示四张任务和已完成的 TB-4；该部分证据不改变 G1 未关闭状态。

修复提交 `af2800950da733d192666d1a0f4f4f6d9f8beb92` 的 [CI #36554088993](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36554088993) 中 `verify`、`container`、`windows-desktop` 均成功。Windows ZIP 为 24,615,981 字节，SHA-256 `C1FA42167D9EBAF44306A1B650D83DFB999A916731F63B4305C516CAAA6CC7D4`；内含未签名 NSIS 安装器 24,627,615 字节，SHA-256 `6147906B5730B69CCDC0F022A6E26517938022617AC1CACF33D91BB7C8A40C2C`。已下载并核对产物；后续固定 `e849afe` 的实际宿主宽度复验结果见本节上方。

诊断改进提交 `33306422b47352abb0e84945c5553e9600c1f412` 的 [CI #36556295411](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36556295411) 中三项作业也均成功。Windows ZIP 为 24,617,510 字节，SHA-256 `B73074E4DCDC676AF2654650144A5FEADD7BAE9BFEDC2A3FEDDEA79435655682`；内含未签名 NSIS 安装器 24,629,149 字节，SHA-256 `A43ADF2E18BA7C6406613093FF58AF74A2738A45A22C61F6297BA1D96578819A`。本机已核对产物，并将安装器经 Taildrop 发送到第二台；两台设备的最新包实机复验仍待进行。

固定提交 `6c8e41afd1b5a620fe8eb30c5aa0c398caf5f997` 的 [CI #36549295157](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36549295157) 中 `verify`、`container`、`windows-desktop` 均成功。Windows ZIP SHA-256 为 `77F141A5BBBA4072E1AF58128693797476741E271A4E93A1B508839DFDE5CF11`，未签名 NSIS 安装器 SHA-256 为 `33CC267AE22197739423E22C645A3728A7C0376FCB27CEDFABFA88ACFAB2035D`。旧版经托盘退出后伴随服务及端口释放；新版静默安装到独立测试目录退出 0，随包 Node 和 CLI 运行。用户在新版独立 Codex 中登录并打开目标项目；只读核对确认项目与本机仓库映射唯一对应、编辑器为空。侧栏“任务看板”已展开，真实 iframe 宽 935px 和 715px 时状态列重排、筛选器可见且无横向溢出，截图在 `.artifacts/acceptance/2026-09-29-ci-6c8e41a/`。

用户将 Codex 缩到系统允许的约 480px 总宽后，侧栏占 290px，iframe 仅约 185px；旧安装版虽然没有横向溢出，但标题和按钮逐字换行，判定可读性不合格。本轮工作树增加 360px 以下的嵌入布局，并把列表视图改为单列任务详情。独立 Chrome 演示页在 185px 的看板与列表截图分别为同目录下的 `compact-185-board.png`、`compact-185-list.png`；两者可读，文档及列表的 `scrollWidth` 均未超过 `clientWidth`。Playwright 响应式回归新增 185px 检查且通过；TypeScript、所改测试的 ESLint、Web 构建均退出 0。此为源码和独立浏览器结果，**修复后的 CI 安装包与真实 Codex 最窄窗口仍待复验**。

第二台 Windows `codex-server` 已收到同一安装器，用户确认 SHA-256 匹配，安装后看到 Taskboard 服务器地址和登录页。桌面登录界面出现“伴随服务发生未知错误”，登录尚未通过；第二台随包 Node 直接 `fetch` 同一 HTTPS 健康接口返回 200，后续继续区分保存地址、登录 POST 和本地状态错误。第二台桌面程序的仓库映射及任务全流程仍待验收。此前本机 CLI 原子领取 TB-3 成功，版本 1→2；并发第二次领取得到版本冲突，服务器和本机桌面均显示“进行中”，但第二台 Edge 初次观察时未自动移动，故状态变更的实时同步尚不能判通过。G1–G4 继续保持未通过。

针对这个无法定位的提示，当前源码将登录输入不合法、服务器连接失败或超时、服务器地址本地保存失败分别返回明确的错误码；伴随服务聚焦测试 6/6、TypeScript 与 ESLint 通过。它尚未进入第二台已安装程序，不能把诊断改进记作登录故障已修复。

随后在同一 `6c8e41a` 安装版中，用户从侧栏收起看板；只读核对确认隔离 Codex 的唯一项目仍映射当前仓库、唯一编辑器为空且无弹窗，原生 PID 和回环监听者一致。已安装伴随服务 `/v1/codex/open-draft` 为 TB-2 返回 `opened=true`；只读 CDP 确认编辑器中的五段内容与预期完全一致、未发送，立即重复调用返回 `opened=false`，原草稿未被覆盖。用户手动清空后再经只读核对确认唯一编辑器为空、无弹窗及注入节点；错误项目拒绝和新修复包的实机复验仍待做，G1 不关闭。

## 2026-09-29：侧栏开关、响应式布局与跨设备接入续验（进行中）

固定提交 `bc02c44e81e93762cfa5268c0cd2e7b6482944fe` 的 [CI #36544426117](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36544426117) 中 `verify`、`container`、`windows-desktop` 均为 success。`windows-installer-ci.zip` 为 24,615,792 字节，SHA-256 `1A7822B709DCE8188C2C9C339E4D6A5306FED94A8E80DC0098F816ED5B8F4D95`；其中未签名 NSIS 安装器为 24,627,431 字节，SHA-256 `B4CC9CEE9EEB23AC17F2070B2D8A26D58754F8DCBD7EEA650C8C7E9668E13BE0`。静默安装到独立测试目录退出码 0，程序及随包 Node 启动，伴随服务监听 `127.0.0.1:47831`。切换前旧测试版经托盘“退出”后，主进程、随包 Node 与该端口均退出；旧隔离 Codex 确认唯一编辑器为空、注入节点为零后，仅停止核对过路径、父进程和 profile 的测试进程，CDP 端口释放。

用户反馈原独立“返回 Codex”按钮点击无效，且侧栏入口已可承担关闭操作；提交 `bc02c44` 移除该按钮，将侧栏“任务看板”入口改为再次点击关闭，并保留 Esc 和按下状态。提交 `c051ce3` 为 iframe 宽度 935、640、420 像素提供三、二、单列重排及窄屏筛选器布局；浏览器回归在 1575、935、640、420 像素验证列均位于容器内且没有横向溢出。当前提交本机在 Node `24.19.0`、pnpm `10.28.0` 下执行 `pnpm check` 退出 0：无数据库 Vitest 102 通过、15 项数据库用例按预期跳过，类型检查、Lint 和构建通过。

`bc02c44` 安装版重新登录隔离测试账号并读到原两张任务；随包 CLI 单独登录后也读到相同任务。已安装 Taskboard 启动独立 Codex `26.924.2738.0`，原生进程、`127.0.0.1:60087` 监听者、唯一 `app://-/index.html` 页面及精确 WebSocket 目标一致。用户在新隔离 profile 登录并打开目标项目，唯一可见项目 ID 与隔离 Codex 数据库中唯一根目录映射匹配，唯一编辑器为空、无弹窗。安装版接入侧栏成功，入口位于“新聊天”下方；用户点击后看板占主内容区，再次点击后看板隐藏，原项目聊天与空编辑器保持。真实截图同时暴露**响应式失效**：iframe 宽 935 像素时仍横向滚动，右侧状态列被截断，证据在忽略目录 `.artifacts/acceptance/2026-09-29-ci-bc02c44/installed-codex-sidebar-before-open.png`（采集时实际已打开）。原因是已安装伴随服务给 iframe 的地址缺少 `embedded=1`，使响应式 CSS 条件未生效；当前工作树已修正内嵌地址并新增参数回归，`pnpm typecheck`、`pnpm lint`、伴随服务与启动器测试 14/14 通过，打包准备产物已含该参数。修复安装包、窗口缩放及草稿成功与拒绝路径仍待实机复验，G1 与 G2 不关闭。

隔离测试 API 经 Tailscale Serve 暴露于同一 tailnet 的 HTTPS 地址；本机经 HTTPS 访问 `/api/v1/health` 得到 200，数据库状态 `ok`。第二台 `codex-server` 先因未接受 Tailscale DNS 而无法解析域名；启用该设备的 Tailscale DNS 后，普通域名 HTTPS 请求返回 200。其原浏览器仍受代理拦截，在不更改系统代理的独立 Edge 中禁用代理后，用户看到登录页，登录同一合成账号并读到原两张任务。测试预览脚本已改为支持配置 `PUBLIC_ORIGIN`；原测试服务固定本机来源时，带 HTTPS `Origin` 的请求为 403，重启后同请求为 200。

本机随包 CLI 于 `2026-09-29T09:22:48Z` 创建 TB-3，服务器返回版本 1；第二台 Edge 未刷新即自动出现该任务，用户报告约 2 秒内可见，本机安装版随后也显示三张任务。复用同一幂等键重试创建，返回原任务 ID 和版本，服务器列表仍恰有三张任务。这证明当前测试网络的双设备浏览器实时分发和该写入幂等性；第二台桌面程序的本机仓库映射、领取冲突、离线与撤权仍未验收，G3 不关闭。另发现随包 `taskctl.cmd` 会覆盖显式 `TASKBOARD_DATA_DIR`，当前工作树改为仅在未设置时使用默认目录；重新生成的运行时 wrapper 以隔离目录读取三张任务成功。上述工作树改动仍待新 CI 与安装版复验。

## 2026-09-29：当前 Codex 宿主 G1 诊断

提交 `ae943d3c487a543646077b26b16ce3101dbd3818` 的 [CI #7](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36519827934) 已完成，`verify`、`container`、`windows-desktop` 均为 success。本机继续保留 `185103d` 安装版启动的隔离 Codex `26.924.2738.0`：PID 27276、监听端口 59504、唯一 `app://-/index.html` 页面及精确 WebSocket 目标一致。用户在此隔离窗口登录并创建 `codex-taskboard` 项目后，页面唯一选中 ID 与隔离 `state_5.sqlite` 中唯一根目录映射对应当前仓库；唯一编辑器为空，且无弹窗或 Taskboard 节点。

源码适配器的实机草稿诊断先拒绝错误目录，再写入 21 字三段验收草稿，第二次写入因编辑器非空而拒绝；只读复核确认原文留在编辑器、未发送。此诊断使用前一宿主版本清单项来试验相同草稿契约，不是已安装产品放行。用户随后手动清空验收草稿；只读复核确认空编辑器，才进行页面重载检查。

当前宿主的真实 `securitypolicyviolation` 事件确认本机看板 iframe 默认受 `frame-src` 阻挡。适配器侧栏诊断在临时回环演示看板上通过 nonce 就绪、入口显示、看板可见、“返回 Codex”、外部重载恢复和退出清理；清理后注入节点与入口均为零，再次出现真实 `frame-src` 拦截。首次探针因验收脚本 `page.evaluate` 表达式写法错误返回空值，未执行注入；修复探针后完整诊断通过。使用新版本清单项重新执行相同完整诊断也通过。临时看板服务已停止。证据脚本与摘要位于忽略目录 `.artifacts/acceptance/2026-09-29-current-host/`，不包含登录凭据或完整会话。

源码现将 `26.924.2738.0` 纳入侧栏和草稿清单，并沿用本次实测的新版宿主标记。聚焦回归 12/12、无数据库完整 Vitest 102 通过且 15 项按预期跳过；TypeScript、ESLint、Web/Node 构建退出 0。这里仍是待提交的本机工作树结果；**尚需同一提交的 CI 安装器、真实安装版侧栏和草稿成功及拒绝路径复验**，G1 与 G2 均未通过。

## 2026-09-29：新机器续验与安装版任务闭环

固定提交 `cac30bbd37e155b1e3b5ba200642248cceb832ab` 使用 Node `24.19.0` 和 pnpm `10.28.0`。`pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test:db`、`pnpm test:e2e`、`pnpm test:offline` 及编译后的 migrate/admin 入口检查均退出 0。无数据库套件为 101 通过、15 项按预期跳过；独立 PostgreSQL 为 116/116，浏览器 6/6，离线冷重启、草稿保留、只读、重连和撤权通过。同一提交的 [CI 运行 #3](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36513524961) 中 `verify`、`container`、`windows-desktop` 全部通过。新机器的 G0 基础门槛通过；后续源码提交仍须核对自身 CI。

干净安装首次执行 `pnpm check` 失败：伴随服务测试依赖尚未生成的 `apps/desktop/runtime/web/index.html`。测试已改为自建临时嵌入网页。浏览器 E2E 原来会覆盖三张受版本控制的文档截图，已改写至 Playwright 测试输出目录，原图恢复。修复后上述检查通过，工作树不再被 E2E 截图污染。

该 CI 的 `windows-installer-ci.zip` SHA-256 为 `A353F290DEED1A8D1787B2C1D1529D0C087EBCBC4C94C2F7D6CCA52153EF059C`；其中 NSIS 安装器 24,633,363 字节，SHA-256 为 `CED5A78D1AB0E8EE24D7C8B90B22A76D385CAD6923A99D452D7303E98888620D`，未签名。静默安装到 `.artifacts/acceptance/2026-09-29-installed/` 退出 0，安装目录含原生程序、随包 Node `22.16.0`、伴随服务、CLI、Web 及卸载器。通过 `TASKBOARD_DATA_DIR` 指向忽略的隔离测试目录；原 `%APPDATA%\CodexTaskboard` 在测试前不存在且未使用。

已安装窗口连接项目独立 PostgreSQL 上的本机测试服务，并以合成账号登录。界面创建空间与任务、修改任务后显示保存回执，数据库版本从 1 增至 2；关闭窗口后原生进程和随包 Node 仍存活，`127.0.0.1:47831` 归随包 Node，重新启动单实例可恢复窗口及任务。随包 CLI 在同一隔离目录登录、列表和读取，版本 2 原子领取得到版本 3；第二次按旧版本领取返回 `VERSION_CONFLICT`、退出码 23；提交验收得到版本 4。安装版实时显示“待验收”，界面验收后显示“已完成”。这些结果证明本机已安装程序与 CLI 的单设备真实服务任务闭环，不能替代两台设备验收。托盘菜单直接恢复、托盘正常退出、端口释放、卸载及重装仍待验证，G2 保持未通过。

本机安装的 Codex 为 `26.924.2738.0`。旧安装版从“启动独立 Codex”明确返回“当前 Codex 安装包版本未通过受管理宿主验收”，没有启动进程。另用独立 profile 直接运行该版本时，可执行文件、独立目录及 `127.0.0.1:9223` 监听者一致，但 `/json/list` 始终为空、无渲染进程；确认无页面后关闭测试 PID，端口释放。此直接启动不计为 G1 成功。提交 `185103da0fff2a048494bd415ee76931b9c26f60` 增加当前版本的**隔离启动**清单，伴随服务对未验收版本仍拒绝侧栏注入和草稿；本机 `pnpm check` 为 102 通过、15 项数据库用例按预期跳过，带独立数据库的完整 Vitest 为 117/117。重新安装产物的包上下文启动结果见下文，G1 保持未通过。

该提交的 [CI 运行 #4](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36516023551) 中 `verify`、`container`、`windows-desktop` 全部通过。`windows-installer-ci.zip` SHA-256 为 `736FBA55F34F57667A5F5D1B799326CCD128B6857F42B53670F86711349A3201`；内含未签名 NSIS 安装器 24,630,633 字节，SHA-256 为 `020B89FDA119F7B49F48B31CA13AB9166D4C53DB19BA31579770B6A3A1B83224`。静默安装到新的隔离目录退出 0，安装后的原生程序和随包 Node 启动，`127.0.0.1:47831` 归随包 Node；沿用隔离数据后，窗口仍显示上一版完成的测试任务。随包 Node `22.16.0` 及 CLI 帮助入口运行成功。为切换版本，仅在核对旧安装目录后强制结束旧测试进程；这不计为托盘正常退出。

新安装版点击“启动独立 Codex”后出现“受管理 Codex 已启动”的反馈，并显示独立 Codex 登录窗口。原生启动器创建 MSIX `26.924.2738.0` 的 `ChatGPT.exe` PID 27276，命令行使用位于隔离测试数据目录的 `--user-data-dir`；`127.0.0.1:59504` 的监听 PID 同为 27276。CDP 列表只有一个 `app://-/index.html` 类型 `page`，目标 ID 和 WebSocket 路径一致；另有一个 `codex-sandbox://` 类型 `webview`，不作为主页面。隔离窗口尚未登录，因此项目身份、侧栏、草稿与拒绝路径未验收，G1 仍未通过。原始核对信息保存在忽略目录 `.artifacts/acceptance/2026-09-29-ci-185103d/installed-launch-evidence.json`。

使用随包 CLI 的本机凭据调用伴随服务的 Codex 探测和接入入口：探测明确返回 `embedded/projects/draft/thread=false`，原因是当前宿主版本尚未完成页面验收；侧栏接入返回 HTTP 409 `ADAPTER_UNAVAILABLE`，未触发页面注入。合成任务的未映射仓库草稿请求返回 `opened=false` 和手动粘贴提示。CLI 凭据访问浏览器会话代理返回 HTTP 403 `LOCAL_SURFACE_DENIED`。这证明当前安装版对**未验收版本**与**未映射仓库**的拒绝路径生效，不代替项目不匹配、非空编辑器及清理恢复等其他 G1 拒绝场景。响应摘要保存在忽略目录 `.artifacts/acceptance/2026-09-29-ci-185103d/unsupported-host-refusal.json`，未保存凭据。

验收记录提交 `e439b67f897a5df10af41dec4453b21b1c3d7e08` 的 [CI 运行 #5](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36517851534) 中容器和 Windows 作业通过，`verify` 在离线流程已报告通过后的测试库清理阶段失败：`DROP DATABASE ... WITH (FORCE)` 与连接池关闭竞态，PostgreSQL 强制断开的空闲连接发出未处理的 `error`。修复提交 `cf031ceb09203ee502185b0a6e38ca08ef6567b7` 等待数据库会话实际断开再执行普通 `DROP DATABASE`，并为服务端连接池增加空闲连接错误处理。本机 `pnpm typecheck`、`pnpm lint`、`pnpm check`、独立数据库 117/117 和 `pnpm test:offline` 均通过；该提交的 [CI 运行 #6](https://github.com/i-am-yimin/codex-taskboard/actions/runs/36518881812) 中三个作业全部通过。CI #6 安装器产物 ZIP SHA-256 为 `52437A5C8807B3BA3EFA56A9FDB4AE97DD22FEDC5CB60215A56F1A378E67E0F3`，内含未签名 NSIS 安装器 24,631,647 字节，SHA-256 为 `026C85980799E00829A3ADB959AAF0B98E085D9DDEBC97AEC8A10639999F09C7`；此新包尚未安装，现有宿主实机结果仍对应 `185103d` 包。

本轮本机没有 Docker 或已安装的 WSL 发行版，不能据此完成 G4 的 Compose 恢复与 HTTPS 复演；当前 CI 容器通过也不等于发布门槛通过。原始安装包和隔离数据均留在忽略目录 `.artifacts/acceptance/`。

## 2026-09-29：换机交接检查

本轮整理当前源码、测试、设计和验收记录，并更新根目录 [交接文档](../HANDOFF.md)。`pnpm check` 退出码 0：类型检查和 Lint 通过；无 `TEST_DATABASE_URL` 的 Vitest 为 101 通过、15 项数据库用例按预期跳过；生产 Web 构建通过，主 JS chunk 540.08 kB 有现存体积提示。`git diff --cached --check` 通过。此结果针对交接工作树，尚需用固定推送提交核对 CI。此次没有重跑数据库、E2E、Rust、NSIS 或真实 Codex 安装版验收；G0–G4 状态不因换机提交自动变为通过。

原始日志、截图、安装包和隔离测试数据仍在本机忽略目录 `.artifacts/acceptance/`，不会进入 Git；另一台机器从仓库内的结果摘要和验收计划开始新的隔离复验。

## 2026-09-26：包上下文通道与真实句柄交接

- 原生辅助入口已接在 Tauri 单实例初始化之前。命名管道使用当前用户 DACL、拒绝远程连接、独占首实例与随机会话；双方通过 Windows 返回的通信方 PID 核验真实句柄、可执行路径及包身份。只有完成同一子进程句柄复制、持久记录核对及一次确认后才返回受管理进程。
- 启动前写入独占 `pending` 记录，子进程创建后原子替换为 `active`。超时、辅助入口退出或记录写入失败时不自动终止可能含草稿的子进程；未确认记录阻止重复启动。通道有 45 秒总截止时间和 32 KiB 消息上限，能力与网页/伴随服务控制通道分离。
- 原生模块最终回归 **17 通过、0 失败、5 个诊断/夹具入口按设计忽略**，退出码 0。首次补测为 16 通过、1 失败：原 CDP 测试服务端只读取一次请求便关闭连接，Windows 返回 10054；修正为读取完整请求头后重新通过，原失败日志保留。编译入口、通过和失败记录在 `.artifacts/acceptance/2026-09-26-package-handoff/`。完整 `cargo check --locked -j 1` 在离线依赖模式下通过；较早在线模式无进展的检查已停止，不计通过。
- 使用当前实际原生模块构建的独立诊断程序，在中文空格隔离路径启动 `26.924.1866.0` 成功，包身份、复制句柄、创建时间、监听者与唯一 `app://-/index.html` 目标匹配。诊断主进程退出后 Codex 仍保留；只读确认停在登录页、无编辑器/弹窗/注入节点后，精确核对身份并停止该诊断进程。该清理不是正常 UI 退出验收。证据 `实机 隔离/result.json`、`readonly.json` 和 `cleanup.json`。
- 原生开发预览版本门禁已更新为 `26.924.1866.0`，真实宿主与草稿证据沿用本日独立记录。安装版按钮、私有归属查询、草稿及退出重启联合验收仍未完成，G1 保持未通过；本轮未修改原来留有未发送草稿的隔离窗口。
- 新原生 `cargo build --locked -j 1 --release` 在离线依赖模式下通过（9 分 30 秒，退出码 0），不是复用旧原生 exe。畸形辅助入口调用在完整 release 程序中返回 1，未进入 Tauri 单实例正常入口。NSIS 打包和中文空格目录安装退出码均为 0，安装后 `companion.js` 与 staging SHA256 一致。安装器 SHA256：`00250B99BD12F986EFC26DA53ECE3B837C16C9B59A71863AD04C170DD1ABC269`；伴随服务 SHA256：`AE550074EBF53E674A5567BCF62BEBBF24E8F066E3B4E866B7DA96859DD77346`。
- 升级前旧测试版伴随服务的认证关闭接口返回 202，但 15 秒内进程未退出；核对原启动器及 Node 子进程身份后执行测试清理。该结果不计为正常托盘退出通过，后续安装版仍需验证关闭路径。记录 `previous-launcher-cleanup.json`；原 Codex 草稿窗口保留。
- **安装版启动已通过。** 新 NSIS 安装版从设置中的“启动独立 Codex”按钮创建包上下文辅助入口及隔离 Codex，启动成功提示出现，私有归属通道驱动的 `/v1/codex/probe` 返回 HTTP 200、`draft=true`。随后两次调用均返回“受管理 Codex 已在运行”，持久身份记录不变；证据 `installed-launch.json`、`installed-binding.json`、`installed-idempotent.json`。仍需用户在新隔离窗口登录并选中项目，才能继续侧栏与任务草稿验收。
- 安装后原生 exe SHA256 为 `F9943585285E9B9060BFFBE4DED6523AAF7FCECFD1CD59DFAC885E4C986191AA`。逐字节对照本轮 release 原始 exe（SHA256 `C711F757366724EBE001829B6F287E7027D2765213735DB9A68BDAE09F6F6441`），两者均为 9,124,352 字节，仅偏移 6,827,658 的 3 字节由 `UNK` 变为 `NSS`，对应打包器记录的 bundle type 注入；不是直接哈希相同。证据 `installed-native.json`。

## 2026-09-26：原生进程句柄交接基础层

`owned_process.rs` 新增 Windows 进程句柄持有与复制，直接启动路径已接入 `ManagedCodex`。保留的句柄仅有查询和同步权限，不因持有者释放而终止 Codex。核验从真实句柄读取 PID、创建时间、规范化可执行路径和包全名；跨进程接收要求已有经过独立认证的辅助进程句柄，不能拿回执中的 PID 代替通道认证。空值、伪句柄、非进程对象和任一身份字段不匹配均拒绝。存活检查及重启保护改为 `WaitForSingleObject`，避免把合法退出码 259 误判为仍在运行。

MSVC 工具链使用 `rustc --edition 2021 --test` 编译实际 `managed_codex.rs` 与 `owned_process.rs`（链接已有 rand/serde_json 依赖），原生测试 **11 通过、0 失败、5 个入口按设计忽略，退出码 0**。忽略项包含两个由父测试显式运行的子进程夹具，以及三个需要特定安装环境的手动诊断；未将后三项计为通过。真实跨进程测试确认源句柄释放后接收方仍持有同一子进程，子进程退出后撤销；另有 PID/创建时间/路径/包身份拒绝、释放保留存活进程及退出码 259 回归。证据与编译入口在 `.artifacts/acceptance/2026-09-26-handle-ownership/`。

这是原生基础模块的编译与实测，不是完整 Tauri 重建或安装包验收。包上下文辅助入口、限当前用户的认证通道、启动回执和故障恢复尚未接入；原生版本门禁仍为 `26.917.9434.0`，G1 保持未通过。本轮没有操作留有未发送草稿的 Codex 窗口。

## 2026-09-24：G0 本机复验

当前基线为 `0c1d38b` 加本轮尚未提交的测试与文档修改；因此以下结果是本机工作树证据，尚不能关闭要求固定提交和 CI 产物的 G0 门槛。Node `22.16.0`、pnpm `10.28.0`，独立数据库为项目内 `taskboard_test`。

| 检查 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 退出码 0；锁文件无需重新解析 |
| `pnpm typecheck`、`pnpm lint`、`pnpm build` | 退出码 0；前端主 chunk 539.28 kB 的既有提示仍在 |
| `pnpm test`，无 `TEST_DATABASE_URL` | 退出码 0；85 通过、15 项数据库用例按预期跳过。修复了跳过的服务器套件在收集阶段仍创建数据库的问题 |
| `pnpm test:db` | 退出码 0；15 个测试文件、100 个用例全部通过，含 PostgreSQL 集成与权限用例 |
| `pnpm test:e2e`，独立测试数据库 | 首次 5/6，通过复验 6/6；首次失败 trace 见忽略目录 `.artifacts/acceptance/2026-09-24-g0-e2e-failure/` |
| `pnpm test:offline`，生产 Web 构建及独立测试数据库 | 退出码 0；断网重开、草稿保留、只读控制、重连及撤权验证通过 |

首次 E2E 失败发生在 1920 宽度的任务创建后。trace 显示创建请求耗时约 2.24 秒并返回 201，旧断言却从点击时起只等待 2 秒。测试已改为先确认写入响应，再等待本地看板呈现；跨设备同步仍从保存成功响应开始保留 2 秒断言。伴随服务的 Windows DPAPI 用例在首次并行检查时超过原 30 秒，单独重跑 8/8 通过；该用例现使用明确的 60 秒上限，本轮完整 `pnpm test` 与 `pnpm test:db` 均通过。G0 仍需对固定提交核对 GitHub CI 的 Linux、容器和 Windows 作业。

## 2026-09-25：G1 进程归属拒绝路径

本机安装的 Codex 版本为 `26.917.9434.0`；适配器允许清单仍只含先前实测的 `26.901.5280.0`。本轮没有连接、注入或修改用户当前的 Codex 实例，也没有放宽 CSP。新版本的宿主结构和项目身份尚未验收。

适配器已把 `managedProcess` 布尔值替换为可重复核验、3 秒内必须返回的启动器归属契约。在 CDP 连接后、CSP 修改前、界面注入前和重载恢复前重新核验；伴随服务不再由 `TASKBOARD_MANAGED_CODEX` 等环境变量启用适配器。聚焦回归：适配器 29/29、独立 Chromium CSP 生命周期 5/5、伴随服务 9/9；完整无数据库测试 90 通过、15 项数据库用例按预期跳过，`pnpm typecheck`、`pnpm lint`、`pnpm build` 退出码均为 0。设计与后续真实证明见 [ADR 0003](adr/0003-managed-codex-ownership.md)。

这些测试使用替身归属对象。Tauri 尚未创建并持有受管理 Codex 子进程，也未把进程、端口和页面绑定证明交给伴随服务；项目路径身份、空白草稿填写及 `26.917.9434.0` 的实机交互仍未通过。G1 保持未通过。

在隔离 profile 中另起当前版本的测试实例后，先核对可执行文件、命令行中的独立目录及 `127.0.0.1:9223` 唯一监听者，再从 `/json/list` 唯一匹配 `app://-/index.html` 页面并用 `Target.getTargetInfo` 复核。只读 `Runtime.evaluate` 观察到 shell、sidebar、content 与空编辑器各 1 个，弹窗、Taskboard 注入节点和入口均为 0；结果保存在忽略目录 `.artifacts/acceptance/2026-09-25-g1-readonly-result.json`。这仅证明页面当时存在旧标记，不证明项目路径、看板交互或 CSP 生命周期兼容，因此没有将新版本加入允许清单。

收尾时再次确认页面为空、无弹窗及注入节点。该独立进程没有主窗口句柄，正常关闭请求未生效；重新核对精确可执行文件、隔离 profile 和端口归属后只停止该测试 PID。复查时该 PID 已退出，`9223` 不再监听；过期的 `.artifacts/codex-smoke-current.json` 已在忽略目录内归档，避免把旧 PID 当作现行凭据。用户当前实例及其数据目录未操作。本轮未启用 CSP，无需恢复 CSP 状态。

同日再次用该隔离 profile 启动当前版本进行只读项目关联。先核对新 PID 的可执行文件、独立 profile、创建时间与唯一回环监听，再精确绑定唯一主页面及 `Target.getTargetInfo`。页面只有一个 `aria-current="page"` 项目，其 `data-app-action-sidebar-project-id` 与本机 `state_5.sqlite` 的 `project_idempotency_keys.key` 唯一匹配；该记录经 `projects`、`project_roots` 联接后只有一个存在的根目录，规范化后等于当前仓库。界面同时显示唯一空编辑器、无弹窗及注入节点。脱敏核对结果见忽略目录 `.artifacts/acceptance/2026-09-25-g1-project-path-result.json` 和 `.artifacts/acceptance/2026-09-25-g1-project-resolver-result.json`。这证明该次隔离 profile 的可见项目与本机目录可关联，不等于生产启动器已持有进程，也不证明会话切换时仍安全。

新增只读项目解析器 [project-identity.ts](../packages/adapter-codex/src/project-identity.ts)：只用明确提供的 Codex 数据目录与可见项目 ID，要求映射和根目录均唯一、路径真实存在；内部数据库缺失、结构变化或歧义时返回不可用。它尚未接入自动草稿。适配器在 CDP 探测返回后也再次核验归属，避免期间撤销仍报告已内嵌。适配器回归 30/30、解析器回归 3/3，`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare` 均退出 0；打包准备产物已核对含探测后的归属复核。解析器首次测试因 Windows 临时目录的 8.3 路径写法与规范化路径不同而失败，修正测试期望后复验通过。隔离进程复查空编辑器和端口归属后已关闭，PID 与 `9223` 均释放；没有写入草稿或修改 CSP。

## 2026-09-25：G1 原生启动器增量

Rust `1.98.1` 已安装在忽略目录 `.artifacts/tools/`。本机没有现成 MSVC 工具链；Visual Studio Build Tools 安装被 Windows UAC 取消（安装器退出码 1602），因此本机改用便携式 LLVM/MinGW 和 Rust GNU 目标验证。`cargo check` 对 Tauri 工程以该目标退出 0，MSVC 目标及安装器构建仍需 Windows CI 或有权限的构建环境复核。

新增 [managed_codex.rs](../apps/desktop/src-tauri/src/managed_codex.rs) 与 Tauri `start_managed_codex` 命令。启动器仅从系统登记的 `OpenAI.Codex` 包中接受已验证的 `26.901.5280.0`，创建唯一隔离 profile 与 Codex 数据目录，持有实际子进程句柄和创建时间；用 Windows TCP 表核对字面 `127.0.0.1` 监听 PID，并要求唯一 `app://-/index.html` 目标的 WebSocket 精确绑定。绑定失败时保留仍运行的子进程句柄，并拒绝启动第二个实例。`cargo test` 11 通过、1 项指定实机版本的测试按默认规则忽略；该项在本机单独运行通过，确认已安装的 `26.917.9434.0` 在创建子进程前被拒绝。监听归属测试实际调用 Windows TCP 表，目标绑定测试使用独立回环服务器；没有连接或修改用户当前 Codex。

此增量尚未把原生归属证明通过私有控制通道交给伴随服务，也没有提供安装包内可供 Codex iframe 访问的本机看板 URL。Tauri 命令尚未接入用户界面，退出 Taskboard 时的安全关闭或保留流程也未验收；真实受管理子进程成功路径、CSP 恢复和未发送草稿仍未验收，G1 保持未通过。

## 2026-09-25：G1 私有归属通道与重启保护

原生启动器现于伴随服务启动前创建随机回环控制端口，并仅向伴随服务子进程传递独立控制密钥；桌面渲染进程只能取得原有 API 桥接密钥。控制端每次读取会重新核验仍持有的子进程句柄、创建时间、监听 PID 和精确 CDP 页面，返回不可变会话描述或拒绝；伴随服务在适配器每次 `owner.verify()` 中再次向启动器查询并对照原描述。控制密钥在伴随服务读取后从环境中移除，避免后续子进程继承。启动器失联、进程退出、端口换主或页面漂移时不续期归属。当前真实版本仍不在允许清单，安装接口还因看板来源与宿主 UI 未验收返回 `HOST_UI_UNVERIFIED`，因此没有开放注入、CSP 或草稿操作。

退出 Taskboard 时不结束可能含未发送草稿的独立 Codex。启动器在本机应用数据目录记录新进程 PID 和创建时间；重启若该进程仍在运行则拒绝另起实例，并提示先处理草稿和关闭旧窗口。只有操作系统确认 PID 已退出或创建时间不符才清除旧记录；记录损坏或进程状态无法读取时拒绝启动，避免凭 PID 猜测。此策略仍需在已安装程序上验证窗口、托盘退出与重启行为。

桌面“连接与设备”中现有“启动独立 Codex”入口调用原生命令并显示拒绝原因；浏览器和 Codex 内嵌页面不显示该入口。当前安装版本会在创建子进程前被拒绝，入口不自行修改允许清单。

验证：私有通道及伴随服务聚焦测试 11/11，Rust GNU 目标 `cargo test` 13 通过、1 项当前版本实机拒绝测试按默认规则忽略；新增 Rust 测试覆盖控制密钥、空会话和重启时存活进程的拒绝。TypeScript 类型检查通过。控制通道的 Node 测试使用模拟启动器响应，Rust 测试使用真实回环服务器和本机进程句柄；两者尚未组成已安装应用的实机成功路径。G1 保持未通过。

随包本机看板来源现由伴随服务提供：每次运行生成独立 URL 能力密钥，只允许该 URL 加载 HTML 和同路径资源；嵌入页面用该密钥调用浏览器会话代理，不能读取本机仓库映射或启动器归属端口。页面和资源带 `no-store`、`no-referrer` 与限制性的 CSP；服务工作线程不在嵌入页面注册。桌面打包准备会把 `dist/web` 放入运行时资源目录。聚焦测试新增 1 项验证页面、资源、浏览器代理可用和本机路径访问拒绝。最终准备目录中的 `companion.js` 与 `web` 资源已在独立 Chromium 中以随机端口实际加载：React 挂载、iframe 就绪握手均成功，资源请求失败数为 0；脱敏结果见 `.artifacts/acceptance/2026-09-25-embedded-smoke.json`。首次脚本因 Playwright 序列化 `tsx` 回调时缺少辅助函数而失败，修正验收脚本后复验通过；这不是产品页面失败。该独立浏览器结果不替代 Codex 宿主及已安装程序验收。

扩大无数据库测试首次执行为 88 通过、9 失败、15 项数据库用例按预期跳过。失败由新增前端能力识别在精简 `window` 替身下读取不存在的 `location`，以及服务器设置组件误经 Web API 模块引入 `import.meta.env` 的 IIFE 测试构建边界导致。已对缺失地址安全回退，并将能力识别移到独立模块；受影响的 14 项测试先单独通过，再重跑完整 `pnpm test`：97 通过、15 项数据库用例按预期跳过，退出码 0。首次失败及修复后的结果均保留在本节，不将首次运行计为通过。

最终 `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare` 和 `git diff --check` 均退出 0；Rust GNU 目标 13 项默认测试通过、1 项按实机条件忽略，该忽略项单独运行通过，确认本机 `26.917.9434.0` 在启动前被拒绝。本轮仍未执行已安装程序或真实受管理 Codex 成功路径，G1 未关闭。

## 2026-09-25：当前 Codex 版本的隔离宿主与安全草稿

本轮在已登录的独立 profile 中启动系统登记的 `26.917.9434.0`，重新绑定新 PID、进程创建时间、`127.0.0.1:9223` 监听者、唯一 `app://-/index.html` 页面及其 WebSocket。脚本与结果保存在忽略目录 `.artifacts/acceptance/2026-09-25-g1-current-host/`；每步操作前重新核对归属。主 Codex 实例未连接或修改。可见的唯一项目 ID 经隔离 `codex-home/state_5.sqlite` 唯一解析到当前仓库真实目录；宿主只有一个空编辑器、无弹窗。

源码验收基于未提交工作树，基线提交为 `0c1d38b`；这些结果尚未绑定冻结提交或 CI 产物，故不能用来关闭最终发布门槛。

`embed-result.json` 的最终执行通过：先用真实 `securitypolicyviolation` 确认 `frame-src` 拦截；适配器在受控 CSP 开启和重载后完成 nonce 就绪握手。真实 iframe 内 React 看板挂载，点击“列表”后出现“看板”切换控件；侧栏入口和主内容浮层各一个，浮层从原生 275px 侧栏右侧开始。“返回 Codex”隐藏看板；外部重载后自动恢复入口和浮层；退出后 owned 节点与入口均为零，实际策略事件再次确认 `frame-src` 拦截。第一次内部交互尝试停在登录页，随后使用随包本机看板的演示参数重测；这不是远程服务器或真实业务数据验收。

本轮同时修复随包页面带 `?demo=1` 时被本机资源鉴权拦截的问题，伴随服务回归 10/10 通过。宿主验收曾因测试归属检查启动 PowerShell 超过 3 秒偶发失败；检查上限改为 10 秒，实际仍逐次验证 PID、创建时间、监听者和精确页面。该失败轮次完成适配器清理，独立 CSP 探针确认恢复，未记为通过。

`draft-result.json` 的最终执行通过：目标路径错配、归属撤销、目标漂移和弹窗开启均拒绝并保持编辑器不变；随后在同一已验证项目中填入一条 33 字验收草稿，页面、项目及文档未切换，文字留在编辑器中且没有发送；再次填入因已有文字被拒绝，原文不变。草稿保留在隔离 Codex 窗口供检查。草稿能力现通过启动器私有会话取得隔离 `codexHome`，每次填写前验证真实目录、项目 ID、编辑器 DOM、空白、无弹窗及页面归属；若看板仍处于安装状态，先恢复 CSP 再填写，避免清理时重载未发送草稿。产品版本允许清单已加入 `26.917.9434.0`，原生启动器也只接受该当前版本；伴随服务的显式接入接口与桌面入口已开放。

这一轮的实机宿主由独立验收脚本持有启动记录，并非从新安装的 Taskboard 通过 Tauri 命令启动。新安装程序的私有控制端、已安装 WebView2 窗口、托盘退出与再次启动，仍需在真实安装包上联合复验；因新原生 profile 没有现成登录会话，不能沿用本轮 profile 的草稿结果冒充已安装程序成功路径。G1 的隔离宿主与草稿子项通过，G1 整体及 G2 仍未关闭。

最终源码检查：`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare`、`git diff --check` 均退出 0；`pnpm test` 为 98 通过、15 项无测试数据库而按预期跳过。其后新增“看板已安装时先恢复 CSP 再填草稿”的独立 Chromium 回归，聚焦测试 7/7 通过；第一次受同时进行的 Tauri 编译负载影响，独立 Chromium 的 `beforeAll` 在 60 秒超时，7 项测试正文均未开始，释放负载后原命令重跑通过。最终随包运行时的独立 Chromium 加载和 nonce 握手再次通过，资源错误数 0。便携式 MSVC 工具链的原生 `cargo test --locked -j 1` 为 13 通过、2 项按环境条件忽略；当前已安装版本发现测试单独执行通过，`cargo build --locked -j 1` 通过。GNU 工具链的首次尝试因缺少 `libgcc` 在依赖链接阶段失败，没有记作产品测试失败或通过。最终再次只读核对隔离窗口：PID 与端口归属未变、同一项目与文档、33 字草稿仍在、无弹窗或注入节点。

## 2026-09-26：已安装程序与受管理 Codex 联合验收（进行中）

从当前未提交工作树重新生成并以 NSIS 安装到 `.artifacts/acceptance/2026-09-25-g1-installed/中文 空格安装`。最新安装器为 `Codex Taskboard_0.1.0_x64-setup.exe`，24,590,920 bytes，SHA-256 `331BD6B2B283B3F3A94A9EF9A2B6D77C8AEC2A24B51A5AA28664FB2EC95E5BE0`，未签名；静默安装退出码 0，安装后的程序文件发生更新，随包 `companion.js` 与准备目录哈希一致。Node 22.16.0 和随包 `taskctl.cmd --help` 已执行。测试进程通过 `TASKBOARD_DATA_DIR` 与 `WEBVIEW2_USER_DATA_FOLDER` 使用仓库忽略目录下的独立数据；正常 `%APPDATA%\CodexTaskboard` 目录的修改时间保持在 2026-09-08。旧测试安装文件保留。证据在同一 `.artifacts/acceptance/2026-09-25-g1-installed/` 目录。

真实已安装 Tauri 窗口、WebView2 与随包 Node 的父子进程和独立 WebView 用户目录已核对；WebView 桥接能力、伴随服务 `/health` 200、协议版本 1、设备标识存在，页面错误数 0。真实窗口的关闭按钮会隐藏窗口，启动器及 47831 伴随服务继续运行；托盘“退出”入口尚未由自动化确认。

首次点击“启动独立 Codex”揭示两处原生 CDP 绑定缺陷：`/json/list` 返回完整 `Content-Length` 正文后保持连接，旧代码等待 EOF 而超时；随后发现 CDP 按请求 `Host` 生成 WebSocket 地址，旧请求未包含端口。这两轮均保留了仍运行的子进程且拒绝另起第二个实例；分别核对测试进程的 PID、创建时间、隔离 profile、监听者与唯一页面，确认编辑器、已选项目和弹窗均为零后，仅停止对应测试进程。修复改为按正文长度读取、发送带端口的 `Host`，并允许持有中的同一子进程在初次超时后重试绑定。保活响应及 Host 请求头有原生回归；默认 Rust 测试 14 通过、3 项按实机条件忽略。指定实机诊断对隔离 Codex 的真实端口分别确认监听 PID 与精确页面解析成功。

最新已安装程序从窗口按钮成功启动受管理 Codex：Taskboard PID 7348、WebView2 监听 PID 20348、伴随服务 PID 26260、受管理 Codex PID 24028；后者位于新建的隔离 profile，CDP `127.0.0.1:58805` 属于该 PID，只有一个 `app://-/index.html` 页面及匹配的 WebSocket。伴随服务经私有启动器会话报告 `draft: true`；当前尚无已验证项目页面，`projects: false`，未接入侧栏或填写草稿。

为验收真实任务按钮，已在同一忽略目录启动全新 PostgreSQL 集群和仅监听 `127.0.0.1:47830` 的测试 API。已安装 Taskboard 用合成账号登录，创建“隔离草稿验收”空间及 TB-1 测试任务，并经真实窗口把该任务的测试仓库地址映射到 `I:\ai\codex-taskboard`，保存后读回匹配。这些写入只针对隔离数据库及隔离伴随服务数据。等待用户在新 Codex 实例登录并选中或创建指向当前仓库的测试项目，再做侧栏、CSP、真实任务按钮、未发送草稿与退出重启验收。G1 整体及 G2 仍未关闭。

用户已在该受管理 Codex 实例登录并选中 `codex-taskboard`。实机复核再次确认启动器持有的 PID、创建时间、回环监听者、唯一主页面、项目 ID 到当前仓库真实目录的唯一映射，以及唯一空白编辑器、无弹窗和无 Taskboard 节点。已安装 Taskboard 的侧栏接入首次被 3 秒 CDP 命令超时拒绝；第二次重试仍因 CDP 命令超时失败，清理阶段的 CSP 关闭命令未在 3 秒内获确认，伴随服务按设计锁定接入。没有填写任务草稿。随后在再次确认启动器归属和空白编辑器后，对该精确隔离页面显式关闭 CSP 绕过并重载；真实 `securitypolicyviolation` 的 `frame-src` 拦截、零 Taskboard 节点和空编辑器证明 CSP 已恢复。证据见 `installed-csp-restoration.json`。当前已安装进程仍保持失败锁定，不能把本轮算作侧栏或草稿通过；G1 整体及 G2 仍未关闭。

针对该实机问题，下一构建将受管理 Codex 的 CDP 命令与清理时限设为 15 秒、宿主重载就绪上限设为 120 秒、iframe 握手设为 15 秒，并将原生归属查询的回环响应时限设为 4 秒。所有操作继续在超时或验证失败时拒绝，不放宽 PID、页面、项目或编辑器身份检查。新构建需重新进行已安装程序验证和用户登录，不能沿用本轮未通过的接入结果。

本次超时调整后的 `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare`、`git diff --check` 退出码均为 0；适配器 30/30、伴随服务 10/10、独立 Chromium CSP 生命周期 7/7 分别串行通过。最初并行测试因本机负载出现一项固定 6 秒参数断言不匹配、伴随服务用例超时及 Chromium 启动钩子超时；修正断言并串行复验通过，未把失败轮次计为通过。

新 NSIS 安装器 SHA-256 为 `8FD62243C762883616CFB64FFE302F7CB3EF1814F7432CF65503B1A73A0819B0`，24,587,132 bytes；隔离安装于 `.artifacts/acceptance/2026-09-26-g1-retest/中文 空格安装`，静默安装退出码 0，随包 `companion.js` 与准备目录 SHA-256 均为 `58BEC21BD858B3D16FCAC488E344E0E6FFA619FB07E29E7DC4D52901A6728536`。旧隔离 Codex 在空编辑器和 CSP 恢复确认后停止，旧伴随服务收到认证关闭请求并退出，旧 Taskboard 测试进程停止；均未动用户主 Codex 实例。

新包第一次用旧 WebView2 用户目录启动后，已安装窗口一度可见且启动了隔离 Codex，但随后 Taskboard 进程退出，原生归属随之中断。应用事件日志未找到对应崩溃事件；此轮不能算成功，首次 Codex 测试进程也已退出。再次用全新 WebView2 测试目录启动新包，窗口和本机 API 保持运行，合成账号重新登录并读到原测试任务。第一次原生绑定在 90 秒内未完成，稍后独立 CDP 只读核对见到唯一主页面；从同一启动器重试绑定成功，伴随服务通过私有通道报告 `draft: true`。新 Codex 仍需用户在隔离目录登录并选中当前仓库项目。原生 `CDP_TIMEOUT` 为 1.2 秒，首次绑定失败原因尚需在稳定负载下确认；侧栏及已安装草稿仍未通过。

用户随后在该新受管理窗口登录，并选中唯一的 `codex-taskboard` 项目。只读核验确认项目 ID 唯一解析到 `I:\ai\codex-taskboard`，PID 14184 的 `127.0.0.1:52511` 监听与唯一 `app://-/index.html` 页面保持绑定，编辑器起初为空。已安装 Taskboard 的“接入 Codex 侧栏”成功返回 `embedded: true`；真实 iframe 的 React 页面可操作，“列表”切换生效，外部重载后入口和浮层恢复，且未出现重复节点。接入前实际 `frame-src` CSP 拦截已记录。证据见忽略目录 `.artifacts/acceptance/2026-09-26-g1-retest/sideboard-installed.json`、`sideboard-verification.json`。这项已安装侧栏验收通过。

真实 TB-1 任务按钮第一次尝试后完成了侧栏清理和 CSP 恢复，但返回“草稿未写入”，只读检查确认编辑器仍空。第二次从同一空编辑器点击后，Taskboard 返回 `DRAFT_UNCONFIRMED` 的安全提示；只读 CDP 检查确认草稿实际留在同一项目的唯一编辑器中，包含测试任务 ID、标题和描述，`textContent` 为 125 字，SHA-256 `ff8eb49e0e734c4ec2a84010775daece2004262edf0a5ea38a5d901066055cbb`。编辑器由五个 `<p>` 段落组成，预期原文为 129 字、含四个换行；去掉换行后与编辑器 `textContent` 完全一致。现有适配器用 `editor.textContent === prompt` 判断写入，因段落换行不计入 `textContent` 而误报未确认。源码已改为逐段重建并精确比对，新增多段落浏览器回归；该修复尚未重新打包并在新的空白隔离编辑器上验收。

第二次尝试后没有再次点击填入，也未发送任务。只读复核确认页面和项目未切换、无弹窗、Taskboard owned 节点与入口均为零；真实 `securitypolicyviolation` 再次证明 `frame-src` 拦截已恢复，草稿仍在编辑器中。证据见同目录 `managed-inspection.json`、`csp-after-draft.json`。因此本轮证明已安装产品能安全写入并保留未发送草稿，但真实按钮的成功回执、重复填入拒绝和修复后安装包的完整闭环尚未通过；G1 整体仍未关闭。保留当前隔离 Codex 窗口供用户检查，期间不得重载、关闭或再次填入。

多段落修复的独立 Chromium 回归 7/7 通过，覆盖真实段落写入及已有草稿拒绝覆盖。默认 60 秒启动钩子的第一次执行超时、七项正文均未开始；以 `--hookTimeout=180000` 复验通过，未改变测试正文时限。`pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare`、`git diff --check` 均退出 0。完整 `desktop:bundle` 在 Cargo 阶段长时间无进展后停止；由于本轮未改原生源码，改用 Tauri 官方 `bundle --bundles nsis --ci` 打包既有原生程序及新资源，退出 0，不能将其记作新一轮 Rust 编译通过。

修复安装器 SHA-256 `372D5EE81AE75B43DA863DA7EDAD9BD3326729003D3C622E3C856A23543C7EBC`，安装到 `.artifacts/acceptance/2026-09-26-g1-draft-fix/中文 空格安装`，退出码 0。安装后与准备目录的 `companion.js` SHA-256 均为 `D1834852478BAC2F9E8C2B0F9000F2A9DB4EF679DDE2CA4C16BA5C8BBB15153B`。新 Taskboard PID 21636，伴随服务 PID 17088 与 WebView2 PID 19620 均为其子进程，分别监听字面回环 47831、9334；新 WebView2 隔离目录登录合成账号成功并读到 TB-1。安装证据见该目录 `install-result.json`、`launch.json`、`board-login.json`。

继续执行时，上一轮 Taskboard、测试 API 和 Codex 的精确 PID 已全部不存在，不能继续声称旧草稿仍保留在窗口。测试 API 在原隔离数据库重新启动。系统登记的 Codex 已更新为 `26.924.1866.0`，真实新包按钮显示“当前 Codex 安装包版本未通过受管理宿主验收”，且没有创建受管理 active 记录；`version-refusal.json` 保存了拒绝结果。允许清单保持不变，修复包的草稿成功回执仍未通过。为后续兼容性验证，在独立 `compat-26.924.1866.0` profile 与 Codex 数据目录启动了新版本测试实例；这由验收脚本持有，不能冒充原生启动器成功路径。需先完成新版本宿主验证，再更新允许清单并重新进行已安装程序闭环。

新版本隔离测试 PID 11972 的可执行路径、隔离 profile 命令行、创建时间及唯一 `127.0.0.1:9223` 监听者均核验通过，但 `/json/list` 持续为空、无主窗口。日志出现 `Desktop bootstrap failed to start the main app phase=bootstrap-import-main`，随后更新器初始化报告“该进程没有程序包标识符”；尚不能断言后者就是启动失败的根因。未出现主页面，未登录、未注入侧栏、未填写草稿或修改 CSP。保存日志及 `ownership.json` 后，再次核对进程创建时间和空页面列表，仅结束该隔离测试进程树，结果见 `compat-26.924.1866.0/cleanup.json`。后续需查清新版本独立启动契约与包身份要求；目前没有需要用户重复登录的可用测试窗口。新包多段落修复的完整实机闭环仍为未通过。

继续排查新版本：清除继承的 `CODEX_*` / `ELECTRON_*` 会话变量后，直接启动仍停在 bootstrap；Node `--inspect-brk` 未产生主进程调试监听，因此未取得最初异常。只读窗口枚举未发现独立错误对话框。另一个仅位于忽略目录的挂起进程原型尝试 Windows 包身份启动属性，创建阶段返回 Win32 575；加入保留包身份的桌面策略后仍失败，均未恢复执行任何子进程。以上不是通过项，也没有进入产品代码。失败且无页面的隔离进程经精确归属与空目标列表核对后清理。

改用 Windows 自带 `Invoke-CommandInDesktopPackage -PreventBreakaway` 后，隔离启动成功。辅助进程先核对自身包身份，设置独立 profile 与 `CODEX_HOME`，再启动新版本 `ChatGPT.exe` 并复核子进程包身份。实际 PID 21000，父辅助 PID 17496；子进程创建时间、可执行路径、独立目录参数及唯一字面回环 `9223` 监听者核对通过。CDP 唯一主页面 `DCE64A7B4227F079A56084667E13B939` 位于 `app://-/index.html`，只读检查显示“登录 ChatGPT”、零编辑器、零项目及零注入节点。证据在 `2026-09-26-g1-draft-fix/compat-official-package/` 的 `launch.json`、`binding.json`、`readonly.json`。没有复制用户凭据或修改安装包。已将精确匹配该 PID 的新窗口置前，请用户登录并选中当前仓库、保持编辑器为空。

此成功说明已找到可以继续新版本宿主验收的隔离启动方式；它尚未接入 Tauri 启动器。产品允许清单仍未改变，不能把辅助脚本的包身份验证冒充生产归属契约或已安装草稿通过。后续须验证新宿主，并为包上下文辅助进程与主 Taskboard 之间建立可验证的进程句柄和归属交接，再重新验收安装包。

## 2026-09-26：新版隔离宿主与多段落草稿复验

用户在包上下文辅助进程启动的 `26.924.1866.0` 隔离窗口登录并选中项目后，项目 ID `e70eb66a-0dc9-4b2b-be96-5cf0b97943c2` 经该独立 `codex-home/state_5.sqlite` 唯一解析到当前仓库。确认唯一空编辑器为 `P:BR`、无弹窗、无注入节点，PID 21000、创建时间、可执行路径、回环 9223 监听者及精确主页面均匹配。

新版 DOM 有两项实际不兼容：原 `.app-shell-left-panel nav` 同时匹配应用导航与项目导航；原 `.app-shell-left-panel + div` 匹配隐藏的 1×1 `role=status` 元素，实际左边界为 -1。候选脚本分别改用 `.app-shell-left-panel nav:not([data-app-navigation-rail])` 和 `main[data-app-shell-main-surface]`。第一次因 PowerShell 归属查询超时失败，已确认恢复 CSP；第二次布局检查拒绝，清理后再次确认 CSP 恢复。失败证据为 `embed-attempt1.json`、`embed-attempt2.json`。验收辅助程序改为调用 Windows 进程与 TCP 表接口逐次核对创建时间、可执行路径和监听归属，避免每步启动 PowerShell 的开销；产品原生归属检查没有替换为测试凭据。

最终 `embed-result.json` 通过：初始实际 `frame-src` 拦截存在；安装后仅一个入口与浮层，侧栏右边界 340、看板左边界 341；真实 iframe React 演示页面及列表切换可用，“返回 Codex”隐藏看板；外部重载恢复；退出后零入口、零 owned 节点、空编辑器，真实 CSP 拦截恢复。此为隔离宿主和随包演示页面验证，不是已安装 Taskboard 的业务按钮验收。

随后 `draft-result.json` 通过：项目错配、归属撤销、页面漂移和弹窗均拒绝并保持原文；同一项目唯一空编辑器填入含两个空行的三段测试草稿，按五个 `<p>` 重建后的原文完全匹配，适配器成功返回，同一文档和项目未改变。已有文字时第二次调用拒绝，原文不变。测试草稿文本节点共 49 字、另有四个换行，保持未发送；没有发送或执行测试任务。当前窗口含草稿，不得再重载或关闭。该结果验证了此前多段落确认误报的修复。

本次脚本仅在测试进程中临时加入候选版本，实际通过后才将 `26.924.1866.0` 加入 TypeScript 宿主允许清单，并以版本化 `codexHostMarkers` 接入已验证的选择器；旧版选择器保持原样。原生 `VERIFIED_VERSION` 仍为旧版，故已安装产品仍拒绝启动新版，这是尚未完成包上下文启动器及持有句柄交接的门槛，不能以本节关闭 G1。下一步为原生启动归属整合及新安装包业务按钮、退出重启闭环。

证据和脚本位于 `.artifacts/acceptance/2026-09-26-g1-draft-fix/`。只读结果仅记录项目标记、字符数和匹配结论，不记录用户会话正文。

源码接入后的验证：独立 Chromium 8/8（含新版双导航区与隐藏状态节点回归）、适配器 30/30、伴随服务 10/10 通过；`pnpm typecheck`、`pnpm lint`、`pnpm build`、`git diff --check` 退出 0。Vite 仍有既存单 chunk 超过 500 kB 的提示。最终只读复核见原页面、原项目、49 字草稿及五段落仍在，零弹窗、零注入节点。未重新打包新版选择器，因为原生新版启动归属尚未实现；当前已安装修复包与本轮最新源码不等价。

## 环境与通过项目

最新实机进展：当前 `26.917.9434.0` 的隔离宿主已通过真实 iframe 内部交互、外部重载恢复、退出后实际 CSP 拦截恢复和安全草稿成功及拒绝路径；已安装程序的侧栏也已通过，但多段落草稿的成功回执仍待修复包复验。历史 `26.901.5280.0` 及早期失败记录保留在[宿主验证记录](codex-host-verification.md)。完整已安装程序与远程业务闭环尚未验收。

本机 Windows x64，Node 22.16.0、pnpm 10.28.0、Chrome。数据库采用项目目录内独立 PostgreSQL 18，测试只使用隔离的测试库；未连接用户生产数据库。Compose 与 CI 目标数据库为 PostgreSQL 17，Linux 环境仍需 CI 验证。

| 项目                    | 结果与证据                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| 类型与静态检查          | `pnpm typecheck`、`pnpm lint` 通过                                                                           |
| 核心、API、伴随服务测试 | 8 个测试文件，36 个用例；包括真实 PostgreSQL 集成测试，非内存替代数据库                                      |
| 空间权限                | 跨空间任务 ID、详情、列表、导出拒绝；只读成员写入拒绝；外部负责人拒绝                                        |
| 并发及幂等              | 同时领取仅一次成功；重复创建重放原响应；同键不同正文冲突；数据库故障注入证明业务写入与幂等记录一起回滚       |
| 所有者与设备            | 所有者保护；转移和删除状态的重复请求重放；恢复遗留领取后旧执行不能提交；退出触发 SSE 撤销                    |
| 伴随服务边界            | 未配对与不可信来源拒绝；浏览器与 CLI 独立能力凭据；浏览器代理原始写入、查询参数；退出撤销及清除凭据          |
| 浏览器端到端            | 1280×800 和 1920×1080：演示搜索/切换/设置；真实账号登录、创建空间及任务、双会话同步、冲突草稿保留和刷新恢复  |
| 任务生命周期            | 两个浏览器会话完成领取、提交结果与验证记录、人工验收；离线禁用领取与保存                                     |
| 同步延迟                | 正常本机网络下，另一会话的任务更新通过 2 秒内可见断言；不是互联网延迟 SLA                                    |
| 生产入口                | `scripts/check-production.ts` 在空 PostgreSQL 库运行编译后的 migrate/admin，验证实际创建唯一实例管理员       |
| 构建与依赖              | Web/Node 构建通过；生产依赖审计无已知漏洞；历史上曾执行 `pnpm deploy` 整理生产依赖，但这不是冻结依赖安装证据 |
| 桌面运行时              | 打包准备脚本包含 Node、CLI、Skill；随包 `taskctl.cmd --help` 已执行。此项不代表安装器或桌面窗口通过验收      |

测试入口见 `tests/`。`pnpm test` 在缺少 `TEST_DATABASE_URL` 时会跳过数据库测试；不能把这种运行当作完整集成验收。使用 `pnpm test:db` 或指向独立 `*_test` 数据库后运行。Playwright 在提供测试数据库时启动独立预览 API。

## 视觉交付

用户于 2026-09-07 确认当前展示版本：参考 iOS 26 磨砂玻璃的半透明工具栏和浮层、蓝色强调色、宽松卡片间距和右侧详情抽屉，支持浅色、深色与跟随系统。后续功能实现保留这版视觉方向。截图均为合成数据：

- [浅色看板](screenshots/board-light.png)、[深色看板](screenshots/board-dark.png)、[1280×800 深色](screenshots/board-compact-dark.png)
- [任务详情](screenshots/task-detail.png)、[空间管理](screenshots/space-settings.png)、[首次连接](screenshots/first-connection.png)
- [空状态](screenshots/empty-state.png)、[冲突草稿](screenshots/conflict-state.png)、[离线状态](screenshots/offline-state.png)

`pnpm exec tsx scripts/capture-ui.ts` 生成四个核心页面和主题截图。真实协作 E2E 生成空、冲突、离线截图。

## 尚未通过的发布门槛

1. **P0 / P3：Codex 实机闭环。** 当前版本的隔离宿主已通过看板内部交互、CSP 生命周期和未发送草稿；仍需从新安装的 Taskboard 启动受管理 Codex，并联合验证私有归属通道、登录后的项目映射、草稿及退出重启行为。`openThread` 仍关闭，远程任务闭环尚未验收。
2. **Windows 安装包。** 完整 MSVC release 测试 8/8、release 编译和 NSIS 打包通过。独立中文空格路径的真实窗口通信、重复启动恢复、认证关闭及端口冲突诊断通过；NSIS 安装文件和注册项已核对。自动启动验证曾被审批拒绝，其后用户手动启动的安装程序、随包 Node、WebView2 和回环监听归属已确认，真实窗口显示登录页。完整安装后功能、真实托盘退出及卸载保留数据仍未验收，安装器最终退出码未捕获。
3. **Docker 部署和恢复。** 隔离 Debian 12 测试机已安装 Docker Engine 29.8.0 与 Compose v5.5.1；使用既有 Linux 镜像的显式 slow/reuse attempt 5 已通过真实 Compose 部署、健康、bootstrap/login、空间任务、备份、干净库恢复和重启核对，且完成清理。HTTPS attempt 2 的内部 CA、重定向、安全 Cookie 和两次 SSE 重连断言均已通过，cleanup 完成且 runner 退出码为 0。它们不证明默认时限、两秒 SLA 或公网 Let's Encrypt。Dockerfile 的冻结离线生产依赖安装已在镜像构建中运行；升级回滚及本轮快照之外的桌面适配器变更仍未通过验收。恢复脚本会重建数据库；只在独立部署环境演练。
4. **桌面实时同步实机验收。** 桌面 UI 已改为通过伴随服务接收 SSE，包含重连和缓存只读回退；仍需真实 Tauri 窗口与两台设备验证约 2 秒更新。结果草稿仍需用户联网核对后提交，不自动覆盖远程修改。
5. **最终发布与维护检查。** Windows 安装器、镜像、SBOM、校验和及构建来源证明尚未由 CI 实际产生。主仓库 ruleset、环境审批及签名配置由维护者管理，本次没有改变 GitHub 设置。

后续应完成 P0 项目草稿契约和受管理 Codex 实机验证，再完成安装后运行、托盘退出、卸载保留数据、多设备及升级回滚验收。Linux 部署与恢复演练沿用已通过的记录。以上项目通过之前保持开发预览，不创建正式 Release。

## 2026-09-09 桌面服务器连接增量

- 登录页增加服务器地址读取、显式保存和锁定提示；未保存或正在保存时阻止登录。已有 Agent 登录只锁定地址编辑，仍允许桌面登录同一服务器。首次未登录的 401 不再作为红色错误展示，真正登录失败和其他网络错误仍会展示。
- 新设置接口要求可信 Origin 和桌面能力凭据，拒绝 CLI；输入校验返回明确的 400。地址仅接受 HTTPS 或本机回环 HTTP 根地址。地址写入、登录与退出串行处理，持久化完成后才切换运行中的远程连接。
- 聚焦测试通过：服务器设置及持久化 8 项（最终执行 `66363`，退出码 0）、既有账号分区存储 3 项（`73687`，退出码 0），以及独立 Chromium 连接组件 5 项（最终执行 `29589`，退出码 0）。覆盖写失败后排队保存与重启、启动配置优先级、两个方向的登录并发、拒绝更改后草稿及待提交结果保留、未保存阻止登录和失败重试。最终补充尾部空白不应误锁登录的回归。凭据层使用测试替身，不是 DPAPI 或真实安装包证据。
- 完整生产 Web 登录页使用独立 HTTP 服务和桌面连接模拟，验证保存失败保留输入及密码、保存成功清密码、实际登录请求使用新地址，以及正常未登录和网络错误的不同展示。1280×800 浅色、1920×1080 深色和 390px 窄窗口检查通过，无页面脚本异常或横向溢出。证据 `.artifacts/server-onboarding-1788956666121/result.json`，执行 `92241` 退出码 0；截图见 [桌面使用说明](desktop.md)。此前两次测试模拟初始化失败，未将其计为通过；修正隔离脚本后复验通过。
- 适配器 25 项、独立 Chromium iframe 8 项及 CSP 生命周期 4 项联合回归全部通过（`72872`，退出码 0）。此前超时的 iframe React 用例本轮也通过；不能将独立浏览器证据等同于真实 Codex 兼容性验收。
- 最终源码的完整类型检查、lint 与 Web/Node 构建均通过（顺序执行 `57971`，退出码 0）。收尾时曾发现测试引用了错误的 Fastify 重载返回类型，修正为明确的 Promise 响应类型后复验通过。仍有现有单个前端 chunk 超过 500 kB 的构建提示。新源码尚未重新生成安装包，版本保持开发预览。

## 2026-09-07 增量验证（历史）

- 已确认磨砂玻璃 UI；保留舒展间距，浅深主题、390px 窄窗口和详情可读性已检查。
- 真实 PostgreSQL 权限、并发与核心测试：19 项通过。真实浏览器 E2E：6 项通过，覆盖两个视口、双会话同步、冲突草稿、领取、提交及验收。
- `pnpm test:offline` 使用生产构建与全新隔离数据库，关闭 Chrome 持久配置后以断网模式重新启动。看板、空间和本地草稿恢复、写操作禁用、联网恢复以及设备撤销后再次断网重开不泄露旧缓存均通过。
- 浏览器离线重开需要此前联网访问、成功缓存页面资源；缓存是未经重新验证的只读副本，不含完整评论、活动和执行历史。已知撤权会清理对应数据，断网期间无法获知服务器上的新撤权。
- `scripts/check-production.ts` 再次在全新数据库验证编译后的迁移和首次管理员初始化；生产依赖审计无已知漏洞。
- 认证切换改为完整串行操作，账号请求在切换期间被明确拒绝；延迟凭据写入后排队失败登录的回归测试通过。普通权限拒绝保留有效会话，缺少浏览器凭据也不会注销 Agent。类型检查、lint、Web/Node 构建及桌面运行时打包准备通过。
- SSE 的真实回环 HTTP 测试通过：可信 Origin 响应头、独立浏览器能力凭据、缺少 Agent 凭据时保留浏览器会话，以及客户端断开后取消上游流。测试替身只模拟远程 API，不替代真实 Tauri/WebView2 验收。
- Skill 安装器拒绝覆盖整个已有目录；在隔离的测试用户目录执行保护检查，已有文件保持不变，未安装到真实用户目录或修改用户环境变量。
- 桌面构建命令与 CI 统一；草稿发布工作流针对固定标签提交执行 PostgreSQL 17、浏览器和离线测试门禁。仅准备流程，尚未在 GitHub 执行打包或发布。
- 本次增量验证时尚无 Rust/MSVC、Docker 和受管理 Codex CDP。`pnpm desktop:diagnose` 返回 `unavailable`，没有重启或注入当前 Codex。后续构建工具进展见下节。

## 桌面构建与部署门禁阶段

- Windows 启动器等待本机伴随服务通过携带本次随机能力凭据的健康检查后才显示主窗口。初始化失败记录诊断并回收已启动的子进程；关闭应用时同样回收。此处的自动化检查不等于安装器实机验收。
- CI 增加 Windows 锁定依赖的 Rust 测试、Tauri 构建及未发布安装包产物；草稿发布采用相同门禁。工作流尚未推送或在 GitHub 执行。
- Linux 部署演练使用独立 Compose 项目、临时配置和专属卷，包含管理员初始化、任务写入、备份、修改、恢复及重启后数据核对。它不读取部署的 `.env`，不操作已有部署卷，也不覆盖公网 HTTPS 验证。**历史记录：** 当时环境没有 Docker，演练未执行；当前 HTTP 演练结果见 [部署验证记录](deployment-verification.md)。
- **历史记录：** 早期 GNU-host `cargo check --locked` 在 Tauri 2.11.5 构建脚本以 `0xc0000005 / STATUS_ACCESS_VIOLATION` 退出。后续隔离 MSVC host 已完成检查、完整测试、链接和 NSIS 打包；当前安装验收边界见下节。
- `ready.rs` 用独立 `rustc --test` 编译执行，6 项通过，覆盖真实回环 TCP 的随机凭据、认证失败、无响应超时和慢速持续响应的总时限。未把这些结果等同于完整 Tauri 编译通过。
- 容器构建已补齐安装前的全部 workspace manifests；备份文件使用唯一名称，并在失败时清理半成品。隔离的 shell 测试以 `pg_dump` 替身验证两个并发备份均保留、失败不残留文件；该测试不证明真实数据库备份恢复可用。
- CDP 适配器 9 项测试通过，覆盖无响应握手的连接释放、协议命令超时、启用 Page 事件后重载恢复及安装失败清理；连接测试使用真实回环 WebSocket 服务模拟协议，不代表 Codex 实机内嵌通过。传输依赖锁定为修复已知漏洞的 `ws@8.21.3`。
- 最终类型检查、lint、生产依赖审计、Web/Node 构建和桌面运行时打包准备通过；Vite 仍提示现有单个前端 chunk 超过 500 kB。部署脚本经 Git Bash 语法检查通过，CI 失败日志上传仅包含 Compose 日志，不包含会话 cookie 或数据库备份。

## 2026-09-08 实机验收推进

- 用户已完成独立 Codex 测试实例登录，已观察到原生侧栏和空白新任务编辑器；测试实例项目列表为空，创建项目对话框已打开。待用户完成本机测试项目设置，并明确决定是否临时放宽该测试页面 CSP，才可继续对应实机步骤。已安装看板也由用户手动启动，窗口和资源路径确认结果见 [桌面版记录](desktop.md)。

- 内嵌页面就绪握手源码增量：适配器聚焦测试 22/22、独立 Chromium 测试 7/7 通过，Astra 已复核场景实际触发；最终完整 `pnpm typecheck`、`pnpm lint` 与 Web/Node 构建通过。真实浏览器测试覆盖跨来源 React 挂载、CSP 拦截、错误消息、取消和导航/节点移除竞态，详见 [桌面宿主验证记录](codex-host-verification.md)。此增量晚于下述安装包，尚未打入 NSIS，也不代表 Codex 内嵌通过。

- NSIS `Codex Taskboard_0.1.0_x64-setup.exe` 已生成（24,401,145 bytes，SHA-256 `45263CB7B1F71AE0CE8F0C114E68B7B9B7B486D98A2F2E9F8403BAE50C6D9AAB`，NotSigned）并在隔离中文空格路径完成 `currentUser /S /NS` 安装文件与注册核对。安装后运行命令被自动审批以 `blocked by policy` 拒绝，整条命令未执行；不能绕过。安装后运行、卸载保留数据和托盘退出仍待用户手动启动已安装 exe 后验收。

- Windows 真实 smoke：中文路径 launcher PID 16196、WebView PID 11320 和 Node PID 21120 的精确路径、进程树、ticks、独占回环 9334/47831 已核对。IPC 测试会话 12353 exit 0，结果为有效 bridge、health 200、protocol 1、设备标识存在且无页面错误；证据 `.artifacts/webview-verification-1788854094565/result.json` 与 `window.png`。Alt+F4 隐藏窗口但服务仍在；第二次同环境启动 PID 14388 exit 0 并恢复原窗口。页面 IPC `/internal/shutdown` 返回 202 后 Node 退出、47831 释放（测试 62213 exit 0）。端口占用测试报告认证健康检查失败，未接管其他监听者，未遗留伴随服务。托盘 UI 未出现在自动化窗口列表，托盘退出未验收；随后 launcher 仅为清理而被精确核对后停止，不能称正常托盘退出。此 smoke 使用直接 Cargo 编译产物，不替代已安装程序验收。

- Windows MSVC host 工具链执行 `cargo check --locked -j 1` 成功。构建工具仅位于忽略目录，未修改系统 PATH；SDK/CRT 构建工具不随产品分发。后续完整测试、链接、窗口和 NSIS 证据分别记录，未以 cargo check 替代这些验证。
- 已在本机启动独立的真实 Codex `26.901.5280.0` 测试实例，验证新进程、独立数据目录、回环 CDP 监听归属及原实例继续运行。未复制凭据，测试实例停在登录页面。
- 实测 Codex 的 CSP 拦截本机看板 iframe；未启用策略放宽。实际侧栏交互、项目识别和草稿填入仍未通过，详见 [桌面宿主验证记录](codex-host-verification.md)。
- 隔离 Debian 测试机已可通过密钥认证 SSH，磁盘和 swap 容量核验通过；Docker Engine 29.8.0 与 Compose v5.5.1 已安装并运行。**历史记录：** 当时部署演练尚未完成；当前 HTTP 演练结果记录在 [部署验证记录](deployment-verification.md)。
- 适配器聚焦测试 22/22 通过，增加精确 `targetId`/URL/WebSocket 绑定、连接后只读核对、重载漂移停止和脚本同步 URL guard；缺少启动器提供的绑定即拒绝注入。端点要求同一字面回环地址、有效端口与对应协议，并拒绝重定向和重复 ID。测试使用协议替身和 `node:vm`，不代表真实所有权、侧栏、iframe 就绪、项目定位或草稿能力已实现；未经授权的 CSP 放宽仍未开启。
- 伴随服务正常退出路径新增认证、流关闭及适配器清理。新增测试通过真实回环 HTTP 验证 CLI 请求返回 403、桌面请求返回 202，适配器清理仍在等待时响应已到达，清理仅执行一次且最终端口关闭；单项退出码为 0。释放 VM 资源后，`pnpm exec vitest run tests/desktop.companion.test.ts` 完整运行通过 8/8（测试 116,312 ms，总计 126.43 s，退出码 0）；此前两个 Windows/DPAPI 超时未通过增加测试超时而解决。
- 上述适配器及测试修改后的 `pnpm typecheck` 已重新执行并以退出码 0 通过，`pnpm lint` 也已通过。新增测试曾暴露替身参数类型错误，修正后再次通过类型检查；未以 Vitest 通过代替类型检查。较早一次辅助脚本生成的退出码文件与错误日志不一致，未采用该文件作为通过依据。
- 最新 Web/Node 构建与桌面运行时重新打包准备通过；随包 Node `v22.16.0` 与 `taskctl.cmd --help` 已重新执行成功。完整 MSVC `cargo test --locked -j 1 --release --manifest-path apps/desktop/src-tauri/Cargo.toml` 已通过（优化编译 37 分 29 秒，完整 `main.rs` 测试可执行文件 8/8 通过、1.02 秒），不是仅独立 `ready.rs` 测试。它不等价于程序启动、WebView2 或 NSIS 安装器验收。匹配的 release `cargo build --locked -j 1` 已于 10 分 03 秒通过并生成 `apps/desktop/src-tauri/target/release/codex-taskboard-desktop.exe`；真实窗口 smoke 已通过，NSIS 已生成并完成隔离安装检查；安装后运行、卸载保留数据和托盘退出仍待验收。
- `ready.rs` 使用 MSVC host 的 `rustc --edition=2021 --test` 编译为 Windows 可执行文件并运行，8 项真实回环 TCP 测试通过（退出码 0）。新增验证覆盖带认证头的关闭请求、收到 202 头后无需等待对端关闭，以及慢速响应不能延长总截止时间；此项仍不等于完整 Tauri 程序或安装器验收。
