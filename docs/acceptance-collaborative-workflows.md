# 协作工作流独立验收

本记录针对 2026-10-25 至 26 日验证时的 `codex/collaborative-agent-workflows` 工作区候选源码，最终来源以本轮提交为准。基线为 `dde5d2eabf77adf1a4347525d85046c1f44b0a4b`；基线 SHA 不是本轮改动的构建提交。没有创建公开 PR，没有发布或验证固定标签安装包。作者自测见[界面记录](acceptance-collaborative-ui.md)，下列结果由独立验收者重新执行。

## 环境与复现

Windows、Node、缓存 Playwright Chromium；生产 `dist/web` 复制到忽略目录的静态快照后提供页面，防止并行构建替换资产。真实回环 HTTP、PostgreSQL 随机专用 `*_test` 数据库，结束删除数据库。数据安排通过合成账号 SQL/API，关键提交、退回、验收、收件箱及提案调整通过当前生产页面完成；没有 route mock 或直接 SQL 写任务终态。

```powershell
$env:TEST_DATABASE_URL = '<独立 PostgreSQL 的 *_test 数据库连接>'
$env:CI = '1'
# 先 pnpm build；保留本次静态快照，目录仅用于本次验收
Copy-Item -LiteralPath dist/web -Destination .artifacts/collaborative-workflows/acceptance/web -Recurse -Force
node --import tsx scripts/check-collaboration.ts
```

`scripts/check-collaboration.ts` 自建随机数据库；额外 Vitest 检查也通过本机忽略目录 wrapper 自建新的随机库，未重建共享测试数据库的表。截图与 JSON 只保存在 `.artifacts/collaborative-workflows/acceptance/`，未使用日常账号、浏览器、Codex 登录或真实草稿。

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
