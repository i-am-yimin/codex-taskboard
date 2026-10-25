# taskctl 与本机 Agent 运行

领取、真实进程、成果提交、人类验收是四件独立的事。`claim` 只取得独占实施权；`run start` 才启动 CLI；CLI 成功退出不会提交任务，也不会验收。

## 本机设置

运行器设置仅由本机 CLI 写入伴随服务数据目录的 `runners.json`。网页与服务器不能指定命令、PID、目录或凭据。先在看板设置中映射任务的 repository；启动前再次比较本机 Git origin 与任务仓库标识。每个伴随服务对同一仓库只有一个目录映射，不提供每次运行选择工作树或自动建工作树。同一规范工作目录同时只允许一个运行；并行叶子需由各自账号和设备映射独立目录，或使用不同仓库。重启后未知运行仍占用对应目录，直到人工核查并解除。

```powershell
taskctl run configure codex-cli 'C:\tools\node_modules\@openai\codex\bin\codex.js' 'C:\TaskboardAgent\codex-home'
taskctl run configure claude-code 'C:\tools\claude.exe' 'C:\TaskboardAgent\claude-home' --auth-mode cli-login
taskctl run probe
```

Codex 的官方 npm `bin/codex.js` 会解析到其官方平台包原生程序，实际进程直接由伴随服务创建；不运行 npm `.cmd`/`.ps1` 包装器。Claude 配置原生 `claude.exe`。仅 Codex CLI **0.164.0**、Claude Code **2.1.310** 完成当前协议核对；其他版本明确显示未验证。探测执行版本与本机认证状态命令，不调用模型。缺程序、未配置、版本未支持、未认证、探测错误分别呈现。

Codex 登录由用户在专用 `CODEX_HOME` 自行完成。Claude 默认 `cli-login` 模式使用专用 `CLAUDE_CONFIG_DIR`，保留订阅/CLI 登录；该模式不传 `--bare`。用户需在相同专用目录配置环境后自行运行官方 `claude auth login`。伴随服务不复制日常登录。

Claude 也支持显式 `--auth-mode api-key --api-key-stdin`。密钥从标准输入写入本机 SecretStore（Windows DPAPI），只注入对应子进程，不上传服务器、不返回网页、不进入日志。API-key 模式使用 `--bare`，不读取 OAuth 或 keychain。不要将密钥放进参数或命令历史。两种模式的计费与登录方式由用户自行选择，Taskboard 不代为登录或购买。

子进程环境只继承系统运行所需的明确键名白名单，另外设置专用 HOME/USERPROFILE/APPDATA/LOCALAPPDATA 及 CLI home。父 Agent 的 OpenAI、Anthropic、云厂商和 Taskboard 凭据不会继承。CLI 自己在专用配置目录中的权限与安全检查仍生效。

## Agent 操作

命令输出 JSON；失败在 stderr 输出 `{ok:false,error:{code,message,details}}` 并给非零退出码。权限20/21、找不到22、冲突23、离线24、输入25、远程26、运行能力27。重试写操作必须同时复用原 `--idempotency-key` 与原 `--version`。冲突不能自动改为最新版本重放原意图。

```text
taskctl get <taskId>
taskctl claim <taskId> --agent-kind claude-code --version <version>
taskctl progress <taskId> '{"progress":40,"summary":"已完成接口"}' --version <version>
taskctl artifact <taskId> '{"kind":"test","title":"验证","text":"结果","verificationScope":"源码单测","limitations":"未做实机"}' --version <version>
taskctl propose <taskId> '{"kind":"decision","payload":{"body":"建议"}}' --version <version>
taskctl run start <taskId> <claimId> codex-cli --permission-mode read-only --version <version>
taskctl run status <taskId> <runId>
taskctl run cancel <taskId> <runId>
taskctl run sync <taskId> <runId>
taskctl run resume <taskId> <claimId> codex-cli --from <previousRunId> --permission-mode read-only --version <version>
taskctl submit <taskId> <summary> <verification> --version <version> --requirements-version <requirementsVersion>
```

原 list/get/create/update/comment/link/claim/release/submit 保留。`claim --thread` 可选，线程与 Agent 类型独立；`link --thread` 仅关联实际线程。新增 submit 需要需求版本；省略 `--requirements-version` 时 CLI 先读一次快照，服务器仍检查需求版本与原任务版本，不静默覆盖冲突。Agent CLI 没有验收或人类提案确认命令。验收只允许指定 reviewer，或提供理由的管理员人类。

## 权限、取消与恢复

默认 **只读分析**：不能声称已允许实现文件修改。用户显式选择 `workspace-write` 才允许工作区开发：Codex 新运行传标准 `--sandbox workspace-write`，续接传相应 `sandbox_mode` 配置；Claude 传标准 `--permission-mode acceptEdits`。Claude 只读传 `plan`。不使用危险跳过权限或全盘开放参数。

Claude 开发模式的测试工具仍按默认权限拒绝未授权工具。可在本机 configure 用 `--test-commands` JSON 数组明确允许 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build`、`npm test`、`cargo test` 中所需的精确命令；使用标准 `--allowedTools Bash(...)`。网页不能传任意工具规则。权限不足应报告实际限制，不能自动提权。

成功必须同时有退出码0和官方成功结果事件；Codex `turn.failed`、Claude `result.is_error` 或缺少结果均不算成功。CLI 输出正文不持久化，避免将用户数据或凭据写入公共日志；记录安全错误类别和退出码。

取消只使用本实例持有的 ChildProcess。Windows 额外保存创建时间与原生路径，在终止前重新核对，再终止该根进程的子树；不接受外来 PID，不扫描杀进程。取消请求和真实退出独立确认，命令成功回执缺失或未退出时不显示已取消。伴随服务重启后不根据旧 PID 夺回控制，活动记录变为 `unknown`；不自动重启。

未知记录阻塞提交、释放和重复启动。人类在原设备核查进程已停止，填写理由并明确勾选确认后，可解除阻塞；原 phase 仍为 unknown，并保留确认人、时间与理由，不能伪称进程成功或取消。Agent token 无此能力。解除后查询原运行，使本机目录锁同步这一人类确认。

恢复必须有官方 session ID、同设备的已结束前序运行以及当前有效领取，产生新的 run；不使用 `--last`、不猜会话。未知运行不能恢复，需核查或带交接新运行。运行观察超时先查询原 run，重试沿原键与版本，不启动第二份。

运行事实写入 outbox 保留原版本、幂等键、账号和浏览器/Agent 凭据类型；不会把离线领取排队。并发任务编辑引起冲突时，UI 标明尚未同步。`run sync` 是显式新意图：先按原键/版本核对未确认回报，再按当前快照沿合法状态路径同步已观察事实；未知/不可变终态不同则明确拒绝，保留人工核查入口。

## 证据范围与来源

受控子进程测试使用独立 Node 进程模拟两种官方事件，验证真实 spawn/退出/子树取消、幂等、会话续接参数与重启未知；它不是模型成功执行证据。服务端测试在独立 `agent_runtime_test` PostgreSQL 验证权限、设备、版本/幂等、状态门禁与人工解除审计。

官方 CLI 在新空 home 下已执行 `--version`、Codex `login status`、Claude `--bare auth status --json`，实际返回未认证；子进程参数白名单强制禁止生成命令，并核对环境键不含凭据。真实生成负路径曾被自动审批拒绝，后续没有重试该动作。未使用真实凭据、未调用付费模型，因此登录后的真实开发、模型成功、真实CLI取消/续接与最终安装包仍需单独授权验收，不能写成已通过。

官方资料：

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex CLI commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
- [Claude Code headless](https://code.claude.com/docs/en/headless)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code credential isolation](https://code.claude.com/docs/en/authentication#credential-management)
