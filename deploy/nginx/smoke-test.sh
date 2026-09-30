#!/usr/bin/env bash
# Smoke test of an ELLIGBLE reverse proxy (OPS-003). Read-only against the runtime: it signs
# in with an account that does not exist, so no data changes. Usage:
#   deploy/nginx/smoke-test.sh https://elligble.example.sch.id [--http http://elligble.example.sch.id]
#       [--insecure] [--flood]
# --insecure accepts a self-signed certificate (local tests only). --flood sends 400 rapid
# sign-in attempts to check the per-address limit; use it on staging only, never during an
# exam. Exit status 0 when every check passes.
set -u

BASE="${1:-}"
shift || true
HTTP_URL=""
INSECURE=()
FLOOD=0
while [ $# -gt 0 ]; do
    case "$1" in
        --http) HTTP_URL="$2"; shift 2 ;;
        --insecure) INSECURE=(-k); shift ;;
        --flood) FLOOD=1; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
if [ -z "$BASE" ]; then
    echo "usage: $0 https://host[:port] [--http http://host[:port]] [--insecure] [--flood]" >&2
    exit 2
fi

FAILED=0
check() {
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $3, got $2"; FAILED=1; fi
}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ORIGIN="$(printf '%s' "$BASE" | sed -E 's#^(https?://[^/]+).*#\1#')"
LOGIN_BODY='{"username":"pemeriksa.proxy","password":"bukan-kata-sandi-asli"}'

status=$(curl -s "${INSECURE[@]}" -D "$TMP/ready.h" -o "$TMP/ready.b" -w '%{http_code}' "$BASE/readyz")
check "readyz through the proxy" "$status" 200
check "readyz body" "$(cat "$TMP/ready.b")" '{"status":"ready"}'
check "one HSTS header" "$(grep -ci '^strict-transport-security:' "$TMP/ready.h")" 1
check "request id echoed" "$(grep -ci '^x-request-id:' "$TMP/ready.h")" 1

# The public side answers /metrics with the web client's page (or 404), never metrics.
curl -s "${INSECURE[@]}" -D "$TMP/metrics.h" -o "$TMP/metrics.b" "$BASE/metrics" >/dev/null
check "no metrics in the public answer" "$(grep -c '^elligble_' "$TMP/metrics.b")" 0
check "no metrics format on the public side" "$(grep -ci 'version=0.0.4' "$TMP/metrics.h")" 0

# A 403 here means the proxy does not forward the original Host (Origin check).
status=$(curl -s "${INSECURE[@]}" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
    --data "$LOGIN_BODY" "$BASE/api/v1/auth/login")
check "sign-in reaches the runtime with its Origin" "$status" 401

head -c 70000 /dev/zero | tr '\0' 'a' > "$TMP/large.b"
status=$(curl -s "${INSECURE[@]}" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
    --data-binary "@$TMP/large.b" "$BASE/api/v1/auth/login")
check "bodies over 64 KB refused" "$status" 413

# The question import accepts a larger body; without a session the runtime answers 401.
head -c 200000 /dev/zero | tr '\0' 'a' | sed 's/^/{"questionsCsv":"/; s/$/"}/' > "$TMP/import.b"
status=$(curl -s "${INSECURE[@]}" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
    --data-binary "@$TMP/import.b" "$BASE/api/v1/assessment/teacher-exams/import/preview")
check "a question file of 200 KB reaches the runtime" "$status" 401

if [ -n "$HTTP_URL" ]; then
    status=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$HTTP_URL/login?x=1")
    check "plain HTTP moves to HTTPS" "${status%% *}" 301
    case "${status#* }" in https://*) echo "ok   redirect target is HTTPS" ;; *) echo "FAIL redirect target: ${status#* }"; FAILED=1 ;; esac
fi

if [ "$FLOOD" = 1 ]; then
    # The account does not exist, so every 429 here comes from the proxy (an HTML page;
    # the runtime answers JSON).
    for i in $(seq 1 400); do
        curl -s "${INSECURE[@]}" -o /dev/null -w '%{http_code} %{content_type}\n' -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
            --data "$LOGIN_BODY" "$BASE/api/v1/auth/login" &
        if [ $((i % 50)) = 0 ]; then wait; fi
    done > "$TMP/flood.txt"
    wait
    limited=$(grep -c '^429 text/html' "$TMP/flood.txt")
    if [ "$limited" -gt 0 ]; then echo "ok   a flood from one address is limited by the proxy ($limited of 400 refused with 429)"; else echo "FAIL a flood of 400 sign-ins was not limited"; FAILED=1; fi
    sleep 25
    status=$(curl -s "${INSECURE[@]}" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
        --data "$LOGIN_BODY" "$BASE/api/v1/auth/login")
    check "sign-in works again after the flood" "$status" 401
fi

exit $FAILED
