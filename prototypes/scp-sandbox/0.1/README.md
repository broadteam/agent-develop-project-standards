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
- Owner-record/path containment checks, normal cleanup and injected cleanup-failure quarantine/non-reuse behavior in the core probe.
- A separate real-filesystem cleanup regression that mounts tmpfs under an owned resource, requires `rmdir` to return `EBUSY`, persists a quarantine state, blocks reuse, then explicitly unmounts and cleans the resource.

## Inspect the implementation

The source is stored as a deterministic gzip payload to keep the prototype artifact compact. Inspect it with:

```sh
gzip -dc prototypes/scp-sandbox/0.1/linux/probe.py.gz
```

The launcher expands it into a fresh temporary file, runs Python, removes the temporary source, then runs the seccomp launch-chain integration and the real-filesystem cleanup-failure regression.

## Known limits

- Linux x86_64 only; no Windows or macOS implementation.
- This probes namespace/chroot isolation inside the current execution environment. It is not a general-purpose sandbox manager or an approved Agent Runner.
- Seccomp is tested in the launch chain as a denylist defense-in-depth profile, not a complete syscall allowlist. Landlock returned ENOSYS in the tested kernel/runtime. The cgroup v2 mount is read-only and cannot delegate child cgroups; per-process prlimit is used instead. AppArmor/SELinux policy and kernel-escape testing remain out of scope.
- Network evidence is limited to the isolated namespace and a host-loopback reachability probe. No live DNS/provider/network allow-list integration is implemented.
- The redactor only recognizes the exact synthetic test marker. It is not a general secret scanner.
- The core probe's owner-state-machine fault branch still uses deterministic injection. In addition, `cleanup-failure-integration.sh` forces a genuine `EBUSY` filesystem cleanup failure by attempting to remove a mounted tmpfs root, persists `quarantining`/`quarantined`, rejects reuse and performs explicit recovery. This is a focused invariant test, not a full production cleanup-manager audit.
- No real Agent client, production credential, Provider request, user repository, production Git observer or persistent Run Manifest store is involved.

The result is therefore **Gate A + Gate B core-probe evidence for one Linux environment**, not production readiness. Gate C (real Agent invocation) remains closed pending a separate security review and explicit authorization.

This prototype is not invoked by the repository's existing CI workflow. No CI workflow or gate was added.


## Standalone seccomp primitive smoke test (historical)

The small `seccomp-smoke.c` utility is retained as an optional kernel-primitive check: it installs a minimal filter and expects `EPERM` for `getppid`. It is not the active sandbox policy and is not used by the main launcher.

The active denylist integration is exercised by `run-seccomp-integration.sh`, which the `linux/run.sh` entry point invokes after the namespace/chroot core probe. That harness compiles `seccomp-exec.c` and `seccomp-child-test.c`, installs the test-mode policy before the synthetic child executes, and checks policy enforcement and inheritance. See the validation report for the exact source Blob identities and latest execution evidence.



## Seccomp launch-chain integration

The main launcher now runs a separate C-based integration harness after the namespace/chroot probe. It builds both test and production variants of the seccomp wrapper/client. The test variant returns a test-only EACCES sentinel for denied syscalls so policy hits can be distinguished from ordinary kernel permission failures; the production variant retains EPERM and confirms that getppid remains allowed. The synthetic client checks all syscall entries in the current denylist, clone/clone3 namespace-creation paths, x32 ABI rejection (SIGSYS), allowed fixture and scratch I/O, read-only-root write denial, and fork+exec filter inheritance. The profile remains an x86_64 denylist with default ALLOW, not a production syscall allowlist.


### Additional syscall and chroot-boundary regression coverage

The current Linux launch-chain test explicitly denies the modern mount API family (`open_tree`, `move_mount`, `fsopen`, `fsconfig`, `fsmount`, `fspick`, `mount_setattr`) and process-handle interfaces (`pidfd_getfd`, `pidfd_send_signal`, `process_madvise`, `kcmp`). The test also checks the less-visible chroot working-directory boundary: it places a world-readable synthetic canary in the host temporary directory, changes the parent working directory there before invoking chroot, then proves the client cannot open the canary by relative path. Both the parent and fork+exec child must report `DENIED inherited-host-cwd`.

This is still a documented denylist, not a syscall allowlist. Unlisted syscalls remain available unless denied by other OS controls.


### Resource-control environment result

The cgroup v2 controller list is visible, but the cgroup2 mount is read-only and cannot create a delegated child cgroup. A direct Landlock ABI call returns ENOSYS on this tested kernel/runtime. Neither Landlock nor cgroup enforcement is active in this prototype.


The seccomp integration now uses a dedicated 32 MiB tmpfs scratch mount with nosuid,nodev,noexec instead of a writable host bind mount. The synthetic client verifies tmpfs type, mount flags, configured size ceiling, writable scratch behavior and readonly-root write denial in both the parent and fork+exec child.


The seccomp exec wrapper must successfully call `close_range(3, UINT_MAX, 0)` before starting the client. It no longer uses a numeric fallback: if `close_range` is unavailable or denied, the wrapper exits before executing the client (fail closed). The current regression opens host-only canaries as FD 9 and FD 100, lowers `RLIMIT_NOFILE` to 64 only after those descriptors are open, and requires both to be `EBADF` inside the client. A forced-unavailable build must exit with status 69 and leave its client marker absent. The current revision's added regression cases have not yet been independently executed; see the validation report. Descriptors 0–2 are intentionally preserved for standard I/O; a production Runner must bind them to controlled supervisor-owned streams, not arbitrary host files or sockets. This prototype does not certify that production binding. Scratch tmpfs is bounded to 32 MiB and 4096 inodes, and the client verifies tmpfs type, nosuid,nodev,noexec flags, byte/inode limits and write behavior.


The synthetic client also verifies its runtime identity and privilege state: UID/GID 65534, no supplementary groups, no_new_privs=1, seccomp filter mode active, empty effective/permitted/inheritable capabilities and an empty capability bounding set. These checks run in the parent and fork+exec child.



## Real filesystem cleanup-failure regression

The main Linux launcher also invokes `cleanup-failure-integration.sh`. Inside a private user + mount namespace, the script mounts a disposable tmpfs below an owned resource directory, then attempts to remove the mounted directory. The kernel must return `EBUSY`; any other result fails the test.

The helper persists a fail-closed `quarantining` state before moving the resource tree into quarantine, records the final `quarantined` state, confirms the mounted canary remains at the quarantined path, and refuses reuse based on the persisted owner record. Recovery is explicit: unmount the quarantined tmpfs, remove the owned paths, persist `cleaned`, then remove the owner record.

This is real filesystem-level failure evidence for the quarantine lifecycle invariant. It supplements, but does not replace, a fault injected into the core probe's own owner-state-machine path or a broader production cleanup-manager review.


The cleanup helper flushes and fsyncs each temporary owner-record file before atomic replacement and fsyncs the containing directory after replacement. This makes the tested state transition more crash-consistent; it does not certify durable storage across all filesystems or hardware.


## 2026-11-14 exact-source replay status

The current validation report records exact Git Blob verification and separate execution for all three components: the compressed Python core probe (compressed SHA `ae64fb2f651018e53705990c2f715ea25fa465b9`, decompressed source SHA `88e08595b3f74fc7c5c59fb13c9473f94dbb5503`, 90-second watchdog, PASS); the seccomp launch-chain harness (two exact-Blob runs, test and production variants, PASS); and the real cleanup-failure harness (three exact-Blob runs, including kernel EBUSY and persisted quarantine recovery, PASS).

These component results do not claim that `linux/run.sh` itself was executed end-to-end in one invocation. The existing repository Standards CI does not run this prototype. Production Sandbox acceptance, cross-platform acceptance and Gate C remain closed; see [STAGE2-ACCEPTANCE.md](./STAGE2-ACCEPTANCE.md).
