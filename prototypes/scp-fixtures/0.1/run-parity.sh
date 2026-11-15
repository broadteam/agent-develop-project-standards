#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/scp-prototype.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
NODE_BIN="${NODE:-node}"
if [ -n "${PYTHON:-}" ]; then
  PYTHON_BIN=$PYTHON
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN=python
else
  printf '%s\n' 'ERROR: Python 3.10+ executable not found; set PYTHON=/path/to/python' >&2
  exit 127
fi
mkdir -p "$TMP/node" "$TMP/python"
SCP_PROTO_OUTPUT_DIR="$TMP/node" "$NODE_BIN" "$ROOT/node/test.cjs"
SCP_PROTO_OUTPUT_DIR="$TMP/python" "$PYTHON_BIN" "$ROOT/python/test_adapter.py"
for kind in request normalized oracle; do
  for fixture in credentialed-project-repository identity-source-reference-unresolvable fingerprint-path-set-mismatch; do
    cmp "$TMP/node/$kind-$fixture.json" "$TMP/python/$kind-$fixture.json"
    printf 'MATCH %s %s\n' "$kind" "$fixture"
  done
done
printf '%s\n' 'PASS: 9/9 generated artifacts are byte-identical.'
printf '%s\n' 'LIMITATION: all observations and client responses are synthetic; no Agent client or live observer ran.'
