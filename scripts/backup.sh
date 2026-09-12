#!/usr/bin/env sh
set -eu
umask 077
destination="${1:-.artifacts/backups}"
mkdir -p "$destination"
backup=$(mktemp "$destination/taskboard-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")
partial=$(mktemp "$destination/.taskboard-backup-XXXXXX.partial")
trap 'rm -f "$partial" "$backup"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U taskboard -d taskboard -Fc > "$partial"
mv -f "$partial" "$backup"
trap - EXIT HUP INT TERM
printf 'Backup saved: %s\n' "$backup"
