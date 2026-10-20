#!/usr/bin/env bash
# Disposable test project; never select or remove an existing deployment's volumes.
set -euo pipefail
umask 077
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
nonce="$(date +%s)-$$"
project="tbmanaged$nonce"
artifacts="$root/.artifacts/openresty-test-$nonce"
mkdir -p "$artifacts"
export COMPOSE_DISABLE_ENV_FILE=1
export COMPOSE_ENV_FILES="$artifacts/empty.env"
export COMPOSE_PROJECT_NAME="$project"
export COMPOSE_FILE="$root/compose.openresty.yaml"
export TASKBOARD_IMAGE="taskboard-managed-test-$nonce"
export TASKBOARD_VERSION=test
export TASKBOARD_PORT="${OPENRESTY_TEST_PORT:-47835}"
: > "$COMPOSE_ENV_FILES"
cleanup() {
  docker compose ps > "$artifacts/compose-ps.log" 2>&1 || true
  docker compose logs --no-color 2>&1 | sed -E 's/(Taskboard first-run setup token: )[a-fA-F0-9]{64}/\1[REDACTED]/g' > "$artifacts/compose.log" || true
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker build -t "$TASKBOARD_IMAGE:$TASKBOARD_VERSION" .
docker compose up -d --wait --wait-timeout 180
api="http://127.0.0.1:$TASKBOARD_PORT/api/v1"
curlx() { curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$@"; }
curlx "$api/health" | jq -e '.data.status=="ok"' >/dev/null
curlx "$api/setup" | jq -e '.data.required==true' >/dev/null
token=$(docker compose exec -T app node -e "process.stdout.write(require('fs').readFileSync('/var/lib/taskboard/setup-token','utf8'))")
payload=$(jq -n --arg token "$token" --arg origin "http://127.0.0.1:$TASKBOARD_PORT" '{token:$token,publicOrigin:$origin,email:"managed@example.test",name:"Managed Owner",password:"managed-test-password-2026"}')
curlx -X POST "$api/setup" -H 'content-type: application/json' --data "$payload" | jq -e '.data.initialized==true' >/dev/null
curlx -X POST "$api/auth/login" -H 'content-type: application/json' --cookie-jar "$artifacts/session.cookie" --data '{"email":"managed@example.test","password":"managed-test-password-2026"}' >/dev/null
curlx "$api/admin/instance" --cookie "$artifacts/session.cookie" | jq -e '.data.database.managed==true and .data.database.status=="ok"' >/dev/null
curlx "$api/admin/logs" --cookie "$artifacts/session.cookie" | jq -e '.data.entries | length>0' >/dev/null
database_secret=$(docker compose exec -T app node -e "process.stdout.write(require('fs').readFileSync('/var/lib/taskboard/postgres-password','utf8'))")
# The API's direct host port must be loopback-only; PostgreSQL has no published port.
docker inspect "$(docker compose ps -q app)" --format '{{json .HostConfig.PortBindings}}' | \
  jq -e --arg port "$TASKBOARD_PORT" '. == {"47830/tcp":[{"HostIp":"127.0.0.1","HostPort":$port}]}' >/dev/null
docker inspect "$(docker compose ps -q db)" --format '{{json .HostConfig.PortBindings}}' | \
  jq -e '(. // {}) | length == 0' >/dev/null
backup=$(sh scripts/backup.sh "$artifacts" | sed -n 's/^Backup saved: //p')
docker compose down
docker compose up -d --wait --wait-timeout 180
curlx "$api/setup" | jq -e '.data.required==false' >/dev/null
curlx "$api/admin/instance" --cookie "$artifacts/session.cookie" | jq -e '.data.database.status=="ok"' >/dev/null
test "$database_secret" = "$(docker compose exec -T app node -e "process.stdout.write(require('fs').readFileSync('/var/lib/taskboard/postgres-password','utf8'))")"
sh scripts/restore.sh "$backup" --confirm-restore
docker compose up -d --wait --wait-timeout 180
curlx "$api/admin/instance" --cookie "$artifacts/session.cookie" | jq -e '.data.database.status=="ok"' >/dev/null
echo 'Managed first-run, loopback binding, admin access, restart, stable secrets, backup and restore passed.'
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'image=%s\n' "$TASKBOARD_IMAGE:$TASKBOARD_VERSION" >> "$GITHUB_OUTPUT"
fi
