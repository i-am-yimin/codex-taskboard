# 仓库维护

开发规则以 [CONTRIBUTING.md](../CONTRIBUTING.md) 为准；本页说明目录、分支和文档的持续维护方式。

## 目录与文档约定

- `apps/` 放可运行应用，`packages/` 放共享契约、适配器和 CLI；职责见[架构](architecture.md)，不为整理外观跨模块搬动业务代码。
- 根 README 介绍产品、下载与快速开始；完整操作放[使用手册](user-guide.md)，环境命令放[开发指南](development.md)，文档导航集中在[索引](README.md)。
- 产品与设计上下文保留在根 `PRODUCT.md`、`DESIGN.md`，供现有设计工具使用。ADR 按[决策索引](adr/README.md)递增维护。
- 每个版本单独保存验收结论；[验收索引](acceptance.md)指向当前基线。[交接入口](../HANDOFF.md)只保留继续工作必需的信息；实验流水进入 `docs/archive/`，保留日期和失败证据。
- 私有证据、Git 备份和诊断进入忽略的 `.artifacts/`；不清理日常 `.data/`、登录、聊天、真实草稿或其他 worktree。

## 分支生命周期

长期集成分支为 `main`。新任务从最新 `origin/main` 创建 `codex/<topic>`，一个分支对应一个可解释的改动；客户端、服务端发布通过固定标签管理，不长期保留每个版本的发布工作分支。

```sh
git status --short --branch
git fetch origin --prune
git switch -c codex/your-topic origin/main
```

推送工作分支并提交目标为 `main` 的 PR，按改动类型执行验证。`verify`、`container`、`windows-desktop` 的现有合并门禁和发布审批保持；不为了整理分支绕过失败检查。GitHub 开启合并后自动删除工作分支；未合并分支和 fork 分支仍需单独核对。

默认分支改名后的已有克隆，先检查并保存自己的未提交工作；原本就在旧默认分支上工作、且该本地分支没有独有提交时，可执行：

```sh
git fetch origin --prune
git branch -m codex/initial-implementation main
git branch --set-upstream-to=origin/main main
git switch main
git merge --ff-only origin/main
git remote set-head origin -a
```

本地旧默认分支若已删除，改用 `git switch --track origin/main`；已有 `main` 时使用现有分支，不覆盖它。其他功能分支继续保留，不能以默认分支改名为由重置或丢弃提交。

## 清理旧分支

清理依据是提交可达性、开放 PR 和 worktree 占用情况；分支名、年龄或 PR 已关闭都不能单独证明可以删除。先同步远端，再检查：

```sh
git status --short --branch
git fetch origin --prune
git worktree list
git branch --merged origin/main
git branch --no-merged origin/main
git branch -r --merged origin/main
```

逐个分支确认其 tip 是 `origin/main` 的祖先、没有开放 PR、没有 worktree 使用，且不属于默认或受保护分支。本地显示 ahead 的提交也须独立检查；squash / rebase 合并留下的非祖先分支保留，核对差异后另行处理，不用 `-D` 批量强删。

删除前在忽略目录记录完整分支名、tip SHA 和 worktree 列表，并创建 `git bundle create <本机备份路径> --all`，用 `git bundle verify <本机备份路径>` 确认可读取。备份可能含历史私有数据，只留在本机。

删除本地分支使用 `git branch -d <已核验分支>`。远端逐个使用带预期 SHA 的删除，避免删除核对后被别人推进的分支：

```sh
git push --force-with-lease=refs/heads/<分支>:<已核验完整SHA> origin :refs/heads/<分支>
git fetch origin --prune
```

这里的 lease 只允许在远端 tip 仍与已核验 SHA 一致时删除。发生变化立即停止并重新核对，不改成无条件 force；不删除发布标签、Release 或资产。恢复时可从 bundle 将原分支精确取回：

```sh
git fetch <本机备份路径> refs/heads/<原分支>:refs/heads/<原分支>
```

## 本次整理（2026-10-25）

基线为 `d37c2e8e97ce45132d4100664d03605643f1682c`。整理前远端有 25 个分支、无开放 PR，24 个旧工作分支及本地原有 24 个分支的 tip 均可从基线到达；工作区干净。默认分支由 `codex/initial-implementation` 改名为 `main`，其保护规则使用 `~DEFAULT_BRANCH`，随默认分支继续生效；发布标签保护保持。

清理前已保存完整 refs、worktree 清单和通过校验的 Git bundle，位于本机忽略目录 `.artifacts/repository-maintenance-20261025/`。保留两个现有 worktree、全部发布标签、资产与本机数据。文档整理在独立的 `codex/repository-maintenance` 分支提交，验证结果以该 PR 为准。

清理完成后，本地与远端各删除 24 个已合并旧分支，保留 `main` 和本次整理工作分支；已开启 PR 合并后自动删除工作分支。重新读取确认两条保护规则、10 个本地及远端标签、8 个 Release 和 35 项资产的固定标识、大小与摘要等记录保持一致。

本次文档检查包含相对链接、归档正文保留、版本与命令核对及 `git diff --check`。没有修改业务源码、依赖、数据库或安装包；未重跑产品单元测试、数据库集成、实机或最终包验收，现有 CI 的执行结果单独记录在 PR。

整理方式参考 [AppFlowy README](https://github.com/AppFlowy-IO/AppFlowy/blob/main/README.md) 将安装、开发与贡献分别引导，以及 [Vite 贡献指南](https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md) 集中说明工作区环境和验证；只借鉴组织方式，未复制代码、素材或引入其依赖与发布策略。
