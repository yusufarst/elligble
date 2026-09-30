#!/usr/bin/env bash
# Prints what a failed end-to-end run left behind into the CI job log, for readers who can
# see the log but not the uploaded report: the page at the failure (error-context.md), the
# timeline of each traced test with durations, the requests of every browser context and
# the end of the server log. Query strings are cut (they carry attempt ids). Never fails.
# Usage: e2e/ci-failure-details.sh <test-results dir> [server log]
set +e

RESULTS="${1:-test-results}"
SERVER_LOG="${2:-}"
shopt -s nullglob

for context in "$RESULTS"/*/error-context.md; do
    echo "::group::page at the failure: ${context#"$RESULTS"/}"
    cat "$context"
    echo "::endgroup::"
done

for trace in "$RESULTS"/*/trace.zip; do
    echo "::group::timeline (start s, duration s, step, error): ${trace#"$RESULTS"/}"
    unzip -p "$trace" test.trace | jq -rs '
        (map(select(.type == "after")) | map({ key: .callId, value: . }) | from_entries) as $after
        | map(select(.type == "before")) as $before
        | ($before[0].startTime) as $t0
        | $before[]
        | [ (((.startTime - $t0) / 100 | round) / 10 | tostring),
            (($after[.callId].endTime) as $end | if $end then (((($end - .startTime) / 100) | round) / 10 | tostring) else "PENDING" end),
            (.title[0:120]),
            (($after[.callId].error.message // "") | gsub("\\s+"; " ") | .[0:200]) ]
        | @tsv' | tail -n 60
    echo "::endgroup::"
    for network in $(unzip -Z1 "$trace" | grep -E '(^|-)trace\.network$'); do
        echo "::group::requests of ${network%%-*} (monotonic ms, method, path, status, ms): ${trace#"$RESULTS"/}"
        unzip -p "$trace" "$network" | jq -rc '
            select(.type == "resource-snapshot") | .snapshot
            | [ (._monotonicTime // "" | tostring), .request.method,
                (.request.url | sub("^[a-z]+://[^/]+"; "") | sub("\\?.*$"; "")),
                (.response.status | tostring), ((.time // 0) | round | tostring) ]
            | @tsv' | tail -n 30
        echo "::endgroup::"
    done
done

if [ -n "$SERVER_LOG" ] && [ -f "$SERVER_LOG" ]; then
    echo "::group::end of the server log (time, level, event, method, path, status, ms)"
    tail -n 80 "$SERVER_LOG" | jq -rR '
        (fromjson? | [ .timestamp, .level, .event, (.metadata.method // ""), (.metadata.path // ""),
                       (.metadata.status // "" | tostring), (.metadata.durationMs // "" | tostring),
                       (if .metadata.aborted then "aborted" else "" end) ] | @tsv) // .'
    echo "::endgroup::"
fi
exit 0
