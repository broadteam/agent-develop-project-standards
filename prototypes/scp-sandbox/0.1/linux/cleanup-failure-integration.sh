#!/bin/sh
set -eu
for c in unshare mount umount python3 mktemp; do
  command -v "$c" >/dev/null 2>&1 || { echo "missing $c" >&2; exit 127; }
done
TMP=$(mktemp -d /tmp/scp-cleanup-failure.XXXXXX)
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT HUP INT TERM
unshare --user --map-root-user --mount --fork sh -eu -c '
  TMP=$1
  mount --make-rprivate /
  python3 - "$TMP" <<'"'"'PY'"'"'
import errno
import json
import os
import pathlib
import subprocess
import sys
import uuid

base = pathlib.Path(sys.argv[1])
run_id = uuid.uuid4().hex
owned_parent = base / "owned"
quarantine_parent = base / "quarantine"
owned_parent.mkdir()
quarantine_parent.mkdir()
owned = owned_parent / run_id
work = owned / "work"
work.mkdir(parents=True)
quarantined = quarantine_parent / run_id
record_path = base / (run_id + ".owner.json")

subprocess.run(["mount", "-t", "tmpfs", "-o", "size=1m,nosuid,nodev,noexec", "tmpfs", str(work)], check=True)
(work / "mounted-canary").write_text("real-filesystem-cleanup-failure\n", encoding="utf-8")

record = {"run_id": run_id, "state": "active", "owned_root": str(owned), "quarantine_root": str(quarantined)}
def persist():
    temporary = record_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(record, sort_keys=True), encoding="utf-8")
    os.replace(temporary, record_path)
persist()

try:
    os.rmdir(work)
except OSError as exc:
    if exc.errno != errno.EBUSY:
        raise RuntimeError(f"expected real EBUSY from mounted resource cleanup, got errno={exc.errno}: {exc}") from exc
    print("REAL_CLEANUP_FAILURE=PASS errno=EBUSY")
else:
    raise RuntimeError("rmdir unexpectedly removed a mounted filesystem root")

# Persist the no-reuse state before moving the owned tree (fail closed on interruption).
record["state"] = "quarantining"
persist()
os.rename(owned, quarantined)
record["state"] = "quarantined"
record["owned_root"] = str(quarantined)
persist()

loaded = json.loads(record_path.read_text(encoding="utf-8"))
if loaded["state"] not in {"quarantining", "quarantined"}:
    raise RuntimeError("quarantined resource was not persisted as unavailable")
print("QUARANTINE_REUSE_GUARD=PASS")
if (quarantined / "work" / "mounted-canary").read_text(encoding="utf-8") != "real-filesystem-cleanup-failure\n":
    raise RuntimeError("mounted resource did not remain reachable at quarantined path")
print("QUARANTINED_RESOURCE_PRESERVED=PASS")

# Only explicit unmount followed by owned-path cleanup can release quarantine.
subprocess.run(["umount", str(quarantined / "work")], check=True)
os.rmdir(quarantined / "work")
os.rmdir(quarantined)
record["state"] = "cleaned"
persist()
if json.loads(record_path.read_text(encoding="utf-8"))["state"] != "cleaned":
    raise RuntimeError("cleanup completion was not persisted")
record_path.unlink()
os.rmdir(owned_parent)
os.rmdir(quarantine_parent)
print("QUARANTINE_RECOVERY_AND_CLEANUP=PASS")
PY
' sh "$TMP"
