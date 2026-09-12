# Deployment verification record

## Prepared isolated Docker acceptance environment

The Windows host has no Docker, Podman, nerdctl, WSL distribution, Hyper-V VM, or configured remote container endpoint. A local mock would not exercise the deployment path, so acceptance is prepared for a disposable Debian 12 QEMU guest.

| Artifact | Source and verification |
| --- | --- |
| QEMU 11.1.0 Windows runtime | Official Windows build installer, downloaded to `.artifacts/qemu/qemu-w64-setup-20260811.exe`; publisher SHA-512 was downloaded and matched. The installer was extracted into `.artifacts/qemu/runtime-full` using an administratively extracted 7-Zip MSI, with no QEMU system installation. `qemu-system-x86_64.exe --version` reports 11.1.0. |
| Debian 12 generic cloud image | Official `debian-12-genericcloud-amd64.qcow2`; publisher `SHA512SUMS` matched. `qemu-img info` reports a 3 GiB qcow2 image. |
| NoCloud configuration | An artifact-only FAT16 volume labelled `CIDATA`, with `user-data`, `meta-data`, and `network-config`. 7-Zip listed the three exact names and the image SHA-256 is `D7615CB406B97714FEDC4F9A57568437C393069C30C2D3871FA147D3CCD9D1B8`. It provisions the temporary SSH-key-only `taskboard` user. |

The 7-Zip MSI was downloaded from the official winget manifest URL and its SHA-256 matched the manifest. It was administratively extracted into `.artifacts` to obtain `7z.exe`; this is not a product installation. No claim is made here about system registration beyond that extraction method.

## Execution status

The first disposable VM boot exposed that the downloaded cloud image's 3 GiB virtual disk was insufficient for the planned 2 GiB swapfile and Docker images. Its overlay and serial log were retained for diagnosis; the official base image was not changed. A separate 20 GiB disposable overlay then booted with TCG, 1024 MiB guest RAM, two vCPUs, QEMU's built-in entropy device, and loopback-only SSH (`127.0.0.1:22222`) plus loopback-only QMP (`127.0.0.1:22223`). The guest detected the 20 GiB disk and automatically expanded its root filesystem from 753,408 to 5,210,107 blocks.

That second boot completed NoCloud successfully and installed the intended public key, but its original local private key was later verified to use OpenSSH `aes256-ctr` with `bcrypt` KDF. The VM was cleanly shut down through QMP after the diagnosis; its 20 GiB overlay and serial log were retained. A replacement artifact-only key was verified to use the OpenSSH `none` cipher/KDF and applied with a new NoCloud instance identity. Authenticated SSH then succeeded against the same 20 GiB overlay. The table above records the initial seed, not the replacement seed's checksum.

The guest has an active 2 GiB swapfile and guest-only HTTP(S) proxy configuration through `10.0.2.2:7890`. Docker installation completed: `systemctl is-active docker` reports `active`, Docker Engine reports `29.8.0`, and Docker Compose reports `v5.5.1`. This verifies the test infrastructure, not application deployment.

The actual source snapshot was selected using Git's tracked and non-ignored untracked file inventory, with explicit checks rejecting local data, credentials, build outputs, toolchains, and generated runtime directories. The resulting gzip archive contains 128 files and is approximately 3.2 MB. It was transferred and extracted into the disposable guest. An earlier broad 164 MB archive was not extracted or used for the deployment test.

**Current status:** the HTTP Compose deployment, backup/restore, restart exercise, and internal-CA HTTPS exercise have passed with cleanup exit 0. The guest has powered off and QEMU exited. Windows release testing has resumed.

## Current deployment attempts

- Attempt 1: Buildx authentication failed on a direct registry connection; the guest client was updated with HTTP(S) proxy settings.
- Attempt 2: the legacy deploy path was found to force a non-frozen installation and was proactively stopped.
- Attempt 3: the registry connection reset during image retrieval.
- Attempt 4 (historical): retry reused the initial frozen dependency cache. Linux Web/Node build completed, and `CI=true pnpm install --prod --frozen-lockfile --offline` completed in 176 seconds; its log states that the resolution step was skipped. The image built, exported, and unpacked successfully as `sha256:227fcbb6f9fe9dfdc0447af1e1dc31569a2a1c17f9c2fee551c3a364aade0bbd`, but the app health check repeatedly exited with `Health check exceeded timeout (5s)`. Logs contained no specific application exception. Attempt 5 later passed the HTTP exercise using this image.

The safe source snapshot contains 128 files and is approximately 3.2 MB. It predates this round's adapter exact-target-binding changes; that omission does not affect the server deployment source, but this deployment attempt cannot accept those desktop adapter changes. The PostgreSQL health check previously used a Unix socket and could report a temporary initialization database healthy; it now uses TCP. A real Linux image check loaded Node 22.16 x64 dependencies and completed an Argon2 64 MiB/3-pass hash verification in 49,897 ms; this is not an application-login latency result. Debian validated `sh -n`, default/slow isolation, and loopback HTTPS Compose configuration.

Attempt 5 reused `sha256:227fcbb6f9fe9dfdc0447af1e1dc31569a2a1c17f9c2fee551c3a364aade0bbd` with `TASKBOARD_TEST_REUSE_IMAGE=1` and `TASKBOARD_TEST_SLOW=1`. The runner exit record is 0 and reports `Disposable Compose deployment, restart, backup, and restore verified (tbdeploy1788847321-5794)`. It verified health, bootstrap/login, space and task creation, backup followed by modification, restore into a clean database, restart, restored title/space name, and removal of the backup marker; cleanup completed. Evidence is retained at guest `/tmp/taskboard-deployment-attempt5.log`, `/tmp/taskboard-deployment-attempt5.exit`, `.artifacts/deployment-test-1788847321-5794/`, and locally at `.artifacts/vm/taskboard-deployment-attempt5.log`. This is an explicit slow/reuse acceptance run, not proof of default timing or a two-second SLA.

HTTPS attempt1 confirmed Docker proxy injection caused internal Caddy-to-app 502 responses; a proxy-cleared direct `wget http://app:47830/api/v1/health` returned 200. Its cleanup completed, then root killed the runner after the old signal trap continued polling; exit 137 is not an acceptance result. The updated Compose/scripts passed Astra review and guest `sh -n` plus preflight (exit 0, 49475). HTTPS attempt2 (`tbhttps1788849438-11015`) completed all assertions and cleanup with runner exit 0; tail session 2341 also closed exit 0 and printed `0`. It verified internal-CA HTTPS, redirect, Secure cookie, and two proxied SSE reconnects. Each SSE curl exited 28 at its intended 45-second bound after receiving 327 bytes; subsequent event and final-board assertions passed. Evidence is guest `.artifacts/https-test-1788849438-11015` and local `.artifacts/vm/taskboard-https-attempt2.log`. The test uses an internal CA and loopback `curl --resolve`/request-specific `--cacert`, not public Let's Encrypt. It does not establish default timing or a two-second SLA.

The first HTTPS run found that Docker client proxy configuration was injected into Caddy and its `NO_PROXY` omitted Compose services, causing internal `app:47830` health traffic to receive 502. `compose.yaml` now explicitly excludes `app`, `db`, and loopback addresses while retaining any user-supplied `NO_PROXY` values; outbound proxy configuration remains available for certificate retrieval. The interrupted run cleaned up; the corrected retry later passed with cleanup exit 0.
