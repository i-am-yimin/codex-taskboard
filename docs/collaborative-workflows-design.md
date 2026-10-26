# 多人协作与 Agent 工作流实施设计

日期：2026-10-26。本文描述当前实现契约与验收要求；设计描述不代替真实 CLI、桌面或最终安装包证据。决策见 [ADR 0007](adr/0007-collaborative-task-workflows.md)。沿用现有模块边界、空间权限、五状态、SSE、只读离线与四主题；所有 01—12 均需完整实现，不能以骨架、假数据、文档或 demo 代替交付。

## 数据与责任契约

保留 Task.assigneeId 为唯一总负责人；新增 reviewerId、parentTaskId（均 uuid|null）、requiredForParent（默认 true）、requirementsVersion（默认 1）、acceptanceCriteria（默认空）、dueAt（ISO 时间或 null）。现有任务编号、checklist、评论、活动、成果保持。任务角色不授予空间权限，所有写入由服务端重新核验当前成员和角色。

| 实体 | 字段、约束与意义 |
| --- | --- |
| task_participants | taskId/userId 联合主键、responsibility、progress 0—100、summary、blockedReason、updatedAt；同空间有效成员，总负责人可同时参与 |
| task_dependencies | taskId/dependsOnTaskId 联合主键；finish_to_start；同空间、无自身关系/循环，上游 cancelled 不算完成 |
| task_claims | id/taskId/actorId/deviceId/claimedAt/releasedAt/releaseReason；releasedAt=null 时每 task 唯一；领取与参与身份不同 |
| executions 增量 | claimId/agentKind/branch/prUrl/commitSha/handoffSummary/blockers/nextStep/limitations/requirementsVersion；phase 新领取为 claimed，running 只兼容旧历史，不代表 OS 运行事实 |
| task_runs | id/taskId/claimId/actorId/deviceId/runner/phase/externalSessionId/startedAt/finishedAt/lastHeartbeatAt/failureReason；phase=starting/running/cancel_requested/cancelled/succeeded/failed/unknown；每 claim 最多一个活动 run；另有 permissionMode、resolvedBy/resolvedAt/resolutionReason；未解除的 unknown 阻止新运行/提交/释放，人类解除仍保留 unknown；不上传 PID/目录/凭据 |
| task_artifacts | id/taskId/executionId?/kind/title/url?/text?/verificationScope/limitations/createdBy/createdAt/deletedAt?；kind=pr/commit/screenshot/document/test/other；可管理且保留历史 |
| task_proposals | id/taskId/kind/payload/baseTaskVersion/baseRequirementsVersion/state/proposedBy/confirmedBy?/confirmedAt?；kind=split/requirements/decision；state=proposed/confirmed/rejected；source 由服务端 auth 决定 human/agent，confirmedPayload 留存人类调整后的严格 payload；payload 必须按 kind 严格校验 |
| task_decisions | id/taskId/proposalId?/body/requirementsVersion/confirmedBy/createdAt；不可覆盖已确认记录，以新记录取代 |
| task_reviews | id/taskId/reviewerId/outcome/reason/requirementsVersion/taskVersion/createdAt；accepted/returned；只能人类产生 |
| notifications | id/userId/spaceId/taskId?/eventId/kind/title/body/createdAt/readAt?/handledAt?/snoozedUntil?/groupKey；userId,eventId,kind 唯一 |
| notification_preferences | userId/spaceId 联合主键、mutedUntil?/desktopEnabled/mergeWindowSeconds；静音不删除持久消息 |
| saved_filters | id/userId/spaceId?/name/query/version；仅本人；query 白名单，重放仍核验空间权限 |
| automation_rules | id/spaceId/type/enabled/config/nextRunAt/timezone/version/lastError；无任意脚本；occurrences 以 ruleId/occurrenceKey 唯一去重 |
| task_state_intervals | id/taskId/kind/startedAt/endedAt?/precision；kind=blocked/review_wait；同 task/kind 只有一个开放区间 |

关联表沿任务外键追溯空间，同空间关系在服务端空间事务锁内校验；不能声称数据库复合外键已提供跨空间约束。成员退出保留历史记录，历史任务角色不继续授权；禁止向其投递新通知或给无权限者新分配职责，需要人类补派。任务事件发现负责人或验收人字段为空时会通知当前管理员。字符串有明确上限，默认 summary/正文 10000、原因/职责 2000、标题 240；成果 url 非空时仅允许 HTTPS；仓库地址按现有规范去除凭据。新提交的 PR 关联非空时与成果 url 一样仅接受 HTTPS，不自动抓取或同步远端。本次不迁移旧 PR 链接，历史返回值仍须由客户端校验协议再提供可点击入口。

## 权限、状态机与竞态

viewer 只读，即使被指定参与者也不能写。editor 可创建、讨论、提案、领取及报自己的进度。总负责人或 admin/owner 可指派职责、修改关系、确认拆分与需求；指定 reviewer 或带理由的人类管理员才能验收。Agent token 不能确认提案、改验收人或验收。空间权限是上限。

| 操作 | 转换 | 前置条件与效果 |
| --- | --- | --- |
| claim | todo→in_progress | 在线/版本匹配/editor、未阻塞、依赖 done、叶子可独立实施、无活动 claim；不启动进程 |
| submit | in_progress→in_review | 当前 claim 持有人或管理员；requirementsVersion、summary、verification 必填，交接/限制等字段可管理；父任务总负责人在必要子全 done 后可创建独立 integration execution 提交而不伪造 claim/run；明确 reviewer；无未确认运行；释放 claim |
| accept | in_review→done | 人类 reviewer/有理由管理员；需求版本匹配、必要直接子任务全 done、无活动 claim/run、独立集成验证 |
| return | in_review→in_progress | reviewer/管理员人类；原因必填，保留成果，通知负责人/提交者；重新领取获独占权 |
| cancel | 活动状态→cancelled | 负责人/admin 人类、必填原因；活动 run 先取消并等待确认，不假成功，不级联取消子任务 |
| reopen | done/cancelled→todo | 负责人/reviewer/admin 人类、原因；保留历史验收、新提交重验；通知已完成下游受影响者 |
| block/unblock | semantic 不变 | 负责人/领取人/admin，以及通过 progress 报本人职责的 editor 参与者；阻塞须原因，记录区间；不自动终止进程 |

PATCH 不可绕过验收，done 必须 accept；不同语义变化使用状态命令，返回 TRANSITION_REQUIRED。相同 semantic 内列移动仍允许。必要子任务 cancelled 不满足父门禁，须人类明确改为非必要；可通过评论说明调整理由，系统不会把取消自动当作豁免。父子完成数不是父验收。checklist 不强制转子任务，不作为验收替代。

沿用现有 app.ts mutation 的单 SQL transaction 和空间行锁；关系写入与父验收使用相同空间锁。递归检查关系图无环；并发 A→B/B→A 不能双成功。父新增必要子任务与父验收拿相同锁，防检查后插入竞态。状态/活动/幂等响应/通知在同事务落库，提交后才 emit。

## 稳定 API 契约

根路径 /api/v1；现有认证、If-Match、Idempotency-Key、BoardError 保留。任务命令、职责/关系/成果/提案/运行等受版本约束的写入递增 task.version；评论和既有线程关联沿用其幂等接口。冲突 409 要求重新读取，不自动重放更改后的意图。幂等重试保留原键/原版本；幂等记录与业务写同事务。所有新字段经过 core Zod。

| 路由 | 内容 |
| --- | --- |
| GET /tasks/:id/detail | 既有 task/activities/executions，增加 participants/parent/children/dependencies/claims/runs/artifacts/proposals/decisions/reviews |
| PATCH /tasks/:id | 新 reviewer/parent/required/acceptance/due 等白名单；已确认需求修改走提案确认 |
| PUT/DELETE /tasks/:id/participants/:userId | 分配由负责人/admin，自身 progress/summary 可 editor 更新 |
| POST /tasks/:id/children | 人类负责人建独立子任务；parent/required；拆分批量确认原子生成 |
| PUT/DELETE /tasks/:id/dependencies/:dependencyId | 同空间无环，负责人/admin |
| POST /tasks/:id/proposals | 仅 kind、严格 payload；基准任务/需求版本由服务端结合 If-Match 记录，客户端不传 baseRequirementsVersion；AI 提案无即时任务副作用 |
| POST /tasks/:id/proposals/:proposalId/confirm 或 /reject | 人类负责人/admin；过期 PROPOSAL_STALE；confirm 可带按原 kind 严格校验的 payload 调整；拆分生成直接子任务与负责人/验收人，依赖另用关系接口管理，确认保留决策记录 |
| GET /tasks/:id/runs、POST /tasks/:id/runs | 列出运行/登记启动，claimId、runner、permissionMode、可选 resumeFrom；不接受PID/目录/凭据 |
| POST /tasks/:id/runs/:runId/events、/resolve | 原领取设备回报严格转换；人类核查停止后仅解除 unknown 阻塞并留审计 |
| POST /me/notifications/:id/delivery、/delivered | 领取当前设备投递轮次、凭精确 deliveryToken ACK；不自动已读 |
| GET /me/notification-events | 本人 SSE 变化提示，无私人正文；重新取当前收件箱 |
| POST /tasks/:id/claim | body agentKind?/threadId?；返回 task/claim/execution/run:null，旧 thread 接受但不强制 |
| POST /tasks/:id/progress | progress/summary/blocked?/blockedReason?；本人职责、领取人或管理员 |
| POST /tasks/:id/submit | 兼容 summary/verification，增 handoffSummary/blockers/nextStep/limitations/artifactIds/requirementsVersion |
| POST /tasks/:id/accept、/return、/cancel、/reopen、/release | 明确命令；reason/requirementsVersion；release 不声称停止进程 |
| POST/PATCH/DELETE /tasks/:id/artifacts[/:artifactId] | editor 新增，作者/负责人/admin 维护，删除留 tombstone/活动 |
| GET /me/tasks | relation=responsible/participating/reviewing/blocked、spaceId/statusId/priority/assigneeId/label/search、分页稳定排序 |
| GET/POST/PATCH/DELETE /me/saved-filters[/:id] | 本人独有筛选；直链不授予权限 |
| GET /me/notifications | cursor/unread/handled/spaceId；deliverable=true 提供独立到期候选，不能与 cursor 混用；当前授权过滤 |
| POST /me/notifications/:id/read、/handle、/snooze | 本人，稍后时间必须未来；read/handled 独立，逐 ID 操作 |
| GET /me/notification-preferences、PUT /me/notification-preferences/:spaceId | 本人的当前空间偏好 |
| GET/POST/PATCH /spaces/:id/automation-rules[/:ruleId] | viewer 可读，admin 可写；配置严格校验 |
| GET /spaces/:id/workflow-metrics | 真实区间统计、样本数/范围/时区；无数据为空而非示例 |

错误码至少包括 TASK_ALREADY_CLAIMED、DEPENDENCIES_NOT_DONE、REQUIRED_CHILDREN_NOT_DONE、REVIEWER_REQUIRED、REVIEWER_ONLY、AGENT_CANNOT_CONFIRM、RUN_STATE_UNCONFIRMED、REQUIREMENTS_CHANGED、DEPENDENCY_CYCLE、CROSS_SPACE_RELATION。403/404 不泄露其他空间标题/ID。

## 后端 registration 与并行边界

app.ts 统一注册模块。CollaborationContext 注入 db、taskAndRole、member、stored/saveIdempotency、rowTask/rowExecution、activity、emit 和可选 event hook；API 模块复用已有外层事务/空间锁，不绕过权限。createWorkflowServices 提供 register/event/notify，createAutomation 提供 register/runOnce 并在 onReady/onClose 管理真实 worker，registerRuns 注册运行事实路由。worker 独立事务先锁空间再锁规则，复验成员/状态；emit 使用 afterCommit。OpenAPI 由 openapi.ts 合并 collaboration-openapi.ts 的 schema/paths。

事件至少携带 eventId/spaceId/taskId/actorId/kind/occurredAt/requirementsVersion/明确受影响任务 ID；通知模块按当前成员算接收者，不接受客户端传任意接收者。领域模块不直接调用系统桌面通知。

## taskctl 与真实运行

core AgentRunner 的 probe/start/status/cancel/resume 独立于 AgentAdapter。probe 对每项返回 supported/reason。Codex CLI/Claude Code 各自本机能力探测；不支持恢复即明确说明并提供带交接的新运行。manual 不伪造进程。

伴随服务回环 API 受本机能力凭据保护，远程 API 无任意命令入口。启动只接任务/claim ID、白名单 runner、显式 permissionMode（默认 read-only）和已验证本机仓库映射；workspace-write 必须明确选择，不能危险跳过权限。每伴随服务同仓库一个映射、同规范 cwd 一个运行，不自动建 worktree；不同账号/设备各自独立映射可并行。执行文件由本机设置验证，argv 调用、不拼 shell；Codex 与 Claude CLI-login 使用独立本机专用 profile 登录，不复制日常桌面认证；Claude 显式 API-key 模式由标准输入配置并用 Windows 当前用户 DPAPI 保护。真实 spawn/退出才更新 run。持有自己创建的真实进程句柄/创建时间；取消只作用于已确认所属进程，退出确认才 cancelled。重启无法验证归属时 unknown，超时先查询原 run，不重复启动。

taskctl 保留 list/get/create/update/comment/link/claim/release/submit，补 progress/artifact/propose 与 run configure/probe/start/status/cancel/resume/sync；claim 不要求 Codex thread，agent 与 thread 独立。机器输出可判断，退出码区分校验/权限/冲突/离线/运行失败。Agent 可以读/领/报，不能验收/确认。离线拒绝领取和状态写，已执行结果沿用 outbox 保留原版本/幂等键，重连冲突待人处理。

## 通知与自动化

提交通知 reviewer；退回通知提交者/负责人；分配通知目标；依赖完成通知下游负责人/领取人；需求确认通知受影响任务责任人；缺责任人通知空间管理员。除操作者、离开成员和无权限者。持久通知与活动同事务产生；个人 SSE 提醒刷新，空间 SSE 不广播私人正文。

桌面通知先有持久记录，再尽力投递；授权不足或桥接请求失败显示原因，插件排队成功只代表已请求，不能确认操作系统最终显示或用户已看到。多设备 delivery claim/ack 与精确 deliveryToken 去重；稍后开启新投递轮次并使旧 token 失效，过期幂等响应不能重新获得旧 lease；不因请求已排队而已读。未读/处理/稍后独立；静音仅抑制提醒；groupKey 合并展示不抹事件；离线重连按 cursor 补取，再按当前权限过滤。

worker 有界轮询，以 FOR UPDATE SKIP LOCKED 抢到期规则，occurrence 唯一防重复。依赖提醒用真实状态事件；超时用 dueAt/区间；周期任务使用明确模板、起点 nextRunAt 和固定 intervalHours；时区只用于显示，按绝对时长推进，不承诺本地墙钟或 cron/DST 语义；离线/停服恢复只生成当前一次并跳过无限历史。停用保历史，触发复核空间/成员/规则。测试注入时钟。迁移前区间 precision=legacy_unknown 不纳入精确时长统计；上线后 exact 单列。blocked/review_wait 由持久当前状态统一归一化：仅任务与空间未归档、semantic 非终态时计时；创建 blocked 立即开，取消/完成/归档关，重开/恢复按当前事实开新段，不累计暂停时间。终态不能通过 progress/PATCH 重新开阻塞。0009 将历史失真开放区间标为 legacy_unknown，并从修复时刻开始缺失的真实活动区间；不捏造过去精确起点。统计裁剪范围并显示样本数，不用随机数据。

## 界面、动效与 Logo

当前卡片显示总负责人、验收人和独立子任务标签等事实；未提供卡片级参与/子任务/依赖聚合计数，不为每张卡额外拉详情。完整责任和关系在详情呈现；详情按目标与验收、职责、子任务依赖、成果验证、讨论决策、活动展开，保留 checklist。提案按真实 source 显示 AI/人类来源、人类确认人和逐项 diff/影响，确认后才生成。运行面板区分领取/启动/运行/提交/验收，未知取消不可显示成功。

我的负责/参与/待我验收/阻塞使用真实服务端查询；稳定空间+任务深链、短编号/完整 ID 复制、保存筛选。加载/空/错误/只读离线状态完整。通知支持未读/处理/稍后/静音。所有四主题、窄窗口、200% 缩放、键盘焦点/读屏、语义按钮/对话框、正文 AA 4.5:1；减少动效时关闭非必要位移/循环。动画不提前显示成功或清理草稿。

专属设计负责人交付原创流转/接力 Logo，统一网页/侧栏/Tauri/安装器/单色与小尺寸，保留原创源 SVG，不复制参考项目素材。动效样式与业务样式文件所有权协调，避免并发覆盖。

## 迁移、兼容与实施分波

在既有 0004_user_themes 后追加迁移，不改旧 SQL。先增 nullable/default 字段与表/索引；新建未指定负责人默认创建者；旧 assignee 回填 participant（职责负责实施，不造进度）；旧 running execution 回填 claim，标 legacy 业务记录，不造 run。旧 done 保留且 reviewer 显示历史未记录；旧 in_review 缺 reviewer 必须人工补派。升级前后核对任务/评论/活动/执行内容和数量，重复迁移无副作用。

先备份并用独立副本验证，再服务端后客户端。客户端 0.1.8 与服务器 0.1.4-preview.1 为本地配套候选，非发布声明。新增公开 health 能力契约：独立 serverVersion、apiVersion、capabilities.collaborativeWorkflows、migrationRequired；仅 0005—0009 齐全时声明协议 1。旧 health 无能力/迁移不全时界面提示升级，保留基础只读和草稿；网络失败显示未验证，不当成版本错。web 与 taskctl 每次新共享写入/启动前重新探测，不能使用缓存能力授权；真实任务 404 保持原语义。登录/退出/本机配置和原有查询/取消不额外增加兼容门禁，既有安全复核不变。本机 runner probe 仍单独声明真实运行能力。危险旧 PATCH 返回语义转换拒绝，提交缺少新必填修订会报校验错误，客户端需同步升级。应用回退不删新表；数据库还原需停写、处理活动 claim/run、备份导出新责任材料、再恢复备份，禁止在线 drop 当回滚。

| 波次 | 文件/责任 |
| --- | --- |
| A 领域 | 领域负责人：core index.ts/collaboration.ts/runner.ts；server collaboration.ts/schema.ts/migrate.ts/app.ts 与 collaboration 回归测试。先冻结类型/路径，再 UI 接续 |
| B 通知自动化 | 集成负责人或独立实现者：server workflow-services.ts/automation.ts 与真实 PG/时钟测试，使用 context/event hook，不抢 app.ts |
| C 本机 CLI | 运行负责人：companion runners.ts/main.ts/store.ts、cli main.ts、真实 capability/进程及回归 |
| D 业务 UI | UI 负责人：CollaborationPanel/NotificationCenter/MyTaskViews、TaskDrawer/api/types/main/realtime/offlineSnapshot/demo；真实 API 接入 |
| E 品牌动效 | 设计负责人：原创 SVG/端图标/CSS token/desktop 图标；协调 styles.css，覆盖四主题与减少动效 |
| F 集成验收 | 集成负责人：OpenAPI、CHANGELOG、user-guide/architecture/ADR 索引、验收文档；pnpm check/db/e2e/offline/相关 Rust 和安装验证 |

已实现迁移依次为 0005_collaborative_workflows、0006_workflow_services、0007_run_recovery、0008_run_permissions、0009_active_workflow_intervals。运行与隐私边界另见 [Agent 运行](agent-runners.md)及[隐私说明](privacy.md)。本设计不宣称付费模型、已登录官方 CLI 取消/续接或最终包已经验收。

## 验收矩阵

| 编号 | 必需正向/边界 | 证据 |
| --- | --- | --- |
| 01 | 多人职责/进度/成果持久、明确 reviewer；viewer/离开/跨空间拒绝 | core、真实 PG、e2e |
| 02 | 人确认原子拆分、保留 checklist、父子/依赖无环与并发成环拒绝、独立领取验收 | PG 并发、e2e |
| 03 | 五状态/退回/阻塞/取消待确认/重开与材料保留；PATCH/Agent 绕过拒绝 | PG、e2e |
| 04 | 叶子 branch/PR/agent/run/交接/验证/阻塞/下一步；双领取仅一个成功；父集成门禁竞态 | PG 并发、CLI、e2e |
| 05 | AI 提案无副作用、人确认留痕、过期冲突、需求 diff/影响通知、旧需求验收拒绝 | PG、e2e |
| 06 | 正确接收者/空间隔离/撤权、未读处理稍后静音合并去重、离线补取、桌面失败不丢 | PG、两账号浏览器、桌面模拟/实机分列 |
| 07 | taskctl 读领报；两 CLI 实际启动/退出/取消/恢复或诚实不支持；重启 unknown、超时不重复、凭据不上传 | CLI/回环模拟、隔离实机 |
| 08 | 六种成果增改删追溯、验证范围/限制；恶意 URL/超限/越权拒绝 | core、PG、e2e |
| 09 | 四个人视图、上下文/ID/深链/保存筛选、分页稳定、撤权不泄漏 | PG、e2e |
| 10 | 键盘读屏/焦点、减少动效、失败不假成功、四主题/窄窗/200% | 浏览器、脱敏截图、人工读屏 |
| 11 | 原创源、单色/小尺寸可辨、各平台一致、实际安装无破图 | 源检查、构建、安装截图 |
| 12 | 真依赖/超时/周期触发，多 worker 去重、固定间隔/停用、区间统计与事实一致 | 注入时钟、真实 PG 并发 |
| 升级 | 带旧任务/评论/执行迁移、重复迁移、claim 回填、reviewer 补派、备份恢复 | 独立 _test PG |
| 离线 | 只读/草稿/outbox 原版本与幂等键、重连冲突、登出撤权清理 | build 后 test:offline |
| 集成 | pnpm check、test:db/e2e，涉及 Rust 则 cargo test/runtime 与最终安装 | 源码/模拟/隔离实机/固定包分列 |

所有证据记录命令、结果、环境范围、提交、脱敏路径及未运行项；生产数据库、日常 Codex 登录/聊天/真实草稿和发布标签资产不用于测试。文档本身只需 diff --check 与链接核对，不能宣称功能已验收。
