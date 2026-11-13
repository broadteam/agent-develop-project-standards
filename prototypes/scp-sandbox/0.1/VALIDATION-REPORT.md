# Linux Sandbox Prototype Validation Report

**Date:** 2026-11-13  
**Prototype:** SCP Linux x86_64 namespace/chroot probe 0.1  
**Result:** Gate A and Gate B core probes passed; not a production sandbox certification.

## Execution environment

- OS: Linux x86_64
- Kernel: 6.18.57
- Runtime: isolated Kata/container execution environment with effective UID 0
- Python: system Python 3 (standard library only)
- Required host utilities: `unshare`, `mount`, `chroot`, `setpriv`, `prlimit`, `ldd`, BusyBox
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
- syscall filtering via seccomp, Landlock, LSM/AppArmor/SELinux or cgroup-enforced resource accounting;
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
