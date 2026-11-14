#!/bin/sh
set -eu
for c in unshare mount umount python3 mktemp timeout; do
  command -v "$c" >/dev/null 2>&1 || { echo "missing $c" >&2; exit 127; }
done
TMP=$(mktemp -d /tmp/scp-cleanup-failure.XXXXXX)
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT HUP INT TERM
timeout --signal=TERM --kill-after=2s 15s unshare --user --map-root-user --mount --fork sh -eu -c '
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
    with temporary.open("w", encoding="utf-8") as stream:
        stream.write(json.dumps(record, sort_keys=True))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, record_path)
    directory_fd = os.open(base, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)

def acquire_resource():
    """Synthetic owner admission path: only active records may be reused."""
    loaded = json.loads(record_path.read_text(encoding="utf-8"))
    if loaded.get("state") != "active":
        current_state = loaded.get("state")
        raise PermissionError("resource unavailable in state={!r}".format(current_state))
    root = pathlib.Path(loaded["owned_root"])
    if root != owned or not root.is_dir():
        raise PermissionError("owned resource root is not reusable")
    return root

def assert_reuse_denied(expected_state):
    try:
        acquire_resource()
    except PermissionError:
        loaded = json.loads(record_path.read_text(encoding="utf-8"))
        loaded_state = loaded.get("state")
        if loaded_state != expected_state:
            raise RuntimeError("expected state={!r}, got {!r}".format(expected_state, loaded_state))
        print(f"QUARANTINE_REUSE_DENIED state={expected_state}=PASS")
    else:
        raise RuntimeError(f"resource was unexpectedly reusable in state={expected_state!r}")

persist()
if acquire_resource() != owned:
    raise RuntimeError("active resource could not be acquired")
print("ACTIVE_RESOURCE_ADMISSION=PASS")

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
assert_reuse_denied("quarantining")
os.rename(owned, quarantined)
record["state"] = "quarantined"
record["owned_root"] = str(quarantined)
persist()
assert_reuse_denied("quarantined")

if (quarantined / "work" / "mounted-canary").read_text(encoding="utf-8") != "real-filesystem-cleanup-failure\n":
    raise RuntimeError("mounted resource did not remain reachable at quarantined path")
print("QUARANTINED_RESOURCE_PRESERVED=PASS")

# Only explicit unmount followed by owned-path cleanup can release quarantine.
subprocess.run(["umount", str(quarantined / "work")], check=True)
os.rmdir(quarantined / "work")
os.rmdir(quarantined)
record["state"] = "cleaned"
persist()
assert_reuse_denied("cleaned")
record_path.unlink()
os.rmdir(owned_parent)
os.rmdir(quarantine_parent)
print("QUARANTINE_RECOVERY_AND_CLEANUP=PASS")
PY
' sh "$TMP"
