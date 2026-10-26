# 协作任务实现与验收进度

本记录用于长任务续接。状态只代表已取得的证据；设计不等于实现，阶段检查不等于最终验收，源码/模拟不等于真实宿主或安装包。

## 责任与边界

- Astra：总指挥、集成决策、总进度与总验收。
- gpt-6.1-sol：用户指定的设计、源代码实现和独立验收 Agent。
- 根线程：环境、持续沟通、Git 操作；不写实现。
- 分支 codex/collaborative-agent-workflows；初始实施起点 dde5d2eabf77adf1a4347525d85046c1f44b0a4b，当前0.1.8续接起点为54de6bc9fdb7275c50652e0d7ad4e9786237e649。
- 共享目录按文件所有权分波，不碰日常 Codex 登录/真实草稿/生产数据，不发布或改固定标签/资产。

## 当前分工与阶段

| 负责人 | 所有权 | 当前状态 |
| --- | --- | --- |
| product_architecture（Sol） | core领域、server/app/迁移/业务、领域测试、新设计/ADR | 0.1.8兼容能力与个人桥接完成并冻结；真实PG/权限与浏览器模拟证据已交付，服务端候选未部署 |
| motion_brand（Sol） | apps/web、品牌/动效资源、icons、通知delivery限定范围 | 键盘、实时重连及跨空间草稿修复完成并冻结；最终compact联验35/35（含完整motion18）、连接单元14/14通过，自有服务已清理 |
| agent_runtime（Sol） | companion/CLI、server/runs.ts、core/runner.ts及运行相关有限集成 | 运行与代理修复完成并冻结；授权native原运行6/6及独立运行/个人桥接9/9通过，非官方provider证据 |
| independent_acceptance（fresh Sol） | 独立测试脚本和验收文档，不改产品源码 | 本轮native9/9与final-4b完整生产链通过；真实评论持久化和末段权限均已覆盖，源码/资源前后不变，自有资源已清理；历史失败证据保留 |

## 需求逐项审计

| 编号 | 必须交付的行为 | 当前证据与剩余 |
| --- | --- | --- |
| 01 | 总负责人、多参与者、验收人及职责/进度/成果；空间权限上限 | 领域与UI实现；fresh六账号真实UI/PG权限闭环通过，角色与责任保持独立 |
| 02 | 父子、依赖、独立领取验收、人确认AI拆分 | 真实PG父子/混合环/并发门禁通过；fresh双叶与父集成UI通过，人调整需求提案通过 |
| 03 | 完整流转、退回、阻塞、取消、重开与材料权限 | 五状态命令与原材料保留实现；interval创建/终态/重开/任务及空间归档修复，真实PG通过 |
| 04 | 叶子并行、执行关联、交接、父集成验收 | 双账号不同Agent claim与报告、branch/SHA/交接、父独立人验通过；单companion同cwd禁止并行 |
| 05 | 讨论/决策/验收条件、AI提议、需求差异影响 | fresh真实UI原/提议diff、人工修改确认、原/确认payload和过期版本409通过；PG提及接收者通过 |
| 06 | 持久通知、桌面提醒、收件人隔离、离线补看 | 完整持久收件箱与native请求桥；真实PG9/9含lease/snooze/50页外候选，fresh真实UI独立状态通过；OS显示未验 |
| 07 | taskctl、Codex CLI/Claude Code运行能力与真实进程语义 | runtime/CLI/面板已实现；官方无模型auth_required，fresh真实companion→synthetic Node6/6；两轮90秒超时保留；provider生成未验 |
| 08 | PR/commit/截图/文档/测试、变更/验证/限制管理 | 成果CRUD/权限/验证限制实现；fresh真实HTTP/PG六类CRUD、软删除、恶意URL拒绝通过；材料未逐项点验UI |
| 09 | 我的角色/阻塞视图、复制/直链、保存筛选 | 服务端角色视图/保存筛选实现并PG通过；fresh生产深链通过，全部视觉状态未独立覆盖 |
| 10 | 拖拽/抽屉/筛选/更新/请求动效，键盘/窄屏/减少动态 | 专属Sol动效/四主题/360px/reduced截图及mock通过；fresh生产Escape/reduced通过；人工读屏/200%未验 |
| 11 | 原创接力卡片品牌，web/桌面/安装器/托盘一致 | 原创SVG/React/PNG/八尺寸ICO统一源码资产；已目视截图与PNG；最终安装托盘/安装器未验 |
| 12 | 依赖提醒、超时升级、周期任务、真实统计 | 真worker/规则/固定小时周期/去重与区间实现；domain27/27、fresh16/16覆盖；0009修正失真历史区间 |

## 已取得的检查证据

- 领域作者执行真实56552独立_test PostgreSQL：collaboration 6项（含旧running数据迁移与重复迁移）、server.integration 6项、server-setup 5项，共17/17通过，21.14秒。
- 领域typecheck与领域ESLint exit 0；UI专属ESLint通过。后续代码仍在变化，必须最终重跑pnpm check。
- 初次候选pnpm check曾因品牌生成脚本Node globals lint失败，作者已改显式导入；它不能记为基线通过。
- 根线程PG56551/56552已实测SELECT1；初期握手超时已恢复。并发测试用不同synthetic账号/独立_test数据库，migration重建只在专用数据库。
- Playwright缓存Chromium153已真实启动；使用CI=1选缓存浏览器，日常浏览器/Codex不参与。
- 官方隔离CLI已真实version/help exit0：Codex0.164.0、Claude2.1.310；工具、隔离home与证据位于忽略.artifacts/collaborative-workflows。尚未经过产品supervisor执行，不计07端到端通过。
- portable Rust/MSVC可用。通知插件exact2.3.3元数据与当前tauri2.11.5兼容，根线程在独立probe验证编译；不复制probe锁覆盖项目原依赖。

## 后续交付门槛

1. runtime/CLI、通知/自动化/统计全功能与UI接续；持久通知先于系统提醒，领取/进程结束/人工验收保持不同事实。
2. OpenAPI、CHANGELOG、user-guide、architecture/ADR索引与最终验收说明按实际行为更新，删除未实现的设计保证。
3. 最终pnpm check、真实PG权限/冲突/幂等/迁移、多人双Agent父子流程E2E、受影响offline/appearance、Rust/desktop prepare/runtime。
4. fresh Sol独立验收与修复；Astra按01—12审计证据。真实CLI、真实桌面和最终固定发布包单列，未运行不得标记通过。

## 第三波进展（历史）

- 第一阶段UI交付：协作模拟E2E 5/5（48.4秒）、适配器测试48/48、专属ESLint通过。截图在忽略目录.artifacts/collaboration-ui。默认顶部品牌缺口由测试发现并修复；侧栏宿主按钮仅替换SVG路径。
- 第二阶段后端交付：真实PG22/22；补充投递去重和真实onReady/onClose后服务套件7/7（6.78秒）。最新全仓typecheck/领域lint通过。product_architecture现idle，待最终OpenAPI/架构文档与修复。
- 新agent_runtime（gpt-6.1-sol）正在实现真实supervisor、taskctl、run API与面板，拥有运行相关app/core/migration有限集成。0007保留unknown状态并增加人类解除阻塞审计，禁止假成功。
- motion_brand已唤回，正在实现收件箱、提及、规则/统计UI、原生通知；其有限拥有workflow-services中delivery/snooze/ack，修复稍后提醒不重置及旧回执竞态。
- 原生通知插件exact2.3.3与既有tauri2.11.5独立编译probe成功（21分12秒冷编译）；仅证明依赖可编译。插件会吞系统show错误，bridge仅报告请求已排队，不能称用户已看到。
- 最终多人真实闭环仍必需：两个参与者各用不同Agent处理两个叶子，其中一项退回通知对应人，最终独立人类集成验收。现有单账号PG/模拟UI不能替代。

## 第四波续接审计（2026-10-25）

- 当前活跃实现者为 agent_runtime 与 motion_brand，均为用户指定 gpt-6.1-sol；域作者已完成前波，等槽位恢复处理 OpenAPI/架构文档和集成缺陷。
- 通知稍后提醒现已具备新投递租约与精确 PostgreSQL epoch 字符串 token。真实 PG 8/8 证明旧 ACK 不能覆盖新提醒轮次。Astra 新增审计发现已读后 snooze 会被 read_at 拦截，已交 UI/通知作者修复并补真实 PG；已处理提醒须明确拒绝或禁用。
- Astra 确认阻塞计时缺口：终态转换关闭区间但保留 blocked=true，重开未恢复区间。待域作者修复并补取消/重开、终态/归档区间回归；未修复前不得声称统计完整验收。
- 运行器补充显式 read-only / workspace-write 权限，Claude 专用 CLI 登录与可选 API-key/bare 双模式。最终权限 argv、认证隔离与同步冲突验证仍在进行。
- 真实 CLI 负路径探测被自动审批拒绝，原因是尚未证明不会继承真实认证或发生付费调用。未绕过拒绝；仅继续官方版本/帮助/无模型认证状态及明确 synthetic 子进程验证。真实认证开发能力不能由这些证据代替。
- 独立多人验收尚未启动。首个槽位释放后使用 fresh gpt-6.1-sol，验证两位参与者、两个不同 Agent 身份的叶子任务、独立人类 reviewer、退回通知、重提交与父集成验收。
- 根线程环境续接记录位于忽略目录 .artifacts/collaborative-workflows/environment.json；它不是当前运行证据，进程与端口必须重新核对。日常 companion 47831 仍为受保护对象。
## 独立验收启动与最新验证

- 根线程已真实完成 pnpm install --frozen-lockfile（10.28.0，8项目，exit0，9.9秒）；不是lockfile-only检查。
- motion最终服务PG9/9（31.44秒），独立deliverable=true候选覆盖历史50条之外的到期提醒；旧ACK/claim重放、已读预约、已处理拒绝均已回归。界面mock4/4、候选补验1/1、生产web构建通过。
- fresh gpt-6.1-sol independent_acceptance已用随机专用_test数据库、6个合成账号、生产web快照与真实HTTP完成第一轮：两参与者各不同Agent token独立领取，A退回/重领/重提/验收，B独立验收；两叶done父仍todo，负责人独立集成提交后由另一人验收才done。Agent验收403、viewer/跨空间拒绝通过。首轮没有启动进程，只证明claim与多人UI流程，不能代替运行证据。
- 官方Codex/Claude在新空home下仅version/auth status返回auth_required；argv和环境键白名单已核对，未重试被拒生成动作。运行器通过显式synthetic真实子进程证明协议/取消/同步，真实provider生成未验。
- 运行同步已补cancel_requested必要路径与同phase session/failure事实比较；未知不推断终态，冲突明确返回。真实companion+Node端到端回归仍在收口。
- root预留56551/collaboration_finalchecks_test供最终全check；fresh使用自己的随机_test库。单companion每仓库单目录、不提供每run工作树选择；并行范围是各账号/设备独立映射目录，不声称同设备同仓库双Agent并发。
## 源码冻结与整体检查（2026-10-26）

- interval缺陷已修：新建blocked开启exact，终态/任务归档/空间归档关闭，重开/恢复按实际状态重开；终态与归档progress拒绝，终态block PATCH拒绝。0009将无法精确恢复的历史失真区间标legacy_unknown。域作者真实PG27/27、fresh领域+服务16/16。
- OpenAPI新增协作/通知候选/个人筛选/自动化/runs补充已接入，契约测试3/3与相关lint通过。域作者现在仅整理架构、ADR/文档索引、隐私、PRODUCT和命令示例。
- fresh扩展多人生产UI已通过通知隔离/read-snooze-handle、人调整AI需求与旧版本409。受控runtime整文件前两轮90秒超时，第三轮仅增加诊断后6/6通过（51.34秒），断言/限时不变，诊断已撤。没有证据将前两轮归因于具体业务错误，最终全check仍需观察。
- 根线程生产test:offline与test:appearance均exit0（真实PG/独立浏览器或companion、冷重启与权限撤销/主题多设备等），日志在忽略目录root-offline.txt/root-appearance.txt，UI缓存源码未再变时证据有效。
- 根线程已启动完整pnpm check（CI=1、56551/collaboration_finalchecks_test），工具会话94451，日志root-pnpm-check.txt；precheck-snapshot.json记录本轮tracked/untracked非ignored源码。检查期间产品/测试/script冻结，文档仍在完善。
## 最终 Node 与桌面运行时结果

- root完整 pnpm check exit0：TypeScript、ESLint、Vitest 31文件239/239（启用真实PG、无skip）及生产build通过；测试355.21秒，build33.64秒。无诊断run整文件6/6（36.264秒，companion取消同步33.219秒）。前两轮90秒时延仍保留历史记录。
- 生产bundle主JS755.22kB/gzip231.34kB产生500kB建议拆包warning，不是error；未调高阈值掩盖，也未为此临时扩范围重构。
- 首次desktop:prepare真实失败，发现taskctl的新companion/runners导入缺少构建alias。runtime Sol补唯一源码映射，模块完整bundle而非external；增强既有runtime检查验证其真实闭包。
- 修复后 pnpm build、desktop:prepare、desktop:check-runtime、目标ESLint、全仓typecheck及diff-check均exit0。中文空格目录仅复制Node与两个CJS，无node_modules/manifest，实际port0伴随启停、CLI帮助、隔离run configure通过。未启动真实Agent或触碰47831。
- motion只格式化本轮新增Rust函数/测试片段，归一化核对无行为/字面量变化，未动历史格式。旧cargo会话无法恢复，未记通过；root新98365会话的cargo test --locked --offline已exit0，45通过、0失败、5忽略（3项需隔离真实宿主、2项进程fixture），新通知边界测试通过。忽略项不计通过，证据为root-cargo-test.txt。
- fresh独立验收已final；文档acceptance-collaborative-workflows.md明确01–12证据、两轮runtime时延、provider/OS提醒/安装包/人工读屏与200%未验范围。root已按完全路径复核并清理两次超时的合成临时目录，无匹配活fixture进程，未扫杀Node。
- root在打包alias修复和独立脚本最终格式之后，以66659会话独立复验全仓typecheck、目标ESLint、Node build、desktop:prepare、desktop:check-runtime均exit0，包含隔离run configure。
- 最终审计发现执行报告prUrl与材料URL的HTTPS契约不一致：提交schema允许其他scheme，旧报告UI直接呈现链接。React的JavaScript URL保护不等于该契约完整；未声称已证实XSS。root授权domain/UI两位Sol仅修提交校验、存量呈现guard和对应回归/OpenAPI，最后复验相关PG、type/lint与必要UI构建。
- cargo新增通知依赖会重生成3个已跟踪gen/schemas文件。依CONTRIBUTING的“提交不包含生成目录”，由root仅恢复本轮自生差异；保留既有tracked文件，不删除历史内容，不改Cargo依赖与真实capability配置。
- HTTPS窄修已由两位Sol完成并冻结：提交复用artifactSchema的URL边界，真实PG8/8覆盖HTTP/JavaScript/Data/File拒绝且version/claim/execution不变、HTTPS/null通过，OpenAPI3/3通过；旧报告仅有效HTTPS提供链接，其他引用保留普通文字。两位作者的全仓typecheck、目标lint和diff-check通过。新增UI单条回归会话12242未返回结果，作者仅Ctrl-C主动中止本次会话，未计通过；未保留绝对起点，不能断言已超时或会话异常，root接手定向复验。最终源码检查与build/stage以root的新结果为准，不把先前239项全check当成此窄修后的整套重跑。

## 最终签收（2026-10-26）

- root最终75118会话exit0：全仓TypeScript、全仓ESLint、真实PostgreSQL领域8/8及OpenAPI3/3（共11/11，9秒）、生产build（31.26秒）、desktop:prepare和desktop:check-runtime全部通过，覆盖HTTPS窄修后的最终候选源码。
- root最终72026会话exit0：新增存量PR引用浏览器回归1/1（23.9秒），使用原60000毫秒配置和缓存Chromium，无扩大timeout或放宽断言。有效HTTPS保留链接；HTTP/JavaScript/Data/协议相对/畸形HTTPS为普通文本，报告与验证文字保留。前次作者主动中止记录保留，不算失败或通过。
- 最终主JS755.36kB/gzip231.38kB；超过500kB的建议拆包warning仍保留。最终桌面运行时验证覆盖中文空格目录和独立run configure；这不是最终安装器或发布包验收。
- Astra按01—12签收实现范围：全部已实施并通过对应层级检查，最终审计发现的区间、通知、打包和PR链接缺口均已修复。多人独立领取/退回/重提、两个叶子与父集成的人类验收、需求调整、收件箱隔离和六类成果具有独立验收证据。
- 保留未验证范围：已登录官方CLI的真实模型生成/取消/续接、OS提醒实际出现或被阅读、最终安装器/NSIS/托盘、人工读屏及200%缩放。单companion每仓库只有一个目录映射，同cwd不并行；并行使用各账号/设备独立映射或不同仓库。不得把这些边界写成已验收。
- 全部实现者和独立验收者已释放所有权，源码、测试和文档冻结。root随后负责仅本轮测试服务的归属核对与清理、本地提交及最终来源说明；不推送、不创建公开PR、不发布或改变固定标签资产。

## 0.1.8 可用候选续接（2026-10-26）

用户追加要求：动效参考 GitHub 开源项目并改善观感，继续验收到 0.1.8 可用。新起点为干净的 `54de6bc9fdb7275c50652e0d7ad4e9786237e649`，沿用 `codex/collaborative-agent-workflows`；前述冻结仅对应该轮交付，新的工作已获授权。旧的239项结果是基线证据，不能代替新候选验证。

本轮分波与所有权：

1. motion_brand（Sol）使用 Impeccable，原创实现完整卡片拖拽/落点、可中断且适应滚动的筛选位移、可中断抽屉进入退出和固定占位操作反馈；root研究GitHub参考与许可证，不复制参考代码、图标或截图。保持四主题、360px、键盘和减少动态效果。
2. agent_runtime（Sol）审计版本、升级与既有运行时序，统一客户端0.1.8版本并修复有证据的阻断；服务端独立版本不随意升级。root负责隔离环境、构建、安装与实际产物证据，Astra只做集成审计和文档。
3. 一个作者释放槽位后唤回独立Sol，针对最终生产资源重做多人协作与受影响UI/运行流程；作者自测与独立验收分开记录。最终候选冻结后执行相关全仓检查及原样安装器验收。

完成门槛：

- 版本、源码来源、锁文件、原生文件版本与安装器一致，最终生产构建和随包运行时通过；相关真实PG、多人父子流程、受控进程取消/恢复/冲突同步稳定，无通过延长限时隐藏的时序问题。
- 原样0.1.8安装器实际安装、冷启动、退出清理、0.1.7升级保留独立合成数据；安装文件与安装器内容和摘要一致；实际窗口、托盘、图标与系统提醒有可审阅证据。
- 最终资源中的动效通过快速连续交互、滚动、拖拽取消与键盘操作，四主题/窄屏/200%缩放/减少动态效果无布局或焦点回归，API确认前不假成功。
- 官方CLI真实认证执行、取消和续接必须走专用profile、限定权限与最小测试任务。不能通过其他agent重试以绕过上一轮自动审批拒绝；若需要用户登录或维护窗口，先准备具体可审阅方案。未知或未验事实不能当作该项通过。
- 不推送或公开发布，不修改日常Codex登录、聊天或真实草稿，不操作生产数据库；本轮仍保护日常伴随服务47831。

初始实机阻断：标准NSIS采用固定currentUser安装身份与single-instance标识，`/D`换目录仍不隔离卸载注册表和快捷方式；`TASKBOARD_DATA_DIR`不隔离WebView数据，原生/网页/CSP仍固定47831。故当前不能在保护既有47831的同时于同机验证原样标准包。优先由root准备干净Windows VM执行原样安装/升级；修改identity的验收构建不算原样生产安装器通过。若无可用VM，须在候选准备完成后取得明确维护窗口授权，不能擅自停止日常实例。

运行作者只读确认三个有界性缺口，已分配受控复现及窄修：DPAPI辅助进程无超时/输出界限；本机取消在等待远端回报之后才进入终止阶段；桌面/父生命周期的5秒退出预算可能早于Windows身份及子树终止helper的15秒上限。它们是独立观察到的代码缺口，尚不能认定是历史两次90秒用例未完成的根因。修复必须保持当前账号鉴权、原创建时间/可执行身份复核、原版本幂等和合法事实同步，不伪造取消成功，不扫描杀其他进程，不扩大原测试限时。客户端四处版本已由Sol精确调整为0.1.8，原安装身份/CSP和服务端独立版本保持。

- 本轮实机环境审查：root未发现可用Windows VM入口或Windows磁盘，仅有Debian部署虚机；未自行安装或启用虚拟化。候选准备完成后再提供具体维护窗口/备份回退方案。Windows专用Computer Use插件可检查Taskboard/托盘/OS提醒，但其Codex和认证界面禁止自动化边界保持，不通过其他工具绕过。
- 本轮PG56551由root重启，使用随机独立`*_test`数据库；56552未开。日常47831/PID23636保持，UI作者暂独占4173测试Vite，最后需按本次归属移交或清理。
- 动效首批5项及协作连跑11项通过；Astra追加发现运行中切reduce的WAAPI标记清理竞态与进入途中退出抽屉的首帧跳变，作者确认并定向修复。CSS zoom=2只是合成缩放夹具，真实WebView200%需最终安装版另验。
- 阻塞report的受控红测确认本机取消会被远端回报拖住；解耦后又复现过早cancel与Windows identity capture的竞态，现等待原identityReady，不降低归属验证。新取消/落盘/重启回归在授权原生环境通过15.675秒，DPAPI三项受控helper回归通过；受限环境中未确认身份的结果保留，实际PG端到端仍待完成。停机后的异步report不能回写已退休store，内存report队列不得冒称已持久投递。
- motion已交付并释放：最终compact专项8/8，前一版desktop7/7与协作联跑11/11，typecheck/专属Lint及一次Impeccable检测通过。已补动态reduce清理、抽屉进入中退出的首帧连续性、同卡退出中重开与旧关闭回调隔离；个人视图gutter及窄屏标题已收齐。Astra已目视最终合成拖拽和360px截图；真实WebView缩放及安装验收另列。4173已清理。
- 第二波domain Sol接管server独立候选0.1.4-preview.1及旧API兼容：公开health声明版本、协议和迁移就绪能力；旧/不兼容服务显示升级提示、基本看板只读/草稿保留，web与taskctl阻止不兼容新写入；认证与本机设置仍可用，网络失败与旧协议区分。不得把普通NOT_FOUND替换成升级错误，不发布或部署生产。实现和回归尚在进行。
- runtime已完成并释放源码：客户端版本五处一致为0.1.8；DPAPI helper为20秒且stdout/stderr合计64KiB，本机事实先落盘、远端回报串行异步，取消等待原identityReady后复核归属。supervisor总退出预算35秒，原生/父退出保护40秒，预算耗尽不伪称已取消。作者相关进程/companion/helper24/24，真实PG/port0/Node整文件6/6，退休回调不得修改重启后state.json的定向复验通过，最终startup/helper5/5；均非官方模型或安装包证据，原90秒测试限时保持。
- 新候选独立验收入口要求显式candidate、新的artifact目录和当前生产web快照，拒绝复用旧证据目录；manifest覆盖tracked及untracked非ignored源码与全部快照文件。旧生产验收18个文件由root另行复制并保存摘要，原目录未改。最终0.1.8集成/安装文档由root唯一维护，独立作者保留协作验收文档；新生产验收尚未运行。
- domain首轮core/web/CLI兼容及传输、真实PG迁移health检查共26/26通过；模拟UI与补充审计仍在收口。Astra发现AgentRunPanel的本机start/sync直接fetch绕过每次health检查，且新增只读状态可能隐藏已有运行取消入口，已交domain修复：启动/同步须重新探测，查询/取消不额外引入兼容门禁，原在线成员/领取人/设备与进程归属检查保持。源码尚未全局冻结。
- root只读确认实际既有服务器公开health为200且缺新能力声明。独立验收将以仅替换health的loopback代理测试旧能力响应，其他页面/API使用新候选与真实PG；该项明确为能力响应模拟，不冒称运行完整旧服务器。真实新服务器迁移与health另有实际PG证据。
- domain完成窄修并声明产品/测试冻结：web本机start/sync与taskctl均在当前在线health通过后才发送请求，start幂等键延后建立；已有运行取消仅沿用原角色/在线条件与伴随服务当前鉴权，不被新增兼容只读隐藏。最终相关unit/transport26/26及真实随机PG health/迁移2/2，兼容UI desktop/compact10/10、原协作/动效/通知desktop18/18。桌面mock新增47831全origin兜底拒绝与unexpected请求为空断言后，取消可达性2/2复验通过；没有真实调用日常companion。最终全仓检查、生产快照及独立候选验收将由root新结果衔接。
- 本机标准候选与隔离新服务器的安装/协作验收，和日常生产可用性分开签收。既有生产health缺协作能力，0.1.8连接后只读不能写成日常协作可用；生产服务器部署、迁移与恢复须有独立具体方案和授权，客户端维护窗口不涵盖生产数据库变更。
- root本轮Rust测试已exit0：45通过、5忽略，编译30分28秒、执行1.63秒；忽略包括3项真实宿主环境检查及2个由父测试启动的夹具入口。后续修复仅TypeScript，不将这些忽略项写成已通过。
- 新全check首轮88292在类型/Lint通过后以exit1结束：35文件共257项，256通过、1失败，388.32秒。失败是新增CLI健康探测在领取前被伴随服务旧proxy白名单拒绝，不是取消时序超时。root保留原日志、摘要与precheck来源；Astra协调期间runtime已在该轮原desktop/run套件结束后修改main.ts与一个测试文件，因此该轮后续输出不能视为统一修后源码验证。必须以重新冻结后的新全check作为最终证据。
- 同根因还影响桌面个人任务、保存筛选、通知和偏好。runtime现按renderer实际使用的路径/方法逐条开放，CLI个人入口和未消费的通知SSE保持拒绝；精确GET健康响应no-store且不写入/读取离线缓存，原key/Origin/当前会话与其他GET缓存不变。新双surface安全矩阵定向1/1通过；domain新增真实PG+port0个人桥接3/3（27.44秒），证明筛选CRUD/版本、通知read与偏好持久化、账号切换隔离及Agent写入拒绝。原run整文件6项正在独立随机库复验，未计通过。
- runtime受限环境复验79731为5/6通过，取消/重启项90.035秒超原90秒限时；PATH_DENIED已消失，受限CIM拒绝访问，但不能据此确认超时因果。保留完整失败日志；wrapper已清理随机库，授权只读CIM未见本轮匹配Node进程，未扫描终止其他进程。随后单次授权native66161原样复验6/6通过，关键取消/重启37.194秒、整文件40.796秒、总46.82秒，原90秒未改。两份新日志均保存在本轮v018目录并校验移动前后摘要；旧18项证据不变。最终TypeScript、目标Lint和diff检查通过，源码再冻结，等待root新全check及构建。
- 用户确认最终动效标准为“克制顺滑，关键操作有质感”，与本轮已实现方向一致；最终生产与安装版验收继续按此标准，不为追求更多动画扩大设计范围。

## 0.1.8 生产复验与键盘竞态修复（2026-10-26）

- 代理修复冻结后的root完整检查73898 exit0：36文件261/261，无skip，TypeScript、Lint及生产构建通过；测试426.39秒、构建34.94秒，原运行取消/重启/同步46.039秒且90秒限时未改。全部tracked/untracked非ignored文件匹配final-2来源清单。该轮生成只读web-final-2，7个资源，主JS761.43kB的500kB建议拆包warning保留。后续键盘窄修改变了web源码，因此这不是修后最终全仓证据。
- 同轮root生产离线64693和主题59341均exit0并清理；desktop prepare/runtime18516通过，中文空格目录中仅使用随包Node/CJS验证实际工厂启停与CLI配置。Rust62621为45通过、5忽略；忽略项未冒称通过。后续root对照final-2复核Rust目录24文件及companion/server/packages共47文件，均无新增、缺失或字节变化，支持保留这些未受UI窄修影响的证据。随包4个运行文件另有摘要，新UI构建后须重新stage核对。
- fresh独立原生验收36064在明确native权限下9/9通过、无skip：原Agent运行6项39.85秒，个人桥接3项7.70秒；wrapper整体89.6秒。仅使用新随机测试库、port0伴随服务和合成Node，覆盖取消/退出/重启/合法同步、退休回调及个人接口隔离；随机库与本轮进程已清理。此结果不代表官方模型生成或已安装程序通过。
- 独立生产3734在no-preference的同卡快速关闭/重开保留草稿后，Space→ArrowRight→Escape取消失败，5秒后浮层和dragging仍存在。前台诊断97510仍失败，页面visible/hasFocus均为true，不能归因后台节流。有效最小诊断65387记录Escape比内置键盘监听注册早62ms，证实快速输入窗口；三份失败证据及web-final-2的7文件前后摘要保持。首轮全链已完成核心协作、通知、需求提案和六类材料，但兼容代理与末尾权限负例未到达，不能记整体通过；最小诊断只覆盖其明确短链。
- motion以公开Sensor契约包裹现有键盘sensor，在注册间隙有界暂存按键并按事件顺序重放；每实例独立内部取消码回收迟到监听，scope卸载不回写旧界面。不改依赖或私有字段，不复制第三方实现。实际落点回归还发现同步重放会读旧落点，现逐事件处理；跨列重挂焦点另由本次请求的有界恢复逻辑负责，claim/patch等待刷新，用户移焦、对话框、隐藏、pagehide、新拖拽和卸载均释放旧恢复请求。原权限、状态命令和安全检查不变。
- 原快速取消用例在原sensor上以5秒断言确定性失败，修后通过，输入之间没有sleep或时钟推进。作者compact项目完整当时17/17通过（93511，1.6分钟）；随后在既有异步claim工厂增加pagehide用例，最终套件共18项，仅相关4/4复验（47678，27.9秒），不写成完整18已执行。覆盖实际同列一次写入及新position、跨列落点/焦点、异步合法claim、主动移焦、drawer、resize/visibility、卸载复用、队列上限及监听清理。隐藏/pagehide为合成生命周期事件，CSS zoom=2不是实际WebView200%。同列落点夹具明确使用可见目标，保留库在目标不可见时先滚动的行为。
- 最终作者TypeScript62661、专属Lint51079和差异检查均exit0；精确修改为main.tsx、两个新增motion模块及motion.spec.ts。Astra与独立验收者完成只读实现审查。作者自有Vite97852已正常中断，4173无监听，测试浏览器已结束，日常47831未动。证据与最终四文件摘要见本机忽略目录的keyboard-repair-verification.json。
- 此时进入统一文档收口与final-3冻结；该轮后续结果与新发现见下节。源码冻结不等于任务结束；标准安装器、实际升级/冷启动/退出/托盘/系统通知与真实缩放仍待候选具备后按授权维护窗口验证。官方CLI生成与实际生产服务升级仍保留各自授权和证据边界。

## 0.1.8 实时恢复、草稿归属与 final-4 冻结（2026-10-26）

- root第三轮完整 `pnpm check` 73311 exit0：36文件261/261、无skip，TypeScript/Lint通过，真实独立PostgreSQL测试429.64秒，生产构建23.60秒；291个源码文件前后摘要一致，测试库已清理。不可覆盖的web-final-3共7文件；主JS764.47kB/gzip235.07kB警告保留。stage27256通过，7个web文件与快照一致，Node/CJS/package四文件与受验runtime18516完全相同。随后web修复改变了源码，这些结果不能代替final-4。
- 独立final-3生产59580已通过两种动效偏好的快速关闭/重开、草稿epoch、Space→ArrowRight→Escape、浮层回收和焦点，随后因仍打开的任务模态阻挡背景“重新检查服务器”而失败。仅在正式脚本补Escape、确认关闭及重新打开原卡片并确认四行真实用户步骤；未强制点击、删断言、加sleep或延长限时。TypeScript/Lint通过，root确认291文件中只该脚本改变；其最终SHA256为 `e911c2555d3b98e985a90208f0cf41d8fa79ee86054885cf9e5a632aa94b94ea`。
- 修正脚本后的独立final-3b生产9212在兼容提示消失后，原5秒发送可用断言失败：界面仍处于等待实时连接。最小真实HTTP/PG诊断79731与仅浏览器可信offline/online事件对照16227均复现，无新SSE请求/ready/board；旧流短断网后仍存活，通用online处理却把状态设为connecting，连接effect未重启。不是重复手工事件覆盖新ready。末段真实写入与权限负例未到达，不能记生产全链通过；诊断使用合成账号并清理专用库/服务/浏览器，快照摘要保持不变。
- motion统一browser EventSource与desktop fetch的连接生命周期：offline先退休旧代次并回收，online显式重建；只有当前流真实ready/board可恢复同步。旧代次的ready/board/error/revoked均被拒绝，逐await/帧检查退休状态，撤权对当前scope终止。连接effect在新账号/空间绘制前清理旧scope；通用网络处理不再重复修改sync。没有以health、navigator或HTTP成功作为恢复写入凭据，原认证、能力和角色边界保持。
- scope回归暴露另一真实缺陷：A详情在切B后继续把三类草稿持久化为B，B当前流撤权继而误删。专用红测99192保留JSON、截图、录像与trace，确认原A编辑/评论/结果先被重标B，随后均为null。三类持久化及提交尝试改用实际task.spaceId，导航不匹配即解绑旧抽屉及退出动画；通知/个人任务显式传递目标空间，等待匹配board后才打开。存储键、版本、原幂等尝试保持；来源未知时不写草稿。
- 修后定向绿测36458通过，最新同版compact联验1622为35/35、4.0分钟：motion18、重连6、兼容5、协作6；完整motion18已执行，早前17加受影响4仅保留历史。普通切空间及退出动画中切空间均证明B撤权保留A三类原始记录、返回A真正撤权仍清理；真实收件箱入口延迟目标board仍打开正确任务。连接层75467为14/14，测试308ms、总2.38秒；TypeScript1142、专属Lint及diff82766均exit0。两次通知选择器/模态路径夹具失败单独留存，无放宽断言。证据在本机忽略目录 `draft-reconnect-final-20261026-121610/verification.json`；Astra核对最终五文件及正式脚本摘要与磁盘一致。
- 上述35项使用Vite、隔离Chromium、合成API/EventSource及可信浏览器联网切换；退出动画夹具暂停浏览器时钟/CSS动画。它们不替代真实生产离线、服务成员撤权、安装版或物理200%缩放。作者Vite98099已退出，4173无监听，日常47831未触碰。Astra与独立验收者完成只读实现复核，代码和测试已冻结。
- 此次冻结后交root固定final-4来源，相关完整验证结果见下节。标准安装器与实装尚待完成。旧0.1.7原程序35文件和卸载/快捷方式已备份，专用旧版companion已在port0初始化独立合成data/profile并退出；实际旧版桌面主题/草稿基线、正常退出后一致备份与0.1.8升级保留仍须在维护窗口内验证。总证据及剩余边界见[0.1.8验收](acceptance-0.1.8.md)。

## 0.1.8 最终生产与安装候选构建门槛（2026-10-26）

- root final-4完整检查96415 exit0：TypeScript、Lint、36文件270/270、无skip及生产构建通过；测试416.03秒、构建22.73秒。292个仓库文件前后摘要一致，随机测试库已清理；web-final-4保存7个不可覆盖资源。主JS765.86kB/gzip235.54kB警告保留，未改阈值。stage17927通过，16文件中7个web与快照一致，Node/CJS/package四文件与成功runtime18516逐字节相同。
- final-4首次独立生产32165已通过原5秒发送恢复、草稿精确保留并实际点击发送；下一步脚本读取详情接口不存在的comments字段发生TypeError。TaskDetail契约实际为activities，此失败属于验收脚本错误，不能将已点击发送写成评论持久化通过；当次末段viewer/outsider仍未达。失败日志、截图、源码/资源前后摘要均保留。
- 仅正式脚本窄修为activities按comment.added、正文、账号和任务精确匹配，随后在本次独立数据库参数化查询comments并断言唯一一行，保存合成评论行证据。原用户路径、poll限时和权限断言未改，没有空数组兜底。静态78923的全仓TypeScript、目标ESLint和diff检查通过；正式脚本SHA256为 `f78339dcd8871b1f762baea0d91e1ad53dd36957d141d4599a15514f91b10b92`。root核对292文件中只有脚本从e911变为f783，产品和测试未变，快照/dist/stage的7资源均不变，固定preproduction-final-4b来源；原e911与精确差异保留，不重复未受影响的270项。
- fresh正式final-4b45528整链exit0：六账号双叶领取/提交/退回重提、独立人类验收与父集成，通知隔离/稍后/处理、需求提案人工调整、六类材料与危险URL拒绝，两种动效下关闭重开/草稿/快速键盘取消/焦点，旧能力health-only代理只读且不转发写入，断网恢复后UI发送并通过API活动与PG评论唯一行核对，末段viewer/outsider写入及outsider详情拒绝全部通过。证据目录 `independent-final4b-9cc8f4d68eff4686bf10f2646de28926`；292源码与7快照资源前后不变，自有浏览器、代理、服务和随机库已清理。Astra与root均亲读结果、评论行及摘要审计，生产全链签收；模拟旧health不等于实际运行旧服务器。
- root随后顺序完成offline72575及appearance37390，均exit0。前者覆盖生产冷重启、草稿保留、只读、重连及真实当前设备撤权后的缓存/草稿清理；后者覆盖真实companion/PG的内嵌主题、多设备同步、主题包、离线冲突、删除回退和身份初始化恢复。各自292来源前后不变、7资源匹配，结果与新截图留在本机忽略目录。此前35项作者模拟与这些生产证据分别保留，不能互相替代。
- 当前源码与生产层级无未解决阻断，可在本轮文档收口后由root提交固定来源，构建原样标准0.1.8安装候选，并核验安装器版本、签名状态、提取内容与全部随包摘要。此结论仅放行候选构建；实际安装、0.1.7升级保留、冷启动/退出/托盘/系统提醒和真实WebView200%仍未验。原样安装会共用既有身份及固定端口，必须按具体维护窗口完成一致备份与回退准备；不改变日常Codex资料，不把客户端维护授权扩大到生产服务迁移或官方模型付费执行。没有推送、标签或发布授权。
