#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v timeout >/dev/null 2>&1 || { echo "missing timeout" >&2; exit 127; }
TMP=$(mktemp /tmp/scp-linux-sandbox-probe.XXXXXX)
cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT HUP INT TERM
gzip -dc "$HERE/probe.py.gz" > "$TMP"
timeout --signal=TERM --kill-after=5s 90s python3 "$TMP" "$@"

# Exercise seccomp after namespace/chroot/UID setup using a synthetic child client.
sh "$HERE/run-seccomp-integration.sh"

# Exercise a real filesystem-level cleanup failure and persistent quarantine guard.
sh "$HERE/cleanup-failure-integration.sh"
