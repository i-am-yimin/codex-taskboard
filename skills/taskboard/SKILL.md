---
name: taskboard
description: Manage an assigned Codex Taskboard task through the local taskctl CLI when a user asks to track, claim, report, or submit work in Taskboard.
---

Use this skill only for work the user has authorized. Taskboard records progress; it does not grant permission to start, change scope, publish, deploy, or contact anyone.

1. Run the bundled `bin/taskctl.cmd` next to this skill to read the task with `get <task-id>`, then claim it with the current `CODEX_THREAD_ID` before beginning work. The Desktop setup action installs that wrapper without replacing an existing user skill. If it is already claimed, report that condition and do not take it over.
2. Keep task comments concise and factual. Link another execution only when a task actually continues in that Codex thread.
3. When implementation and relevant verification are complete, submit a summary and verification using the current task version. Submission moves the work to review; only a human editor accepts it.
4. Do not retry a version conflict by overwriting another change. Re-read the task and ask the user when the intended update is unclear.
5. If the companion is offline, drafts may be saved locally. Do not claim, alter tasks, or represent work as synchronized until the service is reachable.
