# 协作任务实现与验收进度

本记录用于长任务续接。状态只代表已取得的证据；设计不等于实现，阶段检查不等于最终验收，源码/模拟不等于真实宿主或安装包。

## 责任与边界

- Astra：总指挥、集成决策、总进度与总验收。
- gpt-6.1-sol：用户指定的设计、源代码实现和独立验收 Agent。
- 根线程：环境、持续沟通、Git 操作；不写实现。
- 分支 codex/collaborative-agent-workflows；起点 dde5d2eabf77adf1a4347525d85046c1f44b0a4b。
- 共享目录按文件所有权分波，不碰日常 Codex 登录/真实草稿/生产数据，不发布或改固定标签/资产。

## 当前分工与阶段

| 负责人 | 所有权 | 当前状态 |
| --- | --- | --- |
| product_architecture（Sol） | core领域、server/app/迁移/业务、领域测试、新设计/ADR | 全部释放；HTTPS窄修后真实PG8/8、OpenAPI3/3、type/lint通过 |
| motion_brand（Sol） | apps/web、品牌/动效资源、icons、通知delivery限定范围 | 全部释放；Rust最终45通过/5忽略；root追加存量PR guard浏览器回归1/1通过 |
| agent_runtime（Sol） | companion/CLI、server/runs.ts、core/runner.ts及运行相关有限集成 | 运行与打包修复完成并释放；fresh run6/6、进程/契约14+CLI3、真实桌面stage/runtime通过 |
| independent_acceptance（fresh Sol） | 独立测试脚本和验收文档，不改产品源码 | 独立验收完成；六账号生产UI双叶/父集成、通知/提案/六类材料通过，源码检查通过 |

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

## 第三波进展（最新）

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
