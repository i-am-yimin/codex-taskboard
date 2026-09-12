#!/usr/bin/env sh
# Runs only against a disposable Docker Compose project. It never reads a
# deployment's .env, Compose project name, or volumes.
set -eu
umask 077

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
command -v docker >/dev/null
command -v curl >/dev/null
command -v jq >/dev/null

nonce=$(date +%s)-$$
project="tbdeploy${nonce}"
port="${DEPLOYMENT_TEST_PORT:-47832}"
slow="${TASKBOARD_TEST_SLOW:-0}"
reuse="${TASKBOARD_TEST_REUSE_IMAGE:-0}"
case "$slow" in 0|1) ;; *) echo 'TASKBOARD_TEST_SLOW must be 0 or 1' >&2; exit 2;; esac
case "$reuse" in 0|1) ;; *) echo 'TASKBOARD_TEST_REUSE_IMAGE must be 0 or 1' >&2; exit 2;; esac
# Never accept a caller-selected cleanup target. This test only removes its
# generated child of this repository's artifact directory.
artifacts="$root/.artifacts/deployment-test-$nonce"
mkdir -p "$artifacts"
env_file="$artifacts/compose.env"
: > "$env_file"
export COMPOSE_PROJECT_NAME="$project"
export COMPOSE_FILE="$root/compose.yaml:$root/deploy/compose.deployment-test.yaml"
if [ "$slow" = 1 ]; then COMPOSE_FILE="$COMPOSE_FILE:$root/deploy/compose.slow-test.yaml"; fi
# Disable the repository .env and explicitly select an empty Compose env file.
# These exports are inherited by backup.sh and restore.sh as well.
export COMPOSE_DISABLE_ENV_FILE=1
export COMPOSE_ENV_FILES="$env_file"
export DEPLOYMENT_TEST_PORT="$port"
export POSTGRES_PASSWORD='deployment-test-postgres-password'
export SESSION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export DOMAIN='deployment-test.invalid'

cleanup() {
  docker compose ps > "$artifacts/compose-ps.log" 2>&1 || true
  docker compose logs --no-color > "$artifacts/compose.log" 2>&1 || true
  container=$(docker compose ps -aq app 2>/dev/null || true)
  test -z "$container" || docker inspect --format '{{json .State.Health}}' "$container" > "$artifacts/health-history.json" 2>/dev/null || true
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

api="http://127.0.0.1:$port/api/v1"
curlx() {
  if [ "$slow" = 1 ]; then curl --connect-timeout 10 --max-time 120 "$@"; else curl --connect-timeout 2 --max-time 5 "$@"; fi
}
wait_for_health() {
  attempt=0
  deadline=$(( $(date +%s) + 900 ))
  while :; do
    if [ "$slow" = 1 ]; then remaining=$(( deadline - $(date +%s) )); [ "$remaining" -gt 0 ] || break; max=$remaining; [ "$max" -le 30 ] || max=30; else max=5; fi
    if curl --connect-timeout "$( [ "$slow" = 1 ] && echo 10 || echo 2 )" --max-time "$max" --fail --silent --show-error "$api/health" >> "$artifacts/health-probe.log" 2>&1; then return; fi
    attempt=$((attempt + 1))
    if { [ "$slow" = 0 ] && [ "$attempt" -ge 60 ]; } || { [ "$slow" = 1 ] && [ "$(date +%s)" -ge "$deadline" ]; }; then
      docker compose ps >&2 || true
      docker compose logs --no-color >&2 || true
      return 1
    fi
    sleep 1
  done
  return 1
}
json() { jq -er "$1"; }

# `up --build` produces a local linux/amd64 image on the GitHub Ubuntu runner;
# it is never tagged for or pushed to a registry.
docker compose config > "$artifacts/compose.resolved.yaml"
if [ "$reuse" = 1 ]; then
  image="${TASKBOARD_TEST_IMAGE:-codex-taskboard-deployment-test}"
  docker image inspect "$image" --format '{{.Id}}' > "$artifacts/image-id.log"
  docker compose up --no-build --pull never --detach --wait --wait-timeout 900
else
  docker compose up --build --detach --wait
fi
wait_for_health
docker compose exec -T -e TASKBOARD_ADMIN_PASSWORD='deployment-admin-password' app \
  node dist/admin.js bootstrap --email deploy-owner@example.test --name 'Deployment Owner'

login=$(curlx --fail --silent --show-error -X POST "$api/auth/login" \
  -H 'content-type: application/json' \
  --cookie-jar "$artifacts/session.cookie" \
  --data '{"email":"deploy-owner@example.test","password":"deployment-admin-password","deviceName":"deployment-check","tokenKind":"browser"}')
printf '%s' "$login" | json '.data.user.id' >/dev/null
space=$(curlx --fail --silent --show-error -X POST "$api/spaces" --cookie "$artifacts/session.cookie" \
  -H 'content-type: application/json' -H 'idempotency-key: 10000000-0000-4000-8000-000000000001' \
  --data '{"name":"Restore proof","icon":"R","color":"#7856d9","description":"must survive backup"}')
space_id=$(printf '%s' "$space" | json '.data.id')
board=$(curlx --fail --silent --show-error "$api/spaces/$space_id/board" --cookie "$artifacts/session.cookie")
status_id=$(printf '%s' "$board" | json '.data.statuses[0].id')
task=$(curlx --fail --silent --show-error -X POST "$api/spaces/$space_id/tasks" --cookie "$artifacts/session.cookie" \
  -H 'content-type: application/json' -H 'idempotency-key: 10000000-0000-4000-8000-000000000002' \
  --data "{\"title\":\"Restored task\",\"statusId\":\"$status_id\",\"priority\":2}")
task_id=$(printf '%s' "$task" | json '.data.id')

backup=$(sh scripts/backup.sh "$artifacts" | sed -n 's/^Backup saved: //p')
test -n "$backup" && test -f "$backup"

curlx --fail --silent --show-error -X PATCH "$api/spaces/$space_id" --cookie "$artifacts/session.cookie" \
  -H 'content-type: application/json' -H 'if-match: 1' -H 'idempotency-key: 10000000-0000-4000-8000-000000000003' \
  --data '{"name":"Mutation that must be reverted"}' >/dev/null
docker compose exec -T db psql -U taskboard -d taskboard \
  -c 'CREATE TABLE deployment_restore_marker (id integer)' >/dev/null
sh scripts/restore.sh "$backup" --confirm-restore
wait_for_health

test "$(docker compose exec -T db psql -U taskboard -d taskboard -tAc "SELECT to_regclass('public.deployment_restore_marker')")" = ''
restored=$(curlx --fail --silent --show-error "$api/spaces/$space_id/board" --cookie "$artifacts/session.cookie")
printf '%s' "$restored" | json ".data.space.name == \"Restore proof\"" | grep -qx true
printf '%s' "$restored" | json ".data.tasks[] | select(.id == \"$task_id\") | .title == \"Restored task\"" | grep -qx true
printf 'Disposable Compose deployment, restart, backup, and restore verified (%s). Diagnostics retained in %s.\n' "$project" "$artifacts"
