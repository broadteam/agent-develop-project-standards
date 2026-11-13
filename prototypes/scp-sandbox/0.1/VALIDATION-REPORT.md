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

The output-flood probe produced more than the 4096-byte allowance. The capture routine retained at most 4096 bytes, terminated the namespace owner, and did not persist the raw overflow output. The cleanup fault case was injected into the ownership/quarantine state transition; it verified non-reuse after quarantine but did not simulate a real filesystem deletion failure.

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
- real host filesystem deletion-failure behavior (the cleanup failure was injected at the state-machine boundary);
- production-grade evidence retention, immutable Run Manifest storage or CI enforcement.

The current implementation also requires an environment capable of creating the explicit UID/GID maps; a typical locked-down container may reject this. The launcher reports failure rather than falling back to a weaker test.

## CI and repository boundary

The probe was run directly in the isolated execution environment. The repository's existing `.github/workflows/standards-ci.yml` does not run this prototype. No workflow, CI gate, schema, Runner, Registry, Writer, Store or production Agent integration was added.

Gate C (real Agent invocation) remains closed. Before it can be considered, the backend needs a separate platform security review, additional adversarial probes (including syscall and resource enforcement), and explicit authorization for the specific client and credential/network scope.


## Follow-up security primitive discovery

A separate seccomp-BPF smoke test was compiled with GCC and executed successfully. It set `no_new_privs`, installed a classic BPF filter using `PR_SET_SECCOMP`, denied the harmless `getppid` syscall with `EPERM`, and printed `SECCOMP_FILTER=PASS`. This proves only that this process/kernel accepted that small filter. The filter is **not installed by the current namespace/chroot sandbox probe** and is not evidence of syscall restriction in the Gate A/B run.

The cgroup v2 hierarchy exposed controllers `cpuset cpu io memory hugetlb pids`, but the mounted `/sys/fs/cgroup` root was not writable and no child cgroup could be created. The current probe therefore relies on per-process `prlimit` bounds; it does not claim cgroup-enforced aggregate resource limits.

A Landlock ABI version query using the expected Linux syscall did not return within a 2-second bounded probe in this environment. Landlock availability is therefore **unknown** here; no Landlock support or enforcement is claimed and the syscall probe was not integrated.

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
