#!/usr/bin/env sh
# Run only after scripts/check-deployment.sh has proven the disposable Compose lifecycle.
set -eu
umask 077
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
nonce=$(date +%s)-$$
project="tbhttps${nonce}"
port=${HTTPS_TEST_PORT:-48443}
http_port=${HTTPS_TEST_HTTP_PORT:-48080}
domain=deployment-test.invalid
reuse=${TASKBOARD_TEST_REUSE_IMAGE:-0}
slow=${TASKBOARD_TEST_SLOW:-0}
case "$reuse" in 0|1) ;; *) exit 2;; esac
case "$slow" in 0|1) ;; *) exit 2;; esac
artifacts="$root/.artifacts/https-test-$nonce"
mkdir -p "$artifacts"
env_file="$artifacts/compose.env"
cat > "$env_file" <<EOF
POSTGRES_PASSWORD=deployment-test-postgres-password
SESSION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
DOMAIN=$domain
HTTPS_TEST_PORT=$port
HTTPS_TEST_HTTP_PORT=$http_port
EOF
compose_files="$root/compose.yaml:$root/deploy/compose.https-test.yaml"
test "$slow" = 1 && compose_files="$compose_files:$root/deploy/compose.slow-test.yaml"
export COMPOSE_PROJECT_NAME="$project" COMPOSE_FILE="$compose_files" COMPOSE_DISABLE_ENV_FILE=1 COMPOSE_ENV_FILES="$env_file"
export DOMAIN="$domain" SESSION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export POSTGRES_PASSWORD='deployment-test-postgres-password' HTTPS_TEST_PORT="$port" HTTPS_TEST_HTTP_PORT="$http_port"
if test "$slow" = 1; then curlx() { curl --noproxy '*' --fail --silent --show-error --connect-timeout 10 --max-time 120 "$@"; }; else curlx() { curl --noproxy '*' --fail --silent --show-error --connect-timeout 5 --max-time 20 "$@"; }; fi
stream=
cleanup() { test -z "$stream" || { kill "$stream" 2>/dev/null || true; wait "$stream" 2>/dev/null || true; }; app_id=$(docker compose ps -aq app 2>/dev/null || true); test -z "$app_id" || docker inspect --format '{{json .State.Health}}' "$app_id" > "$artifacts/app-health.json" 2>/dev/null || true; docker compose logs --no-color > "$artifacts/compose.log" 2>&1 || true; docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Compose v2's !override must remove the base public 80/443 bindings.
docker compose config --format json > "$artifacts/compose.resolved.json"
jq -e --argjson http "$http_port" --argjson https "$port" '
  .services.caddy.ports | length == 2 and
  all(.[]; .host_ip == "127.0.0.1") and
  any(.[]; (.published|tostring) == ($http|tostring) and (.target|tonumber) == 80) and
  any(.[]; (.published|tostring) == ($https|tostring) and (.target|tonumber) == 443)' "$artifacts/compose.resolved.json" >/dev/null
if test "$reuse" = 1; then docker image inspect "${TASKBOARD_TEST_IMAGE:-codex-taskboard-deployment-test}" --format '{{.Id}}' > "$artifacts/image-id.txt"; docker compose up --no-build --pull never --detach --wait --wait-timeout 900; else docker compose up --build --detach --wait; fi
ca="$artifacts/root.crt"
attempt=0; until docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$ca" 2>/dev/null; do attempt=$((attempt+1)); test "$attempt" -lt 20 || exit 1; sleep 1; done
if test "$slow" = 1; then
  health_deadline=$(( $(date +%s) + 900 ))
  while :; do
    remaining=$(( health_deadline - $(date +%s) ))
    test "$remaining" -gt 0 || exit 1
    health_max=$remaining; test "$health_max" -le 30 || health_max=30
    curlx --max-time "$health_max" --cacert "$ca" --resolve "$domain:$port:127.0.0.1" "https://$domain:$port/api/v1/health" > "$artifacts/health.json" && break
    sleep 1
  done
else
  attempt=0; until curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" "https://$domain:$port/api/v1/health" > "$artifacts/health.json"; do attempt=$((attempt+1)); test "$attempt" -lt 20 || exit 1; sleep 1; done
fi
# Prove HTTP redirects and HTTPS trusts only this test CA. Never use -k.
curlx --resolve "$domain:$http_port:127.0.0.1" -D "$artifacts/http.headers" -o /dev/null "http://$domain:$http_port/"
grep -Eiq "^location: https://$domain:$port/" "$artifacts/http.headers"
curlx --location --cacert "$ca" --resolve "$domain:$http_port:127.0.0.1" --resolve "$domain:$port:127.0.0.1" "http://$domain:$http_port/api/v1/health" > "$artifacts/health.json"
# Browser login must issue a Secure cookie through HTTPS.
docker compose exec -T -e TASKBOARD_ADMIN_PASSWORD=deployment-admin-password app node dist/admin.js bootstrap --email https-owner@example.test --name 'HTTPS Owner'
curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie-jar "$artifacts/session.cookie" -D "$artifacts/login.headers" -H 'content-type: application/json' --data '{"email":"https-owner@example.test","password":"deployment-admin-password","deviceName":"https-check","tokenKind":"browser"}' "https://$domain:$port/api/v1/auth/login" > /dev/null
grep -Eiq '^set-cookie:.*;[[:space:]]*Secure([;,]|$)' "$artifacts/login.headers"
# Open the real proxied SSE endpoint twice; each connection must remain an event stream.
space=$(curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" -H 'content-type: application/json' -H 'idempotency-key: 20000000-0000-4000-8000-000000000001' --data '{"name":"HTTPS SSE","icon":"S","color":"#7856d9"}' "https://$domain:$port/api/v1/spaces")
space_id=$(printf '%s' "$space" | jq -er '.data.id')
board=$(curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" "https://$domain:$port/api/v1/spaces/$space_id/board")
status_id=$(printf '%s' "$board" | jq -er '.data.statuses[0].id')
task=$(curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" -H 'content-type: application/json' -H 'idempotency-key: 20000000-0000-4000-8000-000000000002' --data "{\"title\":\"HTTPS SSE\",\"statusId\":\"$status_id\",\"priority\":2}" "https://$domain:$port/api/v1/spaces/$space_id/tasks")
task_id=$(printf '%s' "$task" | jq -er '.data.id')
for n in 1 2; do
  curl --noproxy '*' --fail --silent --show-error --no-buffer --connect-timeout 5 --max-time 45 --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" -H 'accept: text/event-stream' -D "$artifacts/sse-$n.headers" "https://$domain:$port/api/v1/spaces/$space_id/events" > "$artifacts/sse-$n.body" & stream=$!
  attempt=0; until grep -F 'event: ready' "$artifacts/sse-$n.body" >/dev/null; do kill -0 "$stream" 2>/dev/null || exit 1; attempt=$((attempt+1)); test "$attempt" -lt 20 || exit 1; sleep 1; done
  grep -Eiq '^content-type: text/event-stream' "$artifacts/sse-$n.headers"
  grep -F 'event: ready' "$artifacts/sse-$n.body" >/dev/null
  curlx -X PATCH --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" -H 'content-type: application/json' -H "if-match: $n" -H "idempotency-key: 20000000-0000-4000-8000-00000000000$((n+2))" --data "{\"title\":\"HTTPS SSE $n\"}" "https://$domain:$port/api/v1/tasks/$task_id" >/dev/null
  wait "$stream" || test $? -eq 28
  grep -F 'event: board' "$artifacts/sse-$n.body" >/dev/null
  grep -F "\"taskId\":\"$task_id\"" "$artifacts/sse-$n.body" >/dev/null
  board=$(curlx --cacert "$ca" --resolve "$domain:$port:127.0.0.1" --cookie "$artifacts/session.cookie" "https://$domain:$port/api/v1/spaces/$space_id/board")
  printf '%s' "$board" | jq -e --arg id "$task_id" --arg title "HTTPS SSE $n" --argjson version "$((n+1))" '.data.tasks[] | select(.id == $id and .title == $title and .version == $version)' >/dev/null
  stream=
done
printf 'Internal-CA HTTPS, redirect, Secure cookie, and SSE reconnect verified. Evidence: %s\n' "$artifacts"
