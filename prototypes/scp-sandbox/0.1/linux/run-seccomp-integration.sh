#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for c in gcc ldd unshare mount chroot setpriv prlimit busybox awk timeout python3; do command -v "$c" >/dev/null 2>&1 || { echo "missing $c" >&2; exit 127; }; done
TMP=$(mktemp -d /tmp/scp-seccomp-integration.XXXXXX);cleanup(){ rm -rf "$TMP"; };trap cleanup EXIT HUP INT TERM
R="$TMP/rootfs";mkdir -p "$R/bin" "$R/usr/bin" "$R/work"
copy_to(){ src=$1;dst="$R$2";mkdir -p "$(dirname "$dst")";cp -L "$src" "$dst";chmod 0555 "$dst";ldd "$src"|awk '{for(i=1;i<=NF;i++)if($i~/^\//)print $i}'|while read -r lib;do [ -e "$lib" ]||continue;out="$R$lib";mkdir -p "$(dirname "$out")";cp -L "$lib" "$out";chmod 0555 "$out";done; }
gcc -Wall -Wextra -Werror -O2 -DSCP_SECCOMP_TEST_MODE -o "$TMP/seccomp-exec" "$HERE/seccomp-exec.c"
gcc -Wall -Wextra -Werror -O2 -DSCP_SECCOMP_TEST_MODE -o "$TMP/seccomp-child-test" "$HERE/seccomp-child-test.c"
gcc -Wall -Wextra -Werror -O2 -o "$TMP/seccomp-exec-prod" "$HERE/seccomp-exec.c"
gcc -Wall -Wextra -Werror -O2 -o "$TMP/seccomp-child-test-prod" "$HERE/seccomp-child-test.c"
gcc -Wall -Wextra -Werror -O2 -DSCP_TEST_FORCE_CLOSE_RANGE_UNAVAILABLE -o "$TMP/seccomp-exec-no-close-range" "$HERE/seccomp-exec.c"
copy_to "$(command -v busybox)" /bin/busybox;copy_to "$(command -v setpriv)" /usr/bin/setpriv
copy_to "$TMP/seccomp-exec" /usr/bin/seccomp-exec;copy_to "$TMP/seccomp-child-test" /usr/bin/seccomp-child-test
copy_to "$TMP/seccomp-exec-prod" /usr/bin/seccomp-exec-prod;copy_to "$TMP/seccomp-child-test-prod" /usr/bin/seccomp-child-test-prod;copy_to "$TMP/seccomp-exec-no-close-range" /usr/bin/seccomp-exec-no-close-range
printf 'host-cwd-canary-secret\n' > "$TMP/host-cwd-canary"; chmod 0444 "$TMP/host-cwd-canary"
printf 'host-fd-canary-secret\n' > "$TMP/host-fd-canary"; chmod 0444 "$TMP/host-fd-canary"
ln -s busybox "$R/bin/sh";printf 'seccomp-fixture-read-ok\n' > "$R/fixture.txt";chmod 0666 "$R/fixture.txt"
chmod 0555 "$R" "$R/bin" "$R/usr" "$R/usr/bin" "$R/work"
cat > "$TMP/namespace-test.sh" <<'NAMESPACE_TEST'
set -eu
R=$1
TMP=$2
cd "$TMP"
mount --make-rprivate /
mount --bind "$R" "$R"
mount -o remount,ro,bind "$R"
mount -t tmpfs -o size=32m,nr_inodes=4096,nosuid,nodev,noexec,mode=1777 tmpfs "$R/work"
if env -i HOME=/tmp PATH=/bin:/usr/bin /usr/bin/prlimit --core=0 --cpu=10 --fsize=1048576 --nofile=64 --nproc=64 --as=268435456 -- /usr/sbin/chroot "$R" /usr/bin/setpriv --reuid=65534 --regid=65534 --clear-groups --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs -- /usr/bin/seccomp-exec-no-close-range /bin/busybox sh -c "echo SHOULD_NOT_EXECUTE > /work/close-range-unavailable-marker"; then
  echo "FAIL close_range unavailable did not fail closed" >&2
  exit 1
else
  rc=$?
  [ "$rc" -eq 69 ] || { echo "FAIL close_range failure exit=$rc" >&2; exit "$rc"; }
fi
[ ! -e "$R/work/close-range-unavailable-marker" ] || { echo "FAIL client ran after close_range failure" >&2; exit 1; }
echo "PASS close-range-unavailable-fail-closed"
env -i HOME=/tmp PATH=/bin:/usr/bin /usr/bin/prlimit --core=0 --cpu=10 --fsize=1048576 --nofile=64 --nproc=64 --as=268435456 -- /usr/sbin/chroot "$R" /usr/bin/setpriv --reuid=65534 --regid=65534 --clear-groups --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs -- /usr/bin/seccomp-exec --test-mode /usr/bin/seccomp-child-test
env -i HOME=/tmp PATH=/bin:/usr/bin /usr/bin/prlimit --core=0 --cpu=10 --fsize=1048576 --nofile=64 --nproc=64 --as=268435456 -- /usr/sbin/chroot "$R" /usr/bin/setpriv --reuid=65534 --regid=65534 --clear-groups --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs -- /usr/bin/seccomp-exec-prod /usr/bin/seccomp-child-test-prod
NAMESPACE_TEST
python3 - "$TMP/host-fd-canary" "$R" "$TMP" <<'PY'
import os
import subprocess
import sys

fd_source, rootfs, tmp = sys.argv[1:]
source_fd = os.open(fd_source, os.O_RDONLY)
try:
    os.dup2(source_fd, 9, inheritable=True)
    os.dup2(source_fd, 100, inheritable=True)
finally:
    if source_fd not in (9, 100):
        os.close(source_fd)

command = [
    "timeout", "--signal=TERM", "--kill-after=3s", "60s",
    "unshare", "--user", "--map-users", f"0:{os.getuid()}:1",
    "--map-users", "1:1:65535", "--map-groups", f"0:{os.getgid()}:1",
    "--map-groups", "1:1:65535", "--mount", "--net", "--pid", "--fork",
    "sh", os.path.join(tmp, "namespace-test.sh"), rootfs, tmp,
]
env = os.environ.copy()
env["HOST_SECRET_CANARY"] = "must-not-enter-client"
proc = subprocess.Popen(
    command,
    stdin=subprocess.DEVNULL,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    pass_fds=(9, 100),
    env=env,
)
try:
    stdout, stderr = proc.communicate(timeout=65)
except subprocess.TimeoutExpired:
    proc.kill()
    stdout, stderr = proc.communicate()
    raise SystemExit("FAIL seccomp integration timed out")
if len(stdout) + len(stderr) > 65536:
    raise SystemExit("FAIL seccomp integration exceeded 64 KiB captured output")
sys.stdout.buffer.write(stdout)
sys.stderr.buffer.write(stderr)
raise SystemExit(proc.returncode)
PY
