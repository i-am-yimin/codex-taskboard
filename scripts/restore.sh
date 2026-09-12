#!/usr/bin/env sh
set -eu
backup="${1:?Usage: restore.sh backup.dump --confirm-restore}"
test "${2:-}" = "--confirm-restore" || { printf '%s\n' 'Restore replaces database contents. Back up first, then pass --confirm-restore.' >&2; exit 2; }
test -f "$backup"
# Check archive readability before touching the deployed database.
docker compose exec -T db pg_restore --list < "$backup" > /dev/null
docker compose stop app
# A fresh database also removes objects introduced after this backup.
# On failure leave the app stopped: never serve a partially restored database.
docker compose exec -T db dropdb -U taskboard --force --if-exists taskboard
docker compose exec -T db createdb -U taskboard -O taskboard taskboard
docker compose exec -T db pg_restore -U taskboard -d taskboard --exit-on-error --single-transaction < "$backup"
docker compose start app
