#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for c in gcc ldd unshare mount chroot setpriv prlimit busybox awk python3; do command -v "$c" >/dev/null 2>&1 || { echo "missing $c" >&2; exit 127; }; done
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
import selectors
import signal
import subprocess
import sys
import time
from unittest.mock import patch

class OutputLimitExceeded(RuntimeError):
    pass

class CaptureDeadlineExceeded(TimeoutError):
    pass

def process_group_has_live_members(pgid, proc_root="/proc"):
    """Return whether /proc still contains a non-zombie member of this process group."""
    try:
        entries = os.scandir(proc_root)
    except OSError as exc:
        raise RuntimeError("cannot inspect /proc to verify process-group teardown") from exc
    with entries:
        for entry in entries:
            if not entry.name.isdigit():
                continue
            try:
                with open(os.path.join(proc_root, entry.name, "stat"), "r", encoding="ascii") as stream:
                    stat_line = stream.read()
                closing_paren = stat_line.rfind(")")
                if closing_paren < 0:
                    raise RuntimeError(f"malformed {proc_root}/{entry.name}/stat record")
                fields = stat_line[closing_paren + 2:].split()
                if len(fields) < 3:
                    raise RuntimeError(f"incomplete {proc_root}/{entry.name}/stat record")
                state = fields[0]
                try:
                    process_group = int(fields[2])
                except ValueError as exc:
                    raise RuntimeError(f"invalid process group in {proc_root}/{entry.name}/stat") from exc
                if process_group == pgid and state not in ("Z", "X"):
                    return True
            except (FileNotFoundError, ProcessLookupError):
                # The process exited between scandir and opening its stat file.
                continue
            except PermissionError as exc:
                # Never interpret an unreadable process record as an empty group.
                raise RuntimeError(f"cannot inspect {proc_root}/{entry.name}/stat during teardown") from exc
    return False


def wait_for_process_group_exit(pgid, timeout_seconds):
    deadline = time.monotonic() + timeout_seconds
    while process_group_has_live_members(pgid):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        time.sleep(min(0.025, remaining))
    return True


def terminate_process_group_members(pgid):
    """Reap the execution boundary even when its original leader already exited."""
    try:
        if not process_group_has_live_members(pgid):
            return
        os.killpg(pgid, signal.SIGTERM)
        if wait_for_process_group_exit(pgid, 1.0):
            return
        os.killpg(pgid, signal.SIGKILL)
        if not wait_for_process_group_exit(pgid, 2.0):
            raise RuntimeError("child process group did not terminate after SIGKILL")
    except ProcessLookupError:
        return
    except Exception as exc:
        # Any inspection failure during either the initial scan or TERM grace
        # period means group emptiness cannot be established. Escalate first,
        # then preserve the failure instead of reporting unverified cleanup.
        try:
            os.killpg(pgid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except OSError as kill_exc:
            raise RuntimeError("process-group teardown failed and SIGKILL could not be delivered") from kill_exc
        raise RuntimeError("process-group teardown could not be verified; SIGKILL sent") from exc


def terminate_process_group(proc):
    for stream in (proc.stdout, proc.stderr):
        if stream is not None:
            try:
                stream.close()
            except OSError:
                pass
    terminate_process_group_members(proc.pid)
    try:
        proc.wait(timeout=2.0)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("child process leader did not exit after group teardown") from exc


def wait_for_process_exit_without_reaping(proc, deadline):
    """Observe leader exit while retaining its PID/PGID until group teardown."""
    while True:
        result = os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if result is not None:
            if result.si_pid != proc.pid:
                raise RuntimeError("waitid returned an unexpected child PID")
            return result
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise CaptureDeadlineExceeded("seccomp integration process did not exit before its deadline")
        time.sleep(min(0.025, remaining))


def run_bounded(command, *, env, timeout_seconds, max_output_bytes, pass_fds=()):
    proc = subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        pass_fds=tuple(pass_fds),
        env=env,
        start_new_session=True,
        bufsize=0,
    )
    selector = selectors.DefaultSelector()
    captured = {"stdout": bytearray(), "stderr": bytearray()}
    captured_total = 0
    deadline = time.monotonic() + timeout_seconds
    selector.register(proc.stdout, selectors.EVENT_READ, "stdout")
    selector.register(proc.stderr, selectors.EVENT_READ, "stderr")
    try:
        while selector.get_map():
            remaining_time = deadline - time.monotonic()
            if remaining_time <= 0:
                raise CaptureDeadlineExceeded("seccomp integration exceeded the parent deadline")
            events = selector.select(min(0.25, remaining_time))
            for key, _ in events:
                chunk = os.read(key.fd, 4096)
                if not chunk:
                    selector.unregister(key.fileobj)
                    key.fileobj.close()
                    continue
                remaining_bytes = max_output_bytes - captured_total
                if len(chunk) > remaining_bytes:
                    if remaining_bytes > 0:
                        captured[key.data].extend(chunk[:remaining_bytes])
                        captured_total += remaining_bytes
                    raise OutputLimitExceeded(
                        f"seccomp integration exceeded the {max_output_bytes}-byte combined output limit"
                    )
                captured[key.data].extend(chunk)
                captured_total += len(chunk)
        # Do not reap the leader before checking its process group. A reaped PID
        # could be recycled, making a later killpg() target an unrelated group.
        # WNOWAIT observes exit while the zombie leader still pins its PGID.
        wait_for_process_exit_without_reaping(proc, deadline)
        # The leader can exit while descendants have redirected/closed both output pipes.
        # They must still be terminated before a successful return from the runner.
        terminate_process_group_members(proc.pid)
        return_code = proc.wait(timeout=2.0)
        return return_code, bytes(captured["stdout"]), bytes(captured["stderr"])
    except (OutputLimitExceeded, CaptureDeadlineExceeded):
        selector.close()
        terminate_process_group(proc)
        raise
    finally:
        selector.close()
        for stream in (proc.stdout, proc.stderr):
            if stream is not None and not stream.closed:
                stream.close()
        if proc.poll() is None:
            terminate_process_group(proc)

def self_test_bounded_capture(tmp):
    env = os.environ.copy()
    # WNOWAIT must leave the leader waitable while teardown inspects its PGID.
    leader = subprocess.Popen(
        [sys.executable, "-c", "pass"],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        first_wait = wait_for_process_exit_without_reaping(leader, time.monotonic() + 5)
        second_wait = os.waitid(os.P_PID, leader.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if second_wait is None or second_wait.si_pid != leader.pid or first_wait.si_pid != second_wait.si_pid:
            raise RuntimeError("WNOWAIT did not preserve the exited leader identity")
        if leader.wait(timeout=2) != 0:
            raise RuntimeError("WNOWAIT self-test leader exited unsuccessfully")
        print("PASS process-group-leader-pid-retained-until-teardown")
    finally:
        if leader.poll() is None:
            leader.kill()
            leader.wait(timeout=2)

    with patch(__name__ + ".process_group_has_live_members", side_effect=PermissionError("synthetic proc inspection failure")):
        with patch("os.killpg") as kill_group:
            try:
                terminate_process_group_members(4242)
            except RuntimeError as exc:
                if "SIGKILL sent" not in str(exc):
                    raise
            else:
                raise RuntimeError("process-group inspection failure was not propagated")
            kill_group.assert_called_once_with(4242, signal.SIGKILL)
    print("PASS process-group-inspection-failure-forces-kill-before-failing")

    with patch(
        __name__ + ".process_group_has_live_members",
        side_effect=[True, PermissionError("synthetic proc failure during TERM grace period")],
    ):
        with patch("os.killpg") as kill_group:
            try:
                terminate_process_group_members(4242)
            except RuntimeError as exc:
                if "SIGKILL sent" not in str(exc):
                    raise
            else:
                raise RuntimeError("process-group wait scan failure was not propagated")
            if kill_group.call_args_list != [
                ((4242, signal.SIGTERM),),
                ((4242, signal.SIGKILL),),
            ]:
                raise RuntimeError("wait-stage inspection failure did not escalate SIGTERM to SIGKILL")
    print("PASS process-group-teardown-wait-scan-failure-forces-kill")

    # Validate that the fallback kills a real same-PGID descendant rather than
    # merely calling killpg in a mocked assertion. The child ignores TERM,
    # closes all standard streams, and would leave a delayed marker if alive.
    def assert_real_descendant_killed(failure_point):
        marker = os.path.join(tmp, "forced-kill-" + failure_point + "-survivor")
        if os.path.exists(marker):
            os.unlink(marker)
        child_code = (
            "import pathlib,signal,sys,time; "
            "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
            "time.sleep(0.9); "
            "pathlib.Path(sys.argv[1]).write_text('survived')"
        )
        leader_code = (
            "import subprocess,sys; "
            "subprocess.Popen([sys.executable, '-c', " + repr(child_code) + ", " + repr(marker) + "], "
            "stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)"
        )
        leader_proc = subprocess.Popen(
            [sys.executable, "-c", leader_code],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            wait_for_process_exit_without_reaping(leader_proc, time.monotonic() + 5)
            if failure_point == "initial-scan":
                injected_errors = [PermissionError("synthetic initial proc scan failure")]
            elif failure_point == "term-wait-scan":
                injected_errors = [True, PermissionError("synthetic TERM wait proc scan failure")]
            else:
                raise RuntimeError("unknown process-group failure point")
            with patch(__name__ + ".process_group_has_live_members", side_effect=injected_errors):
                try:
                    terminate_process_group_members(leader_proc.pid)
                except RuntimeError as exc:
                    if "SIGKILL sent" not in str(exc):
                        raise
                else:
                    raise RuntimeError("real descendant teardown failure was not propagated")
            if leader_proc.wait(timeout=2) != 0:
                raise RuntimeError("real descendant fixture leader exited unsuccessfully")
            time.sleep(1.2)
            if os.path.exists(marker):
                raise RuntimeError("SIGKILL fallback did not terminate the real descendant: " + failure_point)
            print("PASS process-group-force-kill-terminates-real-descendant-" + failure_point)
        finally:
            try:
                os.killpg(leader_proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            if leader_proc.poll() is None:
                leader_proc.wait(timeout=2)

    assert_real_descendant_killed("initial-scan")
    assert_real_descendant_killed("term-wait-scan")

    rc, stdout, stderr = run_bounded(
        [sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'x' * 65536)"],
        env=env, timeout_seconds=5, max_output_bytes=65536,
    )
    if rc != 0 or len(stdout) != 65536 or stderr:
        raise RuntimeError("bounded capture exact-limit self-test failed")
    print("PASS bounded-capture-exact-limit")
    try:
        run_bounded(
            [sys.executable, "-c", "import os; b=b'x'*8192\nwhile True: os.write(1,b)"],
            env=env, timeout_seconds=5, max_output_bytes=65536,
        )
    except OutputLimitExceeded:
        print("PASS bounded-capture-overflow-kills-process-group")
    else:
        raise RuntimeError("bounded capture did not reject output overflow")
    try:
        run_bounded(
            [sys.executable, "-c", "import time; time.sleep(30)"],
            env=env, timeout_seconds=0.25, max_output_bytes=65536,
        )
    except CaptureDeadlineExceeded:
        print("PASS bounded-capture-timeout-kills-process-group")
    else:
        raise RuntimeError("bounded capture did not enforce the parent deadline")

    marker = os.path.join(tmp, "orphaned-descendant-survivor-marker")
    if os.path.exists(marker):
        os.unlink(marker)
    descendant_code = (
        "import pathlib,signal,sys,time; "
        "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
        "time.sleep(1.5); pathlib.Path(sys.argv[1]).write_text('survived')"
    )
    leader_code = (
        "import subprocess,sys; "
        "subprocess.Popen([sys.executable, '-c', " + repr(descendant_code) + ", " + repr(marker) + "], "
        "stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)"
    )
    rc, stdout, stderr = run_bounded(
        [sys.executable, "-c", leader_code],
        env=env, timeout_seconds=5, max_output_bytes=65536,
    )
    if rc != 0 or stdout or stderr:
        raise RuntimeError("normal-exit orphaned-descendant fixture failed")
    time.sleep(1.7)
    if os.path.exists(marker):
        raise RuntimeError("orphaned descendant survived after the process-group leader exited")
    print("PASS bounded-capture-kills-orphaned-descendant-after-leader-exit")

    malformed_proc_cases = [
        ("permission-error", None, "cannot inspect", True),
        ("malformed-record", "not-a-proc-stat-record", "malformed", False),
        ("incomplete-fields", "4242 (synthetic) S", "incomplete", False),
        ("invalid-pgid", "4242 (synthetic) S 1 not-a-number 1", "invalid process group", False),
    ]
    for case_name, stat_content, expected_error, inject_permission in malformed_proc_cases:
        fake_proc_root = os.path.join(tmp, "fake-proc-" + case_name)
        fake_stat_dir = os.path.join(fake_proc_root, "4242")
        os.makedirs(fake_stat_dir, exist_ok=True)
        if not inject_permission:
            with open(os.path.join(fake_stat_dir, "stat"), "w", encoding="ascii") as stream:
                stream.write(stat_content)
        try:
            if inject_permission:
                with patch("builtins.open", side_effect=PermissionError("synthetic unreadable proc entry")):
                    process_group_has_live_members(42, proc_root=fake_proc_root)
            else:
                process_group_has_live_members(42, proc_root=fake_proc_root)
        except RuntimeError as exc:
            if expected_error not in str(exc):
                raise
            print("PASS process-group-inspection-fails-closed-" + case_name)
        else:
            raise RuntimeError("process-group inspection incorrectly accepted invalid proc input: " + case_name)

    # Exercise successful parser paths independently of the live process group
    # used by this harness. The command name may itself contain ')'.
    proc_behavior_cases = [
        ("live-member", "4242 (worker ) with parens) S 1 42 1", True),
        ("different-process-group", "4242 (worker) S 1 43 1", False),
        ("zombie-member", "4242 (worker) Z 1 42 1", False),
    ]
    for case_name, stat_content, expected_live in proc_behavior_cases:
        fake_proc_root = os.path.join(tmp, "fake-proc-behavior-" + case_name)
        fake_stat_dir = os.path.join(fake_proc_root, "4242")
        os.makedirs(fake_stat_dir, exist_ok=True)
        with open(os.path.join(fake_stat_dir, "stat"), "w", encoding="ascii") as stream:
            stream.write(stat_content)
        actual_live = process_group_has_live_members(42, proc_root=fake_proc_root)
        if actual_live is not expected_live:
            raise RuntimeError("process-group inspection returned the wrong result: " + case_name)
        print("PASS process-group-inspection-" + case_name)

    # A PID can disappear after scandir() but before its stat file is opened.
    # Both ENOENT and ESRCH representations of that race must be benign.
    for race_name, race_error in (
        ("file-not-found", FileNotFoundError),
        ("process-lookup", ProcessLookupError),
    ):
        fake_proc_root = os.path.join(tmp, "fake-proc-race-" + race_name)
        os.makedirs(os.path.join(fake_proc_root, "4242"), exist_ok=True)
        with patch("builtins.open", side_effect=race_error("synthetic PID disappearance")):
            actual_live = process_group_has_live_members(42, proc_root=fake_proc_root)
        if actual_live:
            raise RuntimeError("disappeared PID was incorrectly reported as live: " + race_name)
        print("PASS process-group-inspection-tolerates-pid-race-" + race_name)

    # Failure to enumerate /proc is distinct from a PID disappearing and must
    # never be interpreted as an empty process group.
    with patch("os.scandir", side_effect=PermissionError("synthetic /proc scan denial")):
        try:
            process_group_has_live_members(42, proc_root=os.path.join(tmp, "unreadable-proc"))
        except RuntimeError as exc:
            if "cannot inspect /proc" not in str(exc):
                raise
            print("PASS process-group-inspection-fails-closed-scan-permission-error")
        else:
            raise RuntimeError("process-group inspection accepted an unreadable /proc root")


fd_source, rootfs, tmp = sys.argv[1:]
source_fd = os.open(fd_source, os.O_RDONLY)
try:
    os.dup2(source_fd, 9, inheritable=True)
    os.dup2(source_fd, 100, inheritable=True)
finally:
    if source_fd not in (9, 100):
        os.close(source_fd)

command = [
    "unshare", "--user", "--map-users", f"0:{os.getuid()}:1",
    "--map-users", "1:1:65535", "--map-groups", f"0:{os.getgid()}:1",
    "--map-groups", "1:1:65535", "--mount", "--net", "--pid", "--fork",
    "sh", os.path.join(tmp, "namespace-test.sh"), rootfs, tmp,
]
env = os.environ.copy()
env["HOST_SECRET_CANARY"] = "must-not-enter-client"
self_test_bounded_capture(tmp)
try:
    return_code, stdout, stderr = run_bounded(
        command, env=env, timeout_seconds=60, max_output_bytes=65536, pass_fds=(9, 100),
    )
except OutputLimitExceeded as exc:
    raise SystemExit("FAIL " + str(exc))
except CaptureDeadlineExceeded as exc:
    raise SystemExit("FAIL " + str(exc))
sys.stdout.buffer.write(stdout)
sys.stderr.buffer.write(stderr)
raise SystemExit(return_code)
PY
