# Codex Taskboard 换机验收交接

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

可复核的交付摘要与资产校验值见 [0.1.0 验收摘要](docs/acceptance-0.1.0.md)。下方按当时情况记录的待办和受阻结论属于历史；当前结论以上方表格为准。仓库收尾将已验收的九个提交与默认分支工作流登记提交合并，另行运行合并 CI；这不重新计算已固定候选的实机门槛。

<!-- /current-acceptance-status -->

## 2026-10-20：新增 Codex 26.1013.4894.0 源码兼容

本机已安装 `26.1013.4894.0`。独立 CI 原生探针校验摘要后启动全新隔离宿主，用户完成登录与项目建立；真实 shell、项目 ID 到当前仓库的只读映射和编辑器模型契约与现有实现匹配。源码的原生与适配器清单已增加该精确版本，相邻与后缀版本继续拒绝。

真实前端 nonce 握手、侧栏内容区、错误目录/模态框拒绝、外部重载恢复、CSP 恢复及 6 段合成草稿模型确认通过。正常文件菜单退出后，当前源码产品启动函数复用原登记目录；登录、项目和完整草稿 DOM/模型哈希保留，无消息发送。合成草稿已精确匹配后清理，测试宿主正常退出。原始失败与最终证据均保存在 `.artifacts/acceptance/2026-10-20-host-26-1013/`，具体范围见 [宿主验证记录](docs/codex-host-verification.md#2026-10-20codex-26101348940-源码兼容验证)。

这是 `v0.1.0` 验收后的源码增量，不移动已验收标签，不继承为新 NSIS 安装包的完整 G1 或双设备验收。

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


### 2026-10-07：第二台完整观察记录回传，但仅覆盖创建前基线；观察器已修正

用户回传第二台完整180秒观察 JSON。0748f67 文件哈希、精确页面、默认 WebView 目录、进程归属和合成账号一致；355次轮询中仅一组稳定状态，原空间显示已同步和九张任务，trackedTasks/trackedCards 全为空。该记录的 passed=true 证明读取与归属校验成功，不证明 G3 生命周期通过。

记录窗口为2026-10-06 15:18:23.272Z至15:21:24.059Z（北京时间23:18:23至23:21:24）；本机成功创建CLI实际开始于15:22:31.433Z、结束于15:22:31.835Z（北京时间23:22:31）。按两侧记录时间，观察在创建命令开始前约67秒已结束；跨设备时钟未独立校准，不能由此计算通知延迟。更直接的覆盖证据是整份记录未包含TB-10，因此最终状态、各阶段可见性和约2秒指标仍未证明，也未据此认定产品同步失败。设备A已经验证的TB-10人工验收version4/done保持。

仅调整忽略目录中的验收工具：默认观察延长到600秒，每次状态变化及每5秒原子保存进度；先验证实际测试空间/合成账号/渲染资源，再发出就绪信号；进行中的JSON明确标记待最终归属核对。15秒首轮观察本身完成通过，但读取检查点时已结束，原始探针覆盖未通过结果保留。60秒复验实际捕获运行中的observing检查点（未带最终passed），结束后退出0、complete、归属保持、passed=true；该工具验证没有写任务或重载页面，不计为G3生命周期/离线通过。

29aa095对应的持续观察器、进程归属包装器和已安装文件清单生成器均已准备，Node语法和PowerShell解析通过；实际文件清单须在已校验CI安装包安装完成后生成，缺少清单或candidate/hash不匹配时拒绝观察。再次仅校验安装辅助脚本通过，尚未安装或启动新候选。桌面目标只返回当前Taskboard主窗口与资源管理器，没有通知区域菜单目标；下一步需要用户正常托盘退出本机旧候选，随后核对进程/端口释放并安装新包。原预览服务保持，G3/G4未通过。

证据：`.artifacts/acceptance/2026-10-05-ci-0748f67/second-device-0748f67-surface-20261006T151823-human-report.json`、对应`assessment.json`、`g3-continuous-observer-preparation.json`、`continuous-observer-live-checkpoint-validation.json`、`continuous-observer-live-checkpoint-validation-second-attempt.json`、`continuous-observer-local-live-validation-60s.json`；新候选工具见`.artifacts/acceptance/2026-10-07-ci-29aa095/g3-observer-preparation.json`、`preupgrade-native-target-inventory.json`和`manual-step-next.json`。


### 2026-10-07：TB-10 人工验收及设备 A 最终状态已核对

用户报告本机 TB-10 已完成。0748f67 同提交已安装候选的只读 CLI verify 实际退出0，任务为 version4/已完成，服务器恰有一次 task.accepted 活动，唯一执行已 released，原九任务的版本、状态及内容哈希均保持。核对前后桌面 PID/创建时间、伴随服务归属、监听端口与随包文件哈希保持一致；未由工具写任务，wireObserved=false。

另一次真实安装表面只读观察实际退出0，精确 targetId 保持，选中“桌面隔离验收”、显示“已同步”，十张任务可见；TB-10 卡片位于“已完成”，缓存版本4、语义done。设备 A 人工验收条件已解决，无需重复点击。设备 B 完整生命周期观察 JSON 尚未回传，约2秒可见指标与最终状态仍未核对，G3保持未通过。

29aa095 新候选启动辅助脚本已按实际安装目标准备并完成语法检查，保留原验收数据及 WebView 缓存；未安装/启动新候选。继续先取得第二台完整观察，再进行相关安装版复验与剩余 G3 场景，G4仍未进入。证据：`.artifacts/acceptance/2026-10-05-ci-0748f67/installed-g3-lifecycle-A-verify-2026-10-07T03-54-20-884Z.json`、`installed-g3-device-A-human-accepted-surface-20261007.json`、`g3-lifecycle-through-submit-progress.json`；新候选工具准备见 `.artifacts/acceptance/2026-10-07-ci-29aa095/start-helper-preparation.json`。


### 2026-10-07：布局修复已提交，29aa095 同提交 G0 与 CI 通过

长执行记录溢出修复已在独立分支 `codex/task-detail-wrap-20261007` 提交并推送，候选 SHA 为 `29aa09578cee2a59ddbe5bb5c1b36965bda8d579`。仅修改活动记录的断行/缩窄规则和对应浏览器回归；原验收工作区仍保持 `0748f67` HEAD，旧安装版 TB-10 的人工验收现场保持。

新候选本机 Node v24.19.0、pnpm 10.28.0 的冻结安装及无数据库 `pnpm check` 退出 0：109 用例通过、15 个数据库用例按预期跳过。第一次在中文用户目录内的工作树执行 `pnpm test:db` 时，原生 initdb 退出 1，尚未启动测试；补采 stderr 确认 `invalid byte sequence for encoding UTF8`。保留原失败和诊断后，同提交的 ASCII 路径 git archive 独立检出再次冻结安装，真实数据库用例 19 文件、124/124 通过，未跳过。该结果记录隔离路径限制，不推断所有 Windows 用户目录均兼容。

真实 PostgreSQL 55440 与专用 API47833/前端4174 完成原浏览器套件 12/12，含数据库协作冲突及桌面/内嵌长记录回归；同候选生产构建的离线冷启动、草稿保留、只读控件、重连与撤权清缓存检查退出 0。这些是独立 Chrome 验证，不能替代两台已安装 Windows 程序的 G3 结果。数据库 serve 包装进程由 Ctrl+C 停止（包装退出 1），专用端口 55440、4174、47833、47834 和候选 Node/PostgreSQL 辅助进程均已核对释放；原预览 API、原数据库、当前安装窗口与诊断端口继续运行。

CI run `37560421232` 的 verify、container、windows-desktop 均完成并成功，head 与候选一致，包含真实数据库浏览器测试、生产/离线检查、Compose 恢复、内部 CA HTTPS、Rust 用例及 NSIS 构建。安装包归档 SHA-256 `D71D8D28FCDE2BC6A93A1EA94D554B03C405E73EFA198140969976AA45BB9A5D` 与 GitHub artifact digest 一致；安装器 SHA-256 `AD8A4C625DE5461B326733250AFE8716852796D3D95E81DB25694C4386EC586D`，签名状态 NotSigned。安装辅助脚本已完成语法与仅校验检查，未安装或启动新候选。GitHub 连接创建草稿 PR 返回 403 Resource not accessible by integration；修复分支已推送，未创建 PR 或合并。

29aa095 的 G0 通过，G1–G4 尚未通过；0748f67 的历史 G0–G2 不自动沿用。当前真实安装窗口再次确认 TB-10 version3/待验收、结果与验收按钮可见；设备 A 人工验收及设备 B 完整生命周期观察 JSON 仍未收到。按闭环验收计划 G3 第3项，人工验收应由设备 A 的用户执行。取得结果后先核对旧生命周期，再进行新候选安装版复验和剩余真实 G3 场景，最后进入 G4。证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/g0-verdict.json`、`g0-cleanup.json`、`ci-result.json`、`install-helper-preparation.json`、`manual-step-next.json` 以及保留的首次失败和实际执行日志。


### 2026-10-07：桌面控制恢复，发现并修复长执行记录的详情面板溢出

用户明确交还桌面控制；get_goal 返回 active，新阻塞审计从本次恢复重新计数。本机当前仍是 0748f67 已安装候选，真实 Taskboard 的 TB-10 详情、结果摘要、验证记录及“验收并完成”可见，仍处于待验收。只读归属和精确页面校验保持；测得详情面板 clientWidth=563、scrollWidth=892，执行记录可用491却撑到856。未换行的 pre 和 flex 子项 min-width:auto 共同造成横向溢出。诊断只读取合成验收页面，没有写任务或 Codex 草稿。

工作树已修复 activity 子项缩窄、长文本断行及验证记录 pre-wrap。新增实际 TaskDrawer 浏览器回归，用模拟 API 的长验证记录、连续链接、会话引用和评论验证桌面/内嵌两种布局，覆盖1320、935、424、185px；修复前2项均失败，修复后2项均通过，文本完整保留。整项目 tsc --noEmit、新回归测试 ESLint、独立输出目录的 Vite 前端生产构建均退出0；没有将此浏览器回归当作已安装程序或真实双设备通过，也未宣称完整 pnpm build/G0重验。临时Vite测试进程按归属核对后退出，4173释放；安装版及API未退出或重启。

首次诊断工具会话缺少WebSocket，改用工具Node24的保存脚本后读取成功；首次pnpm封装器在启动测试前触发无TTY依赖检查拒绝，记录保留，随后直接调用已安装Playwright/Vite CLI完成回归，未清空依赖。

产品CSS及新增回归尚未提交或进入新安装包；当前安装候选的G0–G2历史结果只适用于0748f67。G3人工验收/第二台完整观察及冲突草稿、真实离线禁写、撤权清缓存仍未闭合，G4未通过。下一步先取得TB-10人工验收和第二台观察结果，完成旧候选生命周期只读核对；布局修复进入新候选后重新核对适用门槛。证据：.artifacts/acceptance/2026-10-07-g3-resume/task-detail-overflow-fix-progress.json及所引用的实际宽度、失败/成功回归、类型检查、lint、前端构建和临时服务退出记录。

### 2026-10-06：0748f67 双设备专用 TB-10 已提交，待人工验收及第二台观察回传

用户已确认第二台选择原空间并准备观察。设备 A 使用同一已安装候选的随包 CLI 创建 TB-10（版本1），两条本机 CLI 子进程真实并发领取，仅一次成功、另一次 VERSION_CONFLICT；成功请求重放保持同一版本2和同一 execution。之后提交摘要与验证记录，版本升为3、execution 为 submitted。本机真实界面观察到待验收及结果记录；原九任务在各成功阶段保持原样。CLI 参数与结果有版本及幂等记录，但 wireObserved=false，未宣称捕获了实际 HTTP 请求。首次创建因验收工具遗漏必填 statusId 被产品正确拒绝（VALIDATION_ERROR）；失败证据保留，修正工具后成功，未改产品源码。

设备 A 的180秒提交观察已正常退出0，机器证据截至版本3待验收；第二台最终观察 JSON 尚未回传，计时范围及约2秒指标仍未验证。设备 A 的人工“验收并完成”尚未收到回报，不能代点后记为人工验收。桌面控制收到 Esc 后停止，后续仅做非桌面输入的诊断与证据整理。只读诊断工具已修正实际写按钮名称及 modal 覆盖，并在当前安装版确认归档、保存、领取、验收按钮可被记录；该工具可用验证不等于离线禁写通过。新版两份诊断工具已 Taildrop 发往第二台，传输退出0、PowerShell 解析错误0，尚未远程执行。

G0–G2通过，G3/G4保持未通过。待人工验收与第二台观察结果后核对最终版本4、一次验收活动及 execution released，再执行真实冲突草稿、已有实时连接中断后的离线禁写/恢复与撤权清缓存。证据目录为 .artifacts/acceptance/2026-10-05-ci-0748f67：g3-lifecycle-through-submit-progress.json、installed-g3-lifecycle-A-create-2026-10-06T15-21-00-061Z.json、installed-g3-lifecycle-A-create-2026-10-06T15-22-35-296Z.json、installed-g3-lifecycle-A-claim-2026-10-06T15-23-33-663Z.json、installed-g3-lifecycle-A-submit-2026-10-06T15-25-18-933Z.json、installed-g3-device-A-submit-accept-surface-20261006.json、installed-g3-surface-after-label-correction-20261006.json、g3-write-controls-observer-correction.json。

### 2026-10-06：第二台当前版运行、默认缓存与映射已核对

用户回传第二台诊断：0748f67七项随包文件匹配，主程序/Node/WebView归属匹配，defaultWebViewDirectory=true，合成账号/me及spaces HTTP200，本机映射匹配，root已渲染、资源名匹配、已同步。原样保存second-device-0748f67-readiness-20261006T150344-human-report.json。记录当前cardCount=1，未报告所选空间或筛选，不能据此断言产品故障；原九任务空间存在，但计时前仍需选中该空间、清空筛选并开始界面观察。尚未创建G3专用任务。

另已准备stdin控制的回环故障转发器，用于后续真实关闭已有实时连接并45秒以上自动恢复。仅本机独立端口验证200→503→200，原API期间仍200，Tailscale Serve配置未变，验证进程退出0、端口释放。没有断开两台真实桌面的流，也不计G3离线通过。证据g3-ingress-fault-helper-validation.json与g3-ingress-fault-preparation.json。G0–G2通过、G3/G4仍未通过，目标active。

### 2026-10-06：第二台登录与原九任务空间已确认，开始当前版G3就绪核对

用户对第二台手动登录及原空间TB-1～TB-9的确认请求回复“可以看见”，认证等待已解除，get_goal复核active。实际在本机已安装窗口选择“桌面隔离验收”，界面九张任务及已同步可见；只读观察器退出0，七项文件哈希、合成账号、空间、本机映射、进程归属均匹配。本机仍使用专用旧WebView缓存，此证据不替代第二台默认缓存。三份诊断辅助脚本已再次Taildrop至在线codex-server，退出0，等用户正常托盘退出后启动本机诊断并回传第二台readiness。未重启API、未写任务。当前新诊断等待计数1，不复用已解除的登录阻塞。G0–G2通过，G3/G4仍未通过。证据g3-current-two-device-readiness-progress.json及installed-g3-device-A-current-readiness.json。

### 2026-10-06：等待第二台登录结果，验收目标已标记阻塞

已核对第二台0748f67首次窗口截图：正常登录页、预填服务器正确、无整页白屏及伴随服务未知错误。尚未收到人工登录后原空间及TB-1～TB-9的结果。当前登录结果等待已连续三轮，get_goal复核active后，update_goal返回blocked；安装、端口、托盘等旧阻塞不复用。此状态仅等待第二台人工反馈，完整G0–G4范围保留，G0–G2通过，G3/G4未通过。未新增产品测试、未重启预览API、未改任务。

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

### 2026-10-06：第二台安装被47831占用检查拒绝，待核对进程归属

用户回报第二台升级辅助脚本第13行报COMPANION_PORT_OCCUPIED。按同版脚本控制流，此检查位于安装调用之前；不得记为已升级或当前候选失败。尚未知47831占用者，先请用户读取PID、程序路径、创建时间及父进程；诊断语法已在本机实装实例验证，仅属本机诊断工具验证。当前未停止任何第二台进程。此次用户恢复后的端口归属等待重新计数1，get_goal仍返回blocked，不伪称已恢复active；完整G0–G4范围保留。证据：second-device-port-guard-human-report.json。

### 2026-10-06：第二台当前候选首启结果未回传，目标等待外部操作

第二台0748f67升级和默认缓存正常首启结果连续三轮未获确认。本机所需准备已完成，最后只读核对进程/端口归属保持，本机及Tailscale HTTPS健康均200；证据目录和本机Downloads没有新增第二台结果。最近执行工具均已终止，无可轮询工作句柄。按相同阻塞条件三轮审计，update_goal返回blocked；不沿用已解除的本机托盘等待。G0–G2通过，G3及G4未通过，完整初版目标保留；用户回报第二台脚本输出和首屏后续验。详见当前证据目录goal-next-user-wait-audit.json。

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


更新日期：2026-10-05。项目仍为 `0.1.0` 开发预览，尚未通过发布验收。

## 2026-10-05 当前续验
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


用户本次回复“已清空”后，已只读确认 425ab6e 安装版与受管理 Codex 的 PID、FILETIME、路径、父子关系、监听端口及精确主页面均匹配。唯一编辑器为空、无模态框，仍选中原项目 1f11fa9b-28dd-484a-9c06-8fbd00d9e820；空编辑器 HTML 哈希为 00ec575662495d1f9ab9b7d5aa82c47fd99c899653a700f42eb17a5bb75df264。草稿清空等待已解决，历史三轮审计保存在 goal-g1-cleanup-wait-audit-before-20261005.json，本次计数重置为 0。恢复初期 goal 工具仍保留此前 blocked；继续工作后，最新 get_goal 已确认 active。没有通过 complete 绕过状态。

通过正式安装版“接入 Codex 侧栏”，再实际 Windows 点击 Taskboard 自有入口恢复展开看板。安装版 probe HTTP 200 / embedded=true，九张任务及“已同步”正常。重新接入触发原生页面重载，timeOrigin 现为 1791199646634.1；target/PID 保持，编辑器哈希和项目不变。当前入口/容器 generation=3，aria-pressed=true，iframe 展开。真实 iframe 935px、可滚动区域 920px，三列且无横向溢出；更窄真实窗口仍待用户手动调整。人工启动的 47830 预览 API 返回 status=ok/database=ok。证据为 .artifacts/acceptance/2026-09-30-ci-425ab6e/installed-g1-cleanup-verdict-20261005.json 及 installed-g1-cleanup-reopened-20261005.json/.png。没有重填或发送草稿。

下一步：用户保持这扇独立 Codex 的原侧栏和 Taskboard 都展开，手动缩窄窗口；读实际 iframe 宽度、列数、筛选器可读性和溢出。之后补 G1 其余拒绝/生命周期清理、G2 正常托盘退出重启与卸载重装、同候选第二台 G3；G4 仍受 G0–G3 通过前置约束。G1–G4 总门槛仍未通过，项目继续为开发预览。

### 2026-10-05 真实缩窄窗口：618px 已验证

用户手动缩窄后，实际 native width=963px、iframe=618px（不将约 780px 请求值当测量值）。看板自动为两列，每列 273.5px；document/body scrollWidth 与 clientWidth 均为 603px，无横向溢出。四个搜索/筛选控件、两顶部按钮边界完整。实际 Windows 切换列表：九行，任务/状态两列，表头及首行 grid 均为 376px 130px；负责人和优先级列在该断点隐藏。实际打开 TB-2 详情，字段、按钮、详情容器均在水平边界内，内容没有水平滚动；随后关闭详情并切回看板。原项目、编辑器空白哈希、timeOrigin、归属均不变。聚合 installed-g1-responsive-618-verdict.json passed=true；这是当前宽度通过，gatePassed=false。

该人工最窄尺寸步骤现已完成，结果及编号缺陷见本节上方更新；G1–G4 其余门槛仍待完成。

### 2026-10-05 安装版接口拒绝补验

仍为同一 425ab6e 安装版及原生绑定。缺少本机认证、错误本机认证请求均 HTTP 401 / LOCAL_AUTH_REQUIRED；有效认证但缺少必填字段的请求 HTTP 400 / VALIDATION_ERROR。三种拒绝后原 document、入口/容器 generation=3、展开 iframe、选中项目及空编辑器哈希均不变；TB-2 版本 2、状态未变。installed-g1-local-boundary-20261005.json passed=true；这不替代真实宿主弹窗/会话/结构漂移拒绝。check-current-native-modal.ts 已准备并通过 Node 语法检查，未执行真实弹窗验收，未计通过。

此前最窄就绪检查为 native width=963px / iframe=618px；本轮已测到 native 480px / iframe 424px，见上方更新。get_goal 最新确认 active，goal-next-user-wait-audit.json 将上一轮及本轮分类为 progress，当前人工尺寸条件计数 1，未达到 blocked 阈值。G2 还需正常托盘恢复/退出重启及卸载保留；之前自动初次启动被策略拒绝的动作未通过其他路径重试。G1–G4 仍未完成。

## 2026-09-30 续验历史（已由上方 2026-10-05 状态更新）

**最新实际状态：425ab6e 安装版已接入真实侧栏，并通过错误目录保留展开看板、列表/看板切换、收起重开、外部重载恢复和实际任务详情草稿路径；当前五段未发送草稿等待用户清空；同一条件连续三轮核实，goal blocked。** 仍是桌面 PID 19936、Node 8804、WebView 37724、原生 PID 26844 / 60614 / target 78B076B73CADCC27E31A87C24449CAD0；最新 document timeOrigin 1790806142575.8。当前选中项目仍为 1f11fa9b-28dd-484a-9c06-8fbd00d9e820，映射已恢复到当前检出。实际 Windows 点击 TB-2“在 Codex 中打开”，原生五段内容与预期哈希一致；重复安装版请求被拒绝、编辑器哈希保持，真实 frame-src/enforce 事件确认 CSP 恢复，TB-2 版本 2/状态未变。成功填写时入口/iframe 已按设计撤除，当前 entries/ownedNodes/frames 为 0；清空后需从正式安装版按钮再接入，不要要求用户点当前不存在的入口。请勿发送或再次写草稿。成功 UI 请求的 HTTP 响应未被观察器捕获（iframe 清理），没有重试成功动作；原生结果及 Windows 操作已确认。当前只实际测了 935px iframe 的三列/无横向溢出，更窄真实窗口仍待验收。详见 installed-g1-progress-summary.json，各 G1–G4 总门槛仍未通过。旧登录三轮 blocked 已重置，保留历史审计。 已完成 G2 数据保留前基线 installed-g2-retention-baseline.json；原生草稿仍非空，goal-g1-cleanup-wait-audit.json 记录新条件三轮，goal blocked。用户清空并恢复后重置本次阻塞审计，不能沿用旧计数。就绪诊断现在正确优先提示等待用户清空。

45acfd3 的桌面 PID 41992、伴随 Node 27764、原生 PID 38836 和包启动辅助 PID 26512 已全部退场，47831/9334/63322 已释放。退出前空编辑器、项目和真实 CSP 恢复通过核对；这次是受控升级，不计正常托盘退出。下文旧 PID、登录窗口和已展开看板均为历史，禁止沿用这些身份做新动作。原人工预览 API PID 36200/47830 和测试数据库 55439 仍在，不得重试之前被拒绝的自动 API 启动。新安装包还需原缓存启动、安装版拒绝/草稿及第二台实测；窗口缩窄步骤在新宿主就绪后继续。

修复候选现为 425ab6e24324f74fe14161536598ca8f531e867f：拒绝草稿前先验证项目与编辑器，防止误移除持续入口。本机 check、精确冻结安装、124 项真实数据库、8 项浏览器及生产离线回归通过；CI #36734441283 三项作业全部成功。新安装器 SHA-256 为 341B2053F8B0D7B9D85073DFBFF1D4DE6D66F6E3BC0B5FCA56814E3E891CCE8A，已校验且 Taildrop 发到 codex-server，但尚未安装或实机复验。新证据在 .artifacts/acceptance/2026-09-30-ci-425ab6e/ 与 2026-09-30-g0-425ab6e/。上述 45acfd3 运行状态为历史；本次实际状态以顶部新身份为准。不要把源码回归等同于修复安装包通过。

安装版已新增并修改 TB-8，服务器版本 1→2→3；实际关闭到托盘后再次启动恢复原窗口与服务。错误目录拒绝却移除持续侧栏入口的缺陷已实机复现，映射与入口已恢复；源码已加清理前校验并通过 38 项适配器/CSP 回归，待修复提交的 CI 安装包重做。详见最新验收条目。当前真实看板共八张任务，编辑器为空。不要把错误目录观察器原来的 aggregate passed=true 当作 G1 通过，单独 verdict 明确为失败。

当前运行安装包为 45acfd3，正式支持已验证的 Codex 26.928.1915.0 和 redesigned shell 标记。pnpm check 通过（109 项通过、15 项预期数据库跳过），精确提交三项 CI 全部成功。安装器已校验、未签名，本机已安装到独立目录 2026-09-30-installed-45acfd3；保留原数据/会话文件和原 WebView2 缓存后直接显示七张任务及已同步。旧测试进程仅作精确身份清理，不能算正常托盘退出。源码组件、五段草稿与拒绝、人工清空和 CSP 恢复已有证据；CDP 指针仍在元素稳定等待阶段超时，原因未确认。请继续安装版持续入口验收，不再交接短时源码入口。

新版实际按钮创建的受管理 Codex PID 38836、FILETIME 134352453862940241、回环 63322、target 00DB75D87823D4896287A78C4BE89727 仍有效。用户已登录、选中唯一映射到当前仓库的项目，编辑器为空；安装版“接入 Codex 侧栏”已恢复持续入口，实际 Windows 点击打开、列表/看板切换、收起/再次展开通过。认证 iframe 显示七张任务及已同步，920/935px 无横向溢出，列表四列对齐。当前看板保持展开；不要重新要求登录或寻找未接入的入口。窄窗口实测仍待用户手动缩窄（CDP 窗口 API 不可用），安装版完整草稿/拒绝及 G2/G3 仍待完成。新证据在 .artifacts/acceptance/2026-09-30-ci-45acfd3/。当前桌面 PID 41992、伴随 Node PID 27764、47831；预览 API 保持运行，不得重试此前被策略拒绝的自动启动。新安装器已 Taildrop 发往 codex-server，尚无领取/安装确认。G1–G4 仍未通过。

已核验构建 `cf415a2` 的三项 CI 作业全部成功，本机有数据库回归 124/124 和生产离线回归通过，日志和安装器校验和见验收记录。该安装器已在本机新隔离目录安装，保留原数据和 WebView2 缓存后冷启动直接显示七张任务、TB-6 修改标题与 TB-7 描述，所有写入禁用；再次启动恢复同一实例和伴随服务。旧进程本轮只作精确身份清理，不算正常托盘退出。列表正文与表头错位已作源码修复，七种宽度的独立演示页回归和生产 Web 构建通过，修复提交 `c1a3fcc` 的三项 CI 已全部成功，新安装器已下载核对并发到第二台 Taildrop，但尚未安装运行；第二台默认缓存连续冷启动仍待回报。

官方 MSIX 已升至 `26.928.1915.0`。新的隔离原生探针验证了实际包身份、句柄交接、回环监听者和精确主页面，源码已加入该版本的原生启动支持。本机 `cf415a2` 已通过真实按钮创建同版本隔离宿主及重复启动归属检查，实际 PID 2172/回环 52777/精确主页面一致，连接检测明确拒绝尚未通过页面验收的版本。请使用这次 Taskboard 按钮创建的窗口继续登录和项目选择；原探针窗口仍保留。本轮实际宿主源码检查后已加入侧栏/草稿清单；新安装版完整 G1 仍待验收。预览 API 的自动启动被审批返回 `blocked by policy`，未给出具体原因，用户现已人工启动，健康检查通过；原被拒动作未通过其他入口执行。新隔离 Codex 的登录和项目选择已由用户完成。G1–G4 均保持未通过。

## 获取当前进展

远端仓库为 `https://github.com/i-am-yimin/codex-taskboard.git`，验收工作分支为 `codex/initial-implementation`。新机器执行：

```sh
git clone https://github.com/i-am-yimin/codex-taskboard.git
cd codex-taskboard
git switch --track origin/codex/initial-implementation
pnpm install --frozen-lockfile
```

如果新机器已有该分支，在干净工作树中执行 `git fetch origin`，再更新到 `origin/codex/initial-implementation`。先用 `git status` 检查当地未提交修改，避免覆盖它们。

需要 Node.js `22.16+`、pnpm `10.28.0`。真实服务需要 PostgreSQL `16+`；Windows 桌面构建需要 Rust stable、MSVC C++ 工具链、Windows SDK 和 WebView2。示例配置从 `.env.example` 复制到本机 `.env`，按 [部署说明](docs/deployment.md)填写本机数据库和会话密钥。

## 验收状态

- [开发预览验收记录](docs/acceptance.md)保存按日期排列的实际结果；[闭环验收计划](docs/closure-acceptance.md)给出 G0–G4 的通过条件；[进程归属设计](docs/adr/0003-managed-codex-ownership.md)解释桌面启动器和适配器的安全边界。
- G0：当前修复候选 425ab6e 的本机 check 通过（109 项通过、15 项预期数据库跳过），精确冻结安装、独立测试数据库 124/124、生产离线回归和用户人工启动的 HTTPS API 上 8 项 E2E 均通过；精确提交三项 CI 全部成功，覆盖生产 API、数据库、E2E、离线、依赖审计及 Compose/HTTPS 演练。日志、首次包管理器失败及作用范围见验收记录。
- G1：新原生宿主 26.928.1915.0 的进程、主页面归属及项目契约已确认。45acfd3 安装版持续入口、实际 Windows 点击打开/列表切换/收起再展开、认证七任务及当前 920/935px 无溢出通过。源码草稿与拒绝/CSP 证据已有；实际窄窗口和同一安装版完整草稿/拒绝仍待完成，G1 未通过。
- G2：旧安装包已验证本机托盘退出、卸载保留数据与重装恢复；`87406f5` 以原缓存离线冷启动可读七张任务且禁写。第二台默认缓存启动曾白屏，`cf415a2` 本机原缓存离线冷启动及同实例恢复通过，正常托盘退出、线上读写与第二台同版连续冷启动仍待实测；列表布局修复后的安装包也需实测，G2 未通过。

- G3：`e849afe` 的真实双设备 TB-4 创建、原子领取、提交与人工验收已走通；最新安装包的双设备完整流程、离线禁写与撤权后缓存清理尚待完成。G3 未通过，G4 保持等待 G0–G3 闭环。

换机后的首要任务是复验固定提交的基础检查，然后在新机器的隔离账号或测试数据目录安装同一提交生成的程序，继续 [闭环验收计划](docs/closure-acceptance.md)中的 G1、G2。不要沿用上台机器的 PID、CDP target、进程归属记录或 Codex 会话。切换宿主版本后重新核对页面标记、CSP、项目身份和草稿行为。

## 常用命令

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:db
pnpm test:e2e
pnpm test:offline
pnpm desktop:prepare
pnpm desktop:bundle
```

`pnpm test` 在没有 `TEST_DATABASE_URL` 时会跳过数据库集成测试。`pnpm test:db` 仅使用项目独立的 `*_test` 数据库；浏览器测试也需要先启动独立测试数据库。步骤见 [闭环验收计划](docs/closure-acceptance.md)。桌面代码、真实 Codex 宿主和 NSIS 安装器要在 Windows 上检查。

## 本机证据与数据

`.artifacts/acceptance/` 中的原始日志、截图、诊断程序和安装包按验收计划留在原机器，没有推送到 Git。仓库文档记录必要的结果、校验和和剩余步骤。`.env`、数据库、设备凭据、Codex profile、未发送草稿及其他用户数据也不随仓库迁移；另一台机器需要自己的隔离测试环境。

在继续真实桌面验收前，先阅读 [验收记录](docs/acceptance.md)最近的 2026-09-30 与 2026-09-29 已安装程序及包上下文条目。那里逐项区分了已经观察到的成功路径、失败轮次及仍待复验的步骤。不要把开发预览提交标为正式 Release。

## 2026-10-07 最新续验交接（29aa095）

候选为 `29aa09578cee2a59ddbe5bb5c1b36965bda8d579`，证据位于 `.artifacts/acceptance/2026-10-07-ci-29aa095`，本机安装位于 `.artifacts/acceptance/2026-10-07-installed-29aa095`。G0 已通过，G1/G2/G3 部分完成，G4 未进入；不得宣布初版验收完成。原工作区样式/测试等修改保持，修复工作树候选不变。

本机正常托盘退出、端口与进程释放、相同数据/cache 冷启动已通过。当前主进程 43004、伴随 Node 29816、WebView 23216，精确页面 target `81F3E345357FB4F429AAAEBA4DA17AC1`。共享 API 47830 必须保持，不得重启。G2 尚需同提交卸载/重装和数据保留复验。

G1 已验证本机 480px 原生窗口/424px iframe 的十任务看板、列表、TB-10 五条活动无横向溢出，以及结构/目录/本机边界安全拒绝。活动看板目标 URL 漂移导致恢复未确认并撤销管理；首轮失败与未进入握手结果均保留。精确目标的诊断重载验证 CSP enforce、空编辑器及项目保持，但不能关闭产品恢复门槛。桌面重启后旧独立 Codex 所有权不能复用；须新受管理实例绑定。成功五段草稿、nonce 失败/CSP 正常清理、宿主退出重启仍待完成。

G3：TB-11 `6711b956-73b8-48cc-9a22-1593f6f6252e` 已经过创建v1、一次成功并发领取/幂等重放v2、提交v3、本机人工验收v4。随包 CLI 复核为 done，有一条验收活动、执行记录 released，原十任务指纹保持。本机最后界面为原空间十二任务、TB-11 在已完成；新增 TB-12 是本轮冲突专用合成任务。

第二台完整计时文件已通过 Taildrop 自动收至本机 Downloads 后原样归档：`second-device-29aa095-timed-20261007-092509-979.json`。1178次轮询，七文件、默认缓存、目标和 PID/ticks保持，校准后 v1/v2/v3 可见延迟为391–726、0–335、40–375ms，服务器时间与 CLI请求区间一致，两台页面均未刷新。第二台观察09:35:24Z结束，人工验收09:38:25.773Z，因此v4最终状态尚缺，不能声称v4两秒通过。`installed-g3-lifecycle-timing-assessment.json` 已通过且 g3Passed=false；A观察器已结束并补final owner。

G3冲突草稿：实际安装界面新建 TB-12 `28cd624f-0db1-4f97-9116-bee4f8b922d9`、形成v1草稿；CLI 并发服务器v2后，UI保存返回409/VERSION_CONFLICT且请求If-Match1/幂等键有效，完整草稿指纹和未保存标志保持。关闭详情再打开仍保持。核对服务器最新内容后基于v2保留本机编辑并保存，实际200、v3；成功后草稿缓存清除。先前十一任务逐ID核对未变。证据 `installed-g3-conflict-*.json`；工具首轮错误保留并已修正。

下一人工步骤：codex-server 保持当前原空间/默认缓存/诊断端口9335，收取已发送的 `read-second-device-final-29aa095.ps1` 与 `second-device-final-29aa095.mjs`，运行前者后回传新生成的 `second-device-29aa095-final-*.json`。补读只检查页面和服务器v4，不登录、不刷新、不写任务，不需重做生命周期。

离线禁写/重连、撤权后重新联网缓存清理仍缺实际安装版证据。当前候选的网络故障辅助工具已重新验证（本机47832代理200→503→200、直接API始终200、Serve配置不变、辅助进程及端口释放）；它只是准备结果，不算真实断线通过。后续实际断线须切断已有SSE流、自动恢复测试入口，保护共享API及主聊天。初版Goal工具仍为旧blocked状态，不能调用active；用户已恢复工作，不重复旧等待条件，也不得标complete。

### 2026-10-07：29aa095 第二台最终状态回传核对通过

用户运行最终只读检查并通过 Taildrop 回传原 JSON。七项安装文件、默认 WebView 缓存及进程/PID/创建时间与此前计时报告一致，精确页面和 timeOrigin 未改变。TB-11 在第二台缓存、可见“已完成”卡片、服务器以及新读本机界面均为 version 4 / done，服务器只有一次 task.accepted。v1–v3 已有校准后两秒内证据；观察器在验收动作前结束，因此不声称 v4 的两秒延迟通过。版本冲突的实际 UI 草稿保留与合并已通过；G3 仍待实际断线禁写/自动恢复及撤权缓存清理，G1/G2 其余子项和 G4 继续开放。

证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/installed-g3-final-state-assessment.json`、`installed-A-final-TB11.json`、`second-device-29aa095-final-20261007-101732-622.json`。

### 2026-10-07：29aa095 安装版真实断线禁写与自动重连通过

确认本机与第二台使用同一 HTTPS 测试入口后，保存精确 Serve 配置，用回环代理转发到原共享 API；通过实际空间菜单重建 SSE，确认代理确有流后关闭连接并返回 503 共 50 秒。真实安装窗口在约 0.5 秒观察轮次内显示离线缓存，新建任务和五列添加按钮禁用；十二任务和 TB-11 version4/done 保留。随包 CLI 对专用 TB-12 的版本化幂等更新退出 26 / ACCEPTANCE_TEST_OUTAGE，恢复后 TB-12 仍 version3/原内容，前十一任务指纹保持。入口自动恢复后无需刷新回到已同步，页面 timeOrigin、精确目标与进程归属保持。原 Serve 配置已恢复，代理退出，47832 释放；共享 API 的 47830 所有者未改变。

控制通道首轮 stdin 关闭，未制造故障且手动精确恢复；复用的冲突检查器因详情已关闭而失败，其服务器只读投影被独立核对，未把该次整体失败改写为通过。两类工具失败均保留。证据：`installed-g3-real-offline-assessment.json`、`installed-g3-offline-A-observer.json`、`installed-g3-outage-routing.json`、`installed-g3-offline-cli.json` 和离线/恢复截图，均位于当前候选证据目录。G3 仍待实际撤权后联网缓存清理。

旧隔离 Codex 的实际文件菜单正常退出已确认：编辑器空，原生进程/辅助进程退出、60910 释放、主聊天进程保持。该窗口属于上次桌面启动，不用作新绑定的成功草稿证明。G2 同提交卸载重装辅助脚本已准备，只操作指定验收安装目录及原验收数据，待当前 Taskboard 正常托盘退出后执行。

当前续跑点：本机桌面 PID43004、随包 Node29816 和47831仍运行；旧隔离Codex19860及辅助39676已通过正常文件菜单退出。`uninstall-reinstall-acceptance.ps1 -ValidateOnly` 已退出0，安装器/卸载器/独立目录/八项安装文件基线及四项保留数据固定。下一步需要用户从本机Taskboard托盘正常退出，然后核对端口释放并执行该同提交脚本；完成后用原数据/cache重启，继续新 managed binding 和实际撤权。此轮没有重启共享API，也没有在其他设备直接执行脚本。

### 2026-10-07：29aa095 G2 安装生命周期通过

用户从托盘正常退出后，主进程与47831/9334释放；共享API47830仍为原进程。指定验收目录的NSIS卸载/重装都退出0，卸载实际移除安装程序，四个保留数据文件在卸载及重装后哈希完全一致，原WebView缓存目录保留，八项安装文件（含卸载器）pins匹配。使用原数据/cache启动新安装进程，未经登录或刷新直接出现已同步看板，默认选中专用读写空间；通过正常空间菜单切回原验收空间后显示十二任务。原十一任务指纹、TB-12 version3/原内容、本候选G2实际UI创建并编辑的任务version2及映射保持。合并此前同候选真实读写、托盘隐藏/恢复和正常退出证据，G2通过。安装器实际签名状态为NotSigned，属于开发预览。

首轮最终任务读数因首屏选中了另一测试空间而false；切换空间后通过。合并报告的签名子shell模块加载、证据文件名及把任务标题识别为未保存状态三个工具错误保留原结果，修正后只重跑只读核对；没有重跑安装生命周期。证据：`installed-g2-combined-assessment.json`、`installed-g2-uninstall-reinstall.json`、`normal-exit-before-uninstall.json`、`installed-g2-after-reinstall-original-space.json` 和首屏/原空间截图，均位于当前候选目录。G1/G3尚有必需子项，G4未进入。


### 2026-10-07：29aa095 撤权清缓存通过，G3 同提交闭合

在本机实际安装窗口通过正常 UI 留下 TB-12 未保存任务草稿与 TB-3 未提交结果草稿，基线有五份看板缓存、各一份任务/结果草稿。用临时入口代理切断已有 SSE 并返回503，共50秒；原共享API未重启。离线期间，服务端通过本机已有合成浏览器会话撤销其自身设备登录；独立Agent只读核对确认其他设备记录和服务器十二任务不变。网络自动恢复后，无刷新回到登录页，原账号的看板/任务草稿/结果草稿计数全部归零，离线会话快照、伴随服务账号分区及本机浏览器/Agent凭据清除，仓库映射保留，伴随服务 /me 返回401。原精确Serve路由恢复、47832释放、共享API47830仍由原进程持有。

保留工具失败：首轮 TS 浏览器求值的序列化错误、两次过期状态触发拒绝，以及错误使用Agent执行撤权得到的403 AGENT_SCOPE_FORBIDDEN；它们没有修改任务或扩大令牌权限。修正验收辅助脚本后，用新鲜SSE状态在同一回调内触发故障，再用正确的既有浏览器会话执行撤权。前一轮故障也按50秒自动恢复。后置观察器只用于离线/清缓存，不采用其中对旧TB-11的延迟投影。

合并同提交真实双设备生命周期、v1–v3校准后的两秒内可见、并发原子领取与幂等、设备A人工验收、服务器/A/B最终v4/done、实际版本冲突草稿保留/合并，以及此前真实离线禁写/自动重连，G3通过。v4仅证明最终状态一致，不声称其两秒延迟通过。证据：`.artifacts/acceptance/2026-10-07-ci-29aa095/installed-g3-combined-assessment.json`、`installed-g3-revocation-assessment.json`、`installed-g3-revocation-A-observer-final.json`、`installed-g3-revocation-environment-restored.json`及撤权后的登录截图。

当前G0/G2/G3通过，G1仍待新绑定独立Codex的成功草稿、非空拒绝、nonce/CSP失败清理及正常宿主退出/重启，G4未进入。Taskboard本机停在撤权后的正常登录页，需用户重新登录测试账号。正常安装按钮启动的新独立Codex已通过精确进程/页面只读核对，仍在登录页，无项目与编辑器，需用户登录并打开测试项目。Computer Use读取该窗口时截图与可访问性树出现不一致，未执行输入，改用精确绑定只读诊断确认登录状态；不作为宿主成功验收。

续跑先核对用户完成两处登录，新独立宿主的PID/创建时间/端口/target均读取当前identity文件，保留旧失败，不复用旧窗口或重启共享API。


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


### 2026-10-08：等待旧安装版正常托盘退出

同一阻塞已在三个连续目标回合核对：旧已安装 Taskboard及其伴随服务仍为精确原进程，47831/9334仍占用。新版16a1ceb安装包、同提交G0及独立宿主/第二设备辅助脚本均已完成可独立推进的准备；PowerShell/JavaScript/TypeScript语法校验通过，尚未用于新安装版正式验收。Computer Use未返回通知区域托盘目标，不能完成正常托盘退出。目标标记blocked，等待用户从本机Taskboard托盘菜单退出后继续。共享API与数据库保持健康；未安装覆盖运行实例、未停止原生独立窗口。证据：.artifacts/acceptance/2026-10-08-ci-16a1ceb/preinstall-blocked-audit.json、acceptance-harness-preparation.json。



### 2026-10-08：用户正常退出后，新候选安装及首屏已通过

用户回报托盘退出，已独立核对旧主进程与伴随服务消失、47831/9334均释放，原共享API与数据库PID/创建时间保持不变且健康。已执行16a1ceb的已验证CI NSIS安装器，退出码0；七个实际安装文件全部匹配负载哈希，原有state/CLI凭据文件逐字节保留，沿用既有WebView缓存。新安装版进程/伴随服务/WebView父子归属与唯一页面绑定通过，首屏root渲染正常，实际加载资产正确，未刷新、未更换缓存、无白屏和未知伴随服务错误；实际首屏是登录页。原测试HTTPS健康接口200。目标已恢复active，当前等待用户手动登录新安装窗口；Computer Use禁止操作认证界面。G0保持通过；G2仅安装/首屏部分通过，G1/G2完整流程及G3同候选双设备仍待验收。证据：.artifacts/acceptance/2026-10-08-ci-16a1ceb/old-runtime-post-tray-exit.json、installed-result.json、installed-first-render.json、installed-desktop-identity.json。



2026-10-08登录等待期间补充：在16a1ceb真实NSIS伴随服务验证缺失本机密钥401、错误密钥401、格式错误草稿请求400、不可信Origin403四项拒绝；当前安装页面与state.json哈希保持不变，未启动独立宿主、未填草稿、未登录、未向上游写任务。主Codex、开发探针、共享API及数据库的PID/创建时间/路径全部保留。属于安装版本地边界局部证据，不能替代正式新宿主G1完整成功与拒绝场景。窗口仍为正常登录页，需用户登录。证据：.artifacts/acceptance/2026-10-08-ci-16a1ceb/installed-prelogin-boundaries.json。



2026-10-08后续登录阻塞审计：新候选安装版的精确页面、主进程、伴随服务与WebView归属仍一致，首屏渲染正常、无白屏及未知伴随服务错误，仍显示登录表单。共享API健康，四项真实安装版本地边界拒绝已通过；安装、G0与相关辅助脚本准备完成。三个连续目标回合均需要同一手动登录；Computer Use技能禁止操作用户认证界面，目标标记blocked，等待用户在新Taskboard登录测试账号后继续。未要求再次退出或再次启动API。证据：.artifacts/acceptance/2026-10-08-ci-16a1ceb/login-blocked-audit.json、installed-current-login-audit.json。



### 2026-10-08：16a1ceb 安装版登录后增量验收

固定候选仍为 `16a1ceb7fb4ef203b2bf0e257b5de1e9c9d5cd43`。已在真实安装窗口确认测试账号登录及原空间十二张任务恢复；重复点击启动独立 Codex 复用同一原生进程、创建时间和目标页面。新建专用空间及任务、修改标题/多段描述/仓库标识均由安装窗口执行，三次写入 HTTP 200 且带幂等头，修改携带版本 1 并返回版本 2。关闭窗口隐藏到托盘，再次启动恢复同一窗口、主进程和伴随服务；修改后内容仍在，原空间任务摘要未变。

正式新独立宿主仍处于登录页。此时实际侧栏接入按钮安全拒绝，页面未重载且没有注入节点；报错将“没有编辑器”概括为“编辑器非空或有弹窗”，具体提示仍待完善。正式宿主登录/选项目、正向侧栏及草稿、其余拒绝/CSP/正常退出重启仍未关闭 G1。G2 还需完整退出冷启动、卸载重装和数据保留。G3 需当前候选双设备重验，G4 尚未进入；初版不计为已验收。证据：`.artifacts/acceptance/2026-10-08-ci-16a1ceb/installed-followup-verdict.json` 及对应 G1/G2 记录。测试观察器已正常结束，共享 API/数据库、主 Codex 和原测试空间保持原样。

## 2026-10-08：登录窗口恢复与新候选 fc40da8

- 安装版 16a1ceb 的正式原生实例存活但主窗口隐藏，重复启动没有恢复窗口；精确核对空登录页后只结束该测试实例进行故障修复，不计正常退出验收。随后从安装版实际按钮启动新原生 PID 34588 / HWND 461530，原主 Codex、开发探针、API 47830 和数据库 55439 身份均保留。
- 用户已经在新正式实例登录并选中 `<本机验收仓库>`。只读项目解析、唯一空编辑器及无弹窗均通过；从实际安装版请求侧栏接入后出现唯一入口，未发送草稿。
- 修复提交 `fc40da8dd2caeb2326b6989d17c1311d0e408bfd` 位于干净工作树 `<隔离验收工作树>`、分支 `codex/host-26-930-acceptance`，已推送。重复启动会恢复唯一且归属仍匹配的主窗口，并区分登录页与非空草稿的拒绝原因。
- 新提交 CI `37739769316` 的 verify/container/windows-desktop 全通过。精确源码归档本机 frozen install/check/database/browser/offline 全部通过：无数据库 110 通过、15 预期跳过；真实隔离数据库 125 通过、无跳过；浏览器 12 通过；生产离线恢复、草稿保留、禁写、重连和撤权通过。临时 4174/47833/47834/55440 全释放，共享 API/DB 未重启。G0 关闭，G1–G4 保持未关闭。
- 新安装器 `.artifacts/acceptance/2026-10-08-ci-fc40da8/codex-taskboard-fc40da8-setup.exe` 已从同提交 CI 下载，SHA-256 `A050881C498AB54C977BA50808E5B9F0DEC2095859F867E73DF059980B85AB96`，未签名；还未安装。ZIP 产物摘要与 GitHub 提供的值匹配。
- 下一步需要当前 Taskboard 正常从托盘退出并核对服务/端口释放，再安装 fc40da8，复验恢复、侧栏、草稿与完整生命周期。刚才 Sky 检测到用户输入，停止界面点击；原生接入后编辑器保持空，侧栏入口为收起状态。验收证据：`.artifacts/acceptance/2026-10-08-ci-fc40da8/g0-verdict.json`；前一安装版的当前项目证明在 `2026-10-08-ci-16a1ceb/recovered-native-project-readiness.json`。

### 2026-10-08：未见登录窗的实际状态与换包前清理

用户报告未见登录窗。从唯一已绑定 HWND461530 唤起后实际画面为已登录的 codex-taskboard 项目，侧栏入口存在且编辑器为空；已保存 old-native-before-normal-close.png。普通标题栏关闭隐藏窗口而不退出；绑定至同一 PID34588/target86521FD20297E06329C239EBE6377362 的 Browser.close 返回成功并移除页面，但原生进程及 helper29780 仍在。核对空页面退出前证据、当前无任何 CDP targets、原进程创建时间/路径/父子关系及四个保护进程后，只对旧原生 PID34588 做精确修复结束；helper 自行退出、49353释放。此项明确不是正常退出门槛证据。

fc40da8 新候选仍未安装。旧 Taskboard18100/Node13112 及47831/9334仍在；Computer Use只返回应用窗口，无法定位通知区域托盘图标，下一步需用户从旧 Taskboard托盘点“退出”。待确认全部释放后执行已固定哈希的 install-candidate-fc40da8.ps1 和 start-installed-taskboard.ps1。四个保护进程保持原身份，共享API/数据库未重启。证据：2026-10-08-ci-fc40da8/old-native-retirement.json、old-native-targeted-cleanup.json、preinstall-after-old-native-retirement.json。第二台fc40da8安装器及四个辅助文件已Taildrop成功传送，尚未远程安装。

### 2026-10-08：fc40da8 已安装，登录前窗口恢复验收及第二台诊断脚本修正

- fc40da8 同提交 NSIS 已在专用目录安装，退出码 0；七个随包文件与已验证 CI 负载一致，原专用账号状态、DPAPI 凭据和 WebView 缓存保留。首屏直接显示已有空间，实际窗口创建“fc40da8 安装版读写验收”及任务，随后修改标题、描述和仓库标识；被动观察记录 POST/PATCH 200、幂等头与 If-Match 1→version 2。关闭隐藏及重复启动恢复同一窗口，服务与页面身份保持。G2 只部分通过；设置服务器/重新登录、冷退出重开及卸载重装仍待做。
- 新安装版实际“启动独立 Codex”按钮已创建并绑定独立原生 26.930.7945.0。再次点击实际按钮分别恢复最小化、被覆盖的最大化窗口及正常关闭后隐藏的最大化窗口，保留原 PID/创建时间/页面目标与最大化尺寸；没有创建重复实例。证据 installed-native-restore-verdict.json。
- 新原生仍是登录页。实际“接入 Codex 侧栏”按钮返回 409 CODEX_INSTALL_REFUSED，明确要求先登录并打开项目；页面 timeOrigin/节点/编辑器均未变。初版观察器只匹配中文“登录”导致断言误报，原失败输出保留，英文消息的明确登录/项目要求另行验证。原生 Playwright 截图超时也保留，桌面截图用于留证。G1 完整门槛仍未通过。
- 第二台启动诊断旧脚本误留前候选 EXE 哈希。新 start-second-device-diagnostics-fc40da8-v2.ps1 已固定当前 CI/已安装负载的正确哈希并通过 ValidateOnly，只读检查不启动应用；已 Taildrop 到唯一在线 codex-server，退出码 0。后续使用 v2 文件，不使用原启动诊断脚本。安装脚本/读取脚本及七文件清单已核对。远程新版本安装与首屏尚未观察，不计 G3。
- 收到物理 Esc 后没有再执行桌面输入。新原生只读状态仍需要用户手动登录、打开映射项目并保持编辑器空；恢复桌面操作需用户交还控制权。主 Codex、开发探针、共享 API 47830 和 DB 55439 保持原进程身份，共享服务未重启。
- 当前权威索引：.artifacts/acceptance/2026-10-08-ci-fc40da8/current-progress.json 与 gate-evidence-index.json；安装/窗口/网络/脚本修正分别保存在同证据目录。G0 通过，G1/G2 部分通过，G3 待验收，G4 尚未进入，整体初版可用目标保持未完成。原根工作树预存修改继续保留。
### 2026-10-16：恢复中止的环境，修复网关 502 时无法显示已有离线缓存

- 用户要求继续。原 10 月 8 日各测试进程及 47830/47831/9334/55439 均已停止；当前主 Codex 是 26.1007.9446.0。根工作树既有修改保留；干净候选工作树起点 fc40da8。
- fc40da8 已安装七文件摘要与原 CI 负载一致，使用原数据/WebView 缓存重新启动：无白屏，但已有离线快照和四个空间缓存时，远端 HTTP 502 仍落到登录页。这是本轮真实安装版发现的失败，未计冷启动通过。
- 在候选工作树修复 GET 502/503/504 的暂时服务不可用分类，使缓存读取进入既有只读恢复路径；401/403 继续清理无权缓存，写入错误保持显式失败。修复前的浏览器 502 回归实际失败，修复后 5 项浏览器回归、14 项 API 测试、类型检查与指定文件 lint 全通过。未用这些源码测试替代安装版门槛。
- 新提交 ef99f2b33bdb590f46c4a1bf7081447628f7de2c 已推送原分支 codex/host-26-930-acceptance。CI 38835295104 已确认运行，verify 成功，container/windows-desktop 当次观察仍在进行；新源提交 G0 尚未关闭。修复尚未安装。
- 当前运行时 fallback pnpm 已变成 11.25，一次原始测试调用在执行测试前尝试依赖维护并因无 TTY 退出；该输出保留。随后直接使用项目已有 Playwright/Vite 执行明确回归。另把项目指定的 pnpm 10.28.0 安装到私有 .artifacts/tools/pnpm-10.28.0，核对官方包 SHA512 与路径，未更改全局配置、未重装依赖。
- 使用原已验证 e72c648 开发探针及当前包的精确四段版本启动新的隔离 26.1007.9446.0：私有目录、真实持有句柄、监听者、精确 target 与 page URL 均通过，主 Codex 22308 保持原身份。这只是开发探针，产品原生/DOM 清单尚未扩展，不能计作安装版 G1。新原生 PID 29408 / 窗口 199272 正停在登录页并已显示到前台。
- 现有 .data/test-postgres 原目录恢复至 55439，未重建/清空；只读核对原空间 12 张任务与 fc40da8 的 G2 version 2 任务保留。数据库观察句柄 96465 / PostgreSQL PID 28264。共享 API 47830 因此前自动启动被审批拒绝的明确记录，未自动重试；需要用户手动运行既有 start-preview-api.ps1。认证界面同样需要用户操作。
- 当次完整状态和凭据不外传的证据索引：.artifacts/acceptance/2026-10-16-host-26-1007/current-progress.json。新安装版 PID 15732 / companion 9876 / WebView 8196；旧日期证据保留，不再按旧 PID 执行动作。整体目标仍未完成，G4 未进入。
### 2026-10-16 后续：ef99f2b G0 完整通过，实机门槛继续保持开放

- 同提交 CI 38835295104 的 verify、container、windows-desktop 全部 success。从 GitHub 认证 API 取得安装包和独立探针 ZIP，逐一与 GitHub SHA256 digest 核对。认证信息未写入日志或证据。
- NSIS 安装器已保存于 .artifacts/acceptance/2026-10-16-host-26-1007/codex-taskboard-ef99f2b-setup.exe，SHA256 FB9FEF67454C12C255302933E06DD5D4A5CF31B9E36FDB3CD0A1E2285F2E8D1A，24,642,326 bytes，NotSigned。只检查并解压负载，未执行安装器；七项随包文件摘要已固定。独立本机构建的三个前端文件与 CI NSIS 逐字节一致。
- 本机固定 Node24.19.0 / pnpm10.28.0：frozen install、typecheck、lint、无数据库测试118通过/15预期跳过、build 全部成功。首次子进程误用 PATH Node18 的失败日志保留，随后固定 PATH 重跑。
- 完整数据库门槛首次在中文用户 worktree 初始化 embedded PostgreSQL 失败；同 SHA 的 Git archive 移至 ASCII 专用目录后，无源码修改，独立55440数据库133项全部通过。宽屏与窄屏浏览器22项全部通过；生产离线冷启动、草稿保留、禁写、重连、撤权清理全部通过。证据主索引 .artifacts/acceptance/2026-10-16-ci-ef99f2b/g0-verdict.json，G0 passed=true。
- 临时数据库正常 pg_ctl 停止，55440/4174/47833/47834 全释放。原预览55439、主Codex22308、旧安装15732/9876、独立原生29408的创建时间均保留；只读再次确认原空间12张任务及G2 version2锚点仍在。共享47830仍未启动，未越过先前审批拒绝记录重试自动启动。
- 独立窗口199272最近一次一致读取仍是登录页；最后界面读取提示窗口最小化，激活又提示检测到用户输入，未继续点击或操作认证。下一步请用户手动运行既有 start-preview-api.ps1，并在独立测试Codex登录、打开当前仓库、保持编辑器为空。Computer Use 技能要求认证人工操作。
- 当前产品宿主清单仍未扩展26.1007；开发探针不计安装G1。新NSIS尚未安装；G1/G2/G3仍未关闭，G4未进入。源worktree仍为干净ef99f2b，原根目录用户修改保留。目标 active/incomplete。
### 2026-10-16 用户 API/独立窗口就绪后：宿主适配 d841a64 已提交，本机门槛通过

- 用户已手动启动共享 API；PID30924 / ticks134365889290328253，原55439数据库不变。Node无代理健康请求与curl HTTPS都200；PowerShell默认代理路径曾EOF，不能把该客户端路径当服务器故障。原根提交0748与新候选的 apps/server、packages/core、live-preview脚本、lockfile Git对象相同，未为本次适配擅自重启共享API。
- 用户已完成独立原生29408登录/项目选择。只读证据 native-current-readiness.json：唯一选中项目859ccf96-3fe5-4568-914e-e252dd5dcd07解析到当前仓库、编辑器为空、无modal、壳/项目导航/main标记各唯一；私有持有归属仍通过。
- 新版源码独立47835伴随服务+真实原生宿主通过 nonce iframe安装、错误目录拒绝时保留入口/文档/空编辑器、dispose后恢复空壳和自有节点清理。入口未展开、child宽度0，不能计作可见布局证据。资源URL百分号路径、过宽frame计数造成的前两次辅助脚本失败均保留。
- 当前真实宿主多段草稿成功，五段精确匹配；重复填写拒绝且HTML哈希不变。失效归属、未验证版本、错误target、缺失目录、错误目录拒绝且文档不变。未发送。第一次归属错误消息断言过窄的辅助脚本失败也保留。当前仅有该已知五段验收草稿，SHA256 af85bcbca6e642b0c64384595f3d617bbdc0077ecdc66af51ff93375b29d147e，等待清空确认；不要重载或关闭这扇Codex。
- 真实窗口199272后来已通过Sky成功恢复，截图/可访问树一致显示“Taskboard 26.1007 验收草稿（不要发送）”、唯一项目和五段草稿；没有发送点击。主Codex132228/PID22308保持原身份。
- 精确宿主版本支持已作为 d841a64d2d885270517c47504f6b7778c2d3ba77 提交并推送到 codex/host-26-930-acceptance，工作树干净。修改仅原生/DOM草稿版本列表、已有壳选择回归覆盖及验收文档，不是范围放行。
- 新候选G0本机已完成frozen安装、typecheck/lint、无DB118通过15预期跳过、build、独立真实DB133无跳过、浏览器22、生产offline/草稿/禁写/重连/撤权；私有55440/4174/47833/47834/47835全部清理。原API30924、DB28264、旧安装15732/9876、独立29408及主22308创建时间均未变。
- CI38838235219：verify116772058825、container116772059130成功；Windows116772059144仍进行中。具体最新阶段和本地结果见 .artifacts/acceptance/2026-10-16-ci-d841a64/g0-verdict.json / ci-current.json。ef99f2b安装包保留为旧候选证据；不要当新d841安装包。
- 下一步：清理上述已知草稿并只读确认；继续观察同一CI句柄直至终态，下载校验d841真实NSIS，再正常退出旧安装并安装同候选。G1/G2/G3仍待已安装流程，G4未进入。goal active/incomplete；此前一轮为真实G0进展，本轮为宿主适配/测试进展，不满足blocked。
### 2026-10-16 d841a64 CI 终态通过、安装包已核对并传到第二台

- 同一提交 d841a64d2d885270517c47504f6b7778c2d3ba77 的 CI38838235219 现已全部 success（verify116772058825 / container116772059130 / windows116772059144）。结合本机真实DB133、浏览器22、生产offline及清理，G0通过；g0-verdict.json 已更新，旧的CI未完成判定保留为 g0-verdict-before-ci-completion.json。没有重复运行已通过测试。
- 两个GitHub ZIP摘要与官方值一致；真实NSIS解包路径已检查、7个负载固定，3个前端文件与本地同SHA构建逐字节一致。安装包 codex-taskboard-d841a64-setup.exe，SHA256 9F9728F2DA90443C5B413704F1F7114ADE0F54B3C2FF5515212EA0828B0D4FBD，NotSigned。未执行安装。证据目录 .artifacts/acceptance/2026-10-16-ci-d841a64。
- 本机 install-and-start-taskboard.ps1 已具体准备，校验安装器及7文件、保留原验收data/WebView、拒绝运行中旧实例/占用端口。仅ValidateOnly，未自动启动；先前自动启动审核拒绝不重试。安装后只读绑定工具已经复制到新证据目录，届时只读取新生成身份文件，不复用旧PID。
- 唯一在线 codex-server（peer nAASfos9GN11CNTRL）已通过 Taildrop 收到同一安装器和四个新版安装/启动/只读诊断文件，transfer exit0，远程安装和启动均未执行，不能计G3。各脚本语法、安装器和7负载pin已核对。
- 最新只读确认独立29408仍登录到唯一正确项目，编辑器仍含已知未发送验收草稿；没有新草稿、发送、重载或关闭。旧Taskboard15732/9876及47831/9334仍在；主Codex22308、原数据库28264/55439、用户手动API30924/47830均保留。
- 下一步由用户清空该测试草稿，旧Taskboard从托盘正常退出，再手动执行新安装启动脚本；核对全新身份/首屏后继续同候选G1/G2/G3。G4未进入，整体初版可用验收仍未完成，goal active。

### 2026-10-16 d841a64 已安装，首屏为正确登录页

- 用户手动执行安装启动助手，installed-result.json 证明 NSIS exit0、7个随包哈希一致，原3个数据文件逐字节保留，原WebView缓存保留。新桌面21184/随包Node30636/WebView31576，47831/9334及target F74A55CBB21C6D68A4234D6D8D481B37绑定正确，旧fc40da8已退出。
- 首屏只读观察 rendered=true、loginVisible=true、服务器地址正确、无伴随服务未知错误，当前JS/CSS与d841a64匹配；没有刷新或代登录。G2尚待实际登录后读写、退出重开和卸载重装。
- developer-draft-cleanup.json 确认独立29408仍是正确项目且唯一编辑器为空，归属前后通过；用户已手动清理。该原生窗口暂时保留，没有关闭或发送。
- 被动登录状态码观察器已启动，exec session93405，5分钟上限，只记录路径/方法/HTTP状态，不记录凭据、请求体或响应体。下一步用户手动使用明确测试账号登录新安装窗口。整体G1/G2/G3继续，G4未进入。

### 2026-10-16 登录等待期间的同候选双设备观测准备

- exec93405 被重新轮询确认仍在运行；实际安装窗口当前认证401，既有本机映射GET200且路径匹配。观察器尚未捕获手动登录请求，没有代操作认证。初始状态保留在 installed-prelogin-readiness.json。
- 从既有实测观察器派生 d841a64 的只读500ms界面观察、服务端Date时钟误差边界和第二台PowerShell归属包装器，固定新SHA/安装器摘要/7文件manifest，检查无29aa旧pin、Node语法与PS解析通过。四文件经唯一在线codex-server Taildrop exit0送达，未远程执行，不能计G3通过。证据 g3-timed-observer-preparation.json / g3-timed-observer-transfer.json。
- 待用户完成当前安装版Taskboard手动登录；不得用新的源码替身/旧候选的G1-G3记录代替同候选实机流程。目标仍active。

### 2026-10-16 手动认证阻塞审计

- 登录观察器exec93405正常到期，终态observation_ended，loginResponseObserved=false，未记录任何登录请求；不重启观察器。随后02:33:11Z重新读取真实d841a64窗口，认证/空间仍401，映射仍200且匹配，进程/端口/target归属保持。
- 同一手动认证条件已经连续三个goal turn存在；安装、首屏、草稿清理和双设备所需只读观察准备已完成，继续G1/G2/G3需要用户登录当前Taskboard，Computer Use禁止代操作认证。审计 manual-authentication-blocked-audit.json 已保存，下一步将目标设为blocked等待用户登录；不能称为验收通过或完成。用户登录/恢复后重新读取实际身份与认证，不沿用过期观察器句柄。

### 2026-10-16 用户完成Taskboard登录，安装版新原生已启动

- 用户回复已登录后，真实d841a64窗口 auth/spaces200、测试账号和原空间匹配、本机映射200且正确。手动Taskboard认证阻塞已解除；先前observer93405仍是已终止，不复用句柄。
- 实际安装版设置→连接与设备→启动独立Codex已点击，新原生20904/ticks134365929805210416，helper23036归属新桌面21184，包版本26.1007.9446.0，profile位于原专用data的全新managed-codex/RdbFPhuw1XkDT60N7KbOXiWJ/profile，63756监听者20904、唯一target5F452AC3F8D3519D844D6D8DF419C34B一致。保护主22308、旧开发原生29408、DB28264、API30924身份未变。
- 初次绑定时页面尚在初始化，loginPromptVisible=false但project/editor0；随后的真实Sky截图明确为登录ChatGPT，保留 installed-native-login-surface.png。当前新安装原生窗口HWND788882已置前；旧开发原生HWND199272仍保留空草稿状态。用户须在新窗口手动登录，打开当前仓库、如提示信任则由用户完成，编辑器保持空。
- 在新原生真实登录页上点击安装版接入侧栏，HTTP409/CODEX_INSTALL_REFUSED，明示sign in and open a project first；前后timeOrigin、项目、编辑器和自有节点完全不变，installed-g1-prelogin-refusal.json passed。UIA首次点击geometry不可用，刷新唯一窗口后截图坐标单次重试成功；恢复记录独立保存。observer31147正常结束。
- 安装G1只关闭启动归属/未登录拒绝子项，成功/全部拒绝/可见布局/CSP/正常退出仍待完成；G2和同候选G3仍未完成，G4未进入。用户继续目标，认证等待审计重新计数。

### 2026-10-16 d841a64 安装版可见布局、开关与实际读写继续通过

- 用户已完成安装版启动器创建的独立 Codex20904 登录/项目信任，installed-project-readiness.json 证明项目解析与当前仓库、本机映射一致、唯一编辑器为空。真实侧栏安装200；原安装消息监听未捕获 nonce，失败记录保留。另行真实来源窗口/来源地址/随机 nonce challenge-response 往返通过（installed-g1-ready-roundtrip.json），未冒称捕获原安装消息。
- 安装版内嵌可见935/637/435/424/1575px宽度分别正常重排，筛选器完整且无横向溢出；480px总宽度下宿主自动收起项目侧栏。最窄任务详情397px宽、控件均在抽屉内，滚动到底能看到保存/领取/打开按钮。实际侧栏收起/重开保留同一原生document、项目和空编辑器，JS/CSS逐一与候选manifest哈希一致。见 installed-g1-layout-toggle-verdict.json；G1尚未整体关闭。
- 实际安装窗口新建专用空间“d841a64 安装版闭环验收”(60ce60eb-56d6-4d29-8908-7effe4f78c7a)及TB-1(5ad20074-864b-4375-aa81-370d2f5d0298)，UI修改标题/描述/仓库后PATCH200、If-Match1、version2，创建/修改均带幂等键。原共享空间12张任务哈希0fa1f281b3b0b0de2113fb099616508c06f8e272f89ec62f5e6570555de6cf0f保持。被动写入观察器exec45914已终止。
- 当前安装窗口实际关闭→托盘隐藏→再次启动恢复同一HWND459426，主进程21184/伴随30636/target与document均不变，登录及修改后的TB-1 v2保留，见 installed-g2-window-{before,hidden,restored}.json。完整退出/冷启动/卸载重装仍待执行。
- 安装版错误目录、无映射、目录不存在、未验证会话路由、编辑器角色变化/重复编辑器/项目标签变化均明确拒绝，前后页面逐项一致，临时诊断/映射已恢复；外部重载恢复侧栏通过。外部重载时受控缺失nonce造成失败后，内嵌节点全清理，实际frame-src enforce策略事件证明CSP恢复，项目及空编辑器保留。受控精确页面URL漂移也被拒绝并恢复，页面未变化。
- 所有上述是同一d841安装进程的实际行为，未重跑G0、未修改产品源码、未发送Codex消息。剩余G1草稿/上下文/退出及G2/G3/G4继续；第二台仅已传文件，尚未同候选安装观察，不能计通过。

### 2026-10-16 d841a64 安装版上下文拒绝、185px与真实草稿通过

- 实际原生项目选择“不在项目中工作”及普通项目选择对话框打开时，安装版草稿请求均拒绝，前后页面保持；正确项目已恢复。另行缺失nonce的真实安装失败409后自有节点全清，实际frame-src enforce事件证明CSP恢复。
- 原生480px宽且项目侧栏展开时iframe185px：单列150px、页面scroll/client170/170；详情158px、内部scroll/client141/141，各控件在边界内，保存/领取/打开均可纵向访问。截图与JSON见 installed-g1-minimum-sidebar-{open,detail,detail-bottom}。
- 实际内嵌详情“在Codex中打开”填入TB-1未发送草稿，11个纯P段落与期望内容哈希完全相同；项目身份保持，侧栏自有节点/iframe均清理；重复已安装API请求opened=false，前后草稿及页面逐项一致，真实CSP frame-src enforce事件通过；任务待办v2未变。installed-g1-ui-draft-resumed.json passed，sendInvoked=false，taskWriteInvoked=false。原UI响应因iframe拆除未捕获，但实际UI请求及结果文档均已记录，不冒称捕获响应。观察器exec7724正常结束。
- 当前独立原生20904/HWND788882最大化，保留这段测试草稿待用户手动清空；不发送、不关闭含草稿窗口。Computer Use对GUI删除要求临时确认，下一步请用户清空后只读验证，再继续正常退出。安装版21184/伴随30636及保护主Codex/DB/API未变。
- G0已通过不重跑；G1整体尚待草稿清理和正常退出重启，G2尚待完整退出冷启/卸载重装，G3尚待第二台同d841候选安装与计时闭环；G4未进入，初版可用目标未完成。

### 2026-10-16 用户清空草稿，第二台首屏登录；原生退出失败已清理

- 用户报告第二台按同候选升级请求启动后首屏是登录页；仅计人工首屏观察，尚未接收该次安装JSON/独立readiness，未计同候选G3通过。下一步需手动登录preview测试账号、确认桌面隔离验收，再取得实际安装/页面/本机映射证明。
- 用户报告本机已清空后，installed-g1-draft-cleanup.json只读证明唯一编辑器完全为空，项目/仓库映射正确、无弹窗或注入节点，原生20904和精确target仍一致。
- 真实标题栏关闭：首次UIA坐标过期落到explorer，未输入；刷新/激活后截图坐标点击成功，窗口不可用但native20904/helper23036/63756仍在。安装版实际“启动独立Codex”拒绝：无法唯一确认可恢复主窗口。Browser.close经精确原生空编辑器/目标/OS归属核验后发送，20秒内仍未释放原生/端口，installed-g1-native-graceful-exit.json passed=false，正常原生退出未通过。第一次错误地要求没有page的诊断在动作前拒绝，保留installed-g1-native-close-precondition-first.json；不冒称正常退出。
- 该专用原生草稿已两次证明为空，已核验PID/创建时间/路径/私有profile/父helper/端口及保护进程后执行定点失败清理。原生20904消失、helper23036自行结束、63756释放，主Codex22308、旧开发原生29408、DB28264、API30924保持；installed-g1-native-failed-exit-cleanup.json cleanupPassed=true、normalExitPassed=false。未修改产品源码、未手动删active.json、未停止Taskboard/共享API/数据库。新接入按钮在失去原生后明确显示无可安装适配器。
- 安装版G2退出前checkpoint已保存，auth/spaces200、专用TB-1待办v2未变，原空间12任务哈希保持0fa1f281b3b0b0de2113fb099616508c06f8e272f89ec62f5e6570555de6cf0f。当前Taskboard21184/伴随30636/WebView31576还在，等待用户实际托盘退出后核对释放、按原批准要求由用户手动冷启。G1整体/原生正常退出重启、G2余项、G3均未关闭，G4未进入。

### 2026-10-16 自动续接：安装注册差异与卸载重装预检

- 06:24Z权威检查：本机Taskboard21184/伴随30636/WebView31576仍为原身份，47831/9334仍监听；已清理原生20904/helper23036/63756无残留。第二台暂无新回传/登录完成回报。上一目标回合归类progress，本回合同样有具体预检证据，不冒称verified wait。
- 新发现HKCU Codex Taskboard的InstallLocation/UninstallString仍指向2026-10-08-installed-fc40da8；Registry32/64两视图结果相同、HKLM未发现另一注册。当前d841目录七个载荷哈希仍完全正确。此为安装元数据差异，未归因或冒称修复。
- 已准备uninstall-reinstall-acceptance.ps1，固定d841专用目录、拒绝重解析祖先、校验安装器/载荷/卸载器哈希、保护主Codex/DB/API，记录原数据与缓存；对旧注册目录15个文件逐一哈希用于确认不会改动其文件。实际执行使用候选卸载器及显式_?=候选目录，再重装并核对注册项应归当前候选。卸载参数与注册写入行为参照锁定Tauri CLI2.11.4官方NSIS模板，出处见g2-lifecycle-helper-source-notes.json。
- ValidateOnly执行退出0，installed-g2-lifecycle-preflight.json passed=true仅指只读预检；readyForMutation=false、uninstall/install/launchInvoked均false、g2Passed=false。首次终端摘要对OrderedDictionary直接Select-Object导致全null，但底层JSON正确；转pscustomobject后摘要已修正，第一次JSON保留。
- 当前等待同一两项手动动作：第二台登录preview账号确认原空间；本机Taskboard实际托盘退出。相同手动条件连续目标回合计2，尚不满足blocked阈值；无活跃观察器，不为等待重复重启服务/程序。G0不重跑，G4仍未进入。

### 2026-10-16 手动登录/托盘退出阻塞审计达到阈值

- 上一目标回合为progress：安装元数据差异与实际只读预检已完成；本回合仅重验相同手动条件，归类no progress，不冒称活跃观察器等待。06:31:35Z本机21184/30636/31576身份保持、47831/9334仍在，Downloads无d841回传，主Codex/旧开发原生/DB/API身份保持。见manual-wait-current-state.json。
- 同一两项手动条件连续三个目标回合未变：第二台停在人工回报的登录页，暂无登录完成回报；本机尚未执行实际Taskboard托盘退出。Computer Use禁止代操作认证，通知区域图标不暴露给当前工具；强制结束Taskboard不能代替托盘退出验收。所有独立前置工作及卸载重装脚本只读预检完成，当前无可继续的必要安全动作、无活跃CI/观察器句柄。manual-interaction-wait-audit.json blockedThresholdSatisfied=true，目标将设blocked等待用户。
- 用户完成任一步并恢复后重新按实际进程/端口/页面读状态，不沿用旧native20904绑定（已清理）；如仍需另一手动动作，按恢复后的新审计重新计数。G1–G3仍未全部通过，G4未进入，不能标记完成。

### 2026-10-16 用户完成第二台登录和本机托盘退出，卸载重装通过

- 用户回报第二台已登录、本机已退出，旧手动条件解除；恢复工作并重置后续阻塞审计。目标工具仍显示blocked（无可用active状态API），不创建重复目标或标记完成；按用户恢复授权继续。
- 07:25:52Z本机21184/30636/31576已不存在，47831/9334/63756无监听，之前原生20904/helper23036仍不存在；保护主Codex/旧开发原生/DB/API身份保持。installed-g2-tray-exit-verdict.json passed=true，仅关闭Taskboard实际托盘退出/端口释放子项，不冒称原生正常退出。
- 执行已只读验证的uninstall-reinstall-acceptance.ps1，卸载exit0且候选主程序删除，重装exit0且七载荷哈希匹配；state.json/browser-session.dpapi/cli-key.dpapi字节完全保持，原缓存存在，旧fc40da8目录15文件保持。旧注册卸载后消失，重装后InstallLocation/UninstallString均正确指向d841候选。记录installed-g2-uninstall-reinstall.json passed=true、g2Passed=false，未启动应用。此前注册差异已通过本次生命周期回正，原因未推断，未改产品源码。
- 旧桌面/原生绑定分别保存在installed-{desktop,native}-identity-before-reinstall.json。下一步用户手动运行现有start-installed-taskboard.ps1冷启动，保留原审批边界（不自动启动），随后运行read-installed-first-render.ts reinstalled-cold-render与read-installed-g2.ts reinstalled-cold-retention，核对实际首屏/登录/任务/旧空间哈希。read-first-render辅助脚本已改为分stage文件并校验候选资产名，避免覆盖原首屏证据。
- 第二台用户已登录，但同候选hash/实际owner/default缓存/auth/mapping仍需通过read第二台脚本独立证明：先托盘退出再运行已收的start-second-device-diagnostics-d841a64.ps1和read-second-device-d841a64.ps1，返回JSON；这也覆盖默认缓存重启保留，不要求更换缓存或刷新。尚未启动G3计时观察。G1原生正常退出复验仍欠、G2欠冷启可见恢复、G3未闭环，G4未进入。


### 2026-10-16 16:16 +08 — d841a64 G2 closure and second-device readiness diagnosis

- User reported the reinstalled local first display was the board. Independent exact-owner read verified correct DSNHa63w/BgQrj1WK assets, root rendered without reload, auth200, dedicated TB-1 version2/title/description retained, original12-task hash unchanged.
- Aggregate `2026-10-16-ci-d841a64/g2-verdict.json` now passes G2 using actual NSIS install, UI writes, tray restore/exit, uninstall/reinstall and retained-cache cold-start evidence. Login HTTP response itself was not captured; user login and subsequent auth200 were independently recorded. G1/G3/G4 and initial usable acceptance remain incomplete.
- Second device starter emitted success immediately, then reader failed its listener guard before CDP. Startup timing remains an unproven possibility. New `read-second-device-ready-d841a64.ps1` adds up-to25-second read-only wait and process/port status on failure; PowerShell syntax parsed, Taildrop to codex-server100.116.246.20 exit0, SHA256 F0A434189AD083C8D42DF3486026FDD991A3542ACA86061E1F56ED4E5CC7DBDE. No remote restart or reload was invoked.
- Current installed local runtime: desktop36664, companion27948, WebView5968, target985DCB7646B227970A7F765FAB905A7A. Formal installed button launched fresh native19032/helper19212/port51931/targetFECBCEBD8A384E739FCF403C8D8F43D4 with a new isolated profile; exact ownership and protected processes verified. It is at the login page and requires manual authentication before continuing G1 normal exit/restart. Earlier failed-exit evidence remains.

### 2026-10-17: real native restart failure and strict source fix

- Remote d841 readiness passed: exact seven files/assets, authenticated synthetic account, expected space/mapping, owned runtime and default WebView cache. This is readiness, not G3 closure; original JSON is user-reported.
- Actual installed d841 File → Quit released the owned native/helper/listener and preserved protected processes. Formal relaunch was owned but installing sidebar returned RESTORATION_UNCONFIRMED because old-page cleanup failed after its process exited. G1 remains failed/pending.
- Development branch codex/host-26-930-acceptance pushed e91d999d0724c89be9ef7ee55436b59890973407: launcher-held Windows process signal plus exact session/PID/creation receipt permits retiring failed old cleanup; unknown/live identity remains blocked. Requests share one adapter transition.
- Source typecheck/lint/build exit0;122 tests passed,15 database cases expected skipped; targeted8 tests passed. No local Rust toolchain. Same-head CI, DB/browser and new installer revalidation pending. Evidence: .artifacts/acceptance/2026-10-17-native-retirement-fix/.
- Installed runtime remains d841; new native is at login and old companion has sticky retirement error. No new G3 observer started and no gate carried automatically to the new candidate.

### 2026-10-17: e91d999 G0 completed, installed revalidation prepared

- Same-head CI38996470587 completed success in all3 jobs, including Windows cargo tests and NSIS bundle. Local exact Git archive with Node24.19.0/pnpm10.28.0 passed frozen install; sequential typecheck/lint/test/build,122 no-DB tests plus15 expected skips; actual test DB137/137; browser22/22; production offline/reconnect/revocation. Private ports55440/4174/47833/47834 released and all4 protected processes preserved. G0 verdict passes.
- First helper argument error, fallback pnpm11 policy install failure, and slow artifact transfer attempts retained separately. Fixed runner pins pnpm10.28.0. System-proxy curl downloaded both artifacts; each matched GitHub digest.
- Installer codex-taskboard-e91d999-setup.exe SHA2569E35C903BE18182ABB1439B92BD3550C04595A73E40920280718447A1B726BBE, NotSigned. Seven payload hashes and NSIS member paths checked; all3 frontend files match local build bytes.
- Exact old native2456/helper31200 was at clean login and exited via UI Ctrl+Q; port53001 released. Protected main/developer Codex, original DB and user-started API unchanged. Installed d841 Taskboard desktop36664/companion27948 remains running.
- Prepared and syntax/preflight checked .artifacts/acceptance/2026-10-17-ci-e91d999/install-and-start-taskboard.ps1. It requires current Taskboard tray exit, installs to dedicated2026-10-17-installed-e91d999, preserves original acceptance data/WebView cache, checks all7 installed files, and writes exact runtime identity when manually started. No new installation/start was invoked; previous automatic startup approval rejection remains respected.
- Next: user tray-exits local Taskboard and invokes prepared script. Inspect exact installed first render; then formal managed native start, login/project/empty-editor, embed, normal File/Quit, formal relaunch and prelogin safe refusal, followed by login/reconnect. G1 fix is not yet proven in installed build. e91d999 G2/G3 pending; remote remains ready on d841; overall usable acceptance incomplete. Evidence root .artifacts/acceptance/2026-10-17-ci-e91d999/.

- 2026-10-17 continuation: exact old desktop36664 still running at03:15:30Z, no e91 installed-result/identity yet. Prepared e91 read observers (first render, authenticated state, owned native binding/readiness and mapped project) with candidate-specific tsconfig;7 TS and3 PS helpers pass syntax checks. Protected4 processes revalidated. Evidence observer-preparation.json and installed-g1-checklist.json keep G1 pending. run-installed-read-check.ps1 is a read observer dispatcher for use after manual candidate start. No product/runtime mutation on this continuation.

- 2026-10-17 03:16:16Z blocked audit: exact old d841 desktop36664/companion27948/WebView5968 still live; no e91 installation/identity records. Same manual candidate-start blocker confirmed for3 consecutive goal turns after preparation completed. Goal marked blocked pending user tray-exit and manual install-and-start-taskboard.ps1. G0 e91 remains passed; new installed G1/G2/G3 and G4 remain incomplete. Resume by inspecting actual new process/records after human reply; do not start old observers or bypass the prior automated startup rejection.

### 2026-10-17: e91 installed first render and prelogin verification

- Human installed and started e91d999; prior manual candidate-switch blocker resolved. NSIS exit0, all7 installed hashes matched, data bytes and prior WebView cache retained. Cold first render uses candidate assets; authentication and local mapping verified.
- Installed formal button launched exact isolated native31412/helper26696/port52765; desktop27092/companion15544/WebView28744. Protected main/developer Codex and original DB/API preserved. Native at clean login.
- Actual installed sidebar button before login returned409 CODEX_INSTALL_REFUSED with sign-in/open-project diagnosis. Page unchanged; transient probe observed enforced frame-src CSP and cleaned itself.
- Next: manual login/open current repository/empty editor, then same-candidate sidebar/draft and actual File/Quit/relaunch/reconnect regression. G1, remaining e91 G2/G3, G4 pending. Remote remains d841, no timed observer. Evidence: .artifacts/acceptance/2026-10-17-ci-e91d999/current-installed-checkpoint.json.

- 2026-10-17 continuation: exact e91 native remains live at clean login. Independently completed real installed UI G2 space/task creation and title/description/repository editing in e91d999 dedicated space; three HTTP200 writes with idempotency headers, PATCH If-Match1, task version1→2, visible saved title and paragraph preservation verified. Original12-task hash unchanged. Passive observer stopped normally. G2 UI subset verdict passes; tray/restart/uninstall/reinstall still pending. Manual login/project handoff unchanged (second goal turn); overall gates remain incomplete. Evidence installed-g2-ui-writes-verdict.json and manual-authentication-audit.json in e91 evidence root.

- 2026-10-17 03:35Z manual-authentication blocked audit: third consecutive goal turn confirms same exact live e91 isolated native31412/helper26696/port52765 at unchanged login (no projects/editor). Protected processes preserved. Independent installed UI G2 writes completed; next G1 steps require human authentication. Computer Use forbids automating authentication dialogs. Goal marked blocked awaiting login/open current repository/empty editor. No observer active, no restart or authentication invoked; e91 full G1/G2/G3 and G4 remain incomplete. Resume via current exact native readiness after user reports ready. Evidence manual-authentication-blocked-audit.json.


## 2026-10-17 e91 installed G1 resumed after human login

User completed isolated native login/project. Exact project/mapping and empty editor passed. Same installed e91 runtime passed real sidebar open/list/board/toggle, responsive iframe widths935/642/424/185 and minimum drawer, DOM/mapping/context refusals, external reload recovery, and external nonce failure cleanup with enforced frame-src restoration. Initial passive handshake observer missed child challenge (retained false); independent live origin/source/random-nonce roundtrip passed. No draft inserted yet. Normal native File/Quit/relaunch regression, G2 lifecycle and same-candidate G3/G4 remain. See `.artifacts/acceptance/2026-10-17-ci-e91d999/`.


### 2026-10-17 e91 G1 functional subset completed

Same installed runtime passed target drift from initially enabled adapter, initial and external nonce failure cleanup with actual enforced CSP, and reinstallation through the real installed UI. Actual embedded task drawer action inserted exact eleven-paragraph unsent draft, duplicate refused without change, task remains v2/todo, no send/claim. Main Codex, developer native, DB and API identities preserved. `installed-g1-functional-subset-verdict.json` keeps G1 false: manual cleanup then normal File/Quit and formal relaunch/reconnect still required. Current native retains the synthetic unsent draft; do not close or reload until cleanup. Normal-exit read-only and restart verifier copied to e91 but not executed.


### 2026-10-17 e91 actual normal native quit/relaunch regression

Human cleared draft, original empty editor hash restored. Reinstalled sidebar via actual installed UI and expanded real iframe, then actual File > Quit ChatGPT. Native31412/helper26696/port52765 released, protected identities unchanged. Formal installed button launched native2844/helper10424/port57462, target7287A61EA415CCB096AB359CF0E9DB05 and fresh XFOtjMNDzPauGHZ0legb4rcQ profile. Restart verifier passed actual baseline CSP and unchanged login refusal CODEX_INSTALL_REFUSED (no RESTORATION_UNCONFIRMED). New Sky native window854274 at login. User manual login/project required for final reconnect; G1 remains false. G2 uninstall/reinstall -ValidateOnly passed read-only exact hashes/retention checks; registry still prior d841 directory and runtime busy, so no uninstall/install/launch invoked.

### 2026-10-17：用户指出反复登录

已核对 e91d999 启动器与两次真实启动身份：普通退出后新启动为每次随机创建的 managed-codex 子目录，profile 与 codex-home 都未复用。先前成功登录状态保留在旧目录，但新窗口使用空目录，因此验收重复退出/启动会重复要求人工登录。这是启动器持久化体验缺陷，不能当作正常重启体验。证据见 .artifacts/acceptance/2026-10-17-ci-e91d999/repeated-native-login-finding.json。需要在专用隔离目录内保留登录/项目状态，同时继续逐次核验进程句柄、创建时间、监听端口、精确页面与会话；全新 profile 场景应单独验收。此记录未修改源码、未读取凭据、未代操作登录。G1–G4 仍未全部通过。

### 2026-10-17：反复登录修复19f6162与等待安装复验

- 用户指出普通重启反复登录后，开发工作树已提交并推送19f616212ac3ae85bfab6e25c8cd6d8cfb59a223（fix(desktop): preserve managed Codex login across restarts）。managed-codex/profile.json登记固定随机专用目录；启动器和包上下文助手共同核验规范目录、登记与边界，允许复用非空目录；每次进程句柄/创建时间/随机会话/监听者/精确页面验证继续执行。原生回归五项在Windows CI逐项通过。
- 新证据目录.artifacts/acceptance/2026-10-17-ci-19f6162。G0全部通过：本机Node24.19/pnpm10.28/frozen，顺序typecheck/lint/test/build；无DB122+15预期跳过，真实DB137全通过，浏览器22全通过，生产离线恢复/草稿/禁写/撤权通过，独立端口55440/4174/47833/47834已释放，保护主Codex/开发原生/DB/API。初次脚本双BOM导致#requires头警告，未中断实际门槛；版本单独确认、头已修复并保留诊断，不掩盖。
- CI39004409204三作业成功，下载两产物各与GitHub摘要一致；NSIS安装器SHA256=39F574780D5AF40C6EF0E1CBB1B50FC739095E9DBAE3D0663E5301790D4F031A，NotSigned，七文件载荷及本机/CI前端一致。安装器和脚本已就绪，尚未执行新安装/启动。
- 发现当前e91原生2844实际上已由用户登录并打开正确项目，空编辑器确认后实际安装版接入/真实侧栏展开/独立nonce/资产/能力全部通过，补齐先前正常退出后重接证据。随后实际文件→退出ChatGPT正常释放2844/助手10424/57462，保护进程未变。e91 G1仍因新增普通重启登录保留缺陷未通过，不继承给19f6162。
- 已将刚核对过的XFOtjMNDzPauGHZ0legb4rcQ显式登记为持久专用目录；只写相对目录登记，不读或复制Codex认证文件、不移动目录、不删旧数据。新版本应直接复用该已登录项目，实机仍待证明。verify-managed-profile-persistence.ts已准备，必须在安装版按钮启动后读取真实新进程，不能仅凭源码宣称登录保留。
- 当前旧Taskboard27092/companion15544/WebView28744仍运行；新候选尚未安装。遵守先前自动启动审批拒绝边界，不代为重试启动；请用户从托盘退出后手动运行新目录install-and-start-taskboard.ps1并回报首屏，本轮未再请求登录。新手动安装等待第一轮，目标保持active。第二台仍d841，不在本机修复实测前传新包。G1/G2/G3与G4仍有未完成项。

### 2026-10-17：19f6162 安装与普通重启登录保留实机通过

- 用户直接给出新候选 combined install/start 命令，代理按该明确命令执行（非人工启动）。NSIS exit0、七文件哈希、原 state/session/CLI key/profile registration 及既有 WebView cache 保留均通过。启动身份原脚本的 manuallyStarted:true 已纠正，原记录另存 installed-startup-original-provenance.json。
- 当前桌面13780/companion20924/WebView32116，安装目录2026-10-17-installed-19f6162。首屏直接看板，认证和本机仓库映射200，无白屏、无未知伴随错误。
- 实际安装版设置按钮首次启动原生21824/helper35220/port62164，直接已登录、原项目b46ca849-b08a-4b26-b918-7c4d62202d9e、原空编辑器哈希保留。同一显式登记XFOtjMNDzPauGHZ0legb4rcQ未变。真实侧栏展开/资产/独立nonce均通过。
- 从测试Codex的文件→退出ChatGPT正常退出21824，助手及端口释放；再次从已安装设置按钮启动36568/helper25616/port59629，target DA100DABFFCC5DA19A5518EBF0B523C3。无登录操作，仍复用同一profile/codex-home；原项目和空编辑器保留；基线CSP enforce及保护进程通过。真实UI接入返回200，渲染与独立nonce通过。这是同候选普通重启登录保持证据，不仅是源代码回归。
- 同候选错误目录、缺失映射/目录、无法验证会话、编辑器角色/重复编辑器/项目标签结构故障均拒绝，页面完整保留，临时映射/DOM已恢复。G1仍待其余上下文、重载/握手失败清理、布局、未发送草稿与重启草稿保留；G2–G4未全过。
- 第二台19f6162 installer/start/read helpers已生成并语法核对，Taildrop发送进行中；尚无第二台19实测结果，不继承d841的G3。

### 2026-10-17：19f6162 侧栏与草稿完成实测，发现填入草稿的重启持久化缺陷

- 同一安装版完成普通原生搜索弹窗和未选项目拒绝；受控结构/映射拒绝后状态均已恢复。真实外部重载自动恢复侧栏，独立 nonce 缺失时拒绝并清理。初始安装握手缺失另测返回409 CODEX_INSTALL_REFUSED；两种失败均以真实 frame-src/enforce 事件确认 CSP 恢复。
- 真实 Windows 内嵌布局、列表切换和任务详情已测；935px三列、423px一列；原生总宽480px稳定后宿主自动收起项目侧栏，iframe约424px，详情约397px，无横向溢出。installed-g1-width-185.json 文件名不能充当185px稳定布局证明。
- 真实内嵌 TB-1 详情“在 Codex 中打开”产生POST；11段内容及哈希准确，未发送/未领取，任务仍v2/todo。重复请求 opened:false 且页面/草稿哈希未变。成功响应随iframe拆除未捕获，记录明确区分实际请求/结果与缺失响应；不得补造。
- 保留已填草稿正常文件→退出ChatGPT，36568/helper25616/59629均释放；正式设置按钮再启动17704/helper6012/50233，同一已登录profile/codex-home/原项目保持，但草稿为空。installed-g1-unsent-draft-restart.json为FAILED，不能关闭G1。
- 原生Windows直接键入一段合成对照草稿，不经过adapter；正常退出17704/助手/端口，正式按钮再启7056/helper12504/63508，target CC7FEA58D207C0C948B835D2EF494A7E。登录、项目及该原生输入草稿的全文哈希均保留。两次重启未操作登录、未发送、未修改任务，保护主Codex/开发原生/DB/API未变。故问题缩小到adapter填入流程，execCommand只写入显示但未达持久状态是待验证假设，不能当作已证实根因。
- 当前独立Codex有一段以“Taskboard 19f6162 原生输入重启对照”开头的未发送合成草稿；Computer Use界面删除要求即时确认，下一步需要用户清空或明确允许清空。未做删除；尚未修改新源码或再次构建。第二台19安装器与默认数据/cache install/start/read helpers已Taildrop完成，但尚未请求远程执行，先解决本机草稿回归以减少重复安装。
- 证据在.artifacts/acceptance/2026-10-17-ci-19f6162。G0通过，G1未通过（新草稿重启缺陷），G2部分、G3同候选未执行、G4未进入。current-progress.json已更新为7056及本次证据；目标保持active。
### 2026-10-17：合成草稿清理获持续授权；G2 实际窗口修改已保存

- 用户明确允许直接清空本次和后续同类合成未发送验收草稿，无需再次逐项确认；不涉及无关用户草稿。已通过当前隔离原生窗口核对全文后 Ctrl+A/Backspace 清理原生重启对照草稿，编辑器恢复原空哈希，未发送。上条要求即时确认的描述已被用户本次授权取代。
- 实际安装窗口创建新空间“19f6162 安装版闭环验收”与TB-1，再通过实际任务详情修改标题、仓库、描述并保存。服务器版本1→2，UI显示“任务已保存”，原空间12任务hash未变。POST版本与幂等请求已捕获；600秒被动观察器在PATCH前结束，所以不声称已捕获修改响应/请求头。观察器5755已正常停止。
- 原生诊断显示受控execCommand内容能进入ProseMirror文档模型，并能随页面重载保留。此发现否定“execCommand只改DOM”的简单归因；完整侧栏恢复路径仍在定位。无新源码修改，G1缺陷尚未关闭。
- 只读重读typed-after-restart helper时原生侧栏已收起，项目标记缺失导致新读取passed:false，但全文哈希依旧准确、同profile/home、认证仍在；原同名JSON被该次重读更新。不能把这次缺少标记的复查解释成原生对照草稿丢失；此前现场对照及06:08精确绑定记录仍可佐证内容保留。后续诊断均使用时间戳文件避免覆盖。

### 2026-10-17：19f6162 实际新聊天草稿重启复核与G2生命周期准备

- 第六次受管理进程21184中的真实嵌入看板任务详情操作填入原11段合成草稿，DOM/ProseMirror模型均精确匹配；普通文件菜单“退出ChatGPT”后原生/助手36520/59048全部释放。实际安装版设置按钮重新启动第七次原生37244/助手33900/54618，登录、项目、profile/home和完整11段草稿均保留，模型也精确匹配。此前API完整草稿重启复核同样通过。本轮没有解释早先installed-g1-unsent-draft-restart.json的一次丢失，不能据后续通过关闭根因或G1。
- 根据用户允许当前及同类合成草稿直接清理的持续授权，已实际点击编辑器、选区核对、Backspace清空；空HTML哈希恢复00ec575662495d1f9ab9b7d5aa82c47fd99c899653a700f42eb17a5bb75df264。无发送和任务写入。随后Ctrl+Q正常退出第七次宿主，助手和端口释放，保护进程未变。汇总证据installed-g1-fresh-chat-ui-restart-summary.json。
- G2实际安装窗口任务补做描述修改到版本3，PATCH200/If-Match2/幂等头已捕获。初次v1→2缺少请求头的记录继续保留。关闭Taskboard标题栏后窗口隐藏，13780/20924仍运行；再启动同安装路径恢复同窗口524548及同进程。一次UIA关闭点击因geometry unavailable失败，重新激活观察后坐标关闭成功。证据installed-g2-window-close-restore.json。
- Windows通知区域未被Sky枚举为可操作窗口，无法自动点击托盘“退出”。已备妥uninstall-reinstall-19f6162.ps1并ValidateOnly通过，核对真实注册表卸载目标、安装器和七文件SHA、保护进程、专用数据/cache边界；仅在主进程、助手、相关端口全退出后才卸载和同候选重装，不自动杀进程，不删除数据/cache。当前等待用户托盘退出；安装版13780、companion20924、WebView32116仍在。原工作区既有脏文件与开发工作树未改源码。

### 2026-10-17：继续等待托盘退出期间的独立验收准备

- 本轮起始和结束均实查安装版13780/20924/32116与47831/9334仍为原精确归属，托盘退出未发生。上一轮归类为progress，不将自动续跑当作用户已退出。
- 核对先前原生结构故障脚本：只修改role/composer-label或加隐藏克隆，未直接替换原编辑器正文；此前记录又显示插入前已有新文档，因此无证据把首次草稿重启丢失归因于测试残留。首次只有DOM全文记录、无当时ProseMirror模型记录，根因不能追认；不改源码碰运气。审计g1-draft-regression-evidence-audit.json。
- 生成19f6162专用timed observer/clock calibration/wrapper/minimal七文件manifest。JS语法与PS解析通过；实际安装窗口切到“桌面隔离验收”原12张任务，1.5秒只读观察exit0，精确资产/页面/三进程绑定通过，HTTP Date前后时钟界限有效，未重载、未写任务、非双设备验收。证据local-g3-observer-preflight.json。
- combined install/start/read wrapper及timed watcher、observer、clock、minimal manifest五文件已通过Taildrop发到codex-server，退出码0；没有远端执行。第二台仍未证明安装19f6162，G3未通过。只读观察器会在用户就绪后记录实际创建/领取/回写/验收与离线/撤权；当前还需本机托盘退出后执行已准备的受保护卸载重装。

### 2026-10-17：托盘退出人工动作阻塞审计

第三个连续目标回合实查同一13780/20924及47831/9334仍运行，原生与助手已退出且保护进程保留。Windows通知区域未被Sky暴露为可操作窗口；实际托盘退出前无法证明清理，也不能执行安装版卸载重装。独立可做的草稿重启复核/清理、G2 UI写入和恢复、受保护卸载重装准备、G3同候选观察器本机短测及Taildrop均已完成。证据manual-tray-exit-blocked-audit.json；按连续三回合同一阻塞规则标记目标blocked，等待用户本机Taskboard托盘退出后继续。目标未完成。


### 2026-10-17：用户托盘退出后完成19f6162卸载重装与保留验收

- 用户回复“已退出”，实际检查13780/20924/32116均已退出、47831/9334释放，原生/助手也已退出，保护进程不变。证据installed-g2-actual-tray-exit.json。
- 按精确注册表目标运行官方NSIS卸载器，exit0，七项载荷和注册表项实际移除；同候选安装器再安装exit0，七文件哈希全部匹配。state.json、browser-session.dpapi、cli-key.dpapi、managed-codex/profile.json四文件字节/哈希在卸载前、卸载后、重装后完全一致；既有WebView缓存目录保留。证据installed-g2-uninstall-reinstall-20261017T071105Z.json。
- 由已有验收启动器自动重启（非人工），新Taskboard29860/ticks134366946924647119、companion17684/ticks134366946936161416、WebView30636，页面D2B0342E4831BC8CF1F02198AC521231。首屏无需刷新即为看板，没有登录页和伴随服务未知错误；认证HTTP200、仓库映射匹配、G2任务版本3及原12任务哈希保留。Sky实际截图/可见内容同样确认。
- 生命周期汇总初次脚本错误假定上游为loopback，产生expectedServerConfigurationRetained:false；保存原失败和诊断。实际GET配置仍为用户原先配置的HTTPS Tailscale地址，state哈希亦未变。改正helper的预期后14项生命周期条件全真。证据installed-g2-lifecycle-verdict.json；首错installed-g2-lifecycle-verdict-first-assertion.json与installed-g2-upstream-diagnosis.json保留，不当产品故障。启动helper中manuallyStarted误标已修成false/automatedAcceptanceStart=true。
- G2的同候选全新服务器设置/首次登录UI尚未另测，fullG2不置真；G1早先一次非空草稿重启丢失仍未解释，G3第二台19安装/完整同步离线撤权仍未执行，G4未进入。目标恢复active，阻塞审计计数清零，下一步用户在codex-server托盘退出旧版后运行已传送的combined install/start/read wrapper，原默认数据/cache保留。

### 2026-10-17：19f6162 重装后的独立 Codex 与侧栏复接验收

- 同一候选 `19f616212ac3ae85bfab6e25c8cd6d8cfb59a223` 的已安装程序正式按钮再次启动独立 Codex，登录、所选项目和空编辑器保留。
- 在真实安装窗口点击“接入 Codex 侧栏”，独立 Codex 的实际侧栏入口可展开和收起。最窄内嵌内容宽 185px，筛选器完整且无横向溢出；独立 nonce 就绪响应的来源、目标窗口和 nonce 均匹配。
- 汇总 14 个条件全部为真：`.artifacts/acceptance/2026-10-17-ci-19f6162/installed-post-taskboard-reinstall-native-summary.json`。本轮没有登录、发送草稿或写任务。当前独立测试窗口保留，侧栏看板已收起，编辑器为空。
- G1 先前那次重启丢失草稿仍未找到原因；G2 同候选全新服务器设置/首次登录 UI 尚未覆盖；G3 尚待 codex-server 执行已传送的 19f6162 安装启动读取脚本和后续完整生命周期。均不提前关闭门槛，G4 未进入。

### 2026-10-17：19f6162 本机安装窗口冲突草稿与离线模拟补验

- 专用候选空间新增 TB-2，实际安装窗口输入本地标题但未保存；独立 API PATCH 以版本 1 更新服务器到 2。实际点击“保存任务”捕获 If-Match: 1、幂等键和 409 VERSION_CONFLICT。界面与缓存保持本地标题，关闭重开详情后草稿和冲突提示仍在，缓存哈希不变。
- 依据用户持续授权点击“放弃草稿，加载最新内容”，确认专用草稿缓存删除、未保存标记消失、服务器标题和版本 2 不变。原 G2 TB-1 仍为版本 3；共享空间原 12 张任务哈希未变。
- 同一已安装 WebView 通过 CDP 进行 20 秒页面断网模拟，观察离线缓存、新建/添加/保存/领取均禁用，缓存任务可读，无写入请求；恢复后约 9.7 秒自动同步，页面未重载、任务版本未变。此为本机页面模拟，不能替代第二台真实设备或物理网络中断。
- 汇总：`.artifacts/acceptance/2026-10-17-ci-19f6162/installed-local-g3-supplement-summary.json`。首次 helper 误用字符串优先级被 422 正确拒绝，保存失败输出后改为数字 2；未算产品故障。
- 仍待 codex-server 回传同版安装/首屏/读取结果及真实完整 G3；G1 早先草稿重启丢失原因未明、G2 同版全新配置登录 UI 未测，G4 未进入。目标继续 active，无新产品提交。

### 2026-10-17：准备同安装版首次配置与登录验收，待本机正常托盘退出

- 源码确认桌面程序使用固定 47831 和单实例限制，不能同时运行两套数据目录。当前独立 Codex 经只读确认编辑器为空后 Ctrl+Q 正常退出，原生进程、helper、监听均已释放；受保护进程保留。
- 尝试为切换专用测试数据而结束精确测试 Taskboard 进程的命令被自动审批在执行前拒绝，原因为 `blocked by policy`；该命令及其脚本未执行。随后只读确认原 desktop 29860 / companion 17684 / WebView 30636 仍是原归属。
- 已改为更安全的正常托盘退出路径。准备并 ValidateOnly 预检 `start-fresh-installed-g2.ps1`：校验同候选七个安装文件、全新空数据/缓存目录、受保护身份；运行时若旧进程/端口未释放直接拒绝，脚本不结束任何进程。新窗口预定 CDP9336；原登录数据及缓存保留。预检保存于 `installed-g2-fresh-preflight.json`。
- 首次配置/登录实际窗口尚未启动，不计 G2 通过。下一步请用户在本机当前 Taskboard 托盘点“退出”并回复；随后核对释放、启动专用首次连接窗口，认证由用户操作。第二台同候选回传仍待完成。
### 2026-10-17 继续：退出回报后的本机实况核对
用户回复已退出后，仍读到精确旧运行实例 desktop29860 / companion17684 / WebView30636，47831与9334仍归属该实例。已用 Computer Use 显示同一测试窗口，空间名为19f6162 安装版闭环验收；未结束进程，未启动全新目录。另备 installed-g2-fresh-binding.ts 与 observe-installed-g2-fresh.ts，仅观察服务器设置/登录HTTP状态与安全首屏元数据，不读密码或请求体，语法检查通过；尚无实机运行结果。证据 installed-g2-fresh-user-exit-still-running.json。仍需本机正常托盘退出，G1/G2/G3保持未关闭。

### 2026-10-17 16:07 恢复：本机正常退出与第二台同版就绪
本机旧desktop29860/companion17684/WebView30636及47831/9334已释放。启动同一19f6162安装版的全新G2目录：desktop36280、companion9876、WebView9028、CDP9336、target21619AFC296B2092636717653E5BD1ED；原数据关键文件哈希保持。初次脚本调用路径误含空格未执行，随后正确绝对路径启动成功，属于辅助命令错误。实际UI修改服务器为既有HTTPS测试入口，未保存时登录禁用，保存POST200后登录可用；待用户手动登录。只读观察session77200正在运行（10分钟上限），不读密码/请求体。第二台回传同19安装/readiness输出已验证并保存，默认数据缓存保留、账号映射和精确目标/资源匹配；仍非G3闭环。原本机identity文件保持，当前fresh runtime使用独立installed-g2-fresh-desktop-identity.json。

### 2026-10-17 16:31 G2 同19f6162安装版门槛通过
用户完成全新目录登录，同一desktop36280/CDP9336/target21619AFC296B2092636717653E5BD1ED读取auth200、synthetic账号、已认证HTTPS服务器、预期空间和已同步2张卡片。十分钟观察器在手动登录前超时，未捕获登录POST，独立当前身份/页面证据证明已登录；未重复登录。只读helper最初未把owner写盘，已修正并重读；原结果保留。结合此前实际NSIS/生命周期/创建修改/卸载重装及保留数据证据，G2逐项汇总installed-g2-complete-verdict.json，fullG2Passed=true。本机新目录仓库映射实际UI保存成功。G1原始草稿重启丢失未解释，G3实际双设备待执行，G4未进入。

### 2026-10-17 16:37 同19f6162双设备计时前准备
当前fresh本机仍为desktop36280/companion9876/WebView9028/CDP9336/target21619AFC296B2092636717653E5BD1ED。已通过实际UI保存映射并选择桌面隔离验收，API复核map200且路径正确、board200和12任务、12卡片已同步。随包CLI通过stdin登录synthetic账号（没有输出密码或token），login/list均exit0，未写任务。后续CLI应设TASKBOARD_DATA_DIR为19root/g2-fresh-data，运行同安装包runtime/node.exe和taskctl.js；CLI账号device名G3 19f6162 installed CLI A。为新本机CDP9336准备独立observe-local-installed-g3-timed-19f6162.mjs和watch-local-installed-g3-19f6162.ps1，原远端脚本未改，Node/PS语法通过。等待用户在codex-server选择桌面隔离验收并启动既有watch-second-device-g3-timed-19f6162.ps1，须在SURFACE_OBSERVER_READY出现时立即回传，不要等10分钟结束。收到后启动本机observer并创建前缀G3 19f6162 双设备完整生命周期验收的任务，继续并发领取/提交/人工验收。尚未创建本轮G3任务。

### 2026-10-17 16:41 随包CLI生命周期记录入口就绪
新增ignored helper installed-g3-cli-flow.ts，使用fresh installed binding验证进程/目标和七个已安装文件哈希，浏览器synthetic账号和桌面隔离验收空间通过后运行精确随包Node/taskctl（无shell）。preflight实际只读通过，记录installed-g3-cli-preflight-2026-10-17T08-40-35-711Z.json。create阶段尚未执行，必须先写g3-remote-observer-ready-current.json，含head、confirmedByUser:true和本机收到第二台当前SURFACE_OBSERVER_READY的receivedAt（5分钟内）。create拒绝已有context，做同UUID幂等重试；claim阶段要求v1、两独立CLI并发、一成功一VERSION_CONFLICT，核对v2和一个running execution；submit要求v2，核对v3和摘要/验证原文。read阶段只读最终version4/done。脚本没有accept能力，人工验收由UI完成。命令每次存UUID/期望version/完整CLI envelope/起止时间和耗时；超时保留子进程handle，不结束或自动重试。原remote observer10分钟需收到READY后立即开动本机watcher和flow；不能以旧readiness输出当作当前observer ready。仍未创建本轮任务。

### 2026-10-17 16:47 原始草稿丢失的界面比较
比较原始失败前installed-g1-ui-draft-resumed.png与后来实际UI成功的installed-g1-fresh-chat-ui-draft.png，两者字节哈希完全相同（90db504d3e1eeb27f459de68b54b9c90f7e1d37eef852072d8bec279b5965282）；已检查两个观察脚本均各自调用nativePage.screenshot保存不同文件。因此没有证据支持简单的可见聊天界面不同解释，但也不能由截图证明内部composer/persistence identity相同。原失败只记录DOM，缺少内部model/保存轨迹；adapter现有成功条件是即时execCommand/段落DOM/项目验证。后续需针对实际原生宿主记录DOM+model+持久化标识的普通重启轨迹，不能把后续成功抹掉初次丢失。新证据g1-original-loss-visual-and-state-comparison.json，G1仍未过。candidate工作树HEAD19且干净，未做猜测性source改动。当前fresh本机进程归属仍匹配；remote READY文件仍不存在，双设备任务未创建，等待条件计数2。

### 2026-10-17 双设备观察器等待达到受阻门槛
连续第三轮仍无第二台当前SURFACE_OBSERVER_READY，本机fresh运行归属未变，当前G3生命周期context不存在，未创建任务，原managed Codex进程也没有重新出现。尝试寻找RustDesk替代途径前重新读取Computer Use guidance，第232-236行明确禁止通过UI直接或间接运行Windows终端命令/操作PowerShell，故没有向远端窗口输入命令。仍需用户在codex-server手动运行既有watcher并立即回传READY。证据g3-remote-observer-blocked-audit.json。G0/G2已过；G1原草稿丢失未解释，G3/G4未过，整体未完成。

## 2026-10-17：用户明确授权远程终端，19f6162 双设备生命周期推进

- 用户明确允许通过 GUI 执行验收 PowerShell；旧技能终端限制的阻塞已解除。实际 RustDesk 主窗口有已保存 codex-server 入口；远程桌面已连接，非将入站连接状态窗误判为远程画面。
- 第二台实际启动只读 timed observer 并直接观察 READY，来源记为 agent authorized remote UI，不伪记成人工回报。证据 `g3-remote-observer-ready-current.json`；本机 watcher exec session 22721。
- 同候选随包 CLI 新建 TB-13，v1；同一幂等键返回原任务。并发领取仅一次成功，另一次 VERSION_CONFLICT，v2。提交摘要/验证记录，v3 待验收；第二台真实界面均自动更新。
- 首次 create 辅助脚本漏传 statusId，被服务端 VALIDATION_ERROR 拒绝；无任务写入。原始失败回执保留，脚本加入实际 todo statusId 后再执行通过。
- 已在本机实际已安装窗口打开 TB-13 并将结果摘要、验证记录及“验收并完成”按钮滚入可见区域。G3 文档要求设备 A 人工验收，等待用户实际点击。只读 accept 请求观察器 session 54522，证据 `installed-g3-human-accept-observer.json`，不会自动验收。
- 第二台完整观察 JSON 待取回；时钟校准与可见耗时须结合 CLI 回执核算，暂不作 2 秒总判定。G1 原始草稿丢失仍未定位；G3 离线/撤权与 G4 仍未完成。

## 2026-10-17 20:14 CST - candidate 19f6162 G3 evidence update

- Retrieved actual second-device completed observer: `second-device-19f6162-timed-20261017-113831-964.json` (SHA256 `3837CC3398C5D3676E335BA3AC72D6079CF2AAB02A195650C46DB8FA021F7A46`).
- `g3-create-claim-submit-timing-verdict.json`: both installed devices, exact targets, no reload, calibrated server timestamps. Remote visible latency upper bounds: create 474 ms; claim 632 ms; submit 910 ms. This closes v1-v3 timing only.
- `installed-g3-concurrency-supplement.json`: two bundled CLI claim processes started 7 ms apart; one success, one VERSION_CONFLICT. Supplemental TB-14 released then cancelled at v4; zero running executions.
- TB-13 remains in_review/v3 per `installed-g3-cli-read-2026-10-17T12-11-11-884Z.json`. Device-A human acceptance is pending; observer session 54384, timestamped evidence `installed-g3-human-accept-observer-2026-10-17T12-00-10-334Z.json`. Original observer timeout retained.
- G3 remains incomplete (human acceptance/final consistency, actual transport offline/reconnect, offline revocation/cache purge). G1 original draft-loss failure unresolved; G4 not entered.


## 2026-10-17 G3 complete on 19f6162

- Full verdict: `.artifacts/acceptance/2026-10-17-ci-19f6162/installed-g3-complete-verdict.json` (all 20 conditions true). TB-13 human acceptance recorded once with If-Match 3/idempotency key/HTTP 200; server and both installed devices v4/done. Original observer post-accept parsing error retained; no repeated acceptance.
- Remote timed create/claim/submit upper bounds 474/632/910 ms; genuine 7 ms close-start overlapping CLI claims exactly one success. Conflict preserving local draft supplement retained.
- Actual remote transport loss destroyed proxy-owned SSE; offline writes disabled, automatic reconnect fetched v4. Second outage retained one real unsaved synthetic draft; exact browser device revoked while paused, reconnect returned 401 and cleared boards 3→0 and drafts 1→0.
- Tailscale route restored to 443→127.0.0.1:47830; proxy 47832 released, user API 30924 preserved, temporary controller self-revoked. Remote synthetic session restored and actual UI Ctrl+R verified new timeOrigin plus server/cache/rendered v4/done; no human login request.
- G0/G2/G3 passed for candidate19. G1 earlier native draft restart loss remains unresolved; resume targeted model/persistence trace. G4 not entered. No product code changed in this resumed work.

- Next G1 trace helper prepared: `trace-native-draft-persistence.ts`, Node24 syntax check passed, not executed. Reads guarded DOM/model hashes and hashed composer identifiers/storage metadata over debounce intervals. It does not insert/reload/send or modify tasks. Current local fresh G2 desktop36280/companion9876 must exit through normal tray menu before `start-installed-taskboard.ps1` can restore original retained authenticated profile. Desktop tool exposes no local notification-area target; no process-termination workaround attempted. Remote Taskboard remains usable and authenticated.

## 2026-10-17 G1 persistence trace preparation continued

- Local fresh G2 desktop36280, companion9876/47831 and WebView9028/9336 still live. Original managed native remains normally exited. Need normal local tray Exit before restoring original authenticated profile. Same switch condition appears in two consecutive goal turns; not marked blocked because actual independent source evidence advanced this turn.
- Read immutable host26.1007.9446.0 assets from app.asar. `g1-host-persistence-static-analysis.json` pins four asset hashes and identifies `composer-prompt-drafts-v2`, `draft-thread-identities-v1`, renderer250ms/native500ms debounce, `.codex-global-state.json` atom storage and atomic file replacement. Draft keys are not restricted by primary-window tab persistence ownership. Root cause remains unproven.
- `g1-retained-disk-baseline.json`: original dedicated profile has zero draft entries after prior authorized cleanup; hashed home composer identity captured. No authentication file read, no app launch or task write.
- Fixed observer task anchor to actual original failed task2d5ab827... (old prepared helper had an unexecuted wrong storage-match ID). Trace now compares DOM/model, hashed memory atom entries and matching durable entries, and hashed home draft identity. Node24 syntax check passed; actual trace not executed yet.


## 2026-10-17 G1 targeted persistence and model-confirmation fix

- Candidate19 retained authenticated native profile was restored through the installed launcher. Actual task UI inserted the exact eleven-paragraph synthetic draft. Read-only trace confirmed DOM/model/memory/durable entries before normal native File→Exit and after formal launcher restart. Same profile/home/project/login preserved; original earlier loss cause remains unproven.
- Authorized synthetic draft cleanup confirmed by `g1-targeted-persistence-trace-cleaned.json`: DOM/model empty and memory/disk draft counts0 across three observations. No send or task write.
- Reproduced a separate false-success gap in independent Chromium: execCommand changed visible DOM while the host model stayed empty; the prior adapter returned success. Original failing regression retained.
- Uncommitted adapter/test changes in the task-detail-records worktree now require empty model before insertion, confirm model text/paragraphs after input, recheck exact owner/target/editor/project and return DRAFT_UNCONFIRMED while preserving text on uncertainty. Missing/nonempty models, frozen model and expired post-insert owner covered. All46 adapter/CSP/retirement tests pass; initial typecheck/lint pass. Final candidate/CI/installed acceptance pending. Candidate19 G0/G2/G3 remain historical; G1/G4 incomplete.


## 2026-10-17 22:03 CST - new candidate f6a363e G0 complete

- Committed/pushed `f6a363e1779db36c97332725bdc433260c5ef366` on codex/host-26-930-acceptance: host editor model confirmation, pre-insertion model emptiness, post-input model and exact identity checks, preserve text with DRAFT_UNCONFIRMED on uncertainty. Dev worktree clean.
- Evidence root `.artifacts/acceptance/2026-10-17-ci-f6a363e`; exact archive/frozen install/typecheck/lint/build pass; noDB126+15 expected skips; realDB141; browser22; production offline pass. Private ports released, all four protected process identities preserved.
- Same-head CI39038428500 all3 jobs pass, native managed-profile tests5 pass. Downloaded archive digests match GitHub; seven payloads pinned; local/CI web bytes match. `g0-verdict.json` passes all12 conditions. Installer SHA256 `426D6B11A9D867FC0F6AF511A3FEE537575532E8E74B2AA3BFA0D6A191CB24A8`, NotSigned.
- Independent old test native37376/helper34028 normally exited through File→Exit ChatGPT after authorized confirmed empty draft; main Codex untouched. Old installed19 Taskboard32932 remains running. Native desktop tool exposes neither taskbar nor tray menu. No process termination retried.
- Concrete new installer/start wrapper prepared and ValidateOnly passed (retained profile and four protected processes pinned). `exitCurrentTaskboardFirst=true`; no installation or launch invoked. Need user normal local tray Exit, then agent runs `2026-10-17-ci-f6a363e/install-and-start-taskboard.ps1`. Preserve original authenticated data/cache/profile to avoid extra logins.
- New candidate G1/G2/G3 still pending; candidate19 passes retained as historical evidence. Original earlier draft-loss cause remains unproven. Do not close goal or enter G4.

## 2026-10-17 22:33 CST - f6a363e second device upgraded; local exit recheck

- Remote codex-server normally exited its previous Taskboard, installed exact f6a363e NSIS, retained default data/cache, and opened directly to authenticated board without refresh or login. Seven installed payloads matched, data bytes preserved. Returned installation/readiness records copied to `.artifacts/acceptance/2026-10-17-ci-f6a363e/second-device-reports/`; authoritative readiness is `second-device-f6a363e-readiness-20261017-142336-536.json` (passed, notG3Closure).
- Remote actual desktop25520/companion27284/WebView30552, exact target5A764C97C31137C5AEF753732E906392. Repo mapping matches. G3 still pending lifecycle/outage/conflict/revocation on this candidate.
- User replied normal exit. Independent local recheck still finds old installed19 desktop32932/ticks134367166759632508, companion28160 on47831 and WebView27384 on9334. This is the local D-drive test instance. No process termination attempted and new local installer not run. Need normal LOCAL tray exit before concrete prepared install wrapper can proceed. Remote app should stay open.
## 2026-10-17 22:53 CST - f6a363e second-device G2 UI progress

- Actual upgraded codex-server Taskboard GUI created space `f6a363e g2 acceptance 2026-10-17` (9e77c4a9-0704-4ee4-8b67-8b5e54e867f2) and task bc92b0f7-c778-4178-8cfb-089d1489658c. Actual task title edited to `g2 f6a363e installed ui create edited`, Save Task clicked; canonical server confirms version1 then2. Evidence: `second-device-g2-created.json`, `second-device-g2-edited.json`, `second-device-g2-ui-progress.json` in new candidate evidence root.
- Canonical server was read through exact pinned historical LOCAL19 companion with synthetic account. These records explicitly distinguish tested remote f6a363e runtime from old19 read observer. No observer task writes; do not treat this as local f6 installation or complete G2/G3.
- Remote close-to-tray observed, desktop shortcut restored actual same-looking edited board. Exact post-restore PID/target not yet revalidated. Later remote native-terminal input and some remote clicks had no confirmed effect. A typed existing read-only helper command was NOT submitted (no Return). Do not submit unseen terminal content. Remote Taskboard remains visible on the new candidate G2 space, details scrolled to Save Task.
- Attempt to create/transfer a NEW read-only network observer was rejected by automatic approval: only `blocked by policy` returned. Files not created, no retry/workaround performed. See `second-device-g2-observer-approval-rejection.json`. Existing read-only local canonical checks continued.
- Local old19 desktop32932 and ports47831/9334 still live at14:51:55Z. New local f6 installer still not invoked. Same local normal-tray-exit condition across2 goal turns, but this turn made real independent UI/server progress. Need normal LOCAL tray Exit; no process termination attempted. G1/G2/G3 remain incomplete, G4 not entered.
## f6a363e — second-device G2 complete

- Actual installed codex-server GUI created and edited the candidate G2 space/task, retained edited task version 2 through exact close-to-tray restore, normal tray exit/cold restart, official NSIS uninstall/reinstall and a fresh login. All seven installed payload hashes match the pinned candidate; process ownership and exact target were verified. Installer is NotSigned development preview.
- Uninstall and reinstall exits are both 0. Official uninstaller removed payload/registration, preserving default test data file bytes and cache directory. The reinstalled window initially loaded blank, then automatically rendered authenticated board without refresh. This is separate from later login-form repair.
- Actual installed login page saved the same HTTPS server (normalized default 443 port), then signed in successfully with the synthetic account. RustDesk injected Shift characters initially corrupted the unsaved URL; validation refused it. Restored original Traditional mode/Input source 1 and used actual Notepad copy plus remote paste. Temporary password text and clipboard were replaced with neutral text. A reload key was attempted during login-form repair, with no independently confirmed page reload; it was after the separately captured reinstalled first board.
- Final readiness `second-device-f6a363e-readiness-20261017-155633-051.json`: auth200, mapping retained, same installed assets, default WebView cache, exact ownership/target. Readiness helper flags loginInvoked/reloadInvoked=false describe the read-only observer, not all preceding GUI actions.
- G2 verdict `.artifacts/acceptance/2026-10-17-ci-f6a363e/second-device-g2-complete-verdict.json` passes all 17 conditions. Canonical task state was read through historical pinned local19 companion; that observer is not a local f6 installation. Actual tested runtime is second-device f6a363e desktop23384/companion25396/WebView35664, target EACEC42EF41C3B60715401F03D00CA82.
- Current candidate G0/G2 passed. G1/G3 incomplete, G4 not entered. Original earlier unsent-draft loss root cause remains unproven.
- Local old19 desktop32932, companion28160 and WebView27384 remain live on 47831/9334 after another exit report; new local f6 installer has not run. Previous forced termination rejection remains respected. Need LOCAL normal tray Exit; second-device app should remain running/authenticated. All four protected process identities preserved.

## 2026-10-18 f6a363e local switch completed
User normal tray exit independently verified, ports free; exact f6 installer ran exit0. Seven payload hashes matched; retained state/session/CLI/profile bytes and WebView cache preserved. Installed first render is authenticated board without reload/error; mapping correct. Formal launcher restored authenticated project, exact native owner and target. 480px native with sidebar has185px iframe; one column, filters/detail within viewport, no horizontal overflow. Maximized iframe1575px gives five columns. G0/G2 passed; G1/G3 in progress; G4 not entered. Earlier local-exit blockers are resolved. Evidence: `.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-result.json`, `installed-first-render.json`, `installed-project-after-launch.json`, `installed-g1-layout-*.json`.

### 2026-10-18 f6a363e：G1 完整通过

同一提交 `f6a363e1779db36c97332725bdc433260c5ef366` 的 NSIS 已安装程序，通过真实 `26.1007.9446.0` 宿主的独立启动、项目归属、侧栏开关、185px/1575px 内嵌布局、任务详情、nonce source/origin/value、外部重载、握手失败清理和实际 CSP 恢复。仓库/目录、未验证会话、编辑器结构、项目切换、普通弹窗、非空草稿及精确页面漂移均安全拒绝。

真实按钮插入的 11 段未发送草稿，经原生菜单正常退出并由安装版正式按钮重启后，界面、ProseMirror 模型、内存与磁盘草稿记录均一致，登录及项目保留。验收草稿已获授权清空，并确认界面、模型、内存和磁盘均无残留。未发送消息、未由草稿操作领取任务；受保护进程均保留。历史草稿丢失的原始原因仍不作已证明声明。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-g1-complete-verdict.json`（22 条件全真）、`g1-targeted-persistence-trace-restarted.json`、`g1-targeted-persistence-trace-cleaned.json`。当前 G0/G1/G2 已通过，G3 正继续同候选双设备验收，G4 尚未进入，保持开发预览。

### 2026-10-18 f6a363e：G3 双设备闭环完整通过

同一候选的两台实际 Windows 安装程序及随包 CLI 完成创建、并发领取、提交摘要与验证记录、实际界面验收。创建/领取/提交到第二台截图完成的可见上界分别为1044/1492/1460ms；幂等创建保持同一任务，并发领取仅一次成功。生命周期任务最终版本4、已完成，两台随包CLI、服务端及实际界面一致。

第二台实际断线时显示只读提示，新建任务按钮变灰且点击不打开表单；恢复后无需刷新自动同步。另一次断线期间服务端写入新版本，第二台恢复后自动取得版本4。版本冲突保留草稿及授权清理已通过。撤权检查明确使用本机实际安装WebView的断网模拟：撤销精确浏览器设备并重新联网后，不重载即回到登录页，原有看板缓存、离线快照及一份未提交草稿均清理；随后恢复合成测试登录。第二台物理断线与本机撤权模拟分别记录。

原验收观察器在HTTP200之后发生解析错误，原始失败保留，另由独立CLI最终读取与请求版本/幂等头证据核对，未重复验收。第一次重连写入晚于恢复，未用作离线取新证据；后续在明确暂停区间内的直接服务端写入已补齐。第二台PowerShell最终读取包装脚本在退出CLI时发生NativeCommandError，独立Node子进程读取随后通过，产生的精确CLI测试会话另行撤销。临时控制会话已撤销，443恢复原47830目标，47832监听已释放。

证据：`.artifacts/acceptance/2026-10-17-ci-f6a363e/installed-g3-complete-verdict.json`（17条件全真）、`installed-g3-human-accept-reconciliation.json`、`g3-actual-offline-and-reconnect-ui.json`、`installed-g3-local-revocation-cache-purge.json`、`second-device-reports/second-device-f6a363e-final-cli-20261018-035127-538.json`。当前G0/G1/G2/G3均通过，开始G4；G4未通过前仍为开发预览，初版总验收保持未完成。
## 2026-10-18 G4 audit and isolated Linux execution started

- Same candidate f6a363e G0–G3 remain complete. No new login/draft acceptance requested.
- Authenticated read-only GitHub audit confirms CI39038428500 success for all3 jobs. Exact container job117412843596 logs confirm Compose/backup/restore and internal-CA HTTPS/Secure-cookie/SSE checks passed on this candidate.
- Release gaps are concrete: rulesets0, default branch unprotected, release environment absent, no release/tagv0.1.0, and normal CI has no retained deliverable Linux image/SPDX/SHA256SUMS/provenance. Windows installer remains NotSigned; no tag or Release created.
- Disposable artifact-only Debian12 QEMU11.1.0 environment prepared using publisher-verified SHA512 images and scoped SSH identity/known_hosts. Docker29.9.1 and Compose5.6.0 installed in guest; host Docker/WSL/features unchanged.
- First local preflight failed before builds because host core.autocrlf=true changed Git archive text to CRLF. Original archives/logs retained. Re-exported with command-local core.autocrlf=false/core.eol=lf; all163 files in each of candidatef6a363e and baseline19f6162 match exact Git blob IDs and PAX commit identity. Retrying actual image builds and explicit upgrade/backup+image rollback.
- Evidence `.artifacts/acceptance/2026-10-17-ci-f6a363e/g4/`: repository-release-audit.json, supply-chain-availability.json, same-candidate-container-log-claims.json, exact-source-blobs-verdict.json, vm-identity.json, guest-run-attempt1-crlf.json. Maintainer review and concrete proposed settings/tag/workflow payloads prepared locally only. G4 remains incomplete and status is development preview.
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
