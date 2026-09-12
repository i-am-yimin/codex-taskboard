# Codex Taskboard

[简体中文](README.md) · [Handoff](HANDOFF.md) · [Architecture](docs/architecture.md) · [Deployment](docs/deployment.md) · [Acceptance record](docs/acceptance.md)

A collaborative task layer for Codex Desktop. Share task intent, progress, and review across devices and trusted teams while Codex continues to own local projects and conversations.

**0.1.0 development preview.** Browser demonstrations, database tests, and actual desktop compatibility are separate acceptance gates. An unverified desktop build is not a stable release.

Features include isolated customizable spaces, role-based membership, board and list views, task details and activity, optimistic concurrency, idempotent writes, and server-side synchronization. The Windows companion maps repository identities to local folders and protects device credentials. Agents use a bundled Skill and task CLI. **Codex sidebar embedding and project draft navigation are not currently supported; the Windows installer has not passed acceptance.**

![Board preview](docs/screenshots/board-light.png)

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

The latest desktop source adds server setup to the sign-in screen: enter your server's HTTPS root URL, save it, then sign in. Local development also accepts loopback HTTP. The address persists on the device; explicit startup configuration or an existing device session locks editing. Changing the address never automatically signs out or deletes local work. The previously generated installer does not contain this update; rebuilding and installed-app acceptance are still pending. See the [desktop guide](docs/desktop.md).

`test:offline` requires a production Web build and an isolated test database. It closes the browser and starts its persistent profile offline, then verifies read-only restoration and revocation cleanup. Browser offline startup requires a prior connected visit that successfully cached the app shell.

Contributions through issues and fork PRs are welcome. Repository merges, tags, and releases remain under @i-am-yimin's control. Automation prepares build artifacts and draft releases only.

MIT licensed, independently implemented. Product inspiration: [dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard). This community project is not an official OpenAI product.
