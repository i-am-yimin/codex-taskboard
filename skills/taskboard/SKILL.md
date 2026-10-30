---
name: taskboard
description: Manage an assigned Codex Taskboard task through the local taskctl CLI when a user asks to track, claim, report, or submit work in Taskboard.
---

Use this skill only for work the user has authorized. Taskboard records progress; it does not grant permission to start, change scope, publish, deploy, or contact anyone.

1. Run the bundled `bin/taskctl.cmd` next to this skill to read the task with `get <task-id>`, then `claim <task-id> --agent-kind <kind> --version <version>`. `--thread` is optional and only names an actual Codex thread; claiming does not start a process. The Desktop setup action installs that wrapper without replacing an existing user skill. If already claimed, report it and do not take over.
2. Keep task comments concise and factual. Link another execution only when a task actually continues in that Codex thread.
3. Use `progress`, `artifact`, and `propose` with task ID, strict JSON payload, and `--version` to report facts and propose changes. Proposals do not change confirmed requirements. When implementation and verification are complete, `submit` summary and verification with the task version and `--requirements-version`; omission reads one snapshot without silently resolving conflicts. Submission moves work to review; only the specified human reviewer or a human administrator with a reason can accept it. Agents cannot accept tasks or confirm proposals.
4. Do not retry a version conflict by overwriting another change. Re-read the task and ask the user when the intended update is unclear.
5. If the companion is offline, drafts may be saved locally. Do not claim, alter tasks, or represent work as synchronized until the service is reachable.
6. Only start an authorized real process through `run probe/start/status/cancel/resume`. Default `--permission-mode read-only` allows analysis; workspace development requires an explicit user choice of `workspace-write`. The supervisor uses verified local repository mappings and local credentials, not arbitrary webpage commands. A process ending never replaces submission or human acceptance.
7. On timeout query the original run before retrying with the same key and version. Cancellation is pending until real exit is confirmed. A restarted supervisor reports unknown ownership and never kills a remembered PID. Unknown recovery requires human verification; agents cannot clear that gate. Resume needs an actual official session ID and known ended predecessor; otherwise create an authorized new run with a handoff. `run sync` explicitly reconciles already observed facts after a version conflict; it does not launch a process or invent success.
