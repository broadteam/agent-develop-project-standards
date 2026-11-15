# Linux Host Preflight Contract 0.1

**Status:** Draft. This contract defines host prerequisites for the SCP Linux x86_64 prototype. It is not production acceptance, a security certification, or authorization to run an Agent.

## Purpose

The sandbox prototype already checks namespace creation, a read-only root, seccomp denylist behavior, per-process resource limits and teardown. Those checks do not prove that the host can enforce aggregate process-tree resource limits or that the surrounding security policy is configured correctly. This preflight separates:

- **Prototype runtime prerequisites:** capabilities needed to execute the current synthetic Linux test harness.
- **Production host controls:** delegated aggregate cgroup limits and independently reviewed LSM, egress, socket, syscall and secret-handling policies.

A successful prototype gate must never be interpreted as production readiness.

## Invocation

Run from the repository root:

```sh
gzip -dc prototypes/scp-sandbox/0.1/linux/host-preflight.py.gz | sudo python3 - --json
```

Run the strict production-host gate:

```sh
gzip -dc prototypes/scp-sandbox/0.1/linux/host-preflight.py.gz | sudo python3 - --strict-production
```

The strict command exits **3** unless every production host-control row is PASS. It currently exits 3 in the recorded test runtime.

### Optional delegated cgroup write probe

An administrator may explicitly supply a pre-created, delegated cgroup v2 directory:

```sh
gzip -dc prototypes/scp-sandbox/0.1/linux/host-preflight.py.gz | sudo python3 - --cgroup-root /sys/fs/cgroup/<delegated-directory> --strict-production
```

This option is intentionally active: it creates a temporary empty child cgroup, writes and reads back `cpu.max`, `memory.max` and `pids.max`, then removes the child. It does not move any process into that cgroup, change the parent controller configuration, or modify existing workload limits. Only run it against a dedicated delegated directory whose controller delegation is already configured. Without `--cgroup-root`, discovery is read-only and does not attempt a write.

## Checks and interpretation

| Check | What is actually probed | Required gate |
|---|---|---|
| Platform and privilege | Linux x86_64 and effective UID 0, as required by the current launcher | Prototype |
| Toolchain | Python 3, GCC, gzip, unshare, mount, chroot, setpriv, prlimit, ldd and BusyBox | Prototype |
| Process inspection | Readable `/proc/self/stat`, `NSpid` and PID-directory enumeration | Prototype |
| Namespace and tmpfs | Disposable user/mount/network/PID namespaces, UID/GID maps, private mount propagation, tmpfs mount/unmount, no non-loopback network interface or default route | Prototype |
| Seccomp primitive | A disposable child sets `no_new_privs`, installs a trivial classic-BPF filter and reads back filter mode | Prototype |
| cgroup v2 delegation | `cpu`, `memory`, `pids` controllers available and enabled beneath the delegated root; optional isolated child write/readback | Production |
| Landlock | Kernel ABI availability only; this is diagnostic, not a required policy by itself | Diagnostic |
| LSM policy | Host LSM interfaces and labels are inspected, but the required policy must be independently audited | Production |
| Host sockets and egress | Final mount plan and network policy require explicit review; host capability probing cannot prove future bind mounts or allowed destinations | Production |
| Client syscall policy | A client-version-pinned, reviewed allowlist and regression corpus are required; the current prototype is a denylist with default ALLOW | Production |
| Secret handling | A documented secret model and general pre-persistence scanner/redaction tests are required; the current prototype recognizes one synthetic marker | Production |

The seccomp primitive check only proves that this host accepts installation of a BPF filter. It does not validate the prototype's denylist and does not prove that a complete Agent syscall allowlist exists. Those are separate integration and review obligations.

The network namespace probe verifies that the disposable namespace has only loopback and no external default route. It does not authorize egress to a Provider or prove the final Runner mount/network plan.

## Status values and exit codes

- `PASS`: the specific bounded check was executed and passed.
- `BLOCKED`: a required capability or explicit delegation is absent or denied.
- `UNAVAILABLE`: the kernel/runtime reports the feature unavailable (for example, Landlock `ENOSYS`).
- `NOT_VERIFIED`: the check needs an external policy review or evidence not derivable from host capability probing.

Default execution returns **0** only when the prototype runtime gate is PASS; it may still report production controls as BLOCKED or NOT_VERIFIED. It returns **2** when prototype prerequisites are blocked. `--strict-production` returns **3** unless the production host-control gate is PASS.

The JSON output uses schema `scp-host-preflight/1.0` and is evidence for the observed host at the time of execution. It is not a durable attestation and should be stored with the exact host image, kernel, runtime and script Blob identity.

## Current tested-runtime result (2026-11-15)

The checked runtime reported:

- Prototype runtime: **PASS**. Linux x86_64, effective UID 0, required tools, `/proc`, user/mount/network/PID namespace creation, UID/GID maps, private mount propagation, bounded tmpfs mount/unmount and seccomp filter installation all passed.
- Production host controls: **BLOCKED**. The cgroup v2 controllers were visible, but `/sys/fs/cgroup` was read-only and `cgroup.subtree_control` had no delegated controllers. Aggregate process-tree CPU/memory/PID enforcement was therefore not available.
- Landlock: **UNAVAILABLE**. `landlock_create_ruleset` returned `ENOSYS`.
- LSM policy audit: **NOT_VERIFIED**. The runtime did not expose a readable `/sys/kernel/security/lsm` interface; no required AppArmor/SELinux/Landlock policy was verified.
- Host socket/egress policy, actual-client syscall allowlist and generalized secret scanning: **NOT_VERIFIED**.

The standalone preflight self-test passed 6/6 parser and fail-closed gate tests. The default command returned 0 with the prototype gate PASS; the strict production command returned 3 as designed. This closes a host-capability discovery/documentation gap only. Production Sandbox remains NOT ACCEPTED and Gate C remains CLOSED.

## Non-goals

This tool does not create cgroups unless the explicit `--cgroup-root` option is supplied. It does not install LSM policies, change host firewall rules, mount host paths, alter host sockets, launch an Agent, call a Provider, access production credentials, or certify kernel-escape resistance.
