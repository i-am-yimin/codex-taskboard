# Codex Taskboard

[简体中文](README.md) · [Handoff](HANDOFF.md) · [Architecture](docs/architecture.md) · [Deployment](docs/deployment.md) · [Acceptance record](docs/acceptance.md)

A collaborative task layer for Codex Desktop. Share task intent, progress, and review across devices and trusted teams while Codex continues to own local projects and conversations.

**0.1.3 daily Codex preview.** Connect the normal Codex environment and retain its sign-in, projects and chats. Exact host `26.1016.8622.0`, the fixed-tag installer, real upgrades, sidebar, concurrent connection, normal exit and same-process reconnection passed acceptance; see [0.1.3 acceptance](docs/acceptance-0.1.3.md). **The Windows installer is unsigned; 0.1.3 is a public pre-release.** Earlier tags and assets remain unchanged.

## Getting started

[Download the Windows x64 client 0.1.3](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.3/Codex.Taskboard_0.1.3_x64-setup.exe) and [SHA256SUMS](https://github.com/i-am-yimin/codex-taskboard/releases/download/v0.1.3/SHA256SUMS), or visit the [release page](https://github.com/i-am-yimin/codex-taskboard/releases/tag/v0.1.3). GitHub sign-in is not required. Installer SHA-256: `07948800bb32757e2acd904b9b6c28d41e8931334bf666b56696565200ba3f9d`.

The server is versioned independently as **0.1.2-preview.1**, published as `ghcr.io/i-am-yimin/codex-taskboard:server-0.1.2-preview.1` from source tag `vserver-0.1.2-preview.1`. Its version comes from `apps/server/package.json`; the Windows Taskboard client is **0.1.3** with its existing release process. Updating the server does not change the client version.

The [step-by-step user manual in README](README.md#使用手册) covers server deployment, installation, sign-in, repository mapping, Codex integration, Agent CLI access, review, upgrades and troubleshooting. New server deployments can use [prebuilt images, browser setup and host OpenResty](docs/deployment-openresty.md): the application binds to host loopback, secrets persist in a volume, and browser administrators can manage their account, settings and logs. This requires an image built from the new code; the fixed 0.1.1 image does not support managed setup.

1. Obtain a running Taskboard HTTPS server and an administrator-created account or invitation. Installing the desktop app does not create a hosted server or account.
2. Install the Windows x64 package, verify `SHA256SUMS`, save the server root URL on the sign-in screen, then sign in. The installer bundles Node; system Node and pnpm are not required for desktop use.
3. Map the repository to an existing local folder. Under Settings → Connections and devices, choose “接入日常 Codex”. Save and normally exit Codex once if connection was not enabled, then reopen the same environment. Create and keep using the “Codex（任务看板连接）” Start menu shortcut; the original ChatGPT/Codex icon does not add connection parameters.
4. Agent writes require a separate bundled CLI login. The default Skill installer does not automatically pair the isolated Codex environment; its inherited `TASKBOARD_*` variables are removed. Follow the manual's absolute CLI/Skill path instructions rather than assuming the default Skill wrapper works.
5. In daily mode, copy the task draft and paste it into the intended Codex project, review it, and send it yourself. The independent test environment retains automatic draft filling. Reading and atomically claiming precede Agent work; submitted results require human acceptance. Draft creation does not send a message or claim a task.

Offline views are cached read-only data, not a complete offline task manager. Use the same reachable server across devices, with a local project mapping and CLI login on each. The client release workflow distributes a Linux Docker archive; the independently versioned server image is published separately.

Features include isolated customizable spaces, role-based membership, board and list views, task details and activity, optimistic concurrency, idempotent writes, and server-side synchronization. The Windows companion maps repository identities to local folders and protects device credentials. Agents use a bundled Skill and task CLI. **Sidebar embedding, responsive layouts, and unsent project drafts passed installed-app acceptance with Codex 26.1007.9446.0.** Unknown host versions or unverified process, project, and editor identities are refused. Drafts are never sent or claimed automatically. Historical conversation navigation (`openThread`) remains unavailable.

![Board preview](docs/screenshots/board-light.png)

## Compatibility

| Component  | Accepted scope                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser    | Chrome; board and list views, cached read-only offline views                                                                                         |
| Server     | Linux amd64 / PostgreSQL 16+; deployment, backup/restore and upgrade rollback; HTTPS with an internal CA                                             |
| Desktop    | Windows x64; two installed applications; unsigned development preview                                                                                |
| Codex host | 26.1016.8622.0 daily environment checked with 0.1.3; 26.1013.4894.0 checked with 0.1.1; 26.1007.9446.0 full 0.1.0 baseline; unknown versions refused |

Acceptance applies to the fixed candidate and the environments recorded in the summary. Later source merges run their own CI. Full Codex conversations are not synchronized across devices. Automatic task scheduling, GitHub data synchronization, and full offline editing are outside the first release.

## Preview

Requires Node.js 22.16+ and pnpm 10.28.0.

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

Open [the interactive demo](http://127.0.0.1:4173/?demo=1). Its synthetic data does not access a real account or execute agent work.

## Run

Configure `.env` from `.env.example` with a PostgreSQL connection, a random 32-byte hexadecimal session key, and the public origin.

```sh
pnpm db:migrate
pnpm admin bootstrap --email owner@example.com --name Owner
pnpm dev
```

Provide the administrator password through standard input or the documented environment variable. Registration is invitation-only. Use Docker Compose with Caddy HTTPS for production; see the deployment guide for backup, restore, and upgrade procedures.

```sh
pnpm exec playwright install chromium
pnpm check
pnpm test:db
pnpm test:e2e
pnpm test:offline
pnpm desktop:diagnose
```

The task database is authoritative. Offline mode preserves cached views and drafts; it does not claim new work. Agent results enter review; a human accepts completion. CLI/MCP adapters, additional desktop platforms, and GitHub data synchronization are future extensions.

The desktop sign-in screen provides server setup: enter your server's HTTPS root URL, save it, then sign in. Local development also accepts loopback HTTP. The address persists on the device; explicit startup configuration or an existing device session locks editing. Changing the address never automatically signs out or deletes local work. The accepted Windows installer includes this setup screen and passed testing on two Windows devices. See the [desktop guide](docs/desktop.md).

`test:offline` requires a production Web build and an isolated test database. It closes the browser and starts its persistent profile offline, then verifies read-only restoration and revocation cleanup. Browser offline startup requires a prior connected visit that successfully cached the app shell.

Contributions through issues and fork PRs are welcome. Repository merges, tags, and releases remain under @i-am-yimin's control. Automation prepares build artifacts and draft releases only.

MIT licensed, independently implemented. Product inspiration: [dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard). This community project is not an official OpenAI product.
