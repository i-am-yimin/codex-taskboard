# 开发预览验收记录

<!-- current-acceptance-status -->

## 当前验收结论（2026-10-18）

候选提交：`f6a363e1779db36c97332725bdc433260c5ef366`，版本及标签：`0.1.0` / `v0.1.0`。**初版可用的开发预览验收已完成，G0–G4全部通过。** Windows安装包仍为 **NotSigned**；Release保持草稿。

| 门槛 | 当前结果 | 对应证据 |
| --- | --- | --- |
| G0 基础与 CI | 通过，12条件 | `g0-verdict.json`，CI39038428500 |
| G1 实际 Codex、内嵌自适应、安全草稿与正常重启 | 通过，22条件 | `installed-g1-complete-verdict.json` |
| G2 两台实际安装程序的安装、读写与保留数据 | 通过，17条件 | `second-device-g2-complete-verdict.json` |
| G3 双设备生命周期、冲突、离线恢复与撤权缓存清理 | 通过，17条件；实际第二台与本机模拟范围分别注明 | `installed-g3-complete-verdict.json` |
| G4 部署与发布准备 | 通过，20条件 | `g4/g4-complete-verdict.json`，发布运行39100683953，attempt2 |

总判定：`.artifacts/acceptance/2026-10-17-ci-f6a363e/initial-preview-acceptance-verdict.json`。同目录的`initial-preview-acceptance.md`为可读摘要。仓库两条ruleset、release审批环境和v0.1.0标签均已配置并读回核对；同提交CI生成的Windows安装器、Linux镜像、SPDX SBOM及SHA256SUMS均已验证摘要，五项草稿资产的来源证明覆盖四种唯一文件摘要，source/signer均为完整候选SHA。

本次草稿作业首次因附加Docker构建记录的非ZIP格式失败；精确保全诊断后仅移除该附加CI产物、重跑失败打包作业，正式构建产物及标签保持。排除 `*.dockerbuild` 的永久修正随本次仓库收尾提交，属于后续工作流修正，未纳入本次不可变标签。Windows重建主程序仅28字节时间戳/CodeView GUID元数据不同，其他全部字节及13个运行文件一致，不声称逐字节可复现；GitHub规范化Windows文件名的校验操作已在草稿说明中记录。HTTPS为内部CA验收。公开发布为后续维护者决定。

可复核的交付摘要与资产校验值见 [0.1.0 验收摘要](acceptance-0.1.0.md)。下方按当时情况记录的待办和受阻结论属于历史；当前结论以上方表格为准。仓库收尾将已验收的九个提交与默认分支工作流登记提交合并，另行运行合并 CI；这不重新计算已固定候选的实机门槛。

<!-- /current-acceptance-status -->

### 2026-10-20：v0.1.1 新包与日常安装升级

固定 `v0.1.1`（`c71eb870829371835e2b4ea9f3125f120f552d1e`）实际发布包已完成真实旧 companion 保存数据的 0.1.0→0.1.1 NSIS 升级、首次启动登录/8 张任务/旧编辑 version 2/映射保留，以及 Codex `26.1013.4894.0` 的正式启动与侧栏按钮、742 / 1920px 布局冒烟、草稿成功/拒绝、外部刷新、实际 CSP 恢复和正常重启保留。合成草稿、账号、缓存和专用数据库已清理；测试桌面及 companion 均正常退出 0。

原日常安装已由同一新包升级到 0.1.1，原三张离线缓存任务、凭据、数据语义、服务器及默认 WebView 保留，遗留测试快捷方式已备份后修正。日常 Codex 保持；原程序与 Taskboard 数据回退备份保留。五项资产的摘要及严格 GitHub 来源证明通过，发布保持草稿预览，Windows 未签名。失败记录与范围见 [0.1.1 验收](acceptance-0.1.1.md)及[结构化判定](acceptance/v0.1.1-verdict.json)；固定 `v0.1.0` 资产和既有结论不变。

### 2026-10-20：92873ed 精确宿主安装版兼容增量

`92873edce89d4677b7180e9ff82422bd4873fbb3` 的 CI NSIS 候选已在 Windows x64 实际安装验证 Codex `26.1013.4894.0` 的正式启动和侧栏入口、nonce、交互、三种原生窗口宽度、草稿成功/拒绝、外部重载与实际 CSP 恢复，以及正常宿主退出/重启保留。实际旧载荷安装后由候选覆盖，候选运行文件精确还原、数据字节保持；冷启动无需重新登录/刷新，8 张任务、编辑版本和仓库映射保留。托盘恢复为用户报告，自动观察超时和后续 OS 退出核对分别保留。合成草稿、账号、缓存与专用数据库已清理；最终桌面/伴随服务正常退出码均为 0，日常程序、原 3 张离线缓存任务、数据/凭据和注册信息已恢复核对，日常 Codex 保持。此次安装版兼容验收通过，[结构化判定](acceptance/host-26-1013-verdict.json)保留证据摘要。

详情、安装包摘要、失败原件和范围见[安装版兼容验收](acceptance-host-26-1013.md)。安装器仍未签名；本轮是后续兼容候选，不修改上方固定 `v0.1.0` 的 G0–G4 结论、标签和草稿资产，不重新声称双设备或 Linux 验收。

### 2026-10-07：29aa095 登录后侧栏、宽布局、拒绝路径与重载复验取得实际证据

用户确认本机已就绪、第二台新版首次显示为看板。本机独立宿主的进程/创建时间/端口/精确页面归属保持，实际选中一个项目，唯一编辑器为空，无弹窗；项目身份、本机仓库映射及原 TB-2（version2/原状态）经已安装伴随服务核对一致。安装版正式设置入口已实际接入侧栏，真实 iframe 就绪，加载新候选 JS/CSS。首次 iframe 恢复此前选中的专用读写空间；实际切回原验收空间后，935px 内容区的看板与列表都显示十任务，筛选器完整，无横向溢出。现有错误目录、未映射仓库、缺失目录及无法验证会话路由请求均明确拒绝，宿主观察面保持，临时本机映射恢复。

在精确绑定页面使用诊断 Page.reload，真实安装适配器恢复侧栏/iframe 就绪，项目和空编辑器保持；正式 Tauri 启动命令重复调用复用同一独立进程，没有新增实例。此处只关闭对应子检查，不关闭整个 G1。

后续桌面缩放没有改变实际 1280px 原生窗口；一次任务点击打开 TB-1 而非预期 TB-10。重新选择窗口及重置 Computer Use 会话后，截图仍显示左上角系统菜单。精确原生页面的临时点击观察器在一次入口点击期间未收到页面点击事件，侧栏展开状态未改变；监听器已清理、编辑器仍为空。该现象记录为界面控制未确认，未据此认定产品故障或把窄布局计为通过。草稿成功/完整拒绝与清理、窄布局、正常宿主退出/重启仍待复验。

第二台首屏用户反馈已记录，尚未收到新候选的七项文件及默认缓存运行归属 JSON，未创建新生命周期任务。共享 API 保持原进程，G0 已通过，G1/G2/G3 为部分进展，G4 未进入。

证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/` 中的 `resume-after-human-readiness.json`、`installed-g1-current-data.json`、`installed-g1-sidebar-wide-open.json`、`installed-g1-responsive-wide-board.json`、`installed-g1-responsive-wide-list.json`、`installed-wrong-project.json`、`installed-g1-other-refusals.json`、`installed-g1-external-reload.json`、`installed-g1-duplicate-start-ipc.json`、`native-control-click-diagnostic.json` 及 `current-progress.json`。

### 2026-10-07：29aa095 安装版 CLI 只读预检通过，第二台时间测量工具已验证并补发

新候选随包Node22.16.0及CLI已复用升级保留的Agent配对。当前浏览器合成账号HTTP200、本机仓库映射、deviceId指纹、七项安装文件pins一致，CLI实际读取原空间十张任务及受保护TB-2（version2/原状态）；没有重新登录或写任务。新候选生命周期preflight实际退出0，保存新任务幂等键和十任务基线，taskId仍为空；尚未执行创建、领取或提交。首轮映射探针因工具未统一目录分隔符而拒绝，保留失败后只修正比较逻辑，未修改映射。第二台只读检查器首轮本机验证因把正式启动的Codex package-helper算成第二个桌面主进程而拒绝；修正主进程筛选且保持Node/WebView父子及创建时间验证后退出0。本机使用专用WebView目录，defaultWebViewDirectory=false明确保留，不冒充第二台默认缓存通过。

新增只读HTTP Date多次采样的服务器与观察端时间差区间。首次本机20次实际健康GET全部正常，时间差边界[-58,25]ms、区间宽83ms；它是服务器时间校准，不是两台电脑已同步。新增计时观察器记录任务serverUpdatedAt、卡片在视口内的状态、页面timeOrigin和墙钟/单调时钟差，结束后再次校准；按区间计算首次匹配卡片及缓存版本的保守可见耗时上界，仍要求CLI响应时间与服务器时间一致。1.5秒、2.5秒、卡片不在视口、观察期间重载及缺少结束校准五个边界校验均通过。没有据此关闭约2秒实际指标。

计时包装器在真实安装版运行15秒，实际退出0、complete/passed=true、归属和精确页面保持、前后校准有效，区间宽分别115和119ms；未刷新、未写任务或制造网络故障，原空间十任务已同步。trackedTasks/trackedCards及实际延迟断言均为空，所以没有生命周期/延迟/离线/撤权通过证据。运行中检查点探针读取时观察器已结束，passed=false原样保留，没有重复跑短观察来改写它。新只读就绪及计时工具共五文件已Taildrop补发，退出0；第二台执行仍未核对。

一次Computer Use截图与目标不一致时未点击，重新查询唯一安装路径窗口并激活后Taskboard截图和树一致。主聊天未输入或修改，原API未重启。本轮结束前再次实测独立Codex仍在登录页且无项目；本机用户登录/打开项目和第二台新候选升级首屏反馈仍待取得。29aa095 G0通过，G1–G4未整体通过。

证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/installed-g3-cli-readiness-A.json`、`installed-device-A-readiness.json`、`installed-g3-lifecycle-A-preflight-2026-10-07T05-13-13-504Z.json`、`device-A-server-clock-calibration.json`、`timing-boundary-validation.json`、`timed-observer-live-validation.json`、`timed-observer-live-validation-assessment.json`、`timed-observer-live-checkpoint.json`、`taildrop-additional-readiness-timed-tools.json`及所保留的首轮失败。


### 2026-10-07：29aa095 已安装并首次加载正常，安装窗口读写与托盘恢复已复验

用户正常托盘退出旧候选后，原桌面、随包 Node 及47831/9334均释放，未调用强制停止。已校验CI安装器安装29aa095，安装退出0；原state、浏览器会话、Agent配对和CLI key的字节/哈希在安装前后完全保持，原WebView缓存保留。安装后生成七项实际文件pins，首次启动绑定新桌面/随包Node/WebView2归属及唯一精确页面，未刷新首屏。窗口先恢复先前选中的旧读写验收空间；切到原“桌面隔离验收”后十张任务可见且已同步，TB-10为version4/done。此行为与先前保存的选中空间一致，未误报首次启动自动选中了十任务空间。

实际已安装TB-10详情宽580、clientWidth/scrollWidth均563，五条activity记录及子项无横向溢出，使用新版JS/CSS资源。只读探针最初缓存键名错误、tsx浏览器函数辅助名错误及活动选择器错误均保留记录；修正验收工具后实际退出0，未写任务或重载，不把工具错误当成产品故障。

在实际Windows窗口另建29aa095专用合成空间和任务并修改标题。只读网络观察捕获三次真实POST/PATCH，均HTTP200；创建版本1，修改If-Match=1返回版本2，三次均有幂等键，最终卡片和编辑值一致，观察退出0。一次按钮点击因保存按钮处于可视窗口外被Computer Use拒绝，滚动后单次保存成功。关闭窗口后原进程与端口仍存活，Tauri原生is_visible=false；再次启动恢复同一进程/页面，is_visible=true、timeOrigin保持，任务版本2和标题保持。WebView document.visibilityState仍为visible，未以它冒充原生窗口隐藏证据。正常托盘退出/冷重启、卸载重装仍待新候选复验，G2整体未通过。

从本候选正式按钮启动新独立Codex，MSIX26.928.1915.0（Electron产品版本154.0.8037.57）及新profile/进程/私有helper/回环端口/唯一页面归属一致；主聊天保护实例保持。新独立窗口仍在登录页，未操作认证或项目权限提示；G1侧栏/草稿完整复验待用户登录、打开目标项目并保持空编辑器。

同CI安装器、第二台升级和诊断启动脚本、七项pins及连续G3观察工具共六文件已Taildrop发往codex-server，传输退出0；升级脚本固定安装器SHA256、目标目录并保留默认数据/缓存，任何运行中进程或占用端口即拒绝，未暗中清理。第二台收到/升级/首次正常启动尚未核对。29aa095同提交G0已通过；G1/G2为上述部分结果，G3/G4仍未通过，不沿用0748f67旧门槛。

证据目录：`.artifacts/acceptance/2026-10-07-ci-29aa095/`；关键文件：`old-runtime-post-tray-exit.json`、`installed-result.json`、`candidate-files-29aa095.json`、`installed-desktop-identity.json`、`installed-first-load-and-detail.json`、`installed-g2-full-write-rerun-verdict.json`、`installed-g2-window-hidden.json`、`installed-g2-window-restored.json`、`installed-g2-restore-launch.json`、`installed-native-identity.json`、`taildrop-second-device-send.json`。


### 2026-10-06：G3离线按钮与缓存数量只读记录器已准备

第二台当前候选已安装并正常渲染登录页，登录后九任务空间仍待用户确认。源码核对实时流25秒失联看门狗、服务端10秒心跳；后续离线测试采用至少45秒观察并要求实际离线状态和写按钮禁用证据，不把暂停入口本身当作断线证明。新增只读记录器采集同步标识、新建/添加任务按钮禁用、专用G3任务列及缓存版本、缓存数量；不读取草稿内容或认证凭据，不重载页面、不注入断网。

实际在设备A安装版通过Windows PowerShell5.1运行2秒观察，中文字段正确，四项安装文件哈希及主程序/Node/WebView创建时间、端口、精确页面前后保持。明确标注local-observer-validation-not-second-device，当前A显示G2空间，此次仅证明记录器可用，未验收G3离线/撤权。首次生成因嵌套模板字符串在工具解析前失败，修正后语法及实跑通过，非产品故障。两份脚本已发往在线codex-server，传输退出0，尚未远程执行。证据g3-surface-observer-preparation.json及g3-surface-observer-local-validation.json。G0–G2通过，G3/G4仍未通过。

### 2026-10-06：第二台0748f67升级成功，正常首屏为登录页

用户回报精确孤儿清理及原升级辅助脚本完成：端口已释放，installExit0，安装器SHA-256匹配0748f67，七项随包文件全部匹配；state.json、browser-session.dpapi、cli-key.dpapi前后字节及哈希完全一致，默认WebView目录保留，签名仍NotSigned。此记录来源为第二台用户转贴脚本输出，旧孤儿清理不计正常托盘退出。

已查看并留存用户“首次窗口内容”截图，页面正常渲染登录表单、预填服务器正确，没有整页白屏或伴随服务未知错误。首次首屏属于用户报告，实际运行缓存目录/进程绑定仍待只读观察器核对，尚未观察登录后的空间任务。当前测试账号配置已核对；预览API每次启动随机会话密钥，旧登录失效仅为当前解释推断，未冒充第二台认证响应证据。get_goal已返回active。G0–G2通过，G3/G4仍未通过，接着由用户在第二台手动登录后继续双设备验收。

证据：second-device-0748f67-install-human-report.json、second-device-0748f67-first-display-human-report.json、second-device-0748f67-first-display-login.png，均在当前0748f67证据目录。

### 2026-10-06：第二台旧伴随孤儿进程已定位，精确清理升级脚本已发送

用户只读输出定位第二台47831监听者为随包Node PID22660，创建时间1790689160499ms，其父PID22748已不存在；CompanionScript=true。这是旧安装的遗留进程，当前候选升级仍未执行。新增固定PID/创建时间/随包路径/父进程缺失/端口归属复核的清理脚本；条件全符才停止该进程，保留进程句柄防止PID换主，再调用哈希固定的原升级辅助脚本。该手动孤儿清理不得计为正常托盘退出通过。

PowerShell语法及Windows PowerShell5.1校验模式退出0，未在本机执行实际清理；脚本已Taildrop发至在线codex-server，传输退出0。第二台尚待执行和默认缓存正常首启反馈，G3/G4仍未通过。证据：second-device-orphan-attribution-and-repair-helper.json，脚本clear-confirmed-orphan-and-install-0748f67.ps1。

### 2026-10-06：G3 分阶段 CLI 记录器准备及设备 A 只读预检

第二台当前候选安装/首启尚无回报。本轮新增依赖真实安装包的 Node/CLI 分阶段记录器，固定 0748f67 提交和四项实际运行文件哈希，复用已有 Agent 配对；每项写操作预存独立幂等键，创建、两条 CLI 同时领取、成功领取重放、提交及人工验收后读取均独立分阶段。远程就绪证据和第二台观察准备须先成立。该记录器尚未运行创建、领取或提交，不算 G3 生命周期通过。

随包 Node 语法检查退出0；实际 preflight 退出0，当前主程序/Node/WebView前后归属一致，原九张任务及 G1 TB-2锚点 version2/状态/内容指纹保持。无第二台证据的 create 调用按预期退出1，taskWriteInvoked=false，尚无新任务；此为记录器拒绝条件验证，不是产品故障或 G3通过。已校正进度 JSON 中遗留的 blocked 字段，与本轮 get_goal 返回 active 一致。G0–G2通过，G3/G4仍未通过。

证据：.artifacts/acceptance/2026-10-05-ci-0748f67/g3-lifecycle-harness-preparation.json 及所引用的 preflight/预期拒绝记录。第二台仍按已发送辅助脚本升级后，从 Windows菜单正常首启并报告默认缓存首屏。

### 2026-10-06：0748f67 正常退出后卸载重装完成，G2通过

用户再次确认托盘退出后，只读后检确认冷启动实例主程序/Node/WebView及47831/9334已释放，主聊天创建时间保持。原托盘阻塞条件解除，按用户回复继续工作，新等待条件从0重新审计，未把完整目标标完成。

实际执行当前NSIS候选的专用目录卸载与重装：uninstallExit和reinstallExit均0，原exe删除已确认；state.json、browser-session.dpapi、cli-key.dpapi的长度及SHA-256在卸载前、卸载后和重装后完全相同，旧WebView目录保留；八项安装文件哈希全部匹配。随即用同一专用数据与旧缓存首次启动，无人工刷新，root正常渲染且未显示登录页，me200；当前与两张旧修改任务的version2/标题/空间/编号保持，本机身份和映射指纹一致，实际JS/CSS匹配随包哈希。截图显示当前修改任务与已同步。

审计G2完整覆盖：真实安装后创建/编辑、关闭到托盘和同窗口恢复、两次实际托盘退出、认证冷启动、卸载保留数据、同包重装和重装首启全部具备同提交证据。G2可记通过；安装器仍NotSigned开发预览。本机使用计划允许的专用数据/缓存目录，不替代codex-server默认缓存检查。

G3设备A随包Node v22.16.0与taskctl实际运行。测试Agent登录经stdin提供凭据且不记录秘密，deviceId与原本机状态一致；CLI读取原九张任务及TB-2详情，浏览器me200、账号分区、browser-session字节、本机映射及TB-2 version/status保持。首次观察器把get返回的详情封装误当直接任务，失败证据保留；根据实际CLI契约读取detail.task并复用已成功Agent配对作只读重试后通过。未创建、领取或回写任何任务，G3整体仍未通过。

第二台同提交升级辅助脚本已解析、ValidateOnly校验并Taildrop发送到在线codex-server，传输退出0；脚本核对安装器与七个随包文件，固定原G盘安装目录，保留默认账号数据/缓存，安装后由用户从Windows菜单正常启动；尚无第二台执行或首屏证据。G0–G2通过，G3仍需两台同候选完整生命周期/冲突/离线禁写/撤权，G4等G0–G3闭环。

证据：.artifacts/acceptance/2026-10-05-ci-0748f67/ 中installed-g2-post-tray-exit.json、installed-g2-uninstall-reinstall.json、installed-g2-reinstall-start.json/png、g2-verdict.json、installed-g3-cli-readiness-A-first-observer-shape-failure.json、installed-g3-cli-readiness-A.json、second-device-installer-helper-transfer.json。旧身份和首次托盘后检另存before副本，无待轮询工具句柄。


### 2026-10-06：冷启动实例托盘退出仍待操作，目标标记blocked

连续第三个目标回合，冷启动后的正式安装实例仍运行；只读确认desktop/Node/WebView精确创建时间及47831/9334归属保持，主聊天未变。最新sky.list_windows仅返回Taskboard及文件资源管理器相关窗口，没有可定位的通知区域目标，未发送桌面输入。正常托盘退出须由用户执行；未用窗口关闭或强制终止代替。

前一回合完成第二台就绪观察器本机验证和Taildrop传输；当前回合无新增通过项，无后台工具句柄可等待，必要准备已完成。冷启动后卸载重装必须等正常退出；同候选第二台安装/运行结果仍待用户，G4须等G0–G3闭环。新阻塞审计已满足三次同条件，update_goal返回blocked，完整目标与G0/G1通过及G2–G4剩余范围保留。

证据：installed-g2-cold-start-tray-condition-recheck.json、installed-g2-notification-area-recheck.json、goal-next-user-wait-audit.json；均位于当前0748f67证据目录。用户实际退出后重新核对进程/端口并继续同包卸载保留数据、重装和首启。


### 2026-10-06：第二台当前候选就绪诊断准备

自动继续时只读复查确认冷启动实例仍运行，desktop/Node/WebView创建时间及47831/9334归属保持；尚未发生本轮冷启动后的正常托盘退出，未执行卸载重装。此前回合完成冷启动与G1审计，本轮完成第二台必要诊断准备，goal保持active。

为codex-server生成依赖随包Node、无需Playwright安装的只读观察器与PowerShell归属包装器：核验七个随包文件哈希、唯一精确tauri.localhost页面、账号/测试空间可读、本机仓库映射指纹、资源名称、root渲染及同步提示，并在读取后重新核对进程创建时间和端口归属；不输出能力密钥或账号凭据，不读取Codex草稿。默认启动辅助脚本仅允许0748f67的精确exe，保留默认数据/缓存并拒绝正在运行或自定义环境的实例。

两个PowerShell脚本静态解析通过。观察器实际在本机正式安装版运行，结果通过且前后归属一致；明确标注local-harness-validation-not-second-device，不算G3。脚本已经Taildrop发送到在线且身份匹配的codex-server，传输退出0；第二台安装、运行及默认缓存结果仍未知。首次生成工具调用因嵌套模板字面量解析失败，执行前即终止，修正后通过，非产品故障。G2保留基线在这些读取后再次刷新。

证据：.artifacts/acceptance/2026-10-05-ci-0748f67/ 中second-device-helper-local-validation.json、second-device-helper-preparation.json、second-device-diagnostic-transfer.json和三个同版本辅助脚本。G0/G1通过，G2–G4仍未通过。


### 2026-10-06：0748f67 托盘退出、认证冷启动及 G1 证据闭环

用户确认托盘“退出”后，只读后检证明原安装主程序、伴随服务、WebView 和独立宿主辅助进程均已退出，47831、9334、52822 无监听，主聊天创建时间保持。原托盘等待已解除，goal active，历史 blocked 记录保留。

同一 NSIS 候选以原专用数据及旧 WebView2 缓存冷启动，无人工刷新，首个读取的 root 正常渲染；me 返回200，当前与两张旧验收任务的标题/空间/编号及 version2 保持。设备身份、账号分区、本机映射指纹一致；drafts/outbox均0；实际加载 JS/CSS 与随包文件 SHA-256 相同。真实页面显示当前修改任务和已同步。此项是本机已安装冷启动，不替代第二台默认缓存验收。首次只读诊断脚本两次失败分别因序列化的 __name 和 TypeScript cast，原失败记录保留，修正后退出0；它们不是产品白屏。

逐项审核同提交的真实安装版 G1：正式启动与唯一精确绑定、入口开关和内嵌交互、935/635/424px稳定宽度、精确五段未发送草稿、重复/错项目/无项目/真实弹窗/映射与结构/URL拒绝、失败握手与实际CSP恢复、正常退出及重启均有证据，自动回归由同提交G0全量124项承接，G1可记通过。受控DOM/URL/握手故障明确标注；openThread保持不可用，Ctrl+R未实际重载的失败及185px瞬时布局未计通过。结构测试的finalFaultCleanup=false表示finally已无待清理故障，各case的baselineRestored均true且最终快照与基线一致。

卸载前保留基线已刷新，当前测试独立宿主均已正常退出。卸载器/安装器哈希与精确专用安装路径通过ValidateOnly；卸载和重装尚未执行，须先正常退出本轮冷启动实例。G0/G1通过；G2尚欠卸载保留数据、同包重装与重装首启；G3当前候选第二台完整验证未完成，G4保持等待。

证据：.artifacts/acceptance/2026-10-05-ci-0748f67/ 的 installed-g2-post-tray-exit.json、installed-g2-cold-start.json/png、installed-g2-cold-start-harness-error.json、installed-g2-cold-start-harness-error-2.json、g1-verdict.json、installed-g2-retention-baseline.json。原安装identity和保留基线分别另存before-g2-cold-start与before-cold-start副本，未覆盖首次生命周期证据。


### 2026-10-06 托盘退出条件持续未解除，完整验收目标标记 blocked

连续第三个目标回合仍未发生实际 Taskboard 托盘退出。最新只读检查确认安装 desktop 41768、伴随服务 28416、WebView 3428 的创建时间保持，47831/9334 分别仍属于同一 Node/WebView；重启检查用的独立 Codex 与辅助进程已退出，主聊天创建时间保持。没有正在执行或待轮询的工具句柄，本轮无新增通过项。

工具无法定位通知区域图标，需要用户实际选择托盘“退出”。不能以关闭窗口或强制终止代替此项实机验收。冷启动/卸载重装须待当前实例退出；准备脚本、哈希校验和数据基线已完成。同候选 G3 第二台仍需要用户操作，G4须待G0–G3通过。该条件连续三轮存在且无可独立完成的必要步骤，update_goal已返回blocked；完整G0–G4范围和证据保留。用户完成托盘退出后继续后检、冷启动和数据保留/重装。

证据：installed-g2-tray-condition-recheck.json、goal-next-user-wait-audit.json。已解除的认证与信任条件不再等待。


### 2026-10-06 同候选正常宿主退出、重启与 G2 保留基线

当前安装伴随服务在精确真实宿主页面 URL 受控漂移时拒绝草稿，恢复原 URL 后页面与空编辑器快照保持；此项明确为实际宿主的受控故障。随后经独立宿主应用菜单正常退出，native/helper与调试端口释放，主聊天进程和创建时间保持；probe 返回接入与草稿均不可用。安装版实际“启动独立 Codex”按钮重新建立新 native/helper/profile 与唯一精确页面，并正常渲染登录页。重启检查后的空实例通过原生退出快捷键清理，未请求再次登录；新 native/helper/端口均已释放。

G2 安装版数据保留基线已刷新，包含当前候选新建修改任务、旧验收任务，均 version 2/title/space/number一致；DPAPI文件仅记录长度与哈希，当前 drafts/outbox均0。卸载重装脚本已解析和 ValidateOnly 验证，同候选安装器/卸载器哈希与专用安装路径通过，但尚未执行卸载或重装。Windows工具只返回应用/文件资源管理器窗口，通知区域图标不可定位，下一步需用户实际托盘“退出”，代理随后核对程序、伴随服务、WebView与端口释放，再做冷启动和专用数据卸载保留/重装。

证据：installed-g1-controlled-target-drift.json、installed-g1-normal-native-exit.json、installed-g1-normal-restart-verdict.json、installed-g1-restart-cleanup.json、installed-g2-retention-baseline.json；执行退出0，无待轮询工具句柄。现有预览API保持运行。G0保持通过，G1–G4完整门槛尚未关闭，goal active；已解除的认证/信任等待不重复计数。


### 2026-10-06 信任已解除：0748f67 安装版正式侧栏、草稿与拒绝路径增量验收

用户确认“已信任”后，受管理独立宿主项目唯一选中、目录与本机映射一致、唯一编辑器为空；goal 已恢复 active，原认证/信任等待条件解除。正式安装版侧栏接入、开关、内嵌空间和列表交互通过。真实窗口调整测得 iframe 935、635、424px 均无横向溢出，详情字段和按钮在界内、最窄列表任务编号单行。480px 原生窗口稳定后宿主自动收起导航；约185px仅为瞬时状态，不计稳定布局通过。

普通搜索弹窗及实际“在项目外工作”分别触发安装伴随服务 opened=false，项目/编辑器/原页面完整保持。错误存在目录、未映射仓库、不存在目录、不可验证会话路由亦拒绝且映射恢复。另在精确真实宿主以诊断协议暂改编辑器 role、追加空编辑器、改变 composer 项目标签，三个受控结构故障均拒绝、原表面保持、故障移除后基线完全恢复；该部分明确标为受控故障检查。

真实 Windows TB-2 详情“在 Codex 中打开”请求被观察到，五个纯 P 段落的完整内容哈希与生成 prompt 一致；未发送、未领取，任务 version/status 保持。重复请求拒绝且原草稿保留。侧栏/iframe节点全部清理；实际浏览器 frame-src/enforce 事件证明 CSP 恢复。iframe拆除导致原HTTP响应不可读，未虚构抓到成功响应。代理聚焦并验证内容哈希与选区完全覆盖后清理本轮合成草稿，后检确认编辑器为空。

外部 Page.reload 精确目标恢复侧栏且项目/空编辑器保持；Ctrl+R 没有实际重载的失败尝试独立保留，不能称快捷键成功。重复 start_managed_codex IPC 返回已有实例并保持唯一宿主。通过安装版运行中的 /v1/codex/install 受控截取一次内嵌文档、故意不给 nonce-ready消息，实机握手失败返回409；随后节点清理、项目/空编辑器保留、真实 CSP 拦截事件恢复，诊断路由已移除。

证据：`.artifacts/acceptance/2026-10-05-ci-0748f67/` 的 installed-g1-context-*、installed-g1-controlled-structure-refusals.json、installed-g1-ui-draft.json、installed-g1-ui-draft-cleanup.json、installed-g1-handshake-failure-cleanup.json、installed-g1-responsive-*、installed-g1-external-reload*.json、installed-g1-duplicate-start-ipc.json。G0保持通过，G1–G4尚未关闭，继续正常退出重启、G2完整安装生命周期和当前候选G3双设备验收。


### 2026-10-06 文件夹信任确认持续等待，目标已标记 blocked

最新精确运行绑定及真实 Windows 截图确认：独立 Codex 已登录（loginUiTextPresent=false），当前仍显示 <本机验收仓库> 的“信任此文件夹吗？”权限弹窗；projectCount=0、selectedIds=[]、modalCount=2、唯一编辑器为空，document timeOrigin 保持。已将独立测试窗口置前台，未代点击权限确认。Computer Use guidance 要求由用户处理应用内安全权限请求，普通测试界面授权仍保留。

同一文件夹信任条件已连续三轮以上存在；本轮仅核对该等待条件，无新产品通过证据，无运行中工具句柄。剩余 G1 必须先完成当前项目绑定，后续托盘退出/重装将改变该受管理宿主，G3 当前候选第二台仍需用户操作，G4 按计划等待 G0–G3 全过。update_goal 已返回 blocked，完整目标保留，未宣布初版完成。用户点击当前弹窗“信任文件夹”后直接继续正式侧栏、最窄详情布局和完整草稿安全路径。

证据：2026-10-05-ci-0748f67/installed-native-auth-readiness.json、installed-native-folder-trust-blocked-current.png、goal-next-user-wait-audit.json。G0 已通过，G1–G4 未通过。


### 2026-10-06 独立 Codex 已登录，当前仓库项目待文件夹信任确认

用户报告“独立 Codex 已登录”后，精确受管理 native 30272 的登录标记消失，唯一消息编辑器为空，document timeOrigin/进程/端口/target 归属保持；Taskboard 测试账号仍 `/api/v1/me` 200。原人工认证条件已解除，goal 工具已确认状态 active，不沿用此前 blocked 等待计数。

代理通过实际 Windows UI 打开创建项目表单，填写 `codex-taskboard`，在原生文件夹选择器选择当前仓库，再提交创建。当前出现“信任此文件夹吗？”权限弹窗，项目尚未创建完成；未自动接受安全权限弹窗、未改变宿主安全设置。Computer Use guidance 要求人处理此类权限请求，现等待用户在当前弹窗确认。截图 `2026-10-05-ci-0748f67/installed-native-folder-trust-required.png`，新条件计数 1。

趁实际弹窗保留，以当前安装伴随服务验证合法本机请求的草稿拒绝：仓库映射已核对指向当前检出，测试账号和 TB-2 已核对；弹窗存在且无选中项目时 `/v1/codex/open-draft` 返回 200、opened=false，明确提示草稿未写入。请求前后 native 快照完全一致，空编辑器未变，未发送消息或领取任务。证据 `installed-g1-actual-trust-modal-refusal.json` passed=true、gatePassed=false，观察器终止退出 0。此证据是实际权限弹窗与未选项目的组合拒绝，不能冒充单独 modal 路径完整通过。

G0 保持通过，G1–G4 仍未通过；原完整验收范围保留。用户确认当前文件夹信任后由代理继续项目绑定、正式侧栏入口、宽窄布局、完整草稿及拒绝/CSP清理。当前无待轮询工具句柄。



续验等待核对：精确 native 页面仍为已登录状态，但创建项目/文件夹信任两个弹窗尚在（modalCount=2），projectCount/selectedIds 为 0、编辑器为空且 document 不变。上一轮有实际项目准备和组合拒绝证据，本轮只重新核对未解除的信任条件，归类 no progress；同条件计数 2，目标保持 active。未点击安全权限按钮，没有正在运行的观察器，不重启当前宿主。详见最新 installed-native-auth-readiness.json 和 goal-next-user-wait-audit.json。

### 2026-10-06 新独立 Codex 认证等待：已确认受阻，目标未完成

连续第三轮从当前精确 native/installed 绑定核对：新独立 Codex 仍显示登录页，projectCount/editorCount/ownedNodes 为 0、document timeOrigin 不变；Taskboard 测试账号 `/api/v1/me` 则是 200、看板可见，进程与端口归属保持。因此当前条件是新独立 Codex 的人工认证，已解除的 Taskboard 登录条件不再计入。

上一轮实际本机访问边界检查有进展；本轮只重验相同等待条件，归类为 no progress，没有正在执行的工具句柄。真实 G1 尚不能执行；G2 剩余托盘退出/重装会改变当前 managed launch，G3 同候选第二台还需人工操作，G4 按闭环计划需待 G0–G3 完成。未重复已通过检查、未重启现有 API/宿主、未自动操作认证。满足三轮相同条件且无独立可闭环步骤的 blocked 审计，update_goal 已返回 blocked；原“直到初版可用”完整目标保留，未标完成。用户在已置前台的新独立 Codex 完成认证后继续同安装包实机验收。

证据：`2026-10-05-ci-0748f67/installed-native-auth-readiness.json`、最新 `installed-auth-readiness-*.json`、`goal-next-user-wait-audit.json`。G0 已通过，G1–G4 仍未通过。


### 2026-10-06 当前安装版本机访问边界通过；新宿主认证仍待完成

续验从精确归属的新独立 Codex 读取仍是登录页（editorCount/projectCount/ownedNodes 为 0），未自动操作认证。上一轮有实际读写和窗口恢复进展，本轮继续了可独立执行的本机访问边界检查。当前安装版 `/v1/codex/open-draft` 缺少凭据和错误凭据均返回 HTTP 401 / LOCAL_AUTH_REQUIRED，合法本机凭据但空请求体返回 HTTP 400 / VALIDATION_ERROR；每次请求后原生页面快照完全一致，未写入或发送草稿。读取当前服务器配置为 `https://taskboard.example.test/`，authenticated=true。未退出登录或更改服务器。

证据 `2026-10-05-ci-0748f67/installed-preauth-local-boundary.json` passed=true、gatePassed=false，检查进程已终止退出 0。该范围仅证明登录前的本机访问/格式拒绝，不能替代 G1 登录后侧栏、项目身份、草稿成功和宿主拒绝路径。新宿主人工认证条件连续计数 2，完整目标保持 active，G1–G4 仍未通过；当前无待轮询工具句柄。


### 2026-10-06 0748f67 安装版真实读写通过，原窗口恢复通过

用户报告“已登录”后，精确已安装实例 `/api/v1/me` 返回 200，测试账号匹配，登录页已消失。桌面 PID 41768、随包 Node 28416、WebView2 3428 与创建时间、安装路径、47831/9334 监听者、精确页面 target 的绑定保持一致；此前 Taskboard 重新认证条件已解除，原 G0–G4 目标继续 active。

通过 Taskboard 真实 Windows 按钮已启动新独立 Codex，native PID 30272、helper 19816、端口 50610、精确主页面和独立 profile 归属确认，实际 MSIX 26.928.1915.0。当前窗口仍显示“登录 ChatGPT”，projectCount/editorCount 均 0，未接入侧栏或写入草稿。认证需按 Computer Use 技能由用户完成；后续选项目、缩放、侧栏和自生成草稿操作已有用户授权。新的认证条件计数从 1 开始，不继承已解除的 Taskboard 等待计数。

已在当前安装程序创建 `0748f67 安装版闭环验收` 空间及一张任务并修改标题，真实请求成功，但前两份记录器分别误读 `{data:…}` 响应和遗漏 `/api/v1/spaces/:id/tasks` 创建路由，故其失败记录保留，不能充当通过证据。首次嵌套命名函数引发的 `__name` 记录器错误及修正也保留。两份旧记录器均已终止退出 1。

修正后的完整记录器在同一安装实例重新观察真实 Windows UI：创建 `0748f67 安装版读写复验`（空间 41dd618d-c9b1-4e5f-860d-19f4aee7df56），创建 TB-1 `G2 0748f67 安装版读写复验 2026-10-06`（任务 1c507c2c-b3ab-425e-b1d9-bebd08a4403e，version 1），再修改标题追加“（已修改）”。两次 POST 和 PATCH 均 HTTP 200 且带幂等键；PATCH 携带 If-Match 1，响应 version 2，卡片与详情标题一致，无页面错误。完整记录器终止退出 0，`installed-g2-full-write-rerun-verdict.json` passed=true。未领取或发送 Codex 消息。

通过原生关闭按钮隐藏窗口，稳定 Windows 窗口列表中该程序可见窗口为 0；桌面、随包 Node、WebView2 和端口仍为原归属。再次打开已有安装程序恢复同一窗口 3871040，document timeOrigin 不变，任务 title/version 2 和详情状态保留。证据 `installed-g2-window-before/hidden/restored.json`、`installed-g2-window-visibility-verdict.json` 与真实截图。恢复采用再次启动现有程序，尚未操作托盘菜单“恢复/退出”；冷启动、卸载保留数据与重装、G1 完整实机和同候选 G3 双设备仍待完成。G0 保持通过，G1–G4 未通过，不宣布初版完成。

证据均在 `.artifacts/acceptance/2026-10-05-ci-0748f67/`。当前无待轮询工具句柄；进度与等待审计已更新为本轮实际结果。


### 2026-10-06 预览 API 已恢复，安装版等待重新认证

用户手动启动 API 后，本机和 Tailscale HTTPS 健康接口均 HTTP 200。代理通过真实 Windows 快捷键重载当前已安装窗口；502 提示消失，界面正常渲染登录页。精确进程、创建时间、端口和页面绑定保持一致。当前安装版 /api/v1/me 返回 HTTP 401 / AUTH_REQUIRED；scripts/live-preview.ts 每次启动以 randomBytes 生成预览 sessionSecret，旧会话失效与此配置一致。未填写或提交登录凭据，认证按 Computer Use 技能由用户完成。

证据：2026-10-05-ci-0748f67/installed-after-api-restoration-login.json/png。API 人工启动条件已解除，当前重新认证条件计数 1，完整 G1–G4 未通过；普通测试 Codex 操作仍有用户授权，认证完成后继续正式启动器和实机验收。


续验更新：当前精确安装窗口再次读取仍为 AUTH_REQUIRED 401、loginVisible=true、502=false。新候选 G2 的实际 Windows UI 创建/修改观察器及托盘恢复捕获脚本已按 0748f67 和当前日期准备，增加测试账号校验与失败时连接清理，解析检查通过；尚未执行，不计产品通过。证据 prepared-g2-observer-syntax.json 和 installed-auth-readiness-*.json。当前认证条件连续计数 2，未达到 blocked 阈值。

当前等待审计更新：再次从精确安装窗口读取仍为 AUTH_REQUIRED 401，登录页可见、502 不存在、运行归属不变。相同人工认证条件已连续三轮存在；观察器准备已完成，剩余真实宿主和安装生命周期门槛均依赖认证，本轮没有产品进展，也没有正在等待完成的工具句柄。按 blocked 审计将目标记为受阻，未标记完成；用户登录后从当前 0748f67 安装实例继续原 G0–G4 全范围。详见 goal-next-user-wait-audit.json 和最新 installed-auth-readiness-*.json。

### 2026-10-06 0748f67 已安装并启动；等待恢复验收 API

用户报告“已启动，桌面可用”后，真实状态确认新版安装器退出 0，原测试数据和 WebView2 缓存保留。新版桌面、随包 Node、WebView2 和两个回环端口与 installed-desktop-identity.json 的 PID/创建时间/路径/精确页面一致；当前旧安装条件已解除。已重新取得 Windows 窗口并查看真实界面，未收到停止信号。

当前窗口成功渲染登录壳，无白屏，JS/CSS 逐字节摘要与新版随包资源一致。保留缓存中的 Service Worker 仍存在，不能据此宣布旧 worker 已清除。登录壳显示“远程服务返回 502”，本机预览 API 47830 确认无监听者，已有独立测试 PostgreSQL 55439 仍运行；这是当前服务恢复条件，完整 G1/G2 尚未通过。

既有 2026-09-30-resume/start-preview-api.ps1 明确记载 API 自动启动曾被审批拒绝，仍需用户手动执行，未绕过重试。脚本中的旧 E 盘 Node 改为按 USERPROFILE 定位已验证缓存运行时，实际版本 v24.19.0；UTF-8 BOM 保存，PowerShell parser 0 errors，修正前脚本保留。未执行脚本、未重置数据库或账号。用户手动恢复该 API 后继续同候选真实宿主验收，原目标 G0–G4 保持；新条件计数 1，未将此前 blocked 条件计数继承至新条件。

证据：2026-10-05-ci-0748f67/installed-result.json、installed-desktop-identity.json、installed-startup-before-api.json/png、preview-api-script-runtime-fix.json、progress-summary.json、goal-next-user-wait-audit.json。


### 2026-10-06 退出后的能力失效已确认；新版实机换装仍待人工执行

上一轮已轮询既有 Taildrop 运行句柄至退出码 0，0748f67 安装器成功传到 codex-server；这只证明传输，不证明第二台已安装。随后 Computer Use 在首次读取窗口时报告物理 Esc 停止，未执行点击。本轮未恢复桌面输入，改为只读核对：本机仍是 d1709b0 安装版，0748f67 安装目录中的程序及新版身份记录均不存在。

在已绑定旧安装窗口内读取伴随服务 /v1/codex/probe，返回 HTTP 200，embedded/projects/draft/thread 全为 false，并有“桌面适配器未由启动器启用”的拒绝原因。正常退出的独立 Codex 与 package helper 均不存在，监听端口已释放，主聊天进程创建时间保持一致；无需强制终止。installed-g1-post-normal-exit-probe.json passed=true，但 newCandidateGatePassed=false。旧 active.json 状态不能替代真实进程和能力证据。

新版的最窄详情观察器和草稿请求观察器已准备且解析检查通过，尚未在新版安装实例执行。完整 G1–G4 仍未通过。再次核对安装器 SHA-256 84FC1609B178CCEC538175128B1DACBB0EE42F7579835630EEFF739949820DDA，手动换装脚本存在。此前自动审批拒绝“启动新安装 Taskboard”且没有具体理由，未以其他途径重试。相同手动换装条件已连续三轮存在；剩余实机门槛均需新版启动，本轮完成独立只读检查后已无可继续的门槛工作，目标按等待审计记为 blocked，未标记完成。用户从旧版托盘退出并手动运行 2026-10-05-ci-0748f67/install-and-start-taskboard.ps1 后，可继续原 G0–G4 全范围验收。

证据：2026-10-05-ci-d1709b0/installed-g1-normal-host-exit.json、installed-g1-post-normal-exit-probe.json，以及 2026-10-05-ci-0748f67/second-device-taildrop-transfer.json、2026-10-06-readonly-continuation.json、progress-summary.json、goal-next-user-wait-audit.json。此前记录中的 active 和等待计数 1 是当时状态，本节为当前更新。


### 0748f67 基础门槛完成，等待同包实机换装

新候选 0748f6752f313173222e4301356db873f060ce9e 的精确 git archive 已 frozen install、typecheck/lint/test/build 退出 0，无数据库 109 passed + 15 个预期 skips，真实独立数据库 124/124，HTTPS 原始 Playwright 8/8，production/offline 均退出 0。首次数据库使用默认 55439 与既有预览数据库监听冲突，保留失败后改用独立 55540；测试结束 55540/47834 已释放，既有 47830/55439 保留。首次 E2E 外部 config 引入两份 Playwright 实例，修正为精确 checkout 模块后曾因 TEST_DATABASE_URL 未设置产生两项跳过；这两次结果保留并未计通过，最终使用既有预览 API 对应的实际独立数据库重跑全部八项成功。HTTPS 返回的 JS/CSS 与候选生产资源逐字节相同，API 源码相对已运行版本没有改变。

CI 37336349321 的 verify/container/windows-desktop 全成功；11357156355 归档 sha256:d2f7d0b12522005babd61b13e43eedab9dbaa1bb1844005c1fc2a8cb1a294f52 已对照 GitHub digest 验证。安装器 24,640,807 bytes / 0.1.0 / NotSigned，SHA-256 84FC1609B178CCEC538175128B1DACBB0EE42F7579835630EEFF739949820DDA。g0-verdict.json g0Passed=true，但新版尚未安装，G1–G4 未通过；没有把旧包实机结果沿用。

同目录 install-and-start-taskboard.ps1 和 start-installed-taskboard.ps1 已按新版 SHA/独立安装目录与当前已验证 package helper 绑定准备，UTF-8 BOM、Parser 0 errors、ValidateOnly 包哈希检查通过；当前进程与端口仍在，脚本会先拒绝覆盖运行中程序。首次新安装程序自动启动曾被自动审批拒绝、未给具体原因，原证据保留在 2026-09-30-ci-425ab6e/startup-policy-rejection.json；此轮没有重试自动启动或换途径绕过。需要用户先从当前 Taskboard 托盘“退出”，再手动执行已准备脚本；安装后继续由代理操作已授权的测试 Codex 界面。当前新增安装条件计数 1，目标 active，不沿用此前已解除的详情等待计数。

### 2026-10-05 最窄详情缺陷已修复，候选更新为 0748f67

用户明确授权操作独立测试 Codex 界面，原人工详情条件已解除、等待审计计数归零。d1709b0 的首次 minimum-detail 捕获实际仍在专用单任务空间、detailVisible=false，未计通过；重新观察并由实际 Windows 操作切回九任务空间，480px 原生窗口/424px iframe/409px 内容的看板确认单列 373px、九张卡片、筛选和顶部按钮无横向越界。实际打开 TB-2 并滚动到底，详情字段和操作按钮均可到达且在边界内，但玻璃详情面板 x=-9px、width=412px，左侧被裁切，完整最窄详情仍未通过。

apps/web/src/glass.css 的详情与设置面板四处宽度由 100vw 改为 100%，按包含块的实际可用宽度扣除边距。生产资源隔离对照在 935/618/560/424/409/360/185px 及 Windows 等宽滚动条占位下复现旧版越界，修复后两面板边界均通过；此处仅为生产对照，不是新安装版实机证明。首个观察器过早读取加载壳的 drawer-content，以及 stable gutter 下 clientWidth 与实际包含块宽度的区别均已保留首次脚本和失败结果。固定 pnpm@10.28.0 的 check 退出 0，109 passed、15 个预期数据库 skips；默认 pnpm 11 曾试图重建现有依赖并因无 TTY 提前退出，该失败也保留。源码修复已单独提交并推送为 0748f6752f313173222e4301356db873f060ce9e，现有两份交接记录的脏改动保留。

d1709b0 实际点击 TB-2 的“在 Codex 中打开”后，五段 P 草稿的预期/实际摘要相同、原项目保持、任务 version 2 未变化；重复请求返回 opened=false 且原草稿完整保持，侧栏与 iframe 已清理，真实 frame-src/enforce CSP 事件证实恢复。观察器未捕获 iframe 拆除后的 HTTP 响应，完整 observer 结果 passed=false，未将此缺失证据计为完整 G1。Windows UIA 曾使用滚动前按钮矩形报 outside-window，重新观察后仅点击当前可见截图位置。随后只读确认焦点和完整选区均属于本次合成草稿，再以 Windows 编辑操作恢复空编辑器；原空编辑器哈希一致、无 modal、未发送未领取。当前待新版同 SHA 的实机完整复验。

证据：.artifacts/acceptance/2026-10-05-ci-d1709b0/ 的 installed-g1-responsive-minimum-board-nine.json/png、installed-g1-responsive-minimum-detail-tb2.json/png、installed-g1-minimum-detail-actions.png、installed-g1-ui-draft.json、installed-g1-focus-after-test-draft-cleanup.json、installed-g1-minimum-board-detail-draft-verdict.json；修复对照在 .artifacts/acceptance/2026-10-05-panel-gutter/。新候选基础验收目录 .artifacts/acceptance/2026-10-05-ci-0748f67/，CI 37336349321 的 verify/container 已成功，Windows 作业仍在构建；不得沿用 d1709b0 的 G0 作为新版 G0。完整目标 active，G1–G4 仍未完成。

### 2026-10-05 d1709b0 重复启动 IPC 复用同一宿主通过

在当前已安装窗口的精确 desktop target 中，实际调用一次与正式启动按钮相同的 start_managed_codex IPC。返回“受管理 Codex 已在运行”，调用前后 private-profile 原生启动根均只有 PID 45400 / FILETIME 134356839055931872，未产生第二个受管理根；精确端口/target、项目、空编辑器、侧栏入口和 iframe 容器的已观测状态均保持一致。installed-g1-duplicate-start-ipc.json passed=true、gatePassed=false。该项是已经运行时的同实例复用，不是退出后新启动，也没有模拟页面漂移或端口换主。

首次预检查误把使用同一 profile 的 Electron renderer/GPU/utility 子进程计作独立原生启动根，invoked=false，未执行启动请求；首次失败及修正前脚本保留。观察器修正为 private profile + remote-debugging-port 且排除 --type= 的启动根，并继续依赖精确 launcher PID/FILETIME、端口归属和页面绑定，重跑后通过。

minimum-detail-readiness-1 当前仍是 480px 原生窗口/424px iframe 的九行列表，grid=null、detailVisible=false；最窄看板重排和详情尚未验收。此轮有启动器新证据，但同一 Codex 人工界面条件仍需用户完成；审计连续计数 2、未达到 blocked 阈值，目标保持 active。G0 通过，G1 未完成、G2 部分通过、G3/G4 未完成。

### 2026-10-05 d1709b0 最窄实机列表回归通过；G2 保留基线已取得

用户在同一新宿主切回原九任务空间，切为列表并缩到系统最窄后，实际读取原生窗口 480×820、iframe 424×772、内容宽度 409px，document/body scrollWidth 都为 409px。九行编号 TB-1～TB-9 的实际文字布局矩形均只有一条 lineTop，计算样式 white-space=nowrap；搜索、优先级/负责人/标签筛选器横向完整，两列列表在当前宽度内，未产生水平滚动。截图经查看确认旧版曾断行的 TB-2/TB-3 现为一行。观察前后 document timeOrigin、项目、空编辑器、入口 generation、展开容器和 iframe 数量保持一致。installed-g1-responsive-minimum-list.json/png、installed-g1-minimum-list-verdict.json passed=true、gatePassed=false。此前 minimum-readiness-1 仍为 935px，没有将其当成最窄通过；该次组合读取退出 1 是后续不存在的文档查找路径导致，实际只读捕获命令退出 0。

同候选 G2 只读连续性基线已记录三项本机状态/浏览器会话/CLI 配对文件、八个安装文件/卸载器摘要、设备和活动身份摘要、本机映射摘要、一个账号、0 本地草稿、0 outbox，以及当前候选 G2 新建修改任务与旧 TB-9 的 version 2/title/status。没有输出凭据或数据文件内容。首个基线脚本错误地假定 agent-token.dpapi 必须存在，已保存失败并修正为显式记录 optionalAgentSessionFile.exists=false；没有为了制造基线而登录 Agent。installed-g2-retention-baseline.json 是后续正常退出/冷启动/卸载重装的准备，操作前需要刷新；uninstallInvoked/reinstallInvoked/gatePassed 均为 false。

人工最窄列表条件已解除。本轮有实际回归和基线进展，目标 active；G1 尚需同最窄尺寸的看板与详情、内部交互、侧栏开关、外部重载/CSP 和完整未发送草稿成功/拒绝/清理。G2 正常托盘退出/冷启动/卸载重装、第二台同候选完整 G3 以及其后的 G4 仍未完成。下一人工步骤为保持最窄尺寸，滚回看板页顶部，切为看板并打开 TB-2 的任务详情；Computer Use 技能禁止代操作 Codex 界面。

### 2026-10-05 d1709b0 正式侧栏已展开：935px 实机与七项拒绝通过

用户完成正式接入并回复“已打开”后，绑定的 native 45400 主页面进入新 document timeOrigin 1791212422712.4；原项目唯一、编辑器为空、无模态框。任务看板入口、owned 容器和 iframe 均唯一，入口 aria-pressed=true，入口/容器 generation=1。安装版正式 probe HTTP 200，embedded=true、draft=true、thread=false。真实子框架的实时 location 校验属于本机受保护 embedded 路径；当前服务返回的 JS index-B4uFrCpj.js / CSS index-BGeFmNSz.css 摘要与同候选安装包相同。初次使用 Playwright 子框架的缓存 URL 得到不充分的 isEmbedded=false，以及随后观察表达式转义错误均已保存；修正为实时 location 布尔检查和响应摘要后成功，没有修改宿主页面补证据。证据 installed-g1-official-opened-verified.json/png、installed-g1-frame-live-location-first-failure.json。

当前原生窗口 1280×820，iframe 935×772，文档 clientWidth/scrollWidth 均为 920px，真实三列布局无横向溢出，搜索和三个筛选器及主要按钮均在可见宽度内。截图经查看确认当前内嵌空间为“d1709b0 安装版闭环验收”，有一张 G2 验收任务；原九任务空间尚未在此 iframe 切换。installed-g1-responsive-opened-wide.json/png 只证明宽窗口，最窄列表编号修复仍待同安装包实机复验。

同一安装版完成缺少本机凭据、错误凭据、无效请求格式、未映射仓库、目录不存在、无法验证的会话路由以及存在但不匹配的目录共七项实际拒绝检查。每项均保持原 document timeOrigin、选中项目、空编辑器哈希、入口、展开容器和 iframe 数量；错误目录返回 opened=false，未销毁既有侧栏或重载宿主。临时本机映射均恢复，最终独立读取 TB-2 version 2 / status 与检查前一致。证据 installed-g1-local-boundary.json、installed-g1-other-refusals.json、installed-wrong-project.json、installed-g1-current-data.json；汇总 installed-g1-attachment-and-refusals-verdict.json 的 gatePassed=false。这些结果不替代模态框、会话切换、页面结构变化、非空草稿或完整成功/清理路径。

正式接入等待已解除。目标继续 active，G0 通过、G1 未完成、G2 部分通过、G3/G4 未完成。下一人工步骤是内嵌看板切回“桌面隔离验收”、切为列表并把原生窗口缩到系统最窄；Computer Use 技能禁止代操作 Codex 界面或原生尺寸。本轮有新的实机与拒绝证据，阻塞审计不继承已解除的接入条件。

### 2026-10-05 用户关闭旧窗口后续验：新宿主已启动，正确项目和空编辑器已确认

用户回复“已关闭”后，只读核对旧测试窗口已消失，但旧 native PID 26844 仍留在后台。重新验证其 FILETIME、私有 profile、精确 target，以及主页面/分离页面均无草稿、无模态框后，仅收尾该已关闭测试实例的后台 PID；最终进程、直系子进程与 60614 监听均消失，当前主聊天 41124、新安装版 desktop 36040、companion 38736 保留。retired-native-final-cleanup.json 记录最终结果；此收尾不算旧 Codex 正常退出通过。首次即时端口检查和 DateTime Kind 误判均保留，未覆盖。

随后在 d1709b0 已安装 Taskboard 的“连接与设备”页面，通过正式“启动独立 Codex”按钮创建新 native PID 45400（FILETIME 134356839055931872），版本 26.928.1915.0。辅助 PID 36656 的同安装 exe 路径、启动会话与 launcher PID/FILETIME 参数一致；私有 profile/codex-home 位于新的 managed-codex/lEYq08ISrrtqk43WIPBla1xK，127.0.0.1:57886 监听归属原生 PID，精确主 target E496966A7D537190BCB9D49DA2A6CF6E / app://-/index.html 匹配。新可见窗口 1312546 与原聊天窗口 723204 同时存在。installed-native-identity.json 和 installed-new-native-owner.json 保存完整归属证据（不保存 capability、启动握手或完整命令行）。观察器先后遇到扩展长度 Windows 路径前缀和生成表达式引号错误，首次失败与修正前脚本均已保存，修正后只读检查成功。

新窗口起初无选中项目，随后实时读到唯一选中项目 1a487049-9369-45ab-9d54-4e6a58cdc51e。通过 launcher 私有 codex-home 的只读项目数据库确认其唯一根为当前仓库检出；安装版浏览器的正式 capability 表面只读核对测试账号、TB-2 version 2 及本机仓库映射均匹配。唯一编辑器为空、无模态框，尚无侧栏入口/注入节点，见 installed-new-native-ready.json、installed-g1-current-data.json。恢复最小化 Taskboard 时两次检测到用户输入，停止进一步输入；未点击“接入 Codex 侧栏”，未改写或发送任何草稿。installed-g1-attach-ui-wait.json 记录该当前状态。

旧窗口阻塞已解除，本次恢复审计计数重置；目标 active、G0 通过，G1 未通过，G2 部分通过，G3/G4 未通过。下一步正式侧栏接入与人工入口展开、同候选最窄布局和完整草稿拒绝/清理；第二台同候选安装、G2 正常托盘退出/冷启动/卸载重装及完整 G3/G4 仍需完成。

### 2026-10-05 新安装版关闭窗口/恢复原窗口通过；完整目标等待人工步骤

通过当前 d1709b0 的真实 Windows 标题栏关闭 Taskboard 后，主窗口经稳定可见窗口列表确认隐藏；主进程 36040、服务 38736、WebView 25808 的 FILETIME/路径/父子关系以及 47831/9334 监听保留，原九任务仍可只读核对。对已安装且已经由用户启动过的同一 exe 执行 sky.launch_app，原主窗口 3280848 恢复，唯一窗口列表、真实 Windows 截图及九张任务的 DOM 结果一致，未创建第二个桌面/服务实例。这是单实例恢复，不能当成退出后冷启动，也不是点击托盘图标恢复。首个截图出现 no monitor found，已保留；仅重新取得唯一窗口对象后读取成功。Get-Process.MainWindowHandle 在同进程 unnamed 窗口间变化，未用作可见目标身份依据。installed-g2-window-retention-verdict.json passed=true、gatePassed=false。

当前仍为 G0 通过、G1/G3/G4 未通过、G2 部分通过。旧独立 native PID 26844 的路径和 FILETIME 在连续第三个目标轮次仍匹配；必须用户关闭旧验收 Codex，再由新版创建宿主并人工登录/选中项目。第二台尚需人工取回/安装已传输的同候选，G2 正常托盘退出和冷启动/卸载重装也仍需实机操作。已完成的观察/传输会话均为终态，没有以聊天等待冒充 live process wait。当前可独立完成的安装版创建修改、关闭保留/原窗口恢复及第二台传输已记录；余下必需门槛都有人工或前置门槛依赖。goal-blocked-audit.json 记录连续三次同一人工条件和当前证据；完整目标未完成，不缩减范围，待用户完成人工交接后继续。
### 2026-10-05 同候选第二台安装交接已准备并传输

codex-server 的 Taildrop 节点已实时核对，ping 经 DERP 返回，测试 HTTPS /api/v1/health 返回 200。本机 d1709b0 安装器再次校验固定 SHA-256，通过 Taildrop 连同 install-second-device-d1709b0.ps1 传输成功（exit 0）。脚本采用 UTF-8 BOM，PowerShell AST 检查和 -CheckOnly 已通过，后者只核对安装器摘要及未签名状态、未执行安装。正式由用户执行时拒绝仍运行的桌面同名进程/占用端口，固定安装到原 <第二台安装目录>，逐一匹配本机同候选 exe/Node/companion/index/JS/CSS 的六项摘要，记录安装退出码及原数据/默认 WebView 缓存目录保留；正常启动仍由用户从开始菜单完成，不设置新缓存覆盖。第二台尚未取回、安装或执行同 SHA 实机验收，不能将传输成功计为 G3 通过。

证据 second-device-taildrop-transfer.json，原安装器摘要 22D77DC4E62F095FA731696619B910F9D30FCFAD97843DAA249CA750550A2B51。本机旧独立 native PID 26844/创建时间仍符合原记录，等待用户关闭以继续 G1。当前目标有准备和传输进展，保持 active；总验收未完成。
### 2026-10-05 d1709b0 已安装：九任务恢复、真实 UI 创建与版本修改通过；新宿主等待旧独立窗口关闭

用户已人工完成固定摘要安装器的安装和启动，并确认原“桌面隔离验收”九张任务直接恢复。安装退出码 0，原测试数据与 WebView 缓存保留；当前 desktop 36040/companion 38736/WebView 25808 的创建时间、路径、父子关系、47831/9334 监听及精确 target 均核对。实际 JS/CSS 与同 SHA 构建一致。installed-result.json、installed-startup.json/png、installed-desktop-identity.json 记录这些事实。

当前安装版的 Windows UI 已创建专用空间“d1709b0 安装版闭环验收”和任务“G2 d1709b0 桌面读写验收 2026-10-05”，随后保存标题后缀“（已修改）”。首次观察器因 600 秒到期且未解包 payload.data 未通过，原失败不覆盖；修正后的只读观察先 GET 核对原任务版本 1，随后捕获实际 UI PATCH：HTTP 200、If-Match=1、非空 Idempotency-Key，同一任务版本变成 2，卡片与详情标题一致、未保存提示消失、无页面错误。installed-g2-edit-verdict.json passed=true，但 G2 总门槛未关闭。辅助脚本的浏览器 __name 与数组括号错误已留首次失败记录，无重复创建或写入补证据。

已切回九张任务的原空间，通过当前安装版正式“启动独立 Codex”按钮得到拒绝：“上次独立 Codex 仍在运行，可能含未发送草稿；请在该窗口处理草稿并关闭后重试”。旧 native PID 26844 的 FILETIME、路径、回环监听 60614、精确 target 均仍匹配；只读确认唯一编辑器为空、无模态框、无旧入口及注入节点。installed-g1-prior-host-refusal.json/png 保留拒绝与现场。需用户关闭先前用于看板/草稿验收的旧独立 Codex（保留当前聊天），然后再从当前安装版按钮启动新宿主；Computer Use 技能禁止代操作 Codex 界面。未删除运行标记或接管旧宿主。

证据目录 .artifacts/acceptance/2026-10-05-ci-d1709b0/。G0 已通过；G1 新包最窄布局/草稿全场景、G2 退出重启/卸载重装、同候选双设备 G3 及 G4 仍待完成。目标 active，当前有进展，不满足 blocked 或 complete 条件。下方“待安装/待启动”为早先历史状态，已被此节更新。

### 2026-10-05 人工安装脚本误判辅助进程：已修复并只读预检通过

用户执行新候选安装/启动脚本时在安装前被进程检查拒绝。现场旧主进程 19936、服务 8804、WebView 37724 与 47831/9334 监听均已退场；剩余同名 PID 42992 经原 native identity 的 PID/FILETIME/路径和真实 Codex 子进程 26844 核对，是包上下文启动辅助入口（--taskboard-package-helper），无主窗口或监听。脚本将其误判为桌面实例。未终止该辅助进程或原 Codex。

仅修复忽略目录内的人工验收脚本：只有旧记录的精确辅助 PID/创建时间/路径、辅助参数、无 GUI/监听及原 Codex 子进程身份全部符合才排除；其他同名进程继续阻止安装。新增 -ValidateOnly，PowerShell 语法解析和当前现场预检已通过，安装器未执行，新安装目录仍不存在。原失败脚本/诊断保留；manual-helper-fix-verdict.json 记录边界。用户可重跑同一 install-and-start-taskboard.ps1 命令。G0 不变；G1–G4 仍待新安装版实测。


### 2026-10-05 新候选 d1709b0：G0 通过，安装版复验待启动

编号样式修复已单独提交并推送 d1709b0c789287b74256ac3ab6f8406f43c570a8，保留此前未提交的交接/验收记录。隔离 git archive 精确源码 frozen install、typecheck/lint/test/build 均退出 0：无数据库 109 passed/15 个预期 skips，独立真实数据库 124/124；8 项原始 HTTPS 浏览器检查通过，执行前核对实际服务的 JS/CSS 与精确生产构建逐字节 SHA-256 一致，服务端源码相对 425ab6e 未变且人工 API 未重启。编译入口与隔离生产离线回归退出 0，离线冷启动、草稿保留、禁写、恢复/撤权清理正常；55539/47834 已释放、47830 保持。最初辅助脚本正则语法错误及隔离配置重复加载 Playwright 的失败均在测试前发生，失败与修正记录保留。

CI #37308434077 同 SHA 的 verify（111757651296）、container（111757650935）、windows-desktop（111757651204）全部成功。安装包 ZIP 11344394288 摘要 640e9367e227843c58a017d333ce1464da9576a3d12716144bde36440f5765e6 与 GitHub 匹配；codex-taskboard-d1709b0-setup.exe SHA-256 为 22D77DC4E62F095FA731696619B910F9D30FCFAD97843DAA249CA750550A2B51，24,639,661 bytes，0.1.0，NotSigned。证据 .artifacts/acceptance/2026-10-05-ci-d1709b0/，g0-verdict.json passed=true。安装器尚未执行。

已准备 install-and-start-taskboard.ps1：只在原 Taskboard 进程和验收端口全部释放后，校验固定安装器摘要、安装到新隔离目录，并复用原测试数据及 WebView 缓存启动；不自动执行该脚本。此前安装版自动启动被审批拒绝，继续保留人工启动边界。下一步用户从本机 Taskboard 托盘退出后手动执行脚本，确认原九张任务/错误文字；再从新安装版重新取得独立宿主归属，复验最窄编号、G1 拒绝/清理、G2 生命周期和同候选双设备 G3。G1–G4 未通过，当前最窄实机是旧 425ab6e，不能把生产对照当新包通过。


### 2026-10-05 最窄实机：列表编号缺陷与源码修复

用户已到系统最窄。425ab6e 实际 native 480×600、iframe 424×552、可滚动内容 409px；导航自动收成图标栏。看板自动一列（373px），四个筛选控件、顶部按钮、列表表头/行（182px 130px）及单列详情字段均无横向越界。实际列表却把 TB-2、TB-3 等编号拆成两行；Range 行顶坐标和截图均复现。因此完整最窄可读性未通过，不能用 noHorizontal/controlBounds 代替；installed-g1-responsive-424-verdict.json 的 passed/gatePassed 均为 false。已关闭详情并恢复看板，原项目、空编辑器哈希、document 与归属保持。

apps/web/src/styles.css 的基础 .list-row b 增加 flex-shrink:0 和 white-space:nowrap，两行修复保留长标题换行。提交前工作树 pnpm@10.28.0 check 退出 0，109 passed、15 个预期数据库 skips；生产资源隔离对照覆盖 935、618、424、409、360、185px，旧包在 424/409px 复现编号换行，新构建全部编号一行、无水平溢出且无页面错误。证据 .artifacts/acceptance/2026-10-05-list-number-wrap/ 的 check-result.json、check.log、production-layout-comparison.json 和 before/after PNG。此处是源码生产资源验证，新安装包实机复验仍待完成。最窄人工尺寸等待已解决、审计计数归零。G1–G4 保持未通过；新候选还需同 SHA 的 G0。


## 2026-10-05 本机：草稿清空确认与正式重新接入

用户报告清空后，只读检查确认唯一编辑器为空、无弹窗，原项目、安装版与受管理宿主的 PID/FILETIME/路径/父子归属、47831/9334/60614 监听者及精确 target 一致。之前成功草稿路径撤除了入口；本次通过正式安装版按钮重新接入，并实际 Windows 点击 Taskboard 自有入口展开九任务看板，已同步。重新接入期间页面 timeOrigin 变为 1791199646634.1，空编辑器 HTML 哈希及选中项目保持不变。没有再次填写或发送草稿。47830 预览 API 健康接口正常。

真实 iframe 935px，document scrollWidth/clientWidth 均为 920px，三列布局且无横向溢出。该项只证明宽窗口；更窄真实窗口、其余拒绝/清理和 G2–G4 仍待验收。原清空等待三轮审计已存档，本次计数重置；恢复初期 goal 工具保留此前 blocked 元数据；继续工作后的最新 get_goal 已确认 active，未标记 complete。

证据目录 .artifacts/acceptance/2026-09-30-ci-425ab6e/：installed-g1-cleanup-verdict-20261005.json、installed-g1-cleanup-reattached-20261005.json、installed-g1-cleanup-reopened-20261005.json/.png。installed-g1-progress-summary.json 已更新 manualCleanupPending=false，gatePassed 仍为 false；保留上一份摘要和旧阻塞审计。

### 2026-10-05 真实缩窄窗口：618px 已验证

用户手动缩窄后，实际 native width=963px、iframe=618px（不将约 780px 请求值当测量值）。看板自动为两列，每列 273.5px；document/body scrollWidth 与 clientWidth 均为 603px，无横向溢出。四个搜索/筛选控件、两顶部按钮边界完整。实际 Windows 切换列表：九行，任务/状态两列，表头及首行 grid 均为 376px 130px；负责人和优先级列在该断点隐藏。实际打开 TB-2 详情，字段、按钮、详情容器均在水平边界内，内容没有水平滚动；随后关闭详情并切回看板。原项目、编辑器空白哈希、timeOrigin、归属均不变。聚合 installed-g1-responsive-618-verdict.json passed=true；这是当前宽度通过，gatePassed=false。

下一步保持原导航和看板展开，由用户手动缩到系统允许的最窄；继续读真实 iframe 尺寸，覆盖 560px/360px 以下断点。G1–G4 其余门槛仍待完成。

### 2026-10-05 安装版接口拒绝补验

仍为同一 425ab6e 安装版及原生绑定。缺少本机认证、错误本机认证请求均 HTTP 401 / LOCAL_AUTH_REQUIRED；有效认证但缺少必填字段的请求 HTTP 400 / VALIDATION_ERROR。三种拒绝后原 document、入口/容器 generation=3、展开 iframe、选中项目及空编辑器哈希均不变；TB-2 版本 2、状态未变。installed-g1-local-boundary-20261005.json passed=true；这不替代真实宿主弹窗/会话/结构漂移拒绝。check-current-native-modal.ts 已准备并通过 Node 语法检查，未执行真实弹窗验收，未计通过。

最新只读最窄就绪检查仍是 native width=963px / iframe=618px；需要用户完成实际最窄尺寸调整。get_goal 最新确认 active，goal-next-user-wait-audit.json 将上一轮及本轮分类为 progress，当前人工尺寸条件计数 1，未达到 blocked 阈值。G2 还需正常托盘恢复/退出重启及卸载保留；之前自动初次启动被策略拒绝的动作未通过其他路径重试。G1–G4 仍未完成。

## 2026-10-01 本机：用户就绪后恢复安装版 G1

用户回复“已就绪”后重新核对当前 425ab6e 安装版与新受管理 Codex 的 PID、FILETIME、监听归属和精确主页面。已登录，唯一选中项目经只读数据库解析与当前检出、本机映射一致；唯一消息编辑器为空，无模态框。测试 API 健康，安装版已同步。见 .artifacts/acceptance/2026-09-30-ci-425ab6e/installed-login-ready-verdict.json。goal 当前 active，旧登录等待阻塞计数重置并保留历史审计。新宿主尚无侧栏入口，正在通过正式安装版按钮接入；该就绪检查不计 G1 通过。G1–G4 仍待完成。

### 同一安装包与真实宿主的本轮结果

通过正式安装版“接入 Codex 侧栏”，Windows 实际点击入口打开九任务内嵌看板；列表/看板切换、再次点击收起、重开均正常，项目和空编辑器保持。真实 iframe 宽 935px，三列布局，scrollWidth/clientWidth 均为 920px，无横向溢出。更窄的真实窗口检查尚未执行，不以旧提交的宽度证据替代。首个列表/看板观察器只按 iframe URL 匹配，漏取子帧，证据保留；更正为唯一直接子帧并验证本机 origin/root 后读取指标，不重做 UI 动作。

错误目录暂时映射到独立同提交检出，已安装 /v1/codex/open-draft 明确拒绝；document timeOrigin、侧栏 generation/pressed、展开 iframe、原项目及编辑器哈希全部保持，finally 映射恢复。另核对未映射仓库、不存在目录和无法验证会话路由的拒绝，原表面保持，未创建目录或写远端任务。错误目录结果为 installed-wrong-project.json 的 passed=true；不再采用旧“拒绝后重新接入”作为通过。

外部 Page.reload 一次后，同一原生进程与精确 target 保持，document timeOrigin 改变，安装版 nonce 握手及入口/iframe 恢复，项目和空编辑器哈希不变。重载恢复后默认收起，实际点击可再次展开；此项 installed-g1-external-reload.json 的 passed=true。

实际 Windows 打开内嵌 TB-2 详情并点击“在 Codex 中打开”，当前项目原生编辑器准确显示五个纯文本段落（含两空段），内容 SHA-256 b6d606c798d171430776e447ffa5d725b7d5112f57e58f38ca2febe5aacd75e5。未发送、未领取。重复安装版请求返回 opened=false，现有文档/项目/五段草稿完全不变。真实 frame-src/enforce 策略事件确认成功填写后的 CSP 恢复，入口和 iframe 按设计撤除；TB-2 服务端版本仍为 2、状态未变。UI 请求的成功 HTTP 响应因 iframe 清理没有被观察器捕获，该限制保留；实际 Windows 操作和原生精确内容证明成功，未重复成功写入以补观察。见 installed-g1-ui-draft.json 及截图。

当前五段测试草稿需要用户清空；Computer Use 技能禁止代操作普通 Codex 编辑器。清空后只读核对，再从正式按钮重新接入，继续真实窄窗口与剩余拒绝/生命周期验收。总进度在 installed-g1-progress-summary.json；G1–G4 仍未通过，goal 保持 active。

本次自动续验继续只读核对同一原生 PID/FILETIME/精确页面，五段草稿哈希保持、尚未清空。新增 installed-g2-retention-baseline.json：专用测试目录的设备身份、本机映射、当前账号和三份状态/DPAPI 文件校验值，以及已安装 EXE、随包 Node/服务和卸载器哈希均已记录；TB-9 仍为版本 2、修改标题保留。此为卸载/重装前基线，不计生命周期通过。观察器已修正非空编辑器优先判为 waiting_for_user_draft_cleanup，避免误要求点击已移除的入口。goal 保持 active；本次阻塞审计为第二轮，与旧登录等待计数分开。

再次自动续验只读验证同一原生 PID/FILETIME、60614 监听归属与精确主页面仍存活；编辑器非空且草稿哈希完全相同，未发生人工清空。此前已完成的独立 G2 保留基线无新增必须操作；剩余原生接入/窄窗口/生命周期需要清空当前草稿，第二台同版检查仍需用户操作，G4 尚未满足前置门槛。本次清空条件已连续三轮，goal-g1-cleanup-wait-audit.json 记录 blocked 阈值满足，goal 标记 blocked；G1–G4 未完成。用户清空后恢复时重新验证实时状态并重置阻塞计数。

## 2026-09-30 UTC：425ab6e 人工启动后的安装版续验

实机记录使用 UTC 时间；本机 Asia/Shanghai 的进程核对时间已为 2026-10-01。用户人工运行准备脚本并提供八任务/已同步截图后，旧启动阻塞解除，goal 恢复 active。没有使用其他自动入口重试之前被拒绝的启动。原用户启动预览 API PID 36200/47830 保持运行。

新的桌面 PID 19936、FILETIME 134352664101202080、Node 8804、WebView 37724、47831/9334 监听归属和精确页面 target 2E3C303DECD60E0F8EB5A052C9D345D3 均独立验证，见 resumed-runtime-verification.json。沿用原数据/原 WebView 缓存启动后，root 有内容，实际加载 /assets/index-ZRFQ48Sw.js 与随包 index.html 一致；八张原任务、TB-8 已修改标题及“已同步”均保留。旧 Service Worker 仍注册，但本次没有白屏；这只证明这次启动，不替代第二台默认缓存连续冷启动门槛。

实际 Windows Taskboard 界面创建 TB-9，再修改标题并点击保存：任务 ID 689aeda1-afec-4e17-b352-dd56fb2ed805；POST/PATCH 代理均 HTTP 200，创建版本 1，修改 If-Match 1 返回版本 2，两个 Idempotency-Key 不同。卡片和详情标题均已更新，“未保存草稿”消失，显示“任务已保存”，当前共九任务。任务标题的 2026-10-01 是观察到的本机日期。观察器等待 5 分钟先超时，只记录创建；续观察没有重复创建，捕获修改后因 getByText 匹配卡片及 textarea 而断言失败。随后只读判定第一次表达式写法未执行、第二次过宽 span 选择器匹配父子两个 span；原失败记录保留，最终使用 .task-card .task-title > span 和已知 textarea 分别核对，installed-g2-create-edit-verdict.json 的 passed=true。该判定不会覆盖原错误或代替正常托盘退出/卸载/重装验收。

通过安装版“启动独立 Codex”按钮创建新宿主：原生 PID 26844，FILETIME 134352684260320075，宿主 26.928.1915.0，127.0.0.1:60614 归属一致，精确 target 78B076B73CADCC27E31A87C24449CAD0 / app://-/index.html，独立 profile 与 codex-home 位于 managed-codex/0wg2P3ZjbULGQO18VfDTFM0X。辅助 PID 42992 的路径、启动会话及 launcher PID/FILETIME 参数匹配；父 PID 28536 为已结束的短期包上下文 PowerShell，不能误要求 helper 直接以桌面为父。首次只读解析器未覆盖整个参数被引号包裹的形式，随后已适配；此为观察器纠正。未输出辅助进程的完整命令行或私有握手材料。

installed-native-login.json 显示登录提示可见，项目/编辑器/Taskboard 入口均为 0；本次等待用户在这扇新窗口登录、打开当前仓库并保持空编辑器。Computer Use 技能禁止代操作认证和普通 Codex 项目界面，因此该动作交由用户完成；不会要求点击尚未接入的看板入口。下一步使用本次 installed-native-identity.json 复验错误目录等拒绝是否保持入口/展开看板，再做草稿成功、窄窗口、正常退出及同版双设备门槛。G1–G4 仍未通过。

自动续验已完成新的 native-binding.ts 与 check-current-wrong-project.ts：身份来自本次安装记录，错误目录检查严格要求原 document timeOrigin、入口、展开看板、iframe、项目和编辑器哈希均不变，finally 只恢复临时本机映射，不以重新安装侧栏掩盖拒绝失败。--inspect-only 实际检查确认新原生进程/主页面仍存活且停在登录页；acceptanceExecuted=false、没有改变映射或填写草稿。另以已安装浏览器的正式本机 capability 只读确认当前 TB-2 ID a422d8fb-005e-4e69-b618-936622c808fe、版本 2、空间/仓库及本机映射正确，见 installed-g1-current-data.json。首次误用 CLI key 访问浏览器代理被 LOCAL_SURFACE_DENIED 正确拒绝并保留；浏览器只读观察器的首个回调因构建器 __name helper 失败，随后使用原始只读表达式完成检查。登录/项目选择仍需用户。下一自动续验再次验证同一原生进程、FILETIME、回环监听与精确主页面存活，登录提示仍可见、项目数 0；同一新阻塞连续三轮，goal-login-wait-audit.json 记录 blocked 阈值通过，goal 标记 blocked。G1 实际检查尚未执行，原完整 G0–G4 范围保持；用户完成登录/项目选择并恢复后重新核对当前运行身份。

本次证据目录：.artifacts/acceptance/2026-09-30-ci-425ab6e/。第二台 425ab6e 安装器已 Taildrop 发送，领取/安装仍未确认。

更新日期：2026-09-30。工作分支：`codex/initial-implementation`。下方保留早期审计、实现和实机验证记录。

**本记录不是首版发布通过证明。浏览器协作、部分 Codex 内嵌和 Windows 安装版流程、隔离 HTTP Compose 恢复演练及内部 CA HTTPS 演练已验证；G1–G4 的完整门槛仍未通过。** 2026-09-09 的开发预览快照保留在后半部分；当前提交、推送和换机步骤见根目录 [交接文档](../HANDOFF.md)。本项目仍未打标签或发布正式 Release。

下一轮逐项通过条件见 [闭环验收计划](closure-acceptance.md)。该计划不改变下述历史结果。

## 2026-09-30：425ab6e 已安装，等待人工启动

升级前重新核对 45acfd3 桌面、伴随服务及原生宿主的精确进程归属，唯一项目和编辑器为空。安装版认证 /internal/shutdown 返回 202；47831 释放，但伴随 Node 在 25 秒观察期内未退出。实际宿主清理确认入口与容器移除，frame-src CSP 策略事件恢复，项目和空编辑器保持。随后只对已核对路径与 FILETIME 的测试宿主、包启动辅助进程和桌面实例执行受控退场；伴随 Node 在父进程结束后退出，47831、9334、63322 全部释放，原用户启动的 API PID 36200/47830 保持运行。此证据不算正常托盘退出通过。

425ab6e 的校验过 NSIS 安装器已在新独立目录安装，退出 0，原验收数据与 WebView 缓存保留。随包 Node 为 22.16.0，安装后 exe SHA-256 为 696FACC6BF0C308919BE6AA429427B193331BC30A7D2717C632ADA2A82212249，companion.js 为 4A074711323ACCCB49E078F04FA38DA9E125E49264ECDAA555B1F37C4C7AABF7；编译产物包含清理前草稿校验。

随后启动已安装程序的自动命令被审批拒绝，仅返回 blocked by policy，未给出具体原因，整条命令未执行。未使用其他自动入口重试该启动。已准备 .artifacts/acceptance/2026-09-30-ci-425ab6e/start-installed-taskboard.ps1，采用 Windows PowerShell 兼容的 UTF-8 BOM，使用原数据/原缓存并在人工成功启动后保存实际进程和页面绑定；只读语法检查为 0 个错误，不算启动证明。最后实态为新桌面进程不存在、47831/9334 空闲、原 API 仍在。旧桌面和原生 PID 记录全部过期，后续只使用人工启动脚本生成的新身份。G1–G4 仍未通过。

## 2026-09-30：425ab6e 侧栏拒绝修复的基础门槛和 CI 产物

修复提交 425ab6e24324f74fe14161536598ca8f531e867f 已推送。类型检查和 lint 单独通过，pnpm 10.28.0 check 退出 0，109 项通过、15 项预期数据库跳过。环境自带 pnpm 11.25 首次执行在自动依赖处理阶段因 NO_TTY 中止，未运行测试；保留失败日志后使用项目指定 10.28.0 获得通过，没有清除工作树依赖。

精确 detached ASCII checkout 冻结安装退出 0，真实独立数据库 19 文件、124 项全部通过，55539 端口释放。用户人工启动的 HTTPS API 上原始浏览器 E2E 8 项通过、15.6 秒；生产离线回归通过，验证离线冷启动、草稿保留、写入禁用、重连和撤权清理，独立 47834 端口释放。原 47830 API 保持运行。新本机证据在 .artifacts/acceptance/2026-09-30-ci-425ab6e/ 和 .artifacts/acceptance/2026-09-30-g0-425ab6e/。

同一提交 CI #36734441283 的 verify 109952300840、container 109952300505、windows-desktop 109952300709 全部成功。安装包 ZIP 产物 11106642717 的 SHA-256 为 4D1F7B1598A02923027319593647309CF6AC9BFD87EEA2C38D453B0024BE5FBA，与 GitHub digest 匹配；NSIS 安装器 codex-taskboard-425ab6e-setup.exe SHA-256 为 341B2053F8B0D7B9D85073DFBFF1D4DE6D66F6E3BC0B5FCA56814E3E891CCE8A，NotSigned，24,643,522 bytes。已通过 Taildrop 成功发往 codex-server，尚未确认领取、安装或运行。

该阶段现场仍运行 45acfd3 安装版，侧栏已恢复。其后已受控退场并安装 425ab6e，最新启动状态见上节。源码回归不代表修复安装包的实机通过；安装版错误目录拒绝、正常启动、同版 G1–G3 和真实窄窗口仍待完成，G1–G4 保持未通过。

## 2026-09-30：安装版读写、托盘恢复及拒绝路径的侧栏缺陷

45acfd3 安装版实际 Windows 界面创建 TB-8，再保存标题/描述和仓库，服务端版本依次为 1、2、3。已观察到 /api/v1 代理请求、If-Match 和 Idempotency-Key、HTTP 200 响应及内嵌看板自动出现八张任务。最初观察器选错协议后在写入前停止；修正后的长观察器超时，只记录创建，不能算完整通过。随后聚焦观察器确认修改后的服务端版本 2 和实际仓库保存 2→3，退出 0。失败与后续证据均保留在 .artifacts/acceptance/2026-09-30-ci-45acfd3/installed-g2-create-edit.json、installed-g2-repository-save.json。

实际 Alt+F4 隐藏安装版窗口并保留主进程/服务；再次启动恢复原窗口和同一伴随服务。另一个无窗口同名进程是原有包启动辅助进程，不是重复桌面实例。未映射仓库、缺少本机认证和不可验证会话路由均被拒绝，原项目及空编辑器保持不变。该证据不等于正常托盘退出、卸载或重装。运行脚本与安装 runtime/web/index.html 一致；旧 Service Worker 仍注册，当前页面正常，仍需默认缓存连续冷启动复验。

安装版错误目录测试复现了 G1 缺陷：请求 opened=false、空编辑器和项目保留，但持续侧栏入口与内嵌容器被移除。测试 finally 已恢复原映射、官方侧栏入口及展开状态。原观察器的 passed 只代表拒绝和恢复；另存 installed-wrong-project-verdict.json 明确该项 G1 未通过，不能掩盖界面改变。源码修复将项目、编辑器、弹窗、页面归属和当前看板校验移到清理前；合法请求仍在恢复 CSP 后再次校验，再写入未发送草稿。

修改后的适配器及独立 Chromium CSP 回归 38 项通过，覆盖错误目录、缺失目录、已有文字和弹窗时无重载、原侧栏及草稿保留，以及合法草稿前恢复 CSP。这是源码回归，修复安装包的同一场景仍待 CI 产物实测。G1–G4 保持未通过。

## 2026-09-30：45acfd3 安装版持续侧栏入口与实际点击

新受管理宿主 PID 38836 已由用户完成登录和项目选择；只读核对唯一选中项目 fe50e2f1-e682-498d-b2a2-ea9398683c45 在本次独立 Codex home 内唯一映射到当前验收仓库，与安装版本机仓库映射一致。唯一编辑器为空，无弹窗，初始确实没有 Taskboard 入口。通过已安装窗口的“接入 Codex 侧栏”按钮恢复一个持续入口，probe 返回 embedded=true；本轮未创建临时源码适配器或注入超时任务。

Computer Use 在同一独立窗口实际点击 Taskboard 自己的入口、列表/看板切换和收起/再次展开均成功。内嵌页面 URL 与安装版配置相符，显示“桌面隔离验收”、TB-1～TB-7 和“已同步”；看板实际内容宽 920px，列表宽 935px，document/body scrollWidth 等于 clientWidth。列表四列表头与首行 x/width 一致。收起时 aria-pressed=false、容器 display=none；再次展开时 true/flex，七张任务仍在。项目未切换、编辑器仍为空。现场窗口当前保持看板展开，持续入口归属安装版伴随服务。证据在 .artifacts/acceptance/2026-09-30-ci-45acfd3/installed-sidebar-interaction-result.json、installed-sidebar-*.png/.json、installed-frame-*.json。

实际窗口缩窄尚未完成。尝试 CDP 浏览器窗口 API 返回“Browser window not found”，未改变窗口尺寸；这不算缩放通过，也不是 Taskboard 功能失败。Computer Use 技能限制原生 Codex 界面操作，尺寸变更需用户手动完成。安装版完整草稿/拒绝路径、同版 G2/G3 仍待验收，G1–G4 保持未通过。

## 2026-09-30：45acfd3 精确提交本机 G0 续验

在精确 detached checkout 执行冻结安装通过。位于中文用户目录的 PostgreSQL 本机二进制初始化出现 invalid byte sequence for encoding UTF8（0xb8）；同一二进制的对照验证表明，在中文二进制路径下使用 ASCII 和中文数据目录均失败，在原 ASCII 二进制路径下两种数据目录均成功。未修改 Taskboard 源码以获得通过。保留失败与路径对照记录，再在 .artifacts/acceptance/2026-09-30-g0-45acfd3/checkout 的精确 ASCII checkout 使用 Node 24.19.0、pnpm 10.28.0 冻结安装并执行 pnpm test:db：19 个文件、124 项通过，进程退出 0，独立 55539 端口释放，现有 47830 API 及 55439 数据库保持运行。

同一提交的原始浏览器 E2E 使用已由用户启动的 HTTPS API 和配置 webServer=[]，8 项通过、17.7 秒、退出 0，包括两浏览器实时更新/冲突草稿和紧凑内嵌布局。生产离线脚本退出 0，验证离线冷启动、草稿保留、写入禁用、重连、撤权后缓存清理；使用新建独立 *_test 数据库并正常清理，47834 端口释放。没有重启用户 API。新日志及结果均在 .artifacts/acceptance/2026-09-30-g0-45acfd3/。这些自动回归不替代第二台已安装桌面验收。

## 2026-09-30：45acfd3 CI 安装版升级与新宿主登录前检查

代码候选 45acfd3b1c05b8d3a38f63625e5a9255a1b67a97 的 CI #36713309548 三项作业全部成功（verify 109880054564、container 109880054434、windows-desktop 109880054091）。Windows 产物 11095732356 的 ZIP SHA-256 为 ED82CC2BD1002C443B7B12C3E5C3A6DAD5F1927E57B8EDB9089B899E88F6F50E，与 GitHub digest 匹配；其中 NSIS 安装器 SHA-256 为 44CF500B739D33A799DEC0AE2F34A87A35F543A6C8D2B000BF7E922D4939B7F4，签名状态 NotSigned。

使用正式源码版本清单和标记补查 CDP 指针后，入口仍在“等待可见、可用且稳定”阶段超时，退出码 1。没有确认点击，不能解释为产品点击通过，也未确认其底层原因；已清理服务、入口和复制的凭据，保留 installed-host-authenticated-pointer.json/.log。组件事件通过仍只算组件证据，安装版实际点击待用户登录后的持续入口验证。

升级前重新核对旧隔离宿主 PID 2172、精确 FILETIME、页面及唯一空编辑器，无弹窗和注入。仅清理核对过身份的旧测试进程，主程序、伴随 Node、47831 和旧原生 CDP 均释放；这次精确进程清理不算正常托盘退出。原预览 API 保持运行。安装到独立目录 .artifacts/acceptance/2026-09-30-installed-45acfd3，NSIS 退出码 0，安装前后 state.json、browser-session.dpapi、cli-key.dpapi 校验一致。随包 Node 为 v22.16.0，随包伴随服务包含新宿主支持。保留原数据目录和 WebView2 缓存冷启动，实际窗口直接显示“桌面隔离验收”、TB-1～TB-7 及“已同步”，未刷新或重新登录 Taskboard。新桌面 PID 41992、伴随 Node PID 27764、47831 归属已核对。

通过新版实际“启动独立 Codex”按钮创建新受管理宿主 PID 38836，FILETIME 134352453862940241、回环 63322、精确 target 00DB75D87823D4896287A78C4BE89727 与 app://-/index.html 一致，版本仍为 26.928.1915.0。安装版控制检查已不再拒绝版本，登录前 probe 返回“尚未观察到已验证的 Codex 页面标记”；只读检查确认登录提示可见，尚无项目、编辑器或 Taskboard 入口。此时不能接入侧栏，需用户在这扇新隔离窗口人工登录并打开项目。不得继续使用旧 PID 或旧源码诊断脚本的所有权常量。

精确安装器已经 Taildrop 发往在线 codex-server，传输退出码 0；尚无领取、安装或默认缓存冷启动确认。当前安装、原缓存启动和原生启动均已有新包证据，但持续侧栏、实际指针、缩放、完整草稿路径和同版 G2/G3 仍待验收，G1–G4 未通过。证据在 .artifacts/acceptance/2026-09-30-ci-45acfd3/，源诊断在 .artifacts/acceptance/2026-09-30-resume/。
## 2026-09-30：临时入口消失定位与新宿主组件验证

用户报告“没有任务看板”。上一轮临时入口诊断已因等待人工点击超时而以退出码 1 结束，清理了入口、源码伴随服务及复制的合成测试凭据；因此这次报告对应实际不存在的入口。此前的“请点击任务看板”交接失效，不能继续要求用户寻找已经被清理的控件。已停止这种临时入口交接方式，后续使用安装版管理的持续入口。

实际由 cf415a2 安装版创建的 Codex 26.928.1915.0（PID 2172、精确目标 0C9F06FA781A80889E55CD3B095B8056）已完成源码组件检查。仅复制指定合成账号的本机加密会话到临时诊断目录，读取 /api/v1/me 确认身份后加载同一生产 Web 构建；没有执行新登录或服务端写入。入口位于原生侧栏“新聊天”下方，272×32 像素，在视口内且中心命中入口。Taskboard 自有控件的 DOM 事件检查确认“桌面隔离验收”、TB-1～TB-7、看板/列表切换和侧栏收起/重开；真实 iframe 宽 920/935 像素时 scrollWidth 与 clientWidth 一致。截图已逐一读取，任务列表列对齐正常。清理后所选项目、唯一空编辑器、原生主区域内联样式均不变，实际策略事件确认 CSP 已恢复，源码伴随服务停止且复制的凭据已移除。

组件诊断最初在安装完成后才连接浏览器观察器，得到的 Frame.url 与实际 iframe 文档不一致，三次诊断先因 frame 绑定失败，改查后的两次因 URL 等待失败；实际文档 location 与配置的来源、路径和查询参数一致。将观察器连接移到安装前后，导航事件和实际文档均匹配，最终组件检查退出码 0。该修正仅在忽略目录内的验收脚本，未用诊断工具的初始帧状态误判产品支持。证据：.artifacts/acceptance/2026-09-30-resume/installed-host-authenticated-component.json、.log 以及 installed-host-authenticated-entry.png、-list.png、-board.png。

基于实际宿主的项目、草稿、拒绝、CSP 和组件证据，源码侧栏/草稿清单加入 26.928.1915.0，同时选择该版本已核对的 redesigned shell 标记；独立 Chromium 标记回归覆盖应用导航 rail、项目导航和可见 main 的正确选择。修改后 pnpm check 退出码 0：类型检查、lint、109 项测试和生产构建通过，15 项真实数据库测试因未在本命令提供测试数据库而预期跳过（将由同提交 CI 执行）。日志为 new-host-check.log。这是源码适配支持，尚不能关闭 G1：安装版持续入口、实际指针、自适应缩放和完整草稿路径仍待同一新安装包验收。G1–G4 保持未通过。
## 2026-09-30：新宿主源码草稿成功与人工清理

用户已重新登录本机 cf415a2 安装版。只读窗口观察确认“桌面隔离验收”、TB-1～TB-7 及“已同步”，原登录阻塞已解除。实际新原生宿主的进程归属及项目再次核验后，独立源码适配器向目标项目填写 TB-2 的五段合成验收草稿；五个 P 段落和拼接原文的 SHA-256 与请求完全一致。第二次请求返回 DRAFT_UNAVAILABLE，段落、原文摘要、项目和无注入状态前后相同。测试没有发送消息或调用服务端写入。源码进程临时启用候选版本，生产清单与安装版仍未改变。

用户随后报告“已清空”；实际只读复查确认唯一编辑器恢复 P→BR、所选项目和 composer 标签一致、无弹窗和注入。草稿截图辅助检查未能确认预期可见草稿，未输出具体失配字段；未取得草稿截图，不据此推断失败原因或关闭可见性要求。用户清空后的空编辑器另有独立只读证据。文本插入、重复拒绝与人工清理证据分别保存在 .artifacts/acceptance/2026-09-30-resume/ 的 installed-host-draft-success.json/log、installed-host-draft-cleanup.json 和 installed-host-draft-visual.log。

新宿主真实看板交互继续进行。源测试使用安装版已由用户登录的合成测试会话副本，在独立数据目录启动本机伴随服务，并继续用原安装版 native control 验证实际宿主归属；不修改原数据目录或调用上游写入。辅助脚本最初使用错误构建目录，在启动测试服务前失败，已保留 preparation-failure.json/log 并改为 Vite 配置的 dist/web。之后合成账号 GET 校验和受控握手成功，但 Taskboard 入口的指针稳定检查超时，已保存 pointer-timeout.json/log；退出后原项目、空编辑器和无注入状态恢复，测试服务关闭，副本凭据移除。

现已重新建立精确宿主中的 Taskboard 入口，活动诊断进程限时等待用户点击入口，然后继续看板/列表及侧栏开关检查；它不是通过结果。完整交互、自适应和新安装版复验仍未完成，G1–G4 保持未通过。

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

为验收真实任务按钮，已在同一忽略目录启动全新 PostgreSQL 集群和仅监听 `127.0.0.1:47830` 的测试 API。已安装 Taskboard 用合成账号登录，创建“隔离草稿验收”空间及 TB-1 测试任务，并经真实窗口把该任务的测试仓库地址映射到 `<第二台验收仓库>`，保存后读回匹配。这些写入只针对隔离数据库及隔离伴随服务数据。等待用户在新 Codex 实例登录并选中或创建指向当前仓库的测试项目，再做侧栏、CSP、真实任务按钮、未发送草稿与退出重启验收。G1 整体及 G2 仍未关闭。

用户已在该受管理 Codex 实例登录并选中 `codex-taskboard`。实机复核再次确认启动器持有的 PID、创建时间、回环监听者、唯一主页面、项目 ID 到当前仓库真实目录的唯一映射，以及唯一空白编辑器、无弹窗和无 Taskboard 节点。已安装 Taskboard 的侧栏接入首次被 3 秒 CDP 命令超时拒绝；第二次重试仍因 CDP 命令超时失败，清理阶段的 CSP 关闭命令未在 3 秒内获确认，伴随服务按设计锁定接入。没有填写任务草稿。随后在再次确认启动器归属和空白编辑器后，对该精确隔离页面显式关闭 CSP 绕过并重载；真实 `securitypolicyviolation` 的 `frame-src` 拦截、零 Taskboard 节点和空编辑器证明 CSP 已恢复。证据见 `installed-csp-restoration.json`。当前已安装进程仍保持失败锁定，不能把本轮算作侧栏或草稿通过；G1 整体及 G2 仍未关闭。

针对该实机问题，下一构建将受管理 Codex 的 CDP 命令与清理时限设为 15 秒、宿主重载就绪上限设为 120 秒、iframe 握手设为 15 秒，并将原生归属查询的回环响应时限设为 4 秒。所有操作继续在超时或验证失败时拒绝，不放宽 PID、页面、项目或编辑器身份检查。新构建需重新进行已安装程序验证和用户登录，不能沿用本轮未通过的接入结果。

本次超时调整后的 `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm desktop:prepare`、`git diff --check` 退出码均为 0；适配器 30/30、伴随服务 10/10、独立 Chromium CSP 生命周期 7/7 分别串行通过。最初并行测试因本机负载出现一项固定 6 秒参数断言不匹配、伴随服务用例超时及 Chromium 启动钩子超时；修正断言并串行复验通过，未把失败轮次计为通过。

新 NSIS 安装器 SHA-256 为 `8FD62243C762883616CFB64FFE302F7CB3EF1814F7432CF65503B1A73A0819B0`，24,587,132 bytes；隔离安装于 `.artifacts/acceptance/2026-09-26-g1-retest/中文 空格安装`，静默安装退出码 0，随包 `companion.js` 与准备目录 SHA-256 均为 `58BEC21BD858B3D16FCAC488E344E0E6FFA619FB07E29E7DC4D52901A6728536`。旧隔离 Codex 在空编辑器和 CSP 恢复确认后停止，旧伴随服务收到认证关闭请求并退出，旧 Taskboard 测试进程停止；均未动用户主 Codex 实例。

新包第一次用旧 WebView2 用户目录启动后，已安装窗口一度可见且启动了隔离 Codex，但随后 Taskboard 进程退出，原生归属随之中断。应用事件日志未找到对应崩溃事件；此轮不能算成功，首次 Codex 测试进程也已退出。再次用全新 WebView2 测试目录启动新包，窗口和本机 API 保持运行，合成账号重新登录并读到原测试任务。第一次原生绑定在 90 秒内未完成，稍后独立 CDP 只读核对见到唯一主页面；从同一启动器重试绑定成功，伴随服务通过私有通道报告 `draft: true`。新 Codex 仍需用户在隔离目录登录并选中当前仓库项目。原生 `CDP_TIMEOUT` 为 1.2 秒，首次绑定失败原因尚需在稳定负载下确认；侧栏及已安装草稿仍未通过。

用户随后在该新受管理窗口登录，并选中唯一的 `codex-taskboard` 项目。只读核验确认项目 ID 唯一解析到 `<第二台验收仓库>`，PID 14184 的 `127.0.0.1:52511` 监听与唯一 `app://-/index.html` 页面保持绑定，编辑器起初为空。已安装 Taskboard 的“接入 Codex 侧栏”成功返回 `embedded: true`；真实 iframe 的 React 页面可操作，“列表”切换生效，外部重载后入口和浮层恢复，且未出现重复节点。接入前实际 `frame-src` CSP 拦截已记录。证据见忽略目录 `.artifacts/acceptance/2026-09-26-g1-retest/sideboard-installed.json`、`sideboard-verification.json`。这项已安装侧栏验收通过。

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

### 2026-10-06：0748f67 第二台登录确认及设备A原空间核对

第二台用户确认当前候选登录后可以看到原验收空间及TB-1～TB-9。设备A在真正已安装窗口切回该空间，界面九任务与已同步可见，只读就绪核对退出0：七项随包文件哈希、合成账号、空间、设备本机映射与进程归属匹配。此为设备A当前运行及第二台人工登录结果，尚未取得第二台运行归属、默认缓存和映射的机器记录。已把只读诊断辅助脚本发往第二台，待回传后进入专用G3任务流程；没有写任务或重启服务。完整G3及G4保持未通过。证据位于当前候选验收目录：g3-current-two-device-readiness-progress.json、installed-g3-device-A-current-readiness.json。

### 2026-10-06：0748f67 第二台实际默认缓存运行就绪及离线故障工具准备

第二台实际诊断输出核对七项安装文件、当前运行归属、默认WebView缓存、合成账号、原空间访问及本机映射均通过。当前页面只渲染一张任务，所选空间/筛选尚未知，因此不冒充两端已开始观察原九任务空间。下一步由用户选择原空间并开始只读界面记录后创建专用任务。原始输出及评估分别保存为second-device-0748f67-readiness-20261006T150344-human-report.json、second-device-0748f67-readiness-assessment.json。

准备的断网转发器仅做了本机工具验证：独立端口200→503→200、原API仍200、Serve配置未变、辅助进程正常退出且端口释放。真实双设备流尚未切断，不计为离线通过。首次源码搜索命令的PowerShell解析失败已在准备记录注明，未启动产品测试。G3与G4仍未通过。

### 2026-10-06：0748f67 双设备专用 TB-10 已提交，待人工验收及第二台观察回传

用户已确认第二台选择原空间并准备观察。设备 A 使用同一已安装候选的随包 CLI 创建 TB-10（版本1），两条本机 CLI 子进程真实并发领取，仅一次成功、另一次 VERSION_CONFLICT；成功请求重放保持同一版本2和同一 execution。之后提交摘要与验证记录，版本升为3、execution 为 submitted。本机真实界面观察到待验收及结果记录；原九任务在各成功阶段保持原样。CLI 参数与结果有版本及幂等记录，但 wireObserved=false，未宣称捕获了实际 HTTP 请求。首次创建因验收工具遗漏必填 statusId 被产品正确拒绝（VALIDATION_ERROR）；失败证据保留，修正工具后成功，未改产品源码。

设备 A 的180秒提交观察已正常退出0，机器证据截至版本3待验收；第二台最终观察 JSON 尚未回传，计时范围及约2秒指标仍未验证。设备 A 的人工“验收并完成”尚未收到回报，不能代点后记为人工验收。桌面控制收到 Esc 后停止，后续仅做非桌面输入的诊断与证据整理。只读诊断工具已修正实际写按钮名称及 modal 覆盖，并在当前安装版确认归档、保存、领取、验收按钮可被记录；该工具可用验证不等于离线禁写通过。新版两份诊断工具已 Taildrop 发往第二台，传输退出0、PowerShell 解析错误0，尚未远程执行。

G0–G2通过，G3/G4保持未通过。待人工验收与第二台观察结果后核对最终版本4、一次验收活动及 execution released，再执行真实冲突草稿、已有实时连接中断后的离线禁写/恢复与撤权清缓存。证据目录为 .artifacts/acceptance/2026-10-05-ci-0748f67：g3-lifecycle-through-submit-progress.json、installed-g3-lifecycle-A-create-2026-10-06T15-21-00-061Z.json、installed-g3-lifecycle-A-create-2026-10-06T15-22-35-296Z.json、installed-g3-lifecycle-A-claim-2026-10-06T15-23-33-663Z.json、installed-g3-lifecycle-A-submit-2026-10-06T15-25-18-933Z.json、installed-g3-device-A-submit-accept-surface-20261006.json、installed-g3-surface-after-label-correction-20261006.json、g3-write-controls-observer-correction.json。

### 2026-10-07：桌面控制恢复，发现并修复长执行记录的详情面板溢出

用户明确交还桌面控制；get_goal 返回 active，新阻塞审计从本次恢复重新计数。本机当前仍是 0748f67 已安装候选，真实 Taskboard 的 TB-10 详情、结果摘要、验证记录及“验收并完成”可见，仍处于待验收。只读归属和精确页面校验保持；测得详情面板 clientWidth=563、scrollWidth=892，执行记录可用491却撑到856。未换行的 pre 和 flex 子项 min-width:auto 共同造成横向溢出。诊断只读取合成验收页面，没有写任务或 Codex 草稿。

工作树已修复 activity 子项缩窄、长文本断行及验证记录 pre-wrap。新增实际 TaskDrawer 浏览器回归，用模拟 API 的长验证记录、连续链接、会话引用和评论验证桌面/内嵌两种布局，覆盖1320、935、424、185px；修复前2项均失败，修复后2项均通过，文本完整保留。整项目 tsc --noEmit、新回归测试 ESLint、独立输出目录的 Vite 前端生产构建均退出0；没有将此浏览器回归当作已安装程序或真实双设备通过，也未宣称完整 pnpm build/G0重验。临时Vite测试进程按归属核对后退出，4173释放；安装版及API未退出或重启。

首次诊断工具会话缺少WebSocket，改用工具Node24的保存脚本后读取成功；首次pnpm封装器在启动测试前触发无TTY依赖检查拒绝，记录保留，随后直接调用已安装Playwright/Vite CLI完成回归，未清空依赖。

产品CSS及新增回归尚未提交或进入新安装包；当前安装候选的G0–G2历史结果只适用于0748f67。G3人工验收/第二台完整观察及冲突草稿、真实离线禁写、撤权清缓存仍未闭合，G4未通过。下一步先取得TB-10人工验收和第二台观察结果，完成旧候选生命周期只读核对；布局修复进入新候选后重新核对适用门槛。证据：.artifacts/acceptance/2026-10-07-g3-resume/task-detail-overflow-fix-progress.json及所引用的实际宽度、失败/成功回归、类型检查、lint、前端构建和临时服务退出记录。

### 2026-10-07：布局修复已提交，29aa095 同提交 G0 与 CI 通过

长执行记录溢出修复已在独立分支 `codex/task-detail-wrap-20261007` 提交并推送，候选 SHA 为 `29aa09578cee2a59ddbe5bb5c1b36965bda8d579`。仅修改活动记录的断行/缩窄规则和对应浏览器回归；原验收工作区仍保持 `0748f67` HEAD，旧安装版 TB-10 的人工验收现场保持。

新候选本机 Node v24.19.0、pnpm 10.28.0 的冻结安装及无数据库 `pnpm check` 退出 0：109 用例通过、15 个数据库用例按预期跳过。第一次在中文用户目录内的工作树执行 `pnpm test:db` 时，原生 initdb 退出 1，尚未启动测试；补采 stderr 确认 `invalid byte sequence for encoding UTF8`。保留原失败和诊断后，同提交的 ASCII 路径 git archive 独立检出再次冻结安装，真实数据库用例 19 文件、124/124 通过，未跳过。该结果记录隔离路径限制，不推断所有 Windows 用户目录均兼容。

真实 PostgreSQL 55440 与专用 API47833/前端4174 完成原浏览器套件 12/12，含数据库协作冲突及桌面/内嵌长记录回归；同候选生产构建的离线冷启动、草稿保留、只读控件、重连与撤权清缓存检查退出 0。这些是独立 Chrome 验证，不能替代两台已安装 Windows 程序的 G3 结果。数据库 serve 包装进程由 Ctrl+C 停止（包装退出 1），专用端口 55440、4174、47833、47834 和候选 Node/PostgreSQL 辅助进程均已核对释放；原预览 API、原数据库、当前安装窗口与诊断端口继续运行。

CI run `37560421232` 的 verify、container、windows-desktop 均完成并成功，head 与候选一致，包含真实数据库浏览器测试、生产/离线检查、Compose 恢复、内部 CA HTTPS、Rust 用例及 NSIS 构建。安装包归档 SHA-256 `D71D8D28FCDE2BC6A93A1EA94D554B03C405E73EFA198140969976AA45BB9A5D` 与 GitHub artifact digest 一致；安装器 SHA-256 `AD8A4C625DE5461B326733250AFE8716852796D3D95E81DB25694C4386EC586D`，签名状态 NotSigned。安装辅助脚本已完成语法与仅校验检查，未安装或启动新候选。GitHub 连接创建草稿 PR 返回 403 Resource not accessible by integration；修复分支已推送，未创建 PR 或合并。

29aa095 的 G0 通过，G1–G4 尚未通过；0748f67 的历史 G0–G2 不自动沿用。当前真实安装窗口再次确认 TB-10 version3/待验收、结果与验收按钮可见；设备 A 人工验收及设备 B 完整生命周期观察 JSON 仍未收到。按闭环验收计划 G3 第3项，人工验收应由设备 A 的用户执行。取得结果后先核对旧生命周期，再进行新候选安装版复验和剩余真实 G3 场景，最后进入 G4。证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/g0-verdict.json`、`g0-cleanup.json`、`ci-result.json`、`install-helper-preparation.json`、`manual-step-next.json` 以及保留的首次失败和实际执行日志。

### 2026-10-07：TB-10 人工验收及设备 A 最终状态已核对

用户报告本机 TB-10 已完成。0748f67 同提交已安装候选的只读 CLI verify 实际退出0，任务为 version4/已完成，服务器恰有一次 task.accepted 活动，唯一执行已 released，原九任务的版本、状态及内容哈希均保持。核对前后桌面 PID/创建时间、伴随服务归属、监听端口与随包文件哈希保持一致；未由工具写任务，wireObserved=false。

另一次真实安装表面只读观察实际退出0，精确 targetId 保持，选中“桌面隔离验收”、显示“已同步”，十张任务可见；TB-10 卡片位于“已完成”，缓存版本4、语义done。设备 A 人工验收条件已解决，无需重复点击。设备 B 完整生命周期观察 JSON 尚未回传，约2秒可见指标与最终状态仍未核对，G3保持未通过。

29aa095 新候选启动辅助脚本已按实际安装目标准备并完成语法检查，保留原验收数据及 WebView 缓存；未安装/启动新候选。继续先取得第二台完整观察，再进行相关安装版复验与剩余 G3 场景，G4仍未进入。证据：`.artifacts/acceptance/2026-10-05-ci-0748f67/installed-g3-lifecycle-A-verify-2026-10-07T03-54-20-884Z.json`、`installed-g3-device-A-human-accepted-surface-20261007.json`、`g3-lifecycle-through-submit-progress.json`；新候选工具准备见 `.artifacts/acceptance/2026-10-07-ci-29aa095/start-helper-preparation.json`。

### 2026-10-07：第二台完整观察记录回传，但仅覆盖创建前基线；观察器已修正

用户回传第二台完整180秒观察 JSON。0748f67 文件哈希、精确页面、默认 WebView 目录、进程归属和合成账号一致；355次轮询中仅一组稳定状态，原空间显示已同步和九张任务，trackedTasks/trackedCards 全为空。该记录的 passed=true 证明读取与归属校验成功，不证明 G3 生命周期通过。

记录窗口为2026-10-06 15:18:23.272Z至15:21:24.059Z（北京时间23:18:23至23:21:24）；本机成功创建CLI实际开始于15:22:31.433Z、结束于15:22:31.835Z（北京时间23:22:31）。按两侧记录时间，观察在创建命令开始前约67秒已结束；跨设备时钟未独立校准，不能由此计算通知延迟。更直接的覆盖证据是整份记录未包含TB-10，因此最终状态、各阶段可见性和约2秒指标仍未证明，也未据此认定产品同步失败。设备A已经验证的TB-10人工验收version4/done保持。

仅调整忽略目录中的验收工具：默认观察延长到600秒，每次状态变化及每5秒原子保存进度；先验证实际测试空间/合成账号/渲染资源，再发出就绪信号；进行中的JSON明确标记待最终归属核对。15秒首轮观察本身完成通过，但读取检查点时已结束，原始探针覆盖未通过结果保留。60秒复验实际捕获运行中的observing检查点（未带最终passed），结束后退出0、complete、归属保持、passed=true；该工具验证没有写任务或重载页面，不计为G3生命周期/离线通过。

29aa095对应的持续观察器、进程归属包装器和已安装文件清单生成器均已准备，Node语法和PowerShell解析通过；实际文件清单须在已校验CI安装包安装完成后生成，缺少清单或candidate/hash不匹配时拒绝观察。再次仅校验安装辅助脚本通过，尚未安装或启动新候选。桌面目标只返回当前Taskboard主窗口与资源管理器，没有通知区域菜单目标；下一步需要用户正常托盘退出本机旧候选，随后核对进程/端口释放并安装新包。原预览服务保持，G3/G4未通过。

证据：`.artifacts/acceptance/2026-10-05-ci-0748f67/second-device-0748f67-surface-20261006T151823-human-report.json`、对应`assessment.json`、`g3-continuous-observer-preparation.json`、`continuous-observer-live-checkpoint-validation.json`、`continuous-observer-live-checkpoint-validation-second-attempt.json`、`continuous-observer-local-live-validation-60s.json`；新候选工具见`.artifacts/acceptance/2026-10-07-ci-29aa095/g3-observer-preparation.json`、`preupgrade-native-target-inventory.json`和`manual-step-next.json`。

### 2026-10-07：29aa095 安装版最窄内嵌布局与第二台就绪；漂移故障清理仍待复验

同一候选提交 `29aa09578cee2a59ddbe5bb5c1b36965bda8d579` 的真实受管理 Codex 窗口实测宽 480px、iframe 宽 424px。在原“桌面隔离验收”空间，看板显示十张任务并重排为单列；列表显示十行、任务编号保持单行。文档、搜索、筛选和按钮均无横向溢出。打开 TB-10 后，详情字段和按钮边界正常，五条活动记录及其子项 scrollWidth 均不超过 clientWidth，子项 overflow-wrap 为 anywhere。检查前后项目身份和空编辑器保持；未写任务或发送消息。

本机安装版的缺少密钥、错误密钥、无效请求体三项拒绝通过；受控编辑器 role、重复编辑器和 composer 项目标记故障三项拒绝通过且均恢复基线。页面漂移的首轮脚本从“已展开看板”开始，接入撤销会删除注入节点，导致原脚本要求的完全相等断言失败。首轮原始失败保留；恢复原脚本的无注入前置条件后，漂移请求被拒绝、页面恢复后基线相等。首轮撤销进一步导致伴随服务返回 RESTORATION_UNCONFIRMED；随后 nonce 故障脚本未实际拦截文档，不能据此判握手失败清理通过。

在精确绑定、唯一空编辑器且无注入的前提下，执行显式诊断关闭 CSP bypass 和外部重载，真实 frame-src/enforce 策略事件已出现，原项目和空编辑器 hash 保持。该诊断证明现场已恢复安全策略，不替代程序自己的正常清理/恢复验收。伴随服务仍保持接入撤销，需正常退出并重启同一安装版后继续。G1 总门槛保持未通过。

用户回传第二台 2026-10-07T08:54:18.264Z 的执行 JSON：七项候选文件 hashMatched、默认 WebView 缓存、精确目标、主进程/伴随服务/WebView 归属、合成账号、空间存在与设备映射均通过。此证据明确标注为用户提供的第二台执行报告；cardCount=1 表明还需选择原验收空间后启动计时观察。未据其 passed=true 关闭 G3；本候选生命周期仍只有 preflight，taskId=null，实际跨设备延迟断言为零。共享预览 API 未重启。

证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/` 中的 `installed-g1-responsive-minimum-board.json`、`installed-g1-responsive-minimum-list.json`、`installed-g1-responsive-minimum-detail-activities.json` 及截图，`installed-g1-local-boundary.json`、`installed-g1-controlled-structure-refusals.json`、`installed-g1-controlled-target-drift-active-embed-attempt.json`、`target-drift-active-embed-assessment.json`、`installed-g1-controlled-target-drift.json`、`installed-g1-handshake-failure-cleanup.json`、`diagnostic-csp-recovery-after-drift.json`、`second-device-readiness-29aa095-user-report.json` 和对应来源说明。G0 已通过；G1/G2/G3 仍为部分完成，G4 未进入，初版可用未确认。

### 2026-10-07：29aa095 双设备计时观察内创建、并发领取与提交 TB-11

第二台用户回传实时 SURFACE_OBSERVER_READY，原验收空间显示十张任务、合成缓存与候选资源匹配；观察窗口 09:25:19.804Z 至 09:35:19.804Z。本机正常托盘退出后旧主进程/伴随服务/WebView 及 47831/9334 均释放，预览 API 保持。使用同一安装版、原测试数据与 WebView 缓存启动后首屏恢复看板；实际切回原空间并显示原十任务。

本机随包 CLI 于该观察窗口内创建 TB-11（独立任务 ID 已在忽略目录保存）version1；两个领取进程区间实际重叠，一次成功、一次 exit23/VERSION_CONFLICT，version1→2 且只有一个执行；成功领取同幂等键重放未增加版本或执行。提交摘要和验证记录后 version3/submitted。本机真实安装窗口在未重载下依次显示 TB-11 的待办、进行中、待验收；原十任务指纹保持。当前已打开 TB-11 详情供设备 A 用户人工验收，尚未验收。第二台完整结果尚待回传，计时器就绪或本机阶段成功均不关闭 G3，也未宣告跨设备约2秒断言通过。

证据：同一候选证据目录的 `normal-exit-before-g3-restart.json`、重启后的 `installed-desktop-identity.json`、`second-device-g3-observer-ready-user-report.json`、三个 `installed-g3-lifecycle-A-{create,claim,submit}-*.json`、`installed-g3-lifecycle-A-state.json` 及仍运行的 `installed-g3-timed-A-live.json`。后者最终归属检查未完成时只作进行中记录。

### 2026-10-07 · 29aa095 双设备生命周期回传核对

已收到 `codex-server` 的原始计时 JSON（Taildrop 自动收件后归档，非本机远程执行）。1178 次轮询、七个安装文件哈希、默认缓存、精确页面与进程创建时间核对通过。服务器时钟与 CLI 请求区间一致；第二台 TB-11 版本 1/2/3 的校准可见延迟分别为 391–726、0–335、40–375 毫秒，页面未刷新。

本机人工验收与随包 CLI 复核通过：TB-11 版本 4、已完成，恰有一条验收活动，执行记录已释放，原十张任务指纹保持。第二台观察于 09:35:24 UTC 结束，而人工验收在 09:38:25.773 UTC，故该文件不能证明第二台版本 4 最终状态或其两秒延迟。G3 仍待第二台最终读数、冲突草稿保留、离线禁写/重连与撤权清缓存。证据：`installed-g3-lifecycle-timing-assessment.json`、`installed-g3-timed-A-final-owner.json`、`second-device-29aa095-timed-20261007-092509-979.json`。

### 2026-10-07 · 29aa095 安装版冲突草稿保留

在已安装 Taskboard 界面新建专用 TB-12（ID `28cd624f-0db1-4f97-9116-bee4f8b922d9`），实际编辑标题形成基于版本 1 的未保存草稿；随包 CLI 并发更新服务器至版本 2。界面保存携带 `If-Match: 1` 与幂等键，实际响应 `409 / VERSION_CONFLICT`；完整草稿指纹、未保存标签均保留。关闭详情再打开，草稿指纹与基准版本仍相同、冲突提示仍可见，页面没有重载。

查看服务器最新内容后，点击保留本地编辑并保存；请求使用版本 2 与幂等键，实际 HTTP 200，服务端升至版本 3。仅在成功保存后本机草稿缓存与未保存标签清除。原十张任务及 TB-11 逐 ID/版本/状态/内容指纹核对未变。七个候选文件哈希、目标 ID 和进程归属在各阶段保持。诊断脚本首轮二进制哈希及请求字段投影错误保留为失败证据，修正后取得上述实测结果，不属于产品故障。证据：`installed-g3-conflict-state.json`、`installed-g3-conflict-*.json`。G3 仍未整体通过。

### 2026-10-07：29aa095 第二台最终状态回传核对通过

用户运行最终只读检查并通过 Taildrop 回传原 JSON。七项安装文件、默认 WebView 缓存及进程/PID/创建时间与此前计时报告一致，精确页面和 timeOrigin 未改变。TB-11 在第二台缓存、可见“已完成”卡片、服务器以及新读本机界面均为 version 4 / done，服务器只有一次 task.accepted。v1–v3 已有校准后两秒内证据；观察器在验收动作前结束，因此不声称 v4 的两秒延迟通过。版本冲突的实际 UI 草稿保留与合并已通过；G3 仍待实际断线禁写/自动恢复及撤权缓存清理，G1/G2 其余子项和 G4 继续开放。

证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/installed-g3-final-state-assessment.json`、`installed-A-final-TB11.json`、`second-device-29aa095-final-20261007-101732-622.json`。

### 2026-10-07：29aa095 安装版真实断线禁写与自动重连通过

确认本机与第二台使用同一 HTTPS 测试入口后，保存精确 Serve 配置，用回环代理转发到原共享 API；通过实际空间菜单重建 SSE，确认代理确有流后关闭连接并返回 503 共 50 秒。真实安装窗口在约 0.5 秒观察轮次内显示离线缓存，新建任务和五列添加按钮禁用；十二任务和 TB-11 version4/done 保留。随包 CLI 对专用 TB-12 的版本化幂等更新退出 26 / ACCEPTANCE_TEST_OUTAGE，恢复后 TB-12 仍 version3/原内容，前十一任务指纹保持。入口自动恢复后无需刷新回到已同步，页面 timeOrigin、精确目标与进程归属保持。原 Serve 配置已恢复，代理退出，47832 释放；共享 API 的 47830 所有者未改变。

控制通道首轮 stdin 关闭，未制造故障且手动精确恢复；复用的冲突检查器因详情已关闭而失败，其服务器只读投影被独立核对，未把该次整体失败改写为通过。两类工具失败均保留。证据：`installed-g3-real-offline-assessment.json`、`installed-g3-offline-A-observer.json`、`installed-g3-outage-routing.json`、`installed-g3-offline-cli.json` 和离线/恢复截图，均位于当前候选证据目录。G3 仍待实际撤权后联网缓存清理。

旧隔离 Codex 的实际文件菜单正常退出已确认：编辑器空，原生进程/辅助进程退出、60910 释放、主聊天进程保持。该窗口属于上次桌面启动，不用作新绑定的成功草稿证明。G2 同提交卸载重装辅助脚本已准备，只操作指定验收安装目录及原验收数据，待当前 Taskboard 正常托盘退出后执行。

### 2026-10-07：29aa095 G2 安装生命周期通过

用户从托盘正常退出后，主进程与47831/9334释放；共享API47830仍为原进程。指定验收目录的NSIS卸载/重装都退出0，卸载实际移除安装程序，四个保留数据文件在卸载及重装后哈希完全一致，原WebView缓存目录保留，八项安装文件（含卸载器）pins匹配。使用原数据/cache启动新安装进程，未经登录或刷新直接出现已同步看板，默认选中专用读写空间；通过正常空间菜单切回原验收空间后显示十二任务。原十一任务指纹、TB-12 version3/原内容、本候选G2实际UI创建并编辑的任务version2及映射保持。合并此前同候选真实读写、托盘隐藏/恢复和正常退出证据，G2通过。安装器实际签名状态为NotSigned，属于开发预览。

首轮最终任务读数因首屏选中了另一测试空间而false；切换空间后通过。合并报告的签名子shell模块加载、证据文件名及把任务标题识别为未保存状态三个工具错误保留原结果，修正后只重跑只读核对；没有重跑安装生命周期。证据：`installed-g2-combined-assessment.json`、`installed-g2-uninstall-reinstall.json`、`normal-exit-before-uninstall.json`、`installed-g2-after-reinstall-original-space.json` 和首屏/原空间截图，均位于当前候选目录。G1/G3尚有必需子项，G4未进入。


### 2026-10-07：29aa095 撤权清缓存通过，G3 同提交闭合

在本机实际安装窗口通过正常 UI 留下 TB-12 未保存任务草稿与 TB-3 未提交结果草稿，基线有五份看板缓存、各一份任务/结果草稿。用临时入口代理切断已有 SSE 并返回503，共50秒；原共享API未重启。离线期间，服务端通过本机已有合成浏览器会话撤销其自身设备登录；独立Agent只读核对确认其他设备记录和服务器十二任务不变。网络自动恢复后，无刷新回到登录页，原账号的看板/任务草稿/结果草稿计数全部归零，离线会话快照、伴随服务账号分区及本机浏览器/Agent凭据清除，仓库映射保留，伴随服务 /me 返回401。原精确Serve路由恢复、47832释放、共享API47830仍由原进程持有。

保留工具失败：首轮 TS 浏览器求值的序列化错误、两次过期状态触发拒绝，以及错误使用Agent执行撤权得到的403 AGENT_SCOPE_FORBIDDEN；它们没有修改任务或扩大令牌权限。修正验收辅助脚本后，用新鲜SSE状态在同一回调内触发故障，再用正确的既有浏览器会话执行撤权。前一轮故障也按50秒自动恢复。后置观察器只用于离线/清缓存，不采用其中对旧TB-11的延迟投影。

合并同提交真实双设备生命周期、v1–v3校准后的两秒内可见、并发原子领取与幂等、设备A人工验收、服务器/A/B最终v4/done、实际版本冲突草稿保留/合并，以及此前真实离线禁写/自动重连，G3通过。v4仅证明最终状态一致，不声称其两秒延迟通过。证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/installed-g3-combined-assessment.json`、`installed-g3-revocation-assessment.json`、`installed-g3-revocation-A-observer-final.json`、`installed-g3-revocation-environment-restored.json`及撤权后的登录截图。

当前G0/G2/G3通过，G1仍待新绑定独立Codex的成功草稿、非空拒绝、nonce/CSP失败清理及正常宿主退出/重启，G4未进入。Taskboard本机停在撤权后的正常登录页，需用户重新登录测试账号。正常安装按钮启动的新独立Codex已通过精确进程/页面只读核对，仍在登录页，无项目与编辑器，需用户登录并打开测试项目。Computer Use读取该窗口时截图与可访问性树出现不一致，未执行输入，改用精确绑定只读诊断确认登录状态；不作为宿主成功验收。


### 2026-10-08：宿主自动升级，旧运行环境已退出

续跑以实际进程和端口为准：上一轮安装版、独立 Codex、共享测试 API 与数据库均已停止。29aa095 已安装文件重新核对七个哈希，原数据与 WebView 缓存正常启动，无白屏；缓存页明确离线并禁用新建/添加任务。当前用户注册的 Codex MSIX 已更新为 26.930.7945.0，实际安装版“启动独立 Codex”返回“当前 Codex 安装包版本未列入隔离启动清单”。旧 26.928.1915.0 的成功证据保留，不能用来证明当前版本的 G1。

补记上一轮真实失败清理：安装版实际拦截了一个外部重载后的 iframe 文档，该文档没有 nonce 就绪消息；入口/iframe 清理、真实 frame-src enforce 策略事件、原项目与空编辑器保持不变均通过，随后正常安装版入口重新接入成功。证据为 installed-g1-external-nonce-failure-cleanup-resumed.json。正向五段未发送草稿与正常宿主退出重启仍未收口；历史 RESTORATION_UNCONFIRMED 和工具输入拒绝继续保留。

新增开发探针提交 e72c6482268206a2af8ad534182dc5b60b144bba（分支 codex/host-26-930-acceptance）：允许显式指定四段 MSIX 版本，只匹配当前用户唯一安装的 OpenAI 包，使用原私有管道、包上下文启动和真实进程句柄。产品启动或 DOM/草稿清单保持原规则。已补参数拒绝和新版本精确包选择回归；本机无 Rust/MSVC，CI 37711898585 正在编译和测试，尚不计通过。G4 未进入。

原 .data/test-postgres 目录存在且未重建，既有隔离数据库已恢复至 55439；共享 API 47830 保持未启动。既有 start-preview-api.ps1 顶部注明此前自动启动被策略拒绝，需用户手动运行。启动后再观察当前测试窗口是否需要重新认证。当前进展及可见失败证据：.artifacts/acceptance/2026-10-08-host-26-930/environment-delta.json、installed-launch-refusal.png；数据库观察句柄为 54004。


### 2026-10-08 续跑：当前新宿主已就绪，适配修复进入同提交 CI

原生开发探针 e72c648 的三项 CI 作业均成功，产物摘要与 GitHub artifact digest 一致。实际当前 26.930.7945.0 的私有句柄/端口/精确页面归属已验证；只读观察确认该独立窗口已登录、唯一项目映射当前测试仓库，唯一编辑器为空，无弹窗。不要再次请求该窗口登录。

按实机原生与 DOM/项目契约证据补入当前版本原生启动及页面标记，未知版本仍拒绝。修复提交为 16a1ceb7fb4ef203b2bf0e257b5de1e9c9d5cd43，CI 37713651732 已确认运行中。本机类型检查、lint 和十二项 CSP/私有启动器回归通过；它们使用独立 Chromium/测试夹具，不能替代正式新版安装包完整 G1。新候选所有门槛需按同提交重新核对，29aa095 的 G0/G2/G3保留为历史证据，不自动转移。新候选进展位于 .artifacts/acceptance/2026-10-08-ci-16a1ceb/current-progress.json。

目前共享测试 API 47830仍无监听，数据库55439由原恢复实例持有，十二任务与既有版本保留。继续等待用户手动运行原 start-preview-api.ps1；该步骤未获得完成回报，未自动重启 API。探针独立宿主、原已安装 Taskboard 和数据库均保持运行。


### 2026-10-08：共享 API 已恢复，新候选 G0 通过

用户已手动启动原共享测试 API；实际健康检查及原 API/数据库进程身份均正常。旧安装版因 API 认证会话过期回到登录页。独立原生开发探针仍保持既有已登录项目和空编辑器，未要求重复登录。

候选 `16a1ceb7fb4ef203b2bf0e257b5de1e9c9d5cd43` 的 CI `37713651732` 三项作业均成功。Windows artifact `11522644396` 的 ZIP 摘要与 GitHub digest 一致；安装器 SHA-256 为 `518E82C0C520BF5D402D3E1AB0AA2D58B513E242BD80FCAB81F26465F0FD115E`，签名状态 `NotSigned`。已只读提取 NSIS 负载并固定七个文件哈希，尚未安装/启动新候选。

同提交完整本地 G0 使用精确 git archive 和独立 ASCII 目录：Node v24.19.0 / pnpm10.28.0，冻结安装、typecheck/lint/test/build 全部通过；无数据库109通过、15项预期数据库测试跳过；真实独立数据库124通过、无跳过；实际数据库浏览器12通过；生产离线冷启动、草稿保留、禁写、重连与撤权检查通过。浏览器辅助配置仅隔离端口/相对导入路径，产品源文件未修改；本地前端与 CI NSIS 三个前端文件逐字节一致。独立测试进程已结束、端口全部释放，原共享 API/数据库 PID与创建时间保持不变。G0通过；G1/G2/G3待新版同提交实机验收，G4未进入。

安装与启动脚本已核对原测试数据/缓存、精确安装器哈希及七个安装文件哈希。Computer Use只返回应用窗口，未返回通知区域托盘可操作目标，下一步需用户从本机旧 Taskboard托盘菜单点“退出”；收到后先核对旧主进程/伴随服务及端口释放，再执行新版 NSIS。无需用户再次启动共享 API。记录：`.artifacts/acceptance/2026-10-08-ci-16a1ceb/g0-verdict.json`、`candidate-files-16a1ceb.json`、`manual-step-next.json`。首次安装辅助脚本的重复 UTF8 BOM已修正，原失败记录保留，未触发安装或停止进程。


### 2026-10-08：用户正常退出后，新候选安装及首屏已通过

用户回报托盘退出，已独立核对旧主进程与伴随服务消失、47831/9334均释放，原共享API与数据库PID/创建时间保持不变且健康。已执行16a1ceb的已验证CI NSIS安装器，退出码0；七个实际安装文件全部匹配负载哈希，原有state/CLI凭据文件逐字节保留，沿用既有WebView缓存。新安装版进程/伴随服务/WebView父子归属与唯一页面绑定通过，首屏root渲染正常，实际加载资产正确，未刷新、未更换缓存、无白屏和未知伴随服务错误；实际首屏是登录页。原测试HTTPS健康接口200。目标已恢复active，当前等待用户手动登录新安装窗口；Computer Use禁止操作认证界面。G0保持通过；G2仅安装/首屏部分通过，G1/G2完整流程及G3同候选双设备仍待验收。证据：.artifacts/acceptance/2026-10-08-ci-16a1ceb/old-runtime-post-tray-exit.json、installed-result.json、installed-first-render.json、installed-desktop-identity.json。



### 2026-10-08：16a1ceb 安装版登录后增量验收

固定候选仍为 `16a1ceb7fb4ef203b2bf0e257b5de1e9c9d5cd43`。已在真实安装窗口确认测试账号登录及原空间十二张任务恢复；重复点击启动独立 Codex 复用同一原生进程、创建时间和目标页面。新建专用空间及任务、修改标题/多段描述/仓库标识均由安装窗口执行，三次写入 HTTP 200 且带幂等头，修改携带版本 1 并返回版本 2。关闭窗口隐藏到托盘，再次启动恢复同一窗口、主进程和伴随服务；修改后内容仍在，原空间任务摘要未变。

正式新独立宿主仍处于登录页。此时实际侧栏接入按钮安全拒绝，页面未重载且没有注入节点；报错将“没有编辑器”概括为“编辑器非空或有弹窗”，具体提示仍待完善。正式宿主登录/选项目、正向侧栏及草稿、其余拒绝/CSP/正常退出重启仍未关闭 G1。G2 还需完整退出冷启动、卸载重装和数据保留。G3 需当前候选双设备重验，G4 尚未进入；初版不计为已验收。证据：`.artifacts/acceptance/2026-10-08-ci-16a1ceb/installed-followup-verdict.json` 及对应 G1/G2 记录。测试观察器已正常结束，共享 API/数据库、主 Codex 和原测试空间保持原样。


### f6a363e 已安装第二台 Windows 程序（G2）

同一提交的实际 NSIS 安装版在第二台 Windows 的合成测试账号中完成服务器保存、登录、空间及任务创建修改、托盘恢复、正常退出与冷启动、官方卸载及重装。安装/卸载退出码均为 0，七个随包文件哈希、进程归属、默认数据与缓存保留均已核对；修改后的任务保持版本 2。G2 的 17 项条件通过，证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/second-device-g2-complete-verdict.json`。安装包未签名，仍为开发预览。当前提交 G0/G2 通过，G1/G3 待完成，G4 未进入；本机旧版尚未正常退出，新候选版的本机安装尚未执行。


### 2026-10-18：f6a363e 本机同候选安装及自适应增量

用户正常托盘退出后，已核对端口释放并安装同一 CI 候选，退出码0、七个负载哈希匹配，原数据及缓存保留。首屏直接恢复认证看板，无刷新、白屏或伴随服务错误；正式启动入口复用已有登录与项目配置。最窄480px宿主、导航展开后185px内嵌区为单列，筛选器与详情字段均在视口内；1575px内嵌区为五列，均无横向溢出。G0/G2通过，G1/G3继续，G4未进入。证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-result.json`、`installed-first-render.json`、`installed-project-after-launch.json`、`installed-g1-layout-*.json`。

### 2026-10-18 f6a363e：G1 完整通过

同一提交 `f6a363e1779db36c97332725bdc433260c5ef366` 的 NSIS 已安装程序，通过真实 `26.1007.9446.0` 宿主的独立启动、项目归属、侧栏开关、185px/1575px 内嵌布局、任务详情、nonce source/origin/value、外部重载、握手失败清理和实际 CSP 恢复。仓库/目录、未验证会话、编辑器结构、项目切换、普通弹窗、非空草稿及精确页面漂移均安全拒绝。

真实按钮插入的 11 段未发送草稿，经原生菜单正常退出并由安装版正式按钮重启后，界面、ProseMirror 模型、内存与磁盘草稿记录均一致，登录及项目保留。验收草稿已获授权清空，并确认界面、模型、内存和磁盘均无残留。未发送消息、未由草稿操作领取任务；受保护进程均保留。历史草稿丢失的原始原因仍不作已证明声明。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-g1-complete-verdict.json`（22 条件全真）、`g1-targeted-persistence-trace-restarted.json`、`g1-targeted-persistence-trace-cleaned.json`。当前 G0/G1/G2 已通过，G3 正继续同候选双设备验收，G4 尚未进入，保持开发预览。

### 2026-10-18 f6a363e：G3 双设备闭环完整通过

同一候选的两台实际 Windows 安装程序及随包 CLI 完成创建、并发领取、提交摘要与验证记录、实际界面验收。创建/领取/提交到第二台截图完成的可见上界分别为1044/1492/1460ms；幂等创建保持同一任务，并发领取仅一次成功。生命周期任务最终版本4、已完成，两台随包CLI、服务端及实际界面一致。

第二台实际断线时显示只读提示，新建任务按钮变灰且点击不打开表单；恢复后无需刷新自动同步。另一次断线期间服务端写入新版本，第二台恢复后自动取得版本4。版本冲突保留草稿及授权清理已通过。撤权检查明确使用本机实际安装WebView的断网模拟：撤销精确浏览器设备并重新联网后，不重载即回到登录页，原有看板缓存、离线快照及一份未提交草稿均清理；随后恢复合成测试登录。第二台物理断线与本机撤权模拟分别记录。

原验收观察器在HTTP200之后发生解析错误，原始失败保留，另由独立CLI最终读取与请求版本/幂等头证据核对，未重复验收。第一次重连写入晚于恢复，未用作离线取新证据；后续在明确暂停区间内的直接服务端写入已补齐。第二台PowerShell最终读取包装脚本在退出CLI时发生NativeCommandError，独立Node子进程读取随后通过，产生的精确CLI测试会话另行撤销。临时控制会话已撤销，443恢复原47830目标，47832监听已释放。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-g3-complete-verdict.json`（17条件全真）、`installed-g3-human-accept-reconciliation.json`、`g3-actual-offline-and-reconnect-ui.json`、`installed-g3-local-revocation-cache-purge.json`、`second-device-reports/second-device-f6a363e-final-cli-20261018-035127-538.json`。当前G0/G1/G2/G3均通过，开始G4；G4未通过前仍为开发预览，初版总验收保持未完成。
### 2026-10-18 f6a363e：G4 发布检查与隔离部署开始

已读取同一提交 CI39038428500 的原始 container 日志，确认 Compose、备份恢复、内部 CA HTTPS、Secure Cookie 和 SSE 重连均成功。GitHub 当前 ruleset 为0、默认分支未保护、release 审批环境不存在；普通 CI 未保留可交付 Linux 镜像、SPDX SBOM、SHA256SUMS 和来源证明。安装器明确为 NotSigned。发布设置及标签/草稿运行方案已在本地准备，尚未变更仓库设置、创建标签或 Release。

已建立一次性 Debian12/QEMU11.1.0 环境，官方镜像 SHA512 校验一致；Docker29.9.1、Compose5.6.0 已安装。首次预检因 Windows Git 的 CRLF 导出设置失败，未构建或启动应用容器；保留原始归档和日志后，以命令局部设置重新导出，两份各163文件均与对应 Git blob 及提交标识一致。正构建上一提交19f6162和候选f6a363e，继续实际镜像升级及数据库/镜像回滚。没有修改产品源码或宿主虚拟化设置。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/repository-release-audit.json`、`same-candidate-container-log-claims.json`、`source-identity.json`、`exact-source-blobs-verdict.json`、`guest-run-attempt1-crlf.json`。G0–G3通过；G4仍未完成，保持开发预览。
### 2026-10-18 f6a363e：G4 本地部署、HTTPS 和实际镜像回滚通过

一次性 Debian12/QEMU11.1.0 中使用 Docker29.9.1、Compose5.6.0，按 Git 精确对象分别构建19f6162与f6a363e。两份源码各163文件与Git blob及提交标识完全一致，运行镜像ID分别为60df5ce9…与49418ecd…。候选版的隔离Compose、登录与任务写入、备份恢复、重启、内部CA HTTPS、跳转、Secure Cookie及两次SSE重连全部成功。实际切换19f6162→f6a363e后原任务可读且可写，再恢复升级前数据库及19f6162镜像；原任务标题与版本1恢复、升级后新增测试表消失、备份SHA256保持。升级回滚脚本退出0，清理为true。

显式使用slow/reuse模式；内部CA测试不声称公共Let's Encrypt验收或新的双设备约2秒测量。首次CRLF归档预检与第二次缺少预拉取PostgreSQL镜像的启动失败均保留，后者清理后容器/卷/网络为空；修复验收环境后未重复构建应用镜像。最终本地七项条件全部通过；所有测试项目清空，虚拟机经systemctl正常关机，QEMU退出且回环端口释放。日常Codex、开发宿主、共享预览API及数据库四个受保护进程的PID/创建时间均保持；未调用强制终止。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/local-deployment-verdict.json`、`guest-cleanup-inventory.json`、`environment-final-state.json`、`maintainer-review-bundle.json`及collected下的原始诊断。G4仍待维护者决定具体仓库保护、发布审批环境及v0.1.0标签/草稿流程，再取得并核验同提交CI的Linux镜像、SPDX SBOM、SHA256SUMS及来源证明。安装包NotSigned，当前仍为开发预览；尚未更改GitHub设置、创建标签或Release，总验收保持未完成。
### 2026-10-18 f6a363e：G4 来源证明校验准备及发布工作流登记预检

官方GitHub CLI2.102.0的Windows压缩包已与GitHub资产SHA256和发行校验文件双重核对，仅读取使用，未系统安装。来源证明校验器固定仓库、release-draft.yml、refs/tags/v0.1.0、完整source/signer提交SHA、OIDC issuer及GitHub托管runner策略。对当前已验收CI安装包执行实际验证，来源证明接口返回404，工具退出1且拒绝通过；此结果证明当前发布来源证明仍缺失，不关闭G4。

发布工作流文件在默认分支与候选中的Git blob完全一致（8287be27602db5e48977b56373363007afdaadaf），官方校验和验证的actionlint1.7.12内置语义检查退出0。GitHub Actions列表当前仅返回CI，发布工作流查询/运行列表为404；登记原因及实际dispatch可用性尚未验证。已准备仅追加一行注释的条件备选补丁和带旧blob前置检查的请求体，仅在维护者授权后且dispatch仍找不到工作流时考虑应用。尚未修改默认分支、规则、环境、标签或Release。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/provenance-negative-probe-verdict.json`、`release-workflow-readiness.json`、`release-workflow-lint.json`、`conditional-workflow-registration.patch`。维护者复核方案已更新。本轮取得上述新证据，G0–G3与本地部署通过状态保持；总验收仍等待维护者明确决定和实际CI发布产物核验。
### 2026-10-18 f6a363e：维护者决定受阻，停止重复自动验收

连续第三轮仍未收到对 `g4/maintainer-review-draft.md` 的明确维护者决定。最后一次只读 GitHub 审计为 2026-10-18 13:16（Asia/Shanghai）：rulesets 为 0，release environment、v0.1.0 标签及发布工作流运行查询为 404，Release 为 0。条件补丁、规则和请求体均仅保存在本地，尚未执行外部写入。G0–G3 和 G4 本地七项条件保持通过；CI Linux 交付镜像、SPDX SBOM、SHA256SUMS 与来源证明仍缺失，总验收未完成，保持未签名开发预览。没有其余可独立推进的必需工作，目标标为受阻，等待维护者决定。

本轮用户报告本机托盘退出；只读复核仍观察到已安装验收程序及 47831 监听，不能将本次观察记为进程与端口完全释放。未强制终止、重装或重启。此记录限定本轮观察，不替代先前正常退出验收证据。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/maintainer-decision-blocked-audit.json`、`pending-maintainer-audit.json`、`local-tray-exit-observation-20261018.json`。
### 2026-10-18 f6a363e：维护者授权后已配置保护规则并启动草稿发布

维护者明确回复“是”，批准已展示的发布方案。身份复核为仓库管理员；候选提交、G0–G3原始判定及五份提案请求体的摘要均一致。已创建默认分支ruleset（25332682）、v*标签ruleset（25332684），设置release审批环境及仅允许v0.1.0标签的部署策略；v0.1.0固定指向f6a363e。第一次授权dispatch实际返回404后，按获批条件在默认分支追加唯一注释，提交28891c279fddb59f97b100235e9b1877ccfa8c96；候选标签保持原SHA。发布工作流随后登记为388199392，第二次dispatch返回204，精确运行39100683953已启动。尚未创建Release；构建、审批与最终产物核验仍在继续，总验收保持未完成。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/maintainer-authorization.json`、`approved-release-configuration-result.json`、`approved-workflow-registration-result.json`、`approved-release-dispatch.json`及`approved-release-receipts/`。先前受阻状态由本次明确授权解除，不再等待相同决定。

### 2026-10-18 f6a363e：G4完成，初版可用开发预览验收关闭

维护者批准方案后，仓库保护规则、release审批环境及v0.1.0标签已实际创建并读回核验。发布工作流经获批的单行注释登记修复后，运行39100683953的validate、release-gate、windows、linux及draft五作业最终全部成功。Linux发布镜像的9层压缩blob及解压diff-id、linux/amd64、应用0.1.0、非root启动及SPDX2.3/806软件包均已核对。Windows版本0.1.0，全部13个runtime文件精确匹配已验收包；主程序的28字节差异完整限定在PE/debug时间戳和CodeView GUID，屏蔽这些定位的元数据后全文件一致，原始不一致判定保留。

首次draft下载已通过三项正式产物，失败仅为自动上传的gzip Docker构建记录。官方Docker说明明确要求排除该记录；已将其21612字节内容按GitHub SHA256保全，删除本次运行中精确ID的附加记录，并仅重跑失败draft。attempt2在第二次release环境批准后成功。失败日志、诊断原件、删除及重跑收据均保留。永久排除规则已补到工作树`.github/workflows/release-draft.yml`并通过官方校验和验证的actionlint1.7.12语义检查；该本地修正未移动已验收标签。

草稿Release416260851包含Windows安装器、Linux镜像、两份同摘要的SPDX文件及SHA256SUMS，全部资产摘要已和CI归档/实际文件核对。官方GitHub CLI2.102.0严格验证通过四种唯一摘要，覆盖五项资产；来源证明的仓库、release-draft.yml、refs/tags/v0.1.0、source/signer提交、github-hosted runner和attempt2调用身份均匹配。草稿已明确标注NotSigned、开发预览及实际验收范围。GitHub将Windows文件名空格规范为点号，原CI校验清单与证明均保留，改名校验说明已加入草稿。草稿说明更新时观察到标签转为临时名，已显式恢复v0.1.0及目标SHA并读回；未发生公开发布。

最终G4二十项条件全真，G0–G4原始证据摘要再次核验，总判定为初版可用开发预览验收通过。七项本地部署及虚拟机正常关机清理证据保持；未强制终止受保护进程。公开稳定发布不属于本次关闭范围。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/initial-preview-acceptance-verdict.json`、`initial-preview-acceptance.md`及`g4/g4-complete-verdict.json`、`draft-release-assets-verdict.json`、`provenance-receipts/`、`release-native-metadata-equivalence.json`、`release-linux-image-verdict.json`、`approved-release-packaging-recovery.json`、`workflow-build-record-exclusion-fix.json`、`draft-explicit-tag-preservation.json`。



## 补存候选分支早期源码验证记录（历史）

以下三项来自已验收提交链，记录的是当时的源码验证范围；最终 G0–G4 结论见文件顶部及交付摘要。

### 2026-10-08：26.930.7945.0 的原生启动和页面契约已观测

开发探针提交 e72c648 的同提交 CI 37711898585 三个作业全部通过；独立探针压缩包 SHA-256 为 644c9d7eb2fa31dff2d3e9c3f0819549a658f439b40a2a4bbad003e4b01c8935，执行文件为 FA04FF52F5AC439DD2420F3CCFEB3E56538D5C9B99A63971331A2C4A22F6D976，未签名。在本机实际当前用户 MSIX 中创建全新隔离实例，私有管道交接、真实进程句柄、创建时间、回环端口、精确 target/page/WebSocket 和独立 profile/Codex home 均通过，主 Codex 进程保持原样。

随后只读核对该实例已登录并打开测试仓库，真实项目 UUID 经其隔离 state_5.sqlite 唯一解析到已映射目录；shell、项目侧栏、主内容区与编辑器各一个，编辑器为空、无弹窗，与既有新版 shell 契约一致。按这两项实机证据补入 26.930.7945.0 的原生启动和 DOM 标记清单，未知版本继续拒绝。来源记录位于 .artifacts/acceptance/2026-10-08-host-26-930/native-probe-launch.json 与 native-current-readiness.json。

本机类型检查和 lint 退出 0，独立 Chromium CSP 生命周期及私有启动器回归合计十二项通过；当前源变更的 Rust 编译仍待后续同提交 CI。这些结果只证明启动归属、只读页面/项目契约与自动回归。真实新版侧栏 iframe、nonce/CSP 清理、未发送草稿及全部拒绝路径、正式 NSIS 启动和正常宿主退出/重启尚待完整执行，因此 G1 未关闭，G4 未进入。共享测试 API 当前停止，继续等待用户手动启动原脚本；原数据库十二任务已只读确认保留。


### 2026-10-08：独立 Codex 登录窗口隐藏的恢复缺陷

真实安装版 `16a1ceb` 的受管理原生实例仍存活，但主窗口不可见；重复点击“启动独立 Codex”只返回“已在运行”，没有恢复窗口。Sky 也无法绑定隐藏窗口。只在确认精确 PID、创建时间、包版本、CDP 页面和空登录页后，结束这一个隔离测试进程并保留原 profile；这是故障修复操作，不计入正常退出验收。重新点击实际安装版按钮启动了新的可见登录窗口，原主 Codex、开发探针、API 和数据库身份均保留。证据位于原工作区 `.artifacts/acceptance/2026-10-08-ci-16a1ceb/hidden-native-repair.json` 及 `installed-native-identity-before-hidden-repair.json`。

源码修复：持有进程句柄、创建时间、回环监听者和精确页面仍匹配时，枚举该进程唯一的无 owner、非工具、非子窗口、未被 cloaked 的 `Chrome_WidgetWin_1` 主窗口，重复核对归属后显示或恢复最小化，再尝试前台焦点；多窗口、归属漂移或无法显示时返回具体错误，不把“进程还在”报告为窗口已恢复。最大化尺寸保留；前台焦点被系统拒绝时提示从任务栏选择。

另外，零编辑器的登录页请求侧栏接入时，提示先登录并打开项目；禁止 CSP 绕过和页面重载的行为保留。类型检查及适配器/CSP 测试共 39 项已通过，其中真实独立 Chromium 覆盖登录页、草稿和模态拒绝。Windows 主窗口恢复已新增临时 Win32 测试窗口回归，尚待当前修复提交 CI 运行与同提交安装版实机复验；G1–G4 尚未关闭，旧候选门槛不可结转。

### 2026-10-16：26.1007.9446.0 隔离宿主适配（源码证据，安装版待验收）

- 当前 MSIX 原生入口经独立开发探针启动，真实进程句柄、私有控制归属、回环监听者、精确主页面 target 及 URL 一致；主 Codex 保持原实例。用户完成隔离窗口登录和项目选择后，只读确认唯一选中项目由该隔离 Codex 的 SQLite 映射到预期仓库，编辑器为空且没有模态框。壳、项目导航与内容区标记分别唯一。
- 原生启动清单与独立的 DOM/草稿清单加入精确版本 `26.1007.9446.0`，没有扩大为版本范围；未验证版本仍拒绝。现有真实 Chromium 壳选择回归也覆盖该版本。
- 当前源码伴随服务使用独立数据目录和端口，在上述真实隔离宿主中完成 nonce iframe 接入、错误目录草稿拒绝并保留入口/编辑器、随后恢复 CSP 并清理自有节点。内嵌 React 看板加载成功；入口保持收起，因此本轮结果不证明可见布局或响应式宽度。
- 同一真实宿主的五段未发送草稿精确匹配。重复填写、失效归属、未验证版本、错误目标、缺失目录和错误目录均拒绝，拒绝前后编辑器哈希不变；没有提交消息。草稿清空确认仍待后续记录。
- 本地证据位于忽略目录 `.artifacts/acceptance/2026-10-16-host-26-1007/`：`native-current-readiness.json`、`developer-host-install.json`、`developer-host-draft.json`。初次资源路径转换错误、随后过宽的 frame 计数断言，以及归属错误文字断言造成的验收辅助脚本失败也已保留；修正辅助脚本后通过，未将辅助脚本结果冒充已安装程序证据。
- 以上仅支持当前版本源码适配；G1 仍需同候选 NSIS 启动器创建的真实窗口执行完整成功/拒绝、可见尺寸与清理流程，G2/G3/G4 未关闭。父提交 `ef99f2b` 的 G0 通过记录不自动沿用到本次适配提交。
