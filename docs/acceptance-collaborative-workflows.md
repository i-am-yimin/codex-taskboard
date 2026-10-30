# 协作工作流独立验收

## 0.1.8 本轮独立记录（final4b 生产链通过）

上一轮结果不继承为新候选证据。独立脚本现要求 `--candidate`、`--artifacts`、`--web-snapshot` 三参数；候选须等于当前 root package 版本，输出必须是忽略目录中的全新子目录，禁止覆盖旧结果、复用旧协作快照或跟随快照符号链接。清单记录实际客户端/服务端版本、源码 HEAD/分支/状态/差异哈希、`git ls-files --cached --others --exclude-standard` 全部非 ignored 文件摘要，以及生产快照所有资源的 SHA-256。

最终构建由根集成确认后，复制新 `dist/web` 到本轮独立快照，并使用 `.artifacts/acceptance/2026-10-26-v018/` 下新的独立执行目录。final4b 完整独立生产链已通过；以下分别保留早期失败和最终通过范围，不能据此声明原生安装或官方模型通过。

本轮范围包括真实新服务六账号协作和健康能力契约；两动效偏好下快速关闭/重开、epoch 草稿和键盘取消；仅替换 health 的回环代理模拟旧能力缺失，其余仍访问真实新 PostgreSQL 服务，验证只读、草稿保留、离线重连及新能力恢复。该代理不是旧服务二进制证据，核心协作流程无 route mock。受控运行只使用合成 Node 协议进程，不调用真实付费模型或读取日常凭据。

### 已执行证据与发现

客户端候选为 `0.1.8`，独立服务版本为 `0.1.4-preview.1`。本轮所有数据库均为从独立测试父连接新建的随机 `*_test`，不重建共享表；临时服务使用回环随机端口，结束清理自身浏览器、服务和数据库。

| 检查                | 实际结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 独立 native runtime | 原生授权执行上下文运行 `tests/agent-runs.integration.test.ts` 六项及 `tests/personal-workflows.companion.integration.test.ts` 三项，**9/9，无失败或跳过**。wrapper 用时约 89.6 秒；两个文件实际测试约 39.85 秒和 7.70 秒。覆盖报告阻塞下取消、shutdown/restart、合法显式 sync、退休回调隔离，以及无离线回退的 health 和逐路径个人 API 桥接。证据 `independent-runtime-f807862485f842378dbb69abc3b0c963/`。这是受控 Node/真实 PG/companion 证据，不是官方模型或安装证据。 |
| 首次完整生产脚本    | `independent-production-43152a68f8ed4188ada94456d202bd45/`，**失败**。同一 `web-final-2` 七个资源执行前后 SHA-256 全部一致。真实多账号双叶领取/提交/退回重提/不同人类验收/父独立集成、通知、需求调整和六类材料管理完成；随后快速键盘取消后拖拽浮层 5 秒仍可见。                                                                                                                                                                                                          |
| 前台观察副本        | `independent-front-diagnostic-e90ae3827ee349e5bf2c0040c797e283/`，**仍失败**，原断言和 5 秒不变，资源哈希不变。加入 bringToFront 后仍复现，open 观察均为 visible/hasFocus。第一版事件注入日志为空，不能用它判断传感器时序；其 CRLF 字节与 LF 规范化摘要分别留档。                                                                                                                                                                                                        |
| 有效最小诊断        | `independent-motion-minimal-v2-68c576135555486e91fdeb6c5636db2e/`，**第三次失败**。两合成账号、一个真实 PG 任务、同一生产快照、原 motion loop/5 秒断言。原生 JS 观察器先以安装标记、键事件和无错误冒烟确认有效，真实时序证明 Escape 比键盘传感器监听注册早约 62 毫秒；资源前后摘要一致。                                                                                                                                                                                 |

第三轮时序（performance 毫秒）：Space 2938.3，拖拽浮层与内部 `data-dragging` 出现 2985.2，ArrowRight 3032.9，Escape 3042.4，`bound handleKeyDown` 注册 3104.4。全程页面可见且有焦点；因此后台页面不是这次失败的解释。不能通过等待传感器 ready、增加 5 秒限时或只隐藏浮层消除该失败。

上述三轮均在动效段截断；后续 final3/final3b 已完成两种动效偏好，但生产脚本末尾 viewer/outsider 权限负例仍未到达，不能继承上一轮通过记录。

作者随后窄修公开键盘包装器：缓冲注册间隙输入、逐任务重放、有界队列与实例专属迟到清扫；实际移动后等待 query 刷新，并用可取消的焦点恢复意图尊重新用户焦点、对话框、visibility/pagehide。独立验收者进行了只读生命周期审查，没有修改产品源码。作者 compact 浏览器模拟当时整套 **17/17，1.6 分钟**；之后加入 pagehide 回归，最终 suite 为 18 项，实际只复跑受影响 **4/4，27.9 秒**，不能称整套 18 已运行。作者最终类型、专属 lint 与 diff 检查通过，范围和源码摘要见 `.artifacts/motion/keyboard-repair-verification.json`。

### final3 生产复验与重连缺口

`independent-final3-6d532051e931466ebf4226ac706dfdc4/` 在原正式脚本下完成核心协作和两种动效偏好、快速键盘取消、epoch 草稿及焦点检查。随后健康代理恢复步骤点击被仍打开的任务模态抽屉正确阻挡，30 秒超时，属于验收交互错误。获准仅补四行真实 UI 操作：Escape 关闭并等待对话框隐藏，原 banner 点击完成后重新打开同一任务并等待对话框显示。全部业务断言及原 5 秒限制保留。精确差异为 `final3-formal-modal-fix-exact.diff`；脚本 SHA-256 从 `2a7f30ce62001ad757d469391f0dd32494ecffd5baa25b607ccbbb02be49860d` 变为 `e911c2555d3b98e985a90208f0cf41d8fa79ee86054885cf9e5a632aa94b94ea`，全仓类型检查、定向 ESLint、diff 检查通过。

`independent-final3b-00b7293e12c54aecbb3ab13803b842ea/` 用上述正式脚本复验，完成两种动效环及代理恢复/抽屉重开，但评论发送按钮在原 5 秒内未恢复；页面显示“正在确认实时连接；所有写入已暂停。”。291 个源码文件和七个生产资源执行前后摘要一致。这是实际生产重连失败，最终评论持久化和后段 viewer/outsider 负例尚未到达。

只读被动观察副本 `independent-compatibility-diagnostic-1ba152e8983244018b38deec35f805bf/` 同样失败。随后唯一获准的可信事件对照 `independent-compatibility-trusted-99f76f558b6a4af6b7326d0da4f8d2d4/` 仅移除两次手工 online/offline dispatch，保留浏览器真实短断网与原 5 秒断言，仍失败。原 SSE 已收到 ready，短断网后没有新 SSE 请求、ready 或 board；navigator 已在线，界面仍 connecting。该证据支持“短断网存活旧流后未重新订阅”的缺口，不能证明第二次 online 覆盖新 ready。可信对照按实际评论 input 确认草稿完整保留；首版观察误查 textarea，不能据其空字段推断草稿丢失。两次资源摘要一致，浏览器、代理、临时服务与随机数据库均清理。

作者随后将连接生命周期归于当前空间/账号的独立控制器：offline 立即退休旧连接，online 创建新尝试，仅当前流真实 ready/board 解锁；退休代次早于 unsubscribe，错误重试有界，撤权终止，浏览器与桌面迟到回调被隔离。主界面使用 layout effect 在新空间绘制前退休旧 scope。独立验收只读审查了这些边界，没有修改产品代码；生产结论仍等待 final4。

### 跨空间草稿红绿及最终作者验证

作者在 `draft-space-red-20261026-120058/` 复现真实产品缺陷：A 任务抽屉跨空间仍存活，三个草稿被写成 B 所属，B 当前合法撤权删除了 A 的字段、结果、评论草稿。修复将草稿持久化归属绑定实际 `detail.task.spaceId`，详情未定时不写；抽屉绑定目标空间，导航不匹配时关闭，用户身份纳入实例 key。旧退出动画清理不能关闭新抽屉；通知明确携带目标空间，延迟目标 board 到达前不错误打开任务。独立验收进行了只读归属/生命周期审查。

作者同一场景修复后通过：B 撤权保留 A 三份序列化草稿，返回 A 后当前 A 撤权正确清除三份。退出动画测试以浏览器时钟与活动 CSS 动画保持旧抽屉；通知测试延迟目标空间 board 响应，确认到达后才打开 B 任务。通知单项 **1/1，11.4 秒**。最终联合浏览器验证 **35/35，4.0 分钟**（motion 18、reconnect 6、compatibility 5、collaboration 6），实时单元 **14/14，测试 308 毫秒、总计 2.38 秒**；类型检查、定向 ESLint、diff 检查通过。证据清单为 [verification.json](../.artifacts/acceptance/2026-10-26-v018/draft-reconnect-final-20261026-121610/verification.json)。这属于作者 Vite/隔离 Chromium/合成 API 与 EventSource 验证，短断网使用可信浏览器事件，不替代真实 PG 生产验收。作者自有 Vite 已停止，4173 无监听，日常 companion 未触碰。

### final4/final4b 最终证据

根集成在新随机测试库完成 final4 全量 check/build：36 个测试文件 **270/270，无跳过**，测试 416.03 秒、构建 22.73 秒，292 个源码文件前后一致，数据库已删除。此结果属于根集成执行；final3 的 261 项保持为旧快照记录。生产 JavaScript 765.86 kB、gzip 235.54 kB 的体积警告仍保留。

独立首轮 `independent-final4-726122bdcd414357bfab4983e2d7e849/` 已通过原 5 秒发送按钮恢复、草稿原值检查并实际点击发送，但脚本错误读取详情接口不存在的顶层 `comments`，触发 TypeError。该失败是验收契约误用，不能据此判断产品评论持久化失败；当次也不能声明后段权限检查通过。原 console、results、截图和摘要均保留。

获准仅修正 `scripts/check-collaboration.ts`：原 poll 改读实际 `activities`，严格匹配 `kind==='comment.added'`、body、owner actorId 和 taskId；随后对同一独立数据库的 `comments` 按 task_id/actor_id/body 参数化查询，明确断言恰好一行并保存合成行证据。用户操作、原 poll 限时和其余断言未变，没有用空数组或可选链掩盖缺失。原 e911 脚本备份为 `formal-script-before-activity-fix-e911.ts`，精确差异为 `final4-formal-activity-fix-exact.diff`；新 SHA-256 为 `f78339dcd8871b1f762baea0d91e1ad53dd36957d141d4599a15514f91b10b92`。全仓 TypeScript、目标 ESLint、diff 检查通过。根集成确认 292 文件中仅脚本变更，其余源码和原 `web-final-4` 七资源不变，保存 `preproduction-final-4b-snapshot.json` 与 `production-final-4b-source-adjustment.json`。

独立全新执行 [final4b results](../.artifacts/acceptance/2026-10-26-v018/independent-final4b-9cc8f4d68eff4686bf10f2646de28926/results.json) **exit 0**，完整覆盖六账号双叶领取/提交/退回重提/独立人类验收/父集成、通知隔离与处理、需求人工调整确认、六类材料、两种动效偏好、快速键盘取消和 epoch 草稿。健康能力代理只读及离线后恢复通过，原 5 秒内允许发送，精确 activity 和 [PG 评论唯一行](../.artifacts/acceptance/2026-10-26-v018/independent-final4b-9cc8f4d68eff4686bf10f2646de28926/compatibility-persisted-comment.json) 均验证成功；末段 viewer/outsider 修改拒绝及 outsider 详情拒绝已执行通过，最终父验收截图生成。健康代理仍只是旧能力响应模拟，不是旧服务二进制证据。

[运行摘要审计](../.artifacts/acceptance/2026-10-26-v018/independent-final4b-9cc8f4d68eff4686bf10f2646de28926-snapshot-audit.json) 确认 292 源码文件及七个生产资源执行前后完全一致，正式脚本仍为 f783。自有浏览器、代理、临时 app 与数据库连接全部关闭，随机库 `collaboration_acceptance_24289a4b130744eaa08f04826e92a249_test` 删除，无清理错误；日常 companion 未触碰。没有重复独立 native 9/9，也没有扩大为官方模型证据。

根集成随后串行完成 offline 与 appearance，均 exit 0，来源 292 文件及七资源前后不变；属于其他所有者证据，范围与限制见 [0.1.8 总验收](acceptance-0.1.8.md)，本记录不冒称独立执行。真实安装、官方模型生成/取消/续接、生产升级与发布仍未由本轮独立生产链验证，需分别验收及遵守既有授权。

## 上一轮协作基线历史记录

以下为上一轮协作基线记录，针对 2026-10-25 至 26 日当时的 `codex/collaborative-agent-workflows` 工作区源码，不是当前 0.1.8 候选证据。历史基线为 `dde5d2eabf77adf1a4347525d85046c1f44b0a4b`；该 SHA 不是当前候选或历史未提交改动的构建提交。历史验收没有创建公开 PR，没有发布或验证固定标签安装包。作者自测见[界面记录](acceptance-collaborative-ui.md)，下列为当时由独立验收者重新执行的结果。

## 历史环境与当前复现入口

以下历史结果使用 Windows、Node、缓存 Playwright Chromium；生产 `dist/web` 复制到忽略目录的静态快照后提供页面，防止并行构建替换资产。真实回环 HTTP、PostgreSQL 随机专用 `*_test` 数据库，结束删除数据库。数据安排通过合成账号 SQL/API，关键提交、退回、验收、收件箱及提案调整通过当时生产页面完成；历史核心闭环没有 route mock 或直接 SQL 写任务终态。旧输出及快照不得覆盖，原无参数命令已失效；当前入口如下，须等根集成确认最终新构建后执行：

```powershell
$env:TEST_DATABASE_URL = '<独立 PostgreSQL 的 *_test 数据库连接>'
$env:CI = '1'
$acceptanceId = [guid]::NewGuid().ToString('N')
$snapshotPath = ".artifacts/acceptance/2026-10-26-v018/web-final-$acceptanceId"
$evidencePath = ".artifacts/acceptance/2026-10-26-v018/independent-$acceptanceId"
if ((Test-Path -LiteralPath $snapshotPath) -or (Test-Path -LiteralPath $evidencePath)) { throw 'Refuse to overwrite acceptance evidence' }
Copy-Item -LiteralPath dist/web -Destination $snapshotPath -Recurse
node --import tsx scripts/check-collaboration.ts --candidate 0.1.8 --artifacts $evidencePath --web-snapshot $snapshotPath
```

`scripts/check-collaboration.ts` 自建随机数据库；额外 Vitest 检查也通过本机忽略目录 wrapper 自建新的随机库，未重建共享测试数据库的表。下方历史截图与 JSON 保存在 `.artifacts/collaborative-workflows/acceptance/`；新候选只使用上述新目录。未使用日常账号、浏览器、Codex 登录或真实草稿。

## 实际结果

| 检查                                 | 结果与证据范围                                                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 独立生产页面多人闭环                 | 通过；owner、Codex 实施者 A、Claude 实施者 B、不同人类 reviewer、viewer、无空间成员 outsider，共六个独立浏览器上下文。A/B 各有独立浏览器 device 和 Agent token。                                                                                           |
| 两个叶子独立处理                     | Agent token 分别以 codex-cli / claude-code 类型领取；明确断言 `run=null`、`runs=[]`。A UI 提交、reviewer UI 退回、A 重新领取及 UI 重提/验收；B 独立 UI 提交/验收。身份与领取不冒充真实 CLI 运行。                                                          |
| 独立父集成                           | 提前提交返回 REQUIRED_CHILDREN_NOT_DONE；两个子任务完成后父仍 todo；owner UI 提交集成后父仍未 done，reviewer 独立 UI 验收才 done。                                                                                                                         |
| 真实通知                             | A 退回只产生 A 的通知，B 不收到；B 操作 A 私有通知返回 404。A 生产 UI 已读后仍未处理，可稍后，再标处理，均持久化。截图已目视。                                                                                                                             |
| AI 需求提案                          | Agent 提案不改变已确认需求；Agent 确认返回 403。owner UI 显示当前/提议内容，调整后确认；真实库同时保留原提案与 confirmedPayload，需求升到 v2，v1 提交 409。                                                                                                |
| 人类及空间边界                       | reviewer 的 Agent token 验收返回 403；viewer 和 outsider 修改拒绝，outsider 详情拒绝。                                                                                                                                                                     |
| 真实 PG 领域与通知/自动化            | `vitest run tests/collaboration.integration.test.ts tests/collaboration-services.integration.test.ts`，16/16，23.87 秒。含新建/终态/归档阻塞区间、旧数据重复迁移、并发领取、依赖环、旧提案、收件箱精确租约与隔离、真实自动化多 worker 去重及实际区间统计。 |
| 真实 PG + 临时 companion + 受控 Node | `vitest run tests/agent-runs.integration.test.ts`，最终 6/6，51.34 秒；真实 server→companion→Node 协议进程，任务编辑导致回报冲突，取消后显式 sync，持久化 cancelled 与观察到的 session。没有手写 succeeded 代替进程。                                      |
| 受控进程及运行契约                   | `vitest run tests/agent-runners.test.ts tests/agent-run-contract.test.ts`，14/14，68.48 秒。真实 spawn、退出、保留子树取消、Claude 参数/结果检查、未知恢复、重新鉴权、会话续接和同步转换。                                                                 |

运行端到端项前两次分别在普通沙箱和升级执行下出现 90 秒整体超时，当时没有具体失败断言。第三次仅增加阶段诊断，没有修改断言、权限或 90 秒限时，全部通过：配置、登录、启动、取消、冲突同步、清理均完成，取消返回约 5.1 秒、随后同步约 3.1 秒、stop 约 7 毫秒。诊断行已移除。最终通过不能抹去前两轮时延不稳定；没有足够证据归因于业务错误。没有扫描终止其他 Node 或日常伴随服务。

生产页面扩展脚本曾因任务模态抽屉挡住工具栏而点击超时，改为先 Escape 关闭；提案 textarea 的精确 label 选择器也曾未匹配，改为按实际 label 选择。上述属于验收交互定位修正，未修改产品行为。

## 01–12 证据矩阵

| 项                | 本次独立证据                                                                     | 限制                                                                                     |
| ----------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 01 职责与权限     | 多账号负责人/实施者/reviewer；真实 PG 权限与参与进度测试                         | 未做大型团队长时使用观察                                                                 |
| 02 父子与人确认   | 必要子任务门禁、独立领取验收、父独立集成；领域真实 PG 提案与无环测试             | UI 拆分调整为作者浏览器测试，本次独立 UI 调整的是需求提案                                |
| 03 五状态与材料   | A 退回/重领；真实 PG 终态/重开/阻塞区间与材料权限                                | 所有状态组合的 UI 路径未逐一人工点验                                                     |
| 04 并行与交接     | A/B 独立 token/claim、报告与父集成；独立受控 runner 测试                         | 多浏览器身份协作，非单设备同 cwd 并行；无自动 worktree；没有公开 PR                      |
| 05 讨论与版本     | UI AI 原/提议差异、人工调整确认、原/确认 payload 和过期版本拒绝；PG 提及接收者   | 未逐一人工查看每种讨论通知文案                                                           |
| 06 收件箱         | 真实 PG 接收者、隔离、租约/去重/稍后/候选分页；UI read/snooze/handle             | 离线与真实系统弹窗由其他验收分列，本次未验证 OS 弹窗显示                                 |
| 07 本机执行       | 独立 PG companion + 真实 Node 进程；两协议 supervisor/恢复测试                   | 受控 synthetic 协议，不是官方模型工作成果；官方 CLI 空 home 探测见运行文档，不列独立通过 |
| 08 证据管理       | PG 材料权限回归；脚本保存报告 branch/基线 SHA、验证和限制                        | 未发布 PR，不制造 PR URL；基线 SHA 不代表工作区源码                                      |
| 09 定位视图       | 生产页面空间/task 深链；PG 个人关系/保存筛选与越权回归                           | 四种视图全部视觉状态未独立截图                                                           |
| 10 动效与可访问性 | 生产页面 reducedMotion=reduce、Escape、真实模态与收件箱目视                      | 四主题/窄屏证据见作者记录；人工读屏、200% 与完整键盘路线尚未独立验收                     |
| 11 原创图标       | 当前生产页面截图可见接力标识；源资产见设计记录                                   | 未独立安装；托盘/安装器/原生侧栏外观不列通过                                             |
| 12 自动化与区间   | 独立真实 PG 自动产生任务、多 worker 去重、停用、依赖/逾期/验收等待及区间指标测试 | 注入时钟是可控时间验证，不代表运行数日的墙钟观察                                         |

## 交付边界

最终完整扩展脚本 exit 0，额外验证了六种材料（PR、commit、截图、文档、测试、其他）通过真实 HTTP 新增、修订和软删除留痕，且拒绝 javascript URL（422）。各项明确写入验证范围和限制，不伪造公开 PR；材料管理属于 API 验证，未逐项点验 UI。扩展时修正了一处验收等待竞态：等待“已确认”会提前匹配“当前已确认内容”，改为等待确认按钮消失再读库。

独立追加 `vitest run tests/desktop.cli.test.ts`，3/3，2.45 秒，使用模拟传输检查本机能力键、错误码及 CLI 参数；与受控进程/运行契约的 14 项合计 17 项，不能把三项模拟传输写成真实 CLI 模型证据。目标 ESLint、全仓 `tsc --noEmit` 与 `git diff --check` 均 exit 0，最终脚本已格式化；根集成的完整 `pnpm check` 另记。

本次已证明真实多账号生产页面协作闭环和真实 PostgreSQL 权限/事务/自动化，以及受控 Node 进程的 supervisor 事实同步。官方 CLI 只在作者隔离空 home 中探测到未认证；没有调用付费模型或读取日常凭据，因此登录后的 Codex/Claude 模型实施、官方 CLI 真生成/取消/续接尚未验收。Rust、桌面 runtime、离线、外观、最终安装与发布包结论由根集成记录负责，不能从本记录推导为通过。
