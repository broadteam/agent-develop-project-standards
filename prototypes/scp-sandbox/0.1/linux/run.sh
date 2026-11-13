#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TMP=$(mktemp /tmp/scp-linux-sandbox-probe.XXXXXX)
cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT HUP INT TERM
gzip -dc "$HERE/probe.py.gz" > "$TMP"
python3 "$TMP" "$@"

# Exercise seccomp after namespace/chroot/UID setup using a synthetic child client.
"$HERE/run-seccomp-integration.sh"

# Exercise a real filesystem-level cleanup failure and persistent quarantine guard.
sh "$HERE/cleanup-failure-integration.sh"
