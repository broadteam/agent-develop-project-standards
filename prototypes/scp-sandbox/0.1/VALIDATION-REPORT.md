# Linux Sandbox Prototype Validation Report

**Date:** 2026-11-13  
**Prototype:** SCP Linux x86_64 namespace/chroot probe 0.1  
**Result:** Gate A and Gate B core probes passed; not a production sandbox certification.

## Execution environment

- OS: Linux x86_64
- Kernel: 6.18.57
- Runtime: isolated Kata/container execution environment with effective UID 0
- Python: system Python 3 (standard library only)
- Required host utilities: GCC, `unshare`, `mount`, `chroot`, `setpriv`, `prlimit`, `ldd`, BusyBox
- Source size: 20,304 bytes before gzip; 6,563 bytes compressed
- Compressed Git Blob SHA: `ae64fb2f651018e53705990c2f715ea25fa465b9`
- Decompressed source Git Blob SHA: `88e08595b3f74fc7c5c59fb13c9473f94dbb5503`

## Namespace capability discovery

Ordinary mount/network/PID namespace creation was denied by the outer runtime. Creating the user namespace first and then creating mount, network and PID namespaces succeeded. Mount propagation was made private. Mounting procfs from the nested namespace was not permitted, so the disposable chroot deliberately does not expose `/proc` or `/sys`.

The probe does not turn these environmental constraints into implicit success. It verifies the combined namespace operation and fails if a required capability is unavailable.

## Repeated execution results

The complete probe was run three times in the same isolated execution environment. All three runs completed with the same successful result. The final run reported:

| Check | Result |
|---|---|
| User + mount + network + PID namespaces | PASS |
| UID/GID drop to 65534 | PASS |
| `no_new_privs` and capability drop | PASS |
| Read-only rootfs | PASS |
| Host canary and symlink escape denial | PASS |
| `/proc` and `/sys` hidden | PASS |
| Dedicated writable scratch | PASS |
| Host loopback network isolation | PASS |
| PID namespace descendant teardown | PASS |
| Host secret environment not inherited | PASS |
| Hostile synthetic shim access-denial probes | PASS |
| Synthetic marker redaction before persistence | PASS (exact marker only) |
| Output capture limit | PASS (4096 bytes; overflow not persisted) |
| Ownership check and quarantine | PASS (cleanup-failure injection) |
| Normal cleanup | PASS (owned resources removed) |

The synthetic shim attempted to read the expected-value/Oracle path, Context path, host canary, host proc-root path and container-runtime socket; write outside its scratch root; reach the host loopback listener; and inspect an environment variable that existed only in the host parent. Each attempt was denied or absent, and the shim completed with the expected denial markers.

The output-flood probe produced more than the 4096-byte allowance. The capture routine retained at most 4096 bytes, terminated the namespace owner, and did not persist the raw overflow output. The core probe's cleanup fault case was injected into the ownership/quarantine state transition. A separate real-filesystem regression is now run by the main launcher and is recorded below; it forces EBUSY using a mounted tmpfs root and exercises a persisted quarantine lifecycle.

Final command output ended with:

```text
RESULT=GATE_A_AND_B_CORE_PROBES_PASS; NOT A PRODUCTION SANDBOX CERTIFICATION
```

## Controls demonstrated

1. The client process executes under an unprivileged inner UID/GID 65534.
2. Supplementary groups are empty; capability bounding, inheritable and ambient sets are empty; `no_new_privs=1`.
3. The minimal rootfs is remounted read-only. A dedicated scratch mount is the only writable location supplied to the shim.
4. Host paths are not mounted into the chroot. A deliberately hostile symlink cannot traverse outside the root.
5. The namespace has no route to the host loopback listener. No host network endpoint was exposed to the shim.
6. The environment is rebuilt from an allow-list; the synthetic host-only secret variable is absent inside.
7. The PID namespace owner controls the child lifecycle; terminating the owner tears down the descendant namespace.
8. Output is bounded and the one synthetic marker is replaced in memory before the evidence file is written.
9. Cleanup requires an owner record and canonical path containment. The injected failure path quarantines resources and blocks reuse.

## Explicit non-claims

This is a narrow prototype, not a production security boundary certification. It does **not** prove:

- resistance to kernel vulnerabilities or namespace/chroot escape exploits;
- a complete syscall allowlist, Landlock, LSM/AppArmor/SELinux or cgroup-enforced resource accounting;
- a complete general secret-scanning/redaction policy;
- behavior on Windows, macOS or other Linux kernels/container runtimes;
- arbitrary network policy or approved egress to a real service;
- actual Agent client behavior, Provider authority or real Git/filesystem observations;
- general-purpose cleanup failure handling in a production resource manager (the supplemental regression covers a real mounted-tmpfs EBUSY path and a small persisted owner-record/quarantine lifecycle only);
- production-grade evidence retention, immutable Run Manifest storage or CI enforcement.

The current implementation also requires an environment capable of creating the explicit UID/GID maps; a typical locked-down container may reject this. The launcher reports failure rather than falling back to a weaker test.

## CI and repository boundary

The probe was run directly in the isolated execution environment. The repository's existing `.github/workflows/standards-ci.yml` does not run this prototype. No workflow, CI gate, schema, Runner, Registry, Writer, Store or production Agent integration was added.

Gate C (real Agent invocation) remains closed. Before it can be considered, the backend needs a separate platform security review, additional adversarial probes (including syscall and resource enforcement), and explicit authorization for the specific client and credential/network scope.


## Follow-up security primitive discovery

A separate seccomp-BPF smoke test was compiled with GCC and executed successfully. It set `no_new_privs`, installed a classic BPF filter using `PR_SET_SECCOMP`, denied the harmless `getppid` syscall with `EPERM`, and printed `SECCOMP_FILTER=PASS`. This proves only that this process/kernel accepted that small filter. The filter is **not installed by the current namespace/chroot sandbox probe** and is not evidence of syscall restriction in the Gate A/B run.

The cgroup v2 hierarchy exposed controllers cpuset cpu io memory hugetlb pids, but /sys/fs/cgroup is mounted read-only and the process cannot create a child cgroup or write cgroup.subtree_control. The current probe therefore relies on per-process prlimit bounds; it does not claim cgroup-enforced aggregate resource limits.

A direct C probe of landlock_create_ruleset (x86_64 syscall 444 with LANDLOCK_CREATE_RULESET_VERSION) returned ENOSYS under a 3-second timeout. Landlock is therefore **unavailable in this tested kernel/runtime**, rather than merely unverified; no Landlock policy is installed or claimed.

These findings refine, but do not change, the core Gate A/B result above: the namespace/chroot and synthetic-shim checks pass, while seccomp remains an unintegrated primitive, cgroup delegation is unavailable in this runtime, and Landlock remains unverified.


## Seccomp launch-chain integration follow-up

The main Linux run.sh will run run-seccomp-integration.sh after the namespace/chroot core probe. That harness compiles seccomp-exec.c and seccomp-child-test.c with GCC -Wall -Wextra -Werror, then launches the client test inside user/mount/network/PID namespaces, a read-only chroot, a writable scratch mount and UID/GID 65534. The wrapper sets no_new_privs, installs an x86_64 architecture-checked classic BPF denylist (including x32 ABI rejection), then execs the synthetic client.

The client verifies that mount, umount2, ptrace, unshare, BPF, userfaultfd and a test-only getppid sentinel return EPERM, while getpid, fixture reads and scratch writes remain usable. A write to the read-only rootfs is denied with EROFS. The client then forks and execs a child, which repeats the same checks to prove filter inheritance. The integration command passed locally with GCC -Wall -Wextra -Werror.

This is a denylist with default ALLOW, not a comprehensive production Agent syscall allowlist. It is a launch-chain integration harness, not kernel-escape certification; cgroup, Landlock and LSM limitations remain.


## 2026-11-14 exact remote launch-chain correction and verification

The first seccomp integration commit exposed two packaging defects during execution of the exact remote files: the temporary path was created as a file rather than a directory, and the compact C launcher triggered GCC's -Wmisleading-indentation under the required -Werror build. These defects were fixed in the follow-up commit; the shell launcher now uses mktemp -d and the C entry points use explicit statement blocks.

The corrected remote source files were then fetched, checked against their Git Blob SHA values, and executed in the isolated Linux environment:
- seccomp-exec.c Blob SHA: f32ba52465d7576149ec247b260ae8629efa4708
- seccomp-child-test.c Blob SHA: fb1a201235d856208c67fe5e3e390957e4d13c33
- run-seccomp-integration.sh Blob SHA: 0eb9698e781653660060d5fbce2916a78b0de71a

Result: GCC -Wall -Wextra -Werror compiled both programs; the integration run passed. The parent and fork+exec child both observed EPERM for the test sentinel, mount, umount2, ptrace, unshare, BPF and userfaultfd. Both could still call getpid, read the read-only synthetic fixture, were denied writes to the read-only rootfs with EROFS, and could write to the dedicated scratch mount. The final marker was SECCOMP_FORK_EXEC_INHERITANCE=PASS.

This is still a denylist with default ALLOW, not a full Agent syscall allowlist. The filter is a defense-in-depth layer in the tested launch chain, not a production security certification.


## 2026-11-14 clone-family namespace bypass regression

The seccomp launcher now checks the legacy clone flags argument and returns EPERM whenever a supported CLONE_NEW* namespace flag is present. clone3 is denied with ENOSYS because classic seccomp BPF cannot dereference the userspace clone_args pointer; ENOSYS permits libc to fall back to legacy clone, whose flags are checked. The synthetic client test verifies clone(CLONE_NEWUSER) -> EPERM, clone3(NULL, 0) -> ENOSYS, and confirms that ordinary fork+exec still succeeds. Both the parent and its fork+exec child repeat these checks.

Final source Blob SHAs for the expanded regression set:
- seccomp-exec.c: aed40a67bda0231c6e567a06c286378e4eb023b4
- seccomp-child-test.c: 87825be539a33647939eb46f4aa725b563dc28ce
- run-seccomp-integration.sh: 0eb9698e781653660060d5fbce2916a78b0de71a

The integration harness was rerun after the clone/clone3 checks were added. GCC -Wall -Wextra -Werror succeeded; both parent and child reported DENIED for the test sentinel, mount, umount2, ptrace, unshare, clone namespace flags, clone3 fallback, BPF and userfaultfd; both reported ALLOWED for getpid, fixture read and scratch write; both reported DENIED for writes to the read-only root. The final line was SECCOMP_FORK_EXEC_INHERITANCE=PASS.

The profile remains an x86_64 denylist with default ALLOW. It is not a complete syscall allowlist and does not constitute production sandbox certification.


## Final seccomp launcher blob verification

The final seccomp launcher source, including legacy clone namespace-flag inspection and clone3 ENOSYS fallback behavior, is Git Blob aed40a67bda0231c6e567a06c286378e4eb023b4. This exact source was compiled locally with GCC -Wall -Wextra -Werror and exercised by the namespace/chroot integration harness. The synthetic client and its fork+exec child both reported clone(CLONE_NEWUSER) denied with EPERM and clone3 denied with ENOSYS, while ordinary fork/exec, fixture reads and scratch writes remained successful. The accompanying test source is Blob 87825be539a33647939eb46f4aa725b563dc28ce and the integration launcher is Blob 0eb9698e781653660060d5fbce2916a78b0de71a.


## 2026-11-14 modern mount API and process-handle regression coverage

A further seccomp review identified newer interfaces that could bypass a policy limited to legacy `mount(2)` and `unshare(2)`. The denylist and synthetic regression client now also cover:
- mount API: `open_tree`, `move_mount`, `fsopen`, `fsconfig`, `fsmount`, `fspick`, and `mount_setattr`;
- process/handle APIs: `pidfd_getfd`, `pidfd_send_signal`, `process_madvise`, and `kcmp`.

The exact latest local source files were executed through the namespace/mount/network/PID/chroot/UID/seccomp integration harness. GCC `-Wall -Wextra -Werror` compilation succeeded. Both the original client and its fork+exec child observed EPERM for open_tree, move_mount, fsopen, fsmount, mount_setattr, pidfd_getfd and process_madvise, along with the earlier blocked syscalls. Ordinary getpid, read-only Fixture reads and dedicated Scratch writes remained available; writes to the read-only root returned EROFS; fork+exec filter inheritance passed.

Source Blob identities for the exact tested local bytes:
- `seccomp-exec.c`: `6ab19f64773794f36eb402853c76ff591b4c4f28`
- `seccomp-child-test.c`: `fd114870ac09fd63bb6538f1a10ccee8a467556c`

This remains a denylist with default ALLOW, not a complete syscall allowlist or production Agent policy. The tests cover the listed interfaces on this Linux x86_64 kernel only; they do not establish equivalent behavior on other architectures or kernels.


## 2026-11-14 pidfd signal and kcmp enforcement regression tests

The seccomp denylist already included `pidfd_send_signal` and `kcmp`; the synthetic client regression suite now explicitly exercises both. It expects `pidfd_send_signal` to return EPERM and uses a self-to-self `kcmp(KCMP_FILES)` probe to require EPERM rather than a normal comparison result. The exact updated test file was run in the same namespace/chroot/UID/seccomp harness as the launcher. Both the parent and fork+exec child denied the test sentinel, legacy/new mount APIs, pidfd_getfd, pidfd_send_signal, kcmp, process_madvise, namespace creation paths, BPF and userfaultfd. Both continued to read the fixture, write dedicated scratch and receive EROFS for rootfs writes. Fork+exec filter inheritance passed.

Exact test source Git Blob SHA: `88804bb1e67f1ef03f41233c3dfc7bf822295a2f`.


## 2026-11-14 inherited working-directory escape regression

The seccomp integration runner now deliberately changes its host-side working directory to the disposable temporary directory before invoking chroot. A world-readable synthetic canary is placed in that host directory. The client attempts to open the canary by relative path (`host-cwd-canary`). If the chroot launcher were to preserve the caller's old working directory, the file would be readable and the test would fail. The required result is ENOENT. Both the initial client and its fork+exec child report `DENIED inherited-host-cwd`.

The canary is mode 0444 so an unexpected access cannot be hidden by ordinary permission denial. This specifically verifies that the chroot invocation moves the process working directory into the new root before the unprivileged client starts; it supplements the absolute host-path and symlink checks.

Exact local-execution Git Blob SHAs:
- seccomp-child-test.c: `eccaa7a590b7683001148a50d0fce7767327340d`
- run-seccomp-integration.sh: `f683504f88d38e515dee58be62716d513aa03a94`

The exact updated files were run through the full seccomp integration harness. Both parent and child passed the syscall-denial matrix, cwd canary, readonly fixture read, root-write denial, scratch write and fork+exec inheritance check.


## 2026-11-14 Landlock and cgroup definitive capability check

The earlier Landlock timeout note is superseded by a direct C syscall probe. Calling landlock_create_ruleset(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION) using x86_64 syscall 444 returned ENOSYS (bounded by a 3-second timeout). The tested kernel/runtime does not expose the Landlock syscall; no Landlock policy is present.

The cgroup v2 mount exposes cpuset cpu io memory hugetlb pids in cgroup.controllers, but /sys/fs/cgroup is mounted read-only, cgroup.subtree_control is empty, and creating a child cgroup fails. The current runtime cannot delegate cgroup resource control. Per-process prlimit remains in place, but is not aggregate CPU/memory/PID accounting.


## 2026-11-14 bounded tmpfs scratch integration

The seccomp launch-chain integration no longer bind-mounts a host writable scratch directory into the chroot. It now mounts a dedicated 32 MiB tmpfs at /work inside the private mount namespace with nosuid,nodev,noexec. The synthetic client checks the filesystem type (TMPFS_MAGIC), verifies the NOEXEC/NOSUID/NODEV flags and the configured size ceiling, then creates a scratch marker. Both the original process and its fork+exec child pass. The readonly rootfs still rejects writes with EROFS.

Exact local-execution source Git Blob SHAs:
- seccomp-child-test.c: 21667e37e1c2d75ce9448194df06c504cdb33a5b
- run-seccomp-integration.sh: 83f0dd5c1c1019fc2f638e7f7057d5621027d95e

This confines client scratch writes to a bounded ephemeral filesystem inside the mount namespace rather than a host bind mount. It does not provide aggregate CPU/memory/PID accounting; cgroup delegation remains unavailable and per-process prlimit remains the only resource limit outside the tmpfs byte ceiling.


## 2026-11-14 inherited descriptor closure and inode-bounded scratch (initial implementation; superseded)

The initial seccomp launcher closed file descriptors 3 and above before execing the synthetic client. It used close_range where available and fell back to an RLIMIT_NOFILE-bounded close loop. That fallback was later found incomplete when a descriptor above the current soft limit had been opened before the limit was lowered; it was removed in the subsequent fail-closed hardening recorded at the end of this report. The regression runner deliberately opens a host-only canary as FD 9 before entering the user/mount/network/PID namespace chain. The client must observe EBADF for FD 9; both the initial process and fork+exec child pass this assertion.

The scratch tmpfs now has both a 32 MiB byte ceiling and an explicit 4096-inode ceiling, in addition to nosuid,nodev,noexec. The client checks TMPFS_MAGIC, mount flags, f_blocks/f_frsize capacity, f_files inode count, and actual write behavior. Both parent and fork+exec child pass.

Exact local-execution source Git Blob SHAs:
- seccomp-exec.c: b36b72376cec0b8fc1b2b9b32519b6f077798b1a
- seccomp-child-test.c: 2871732dd3e946b9bdaac71d2a3dfd7f421b1029
- run-seccomp-integration.sh: 0b762b0daf763d3a3ef7f5a358060c17b8efa5c6

These checks reduce inherited-descriptor and scratch-exhaustion exposure. They do not establish cgroup CPU/memory/PID aggregation, Landlock availability, complete syscall mediation, or production Agent safety.


## 2026-11-14 runtime identity and capability assertions

The seccomp client test now reads back its actual execution identity rather than relying only on launch arguments. In both the initial client and its fork+exec child it verifies:
- real/effective UID and GID are all 65534;
- supplementary group count is zero;
- PR_GET_NO_NEW_PRIVS returns 1;
- PR_GET_SECCOMP reports SECCOMP_MODE_FILTER;
- capget effective, permitted and inheritable capability sets are empty;
- PR_CAPBSET_READ returns zero for every capability through CAP_LAST_CAP.

The exact updated client was run in the full namespace/chroot/seccomp integration harness. Both parent and child passed all identity/capability assertions and the existing syscall denial, inherited FD/cwd canary, readonly rootfs, bounded tmpfs and allowed scratch I/O checks.

Exact test Git Blob SHA: c77f27b9062a8522f35a54c099dfb341a247a34c.


## 2026-11-14 exact-blob seccomp integration re-run

The current PR #11 Head at the time of this re-run was `6e9458f9cda1e6b09a2b519857ae866ce47e47b6`. The following three source files were retrieved from that exact commit, reconstructed in a disposable local test directory, and checked with `git hash-object`; each local Git Blob SHA matched the remote file Blob SHA:

- `seccomp-exec.c`: `b36b72376cec0b8fc1b2b9b32519b6f077798b1a`
- `seccomp-child-test.c`: `c77f27b9062a8522f35a54c099dfb341a247a34c`
- `run-seccomp-integration.sh`: `0b762b0daf763d3a3ef7f5a358060c17b8efa5c6`

Execution environment: Linux x86_64, kernel 6.18.57, GCC 14.2.0, effective UID 0, Python 3.13.5 available. The integration harness was executed twice with the exact matching source bytes. Both runs compiled with `gcc -Wall -Wextra -Werror` and passed.

Both the initial synthetic client and its fork+exec child verified UID/GID 65534, zero supplementary groups, `no_new_privs=1`, active seccomp filter mode, empty capability sets and an empty capability bounding set. Both denied the test sentinel, legacy and modern mount APIs, ptrace, pidfd/process-handle calls, kcmp, process_madvise, namespace transitions, clone namespace flags, clone3 (ENOSYS fallback), BPF and userfaultfd. Both retained the expected `getpid`, fixture-read and bounded-tmpfs scratch-write behavior; rejected writes to the read-only rootfs; observed EBADF for inherited host FD 9; and observed ENOENT for the inherited-host-cwd canary. The run ended with `SECCOMP_FORK_EXEC_INHERITANCE=PASS`.

This re-run executes the standalone seccomp integration harness, not the full `linux/run.sh` entry point or the separate Python namespace/chroot probe. The existing PR Standards CI is a separate signal and does not execute this harness. The policy remains an x86_64 denylist with default ALLOW; it is not a production syscall allowlist or Agent sandbox certification.


## 2026-11-14 complete seccomp denylist regression coverage and production-mode check

PR #11 Head before this code update: `4ef2854cdb9499e41a62c60222e3344c434ae569`. The updated files were locally executed twice; the resulting source Blob identities are:

- `seccomp-exec.c`: `eb5e61964858111c5a3e51f2b2c7a6670a431d19`
- `seccomp-child-test.c`: `39f3c8ac94631e0931db8bb82c1d63e31d693891`
- `run-seccomp-integration.sh`: `c1189d6bb93957e31a9023bc4a3033f0894d3fa4`

The test harness now compiles both a test-only pair and a production pair. In test mode, denied syscalls return EACCES (instead of EPERM) so a matching result distinguishes a seccomp rule hit from ordinary permission checks performed by the kernel or LSM. The production build keeps EPERM and leaves the test-only getppid sentinel allowed. This test-mode errno override changes only the denial result used for measurement; the syscall match set is shared with the production build.

The synthetic client now has 42 generic denial assertions plus dedicated kcmp, clone namespace-flag, clone3 fallback and x32 ABI probes. The x32 test runs in a forked child and requires SIGSYS. The production build separately confirms getppid is allowed while denied operations return EPERM. Both build variants run the runtime-identity, capability, inherited-FD/cwd, read-only-root, tmpfs quota, fixture/scratch I/O and fork+exec inheritance checks in parent and child.

Environment: Linux x86_64, kernel 6.18.57, GCC 14.2.0, effective UID 0. Both complete integration-harness runs passed with `-Wall -Wextra -Werror`. This remains synthetic Linux x86_64 validation only; it does not create a production syscall allowlist or authorize real Agent execution.


## 2026-11-14 real filesystem cleanup-failure and quarantine regression

A supplementary integration test was added as `linux/cleanup-failure-integration.sh` and is invoked by the main `linux/run.sh` entry point after the seccomp integration harness.

The script ran three times on Linux x86_64 / kernel 6.18.57 inside the same isolated Kata/container environment. Each run created a private user + mount namespace and mounted a disposable tmpfs below an owned resource root. An actual `os.rmdir(mountpoint)` call returned kernel `EBUSY`; any other errno would fail the test.

All three runs produced the same results:

```text
REAL_CLEANUP_FAILURE=PASS errno=EBUSY
QUARANTINE_REUSE_GUARD=PASS
QUARANTINED_RESOURCE_PRESERVED=PASS
QUARANTINE_RECOVERY_AND_CLEANUP=PASS
```

Before renaming the owned resource tree, the helper atomically persists the `quarantining` state. It then moves the tree to a distinct quarantine path, persists `quarantined`, reads the owner record back and verifies reuse is rejected while the mounted canary remains accessible only through the quarantine path. Explicit `umount` and owned-path removal are required before the state becomes `cleaned`.

Exact cleanup harness Git Blob SHA: `97aaea4f700ff15e91ab127774b21b5dce76521d`.

Scope: this demonstrates a genuine filesystem cleanup failure and a focused persisted quarantine/non-reuse/recovery flow. The core Python probe's own cleanup-failure state-machine branch remains deterministic fault injection; the supplemental harness is not a full integration of every production resource-owner path and does not cover every possible filesystem failure mode.


The cleanup helper's owner-record update now flushes and fsyncs the temporary file before atomic replacement, then fsyncs the containing directory. This orders the persisted `quarantining` state before the quarantine rename and persists the follow-up state transitions. The behavior is exercised on the temporary filesystem in the integration test; it is not a durability certification for arbitrary filesystems or storage hardware.

The latest local re-run used source copies reconstructed from the GitHub-returned file contents. The seccomp test/production harness passed twice, with the six RLIMIT ceilings read back in both parent and fork+exec child; the real tmpfs EBUSY/quarantine test passed three times. However, the local copies were not proven byte-identical to the remote Git Blob values. Treat these results as local behavior validation, not exact-Blob replay evidence.


## 2026-11-14 exact-blob seccomp and cleanup replay

At PR Head `e069e4cbec2ef079081a1926278f10718d11b857`, all four helper inputs used for the latest replay were verified locally with `git hash-object` and matched their committed GitHub Blob SHAs:

- `seccomp-exec.c`: `eb5e61964858111c5a3e51f2b2c7a6670a431d19` — exact match.
- `seccomp-child-test.c`: `c9dcf4768f0704efa99466437d02acf598a1f2ae` — exact match.
- `run-seccomp-integration.sh`: `4975a6883fa628c1fe5e5c92a49458a2da96f8fa` — exact match.
- `cleanup-failure-integration.sh`: `8e21f56b26ad2620556f8c1406ba44d9f150b30f` — exact match.

The exact-Blob seccomp harness was run twice with GCC `-Wall -Wextra -Werror`. Both test-mode and production-mode variants passed, including the declared syscall-denial probes, clone/clone3 namespace bypass cases, x32 ABI SIGSYS, fixture/scratch access, read-only-root denial, inherited FD/cwd canaries, bounded tmpfs, production getppid allowance and fork+exec filter inheritance. The six soft/hard RLIMIT ceilings (CORE 0, CPU 10s, FSIZE 1 MiB, NOFILE 64, NPROC 64, AS 256 MiB) were read back successfully in both parent and fork+exec child. Resource-limit probe output formatting was corrected to emit normal line breaks before this replay.

The exact-Blob cleanup helper was run three times. Every run returned the real kernel EBUSY for the mounted tmpfs removal, persisted quarantine state, blocked reuse, preserved the quarantined mount and completed explicit unmount/recovery:
```text
REAL_CLEANUP_FAILURE=PASS errno=EBUSY
QUARANTINE_REUSE_GUARD=PASS
QUARANTINED_RESOURCE_PRESERVED=PASS
QUARANTINE_RECOVERY_AND_CLEANUP=PASS
```

The compressed Python core probe was not re-run in this pass because the local temporary gzip copy failed `gzip -t`; prior three-run core-probe evidence remains separate. Therefore this is exact-Blob replay of the seccomp and cleanup helpers, **not** a full `run.sh` end-to-end replay. The committed gzip blob remains `ae64fb2f651018e53705990c2f715ea25fa465b9`.


## 2026-11-14 exact-Blob core-probe replay (superseding interim failure note)

The earlier temporary-copy attempt failed `gzip -t`, so the compressed probe was not executed in that pass. This was a local transfer-artifact problem, not a defect in the committed gzip blob. The exact current PR file was subsequently fetched through the GitHub Contents API and revalidated before execution.

- PR Head at replay: `c715a1bd48771d7fbab88036e662ef6da6ba7070`.
- Compressed file: `prototypes/scp-sandbox/0.1/linux/probe.py.gz`.
- Compressed Git Blob SHA-1: `ae64fb2f651018e53705990c2f715ea25fa465b9` (exact match).
- `gzip -t`: PASS.
- Decompressed source Git Blob SHA-1: `88e08595b3f74fc7c5c59fb13c9473f94dbb5503` (exact match).
- Environment: Linux x86_64, kernel `6.18.57`, isolated container runtime, effective UID 0.
- Execution: decompressed the exact verified gzip bytes and ran the source under `timeout --signal=TERM --kill-after=5s 90s python3`.

Result: `RESULT=GATE_A_AND_B_CORE_PROBES_PASS; NOT A PRODUCTION SANDBOX CERTIFICATION`.

The exact committed core probe passed its user/mount/network/PID namespace setup, UID/GID drop to 65534, no_new_privs and capability drop, read-only rootfs, host path and symlink containment, hidden proc/sys, dedicated scratch write, host loopback isolation, PID descendant teardown, host environment non-inheritance, synthetic shim access-denial probes, 4096-byte output cap with exact synthetic-marker redaction, cleanup ownership/quarantine and normal cleanup.

This closes the previously outstanding exact-Blob **core-probe** replay. It does not claim that the complete `linux/run.sh` wrapper was executed end-to-end in one invocation: the exact-Blob seccomp integration and cleanup-failure helpers were exercised separately in their previously documented runs. Existing Standards CI is also separate and does not run these SCP-specific probes.


## 2026-11-14 explicit quarantine admission check (exact-Blob rerun)

The earlier cleanup helper emitted a reuse-guard PASS after inspecting only the persisted state value; it did not attempt the harness admission path. That assertion was too weak. The helper was corrected so its test-only `acquire_resource()` path admits a resource only when the persisted record is `active` and still names the original owned root. The test now attempts acquisition and requires denial in each non-active state:

- `quarantining`: rejected before the owned tree is renamed;
- `quarantined`: rejected after the quarantine path and state are persisted;
- `cleaned`: rejected after explicit unmount and owned-path removal, until the owner record is removed.

The `active` state is separately required to admit the original owned resource. The exact committed helper Blob is `bde76808b7dbf7af1dcf895fa207fe19e880d6e1`; the local `git hash-object` result matched it before execution. Three consecutive executions on Linux x86_64 / kernel 6.18.57 passed. Every run observed the real mounted-tmpfs `EBUSY`, rejected the three non-active admission attempts, preserved the quarantined mount, and completed explicit unmount/recovery.

Scope: this is an explicit state-based admission check implemented inside the synthetic test helper. It still does not test a production resource manager, symlink/race/partial-creation handling, or crash recovery across process restart. Production cleanup-manager acceptance remains closed.


## 2026-11-14 close_range regression and standard-I/O harness execution

This section supersedes the prior execution-pending note. The first attempt to run the helper through the documented POSIX sh entry exposed a test-harness portability defect: the exec 100<file construct was parsed as an attempted command by the container's /bin/sh (dash). The helper was corrected to open and duplicate FD 9 and FD 100 through Python, then pass only those descriptors to the namespace chain. The launcher and its fail-closed close_range behavior were not weakened.

The client test also verifies the standard-I/O boundary in the synthetic runner harness:
- stdin is explicitly /dev/null (character device major 1, minor 3);
- stdout and stderr are supervisor-created pipes;
- the client checks all three descriptors in both the initial process and fork+exec child, in test and production seccomp variants;
- the harness incrementally drains stdout/stderr with selectors and retains at most 64 KiB combined (plus one 4 KiB read buffer). It terminates the child process group on overflow or the 65-second parent deadline. Standalone helper tests cover exact-limit acceptance, overflow termination and silent-timeout termination (3/3 local pass). This remains test-harness capture, not production Runner or online back-pressure certification.

Exact source identities at the replay:
- seccomp-exec.c: c59d673e0094d6e604649d9ddca85624f812f620 (unchanged exact remote Blob).
- seccomp-child-test.c: 14d4f6b32c23de5f39889a2da5a2967b51102d95.
- run-seccomp-integration.sh: 14c7bb8504b2da6ed637501bf6f8a29085d6be5f.
- cleanup-failure-integration.sh: bde76808b7dbf7af1dcf895fa207fe19e880d6e1 (unchanged).

Environment: Linux x86_64, kernel 6.18.57, effective UID 0, GCC 14.2.0, Python 3.13.5. The modified helper was invoked explicitly with sh, compiled with -Wall -Wextra -Werror, and passed three consecutive runs.

Each run verified:
- forced close_range unavailability returns launcher exit 69 and does not create the client marker;
- FD 9 and FD 100 are EBADF in the test and production clients, including fork+exec children, after the process limit is reduced to 64;
- the six soft/hard RLIMIT ceilings, UID/GID 65534, empty supplementary groups/capabilities, no_new_privs, seccomp state, syscall-deny probes, namespace-clone checks, x32 rejection, read-only root, bounded tmpfs and fork+exec filter inheritance;
- controlled standard I/O in four client contexts per run (test/production x initial process/fork+exec).

This remains a synthetic Linux x86_64 launch-chain test, not a production Runner. It does not establish a production stdin policy, online output back-pressure, aggregate resource control, complete syscall allowlist, LSM policy, general secret scanning, or cross-platform support.

The compressed core probe and real-filesystem cleanup helper retain their separately recorded exact-Blob evidence. The complete linux/run.sh combined invocation has not been run in one invocation in this pass. Existing Standards CI does not execute this Sandbox harness. The bounded-capture self-test is local helper evidence, not a rerun of the integrated seccomp harness.
