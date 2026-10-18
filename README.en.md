# Codex Taskboard

[简体中文](README.md) · [Handoff](HANDOFF.md) · [Architecture](docs/architecture.md) · [Deployment](docs/deployment.md) · [Acceptance record](docs/acceptance.md)

A collaborative task layer for Codex Desktop. Share task intent, progress, and review across devices and trusted teams while Codex continues to own local projects and conversations.

**0.1.0 development preview.** The accepted `v0.1.0` candidate is fixed at `f6a363e`. All G0–G4 gates passed on October 18, 2026, covering installed Windows applications, Codex sidebar embedding and safe drafts, two-device collaboration, and Linux deployment. **The Windows installer is unsigned; the release remains a draft.** See the [0.1.0 acceptance summary](docs/acceptance-0.1.0.md) for evidence and scope.

Features include isolated customizable spaces, role-based membership, board and list views, task details and activity, optimistic concurrency, idempotent writes, and server-side synchronization. The Windows companion maps repository identities to local folders and protects device credentials. Agents use a bundled Skill and task CLI. **Sidebar embedding, responsive layouts, and unsent project drafts passed installed-app acceptance with Codex 26.1007.9446.0.** Unknown host versions or unverified process, project, and editor identities are refused. Drafts are never sent or claimed automatically. Historical conversation navigation (`openThread`) remains unavailable.

![Board preview](docs/screenshots/board-light.png)

## Compatibility

| Component | Accepted scope |
| --- | --- |
| Browser | Chrome; board and list views, cached read-only offline views |
| Server | Linux amd64 / PostgreSQL 16+; deployment, backup/restore and upgrade rollback; HTTPS with an internal CA |
| Desktop | Windows x64; two installed applications; unsigned development preview |
| Codex host | 26.1007.9446.0 full installed-app baseline; other exact versions have separately recorded evidence |

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
