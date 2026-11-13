# SCP Linux Sandbox Probe 0.1

**Status:** Linux x86_64 security-probe prototype. Gate A and Gate B core probes passed in the recorded execution environment. This is not a production sandbox certification.

## Run

From the repository root, in a disposable Linux x86_64 VM/container that allows user, mount, network and PID namespaces:

```sh
sudo sh prototypes/scp-sandbox/0.1/linux/run.sh
```

The probe deliberately requires effective UID 0 to establish its explicit UID/GID maps. It also requires Python 3, GCC, `gzip`, `unshare`, `mount`, `chroot`, `setpriv`, `prlimit`, `ldd`, and BusyBox. The script fails closed when a required executable or namespace operation is unavailable. It does not silently downgrade to a temporary-directory-only test.

No third-party Python package is required. All test data is synthetic. The probe creates and deletes its own temporary rootfs, scratch area, owner record, loopback listener and synthetic canaries. It does not mount the repository checkout into the sandbox and does not call an Agent, Provider or external endpoint.

## What it checks

- User + mount + network + PID namespaces, with private mount propagation.
- A read-only minimal rootfs and one separately writable scratch directory.
- UID/GID 65534, empty supplementary groups, empty capability bounding/inheritable/ambient sets and `no_new_privs`.
- Host path and symlink traversal denial; `/proc`, `/sys` and container runtime sockets are not exposed.
- Host loopback listener is unreachable from the sandbox network namespace.
- Host environment variables are not inherited.
- A hostile synthetic shell shim cannot read Oracle/Context/host canaries or write outside scratch.
- Bounded output capture (4096-byte flood probe), process timeout and namespace-descendant teardown.
- A synthetic-marker-only redaction check before writing the sanitized output artifact.
- Owner-record/path containment checks, normal cleanup and injected cleanup-failure quarantine/non-reuse behavior.

## Inspect the implementation

The source is stored as a deterministic gzip payload to keep the prototype artifact compact. Inspect it with:

```sh
gzip -dc prototypes/scp-sandbox/0.1/linux/probe.py.gz
```

The launcher expands it into a fresh temporary file, runs Python, removes the temporary source, then compiles and runs the seccomp launch-chain integration test.

## Known limits

- Linux x86_64 only; no Windows or macOS implementation.
- This probes namespace/chroot isolation inside the current execution environment. It is not a general-purpose sandbox manager or an approved Agent Runner.
- Seccomp is tested in the launch chain as a denylist defense-in-depth profile, not a complete syscall allowlist. Landlock returned ENOSYS in the tested kernel/runtime. The cgroup v2 mount is read-only and cannot delegate child cgroups; per-process prlimit is used instead. AppArmor/SELinux policy and kernel-escape testing remain out of scope.
- Network evidence is limited to the isolated namespace and a host-loopback reachability probe. No live DNS/provider/network allow-list integration is implemented.
- The redactor only recognizes the exact synthetic test marker. It is not a general secret scanner.
- Cleanup quarantine was exercised with deterministic state/failure injection, not by forcing a real host filesystem deletion failure.
- No real Agent client, production credential, Provider request, user repository, production Git observer or persistent Run Manifest store is involved.

The result is therefore **Gate A + Gate B core-probe evidence for one Linux environment**, not production readiness. Gate C (real Agent invocation) remains closed pending a separate security review and explicit authorization.

This prototype is not invoked by the repository's existing CI workflow. No CI workflow or gate was added.


## Separate seccomp kernel primitive smoke test

An optional, deliberately narrow C smoke test shows that this kernel accepts a classic seccomp-BPF filter and returns `EPERM` for one harmless syscall (`getppid`). It is **not** applied by the main sandbox probe and is not counted as an enforced sandbox policy.

On Linux with GCC:

```sh
gcc -Wall -Wextra -O2 -o /tmp/scp-seccomp-smoke prototypes/scp-sandbox/0.1/linux/seccomp-smoke.c
/tmp/scp-seccomp-smoke
```

Expected output: `SECCOMP_FILTER=PASS`.



## Seccomp launch-chain integration

The main launcher now runs a separate C-based integration harness after the namespace/chroot probe. It installs an x86_64 architecture-checked seccomp-BPF denylist after namespace/chroot/UID setup, rejects x32 syscall-number tagging, and denies a documented set of high-risk syscalls. A synthetic client verifies syscall denial, allowed fixture reads and scratch writes, read-only-root write denial, and filter inheritance through fork+exec. The profile is a denylist with default ALLOW, not a production syscall allowlist; a test-only getppid sentinel proves that the filter is active.


### Additional syscall and chroot-boundary regression coverage

The current Linux launch-chain test explicitly denies the modern mount API family (`open_tree`, `move_mount`, `fsopen`, `fsconfig`, `fsmount`, `fspick`, `mount_setattr`) and process-handle interfaces (`pidfd_getfd`, `pidfd_send_signal`, `process_madvise`, `kcmp`). The test also checks the less-visible chroot working-directory boundary: it places a world-readable synthetic canary in the host temporary directory, changes the parent working directory there before invoking chroot, then proves the client cannot open the canary by relative path. Both the parent and fork+exec child must report `DENIED inherited-host-cwd`.

This is still a documented denylist, not a syscall allowlist. Unlisted syscalls remain available unless denied by other OS controls.


### Resource-control environment result

The cgroup v2 controller list is visible, but the cgroup2 mount is read-only and cannot create a delegated child cgroup. A direct Landlock ABI call returns ENOSYS on this tested kernel/runtime. Neither Landlock nor cgroup enforcement is active in this prototype.
