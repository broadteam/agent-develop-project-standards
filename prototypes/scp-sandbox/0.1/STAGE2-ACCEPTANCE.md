# SCP Stage 2 Sandbox Acceptance Register

**Snapshot:** 2026-11-14  
**Scope:** Synthetic Linux x86_64 security prototype only  
**Decision:** Limited Linux prototype evidence is recorded; production sandbox acceptance and Stage 3 authorization remain closed.

## Acceptance status

| Control / gate | Status | Evidence and boundary |
|---|---|---|
| User + mount + network + PID namespaces | PASS (tested runtime) | Prior three-run core-probe record; namespace operations fail closed when unavailable. |
| Read-only rootfs / chroot / host path / symlink / cwd boundary | PASS (tested runtime) | Core probe plus targeted cwd canary regression. |
| UID/GID 65534, empty groups and capability sets, no_new_privs | PASS (tested runtime) | Readback in seccomp client; parent and fork+exec child. |
| Seccomp architecture check, x32 rejection, clone/clone3 namespace bypass | PASS (targeted x86_64) | Denylist only; test-mode EACCES distinguishes rule match; production mode retains EPERM. |
| Seccomp syscall regression list | PASS (listed syscalls only) | Not a complete allowlist; unlisted syscalls default ALLOW. |
| Bounded scratch | PASS (tested runtime) | 32 MiB / 4096 inode tmpfs with nosuid,nodev,noexec. |
| Inherited host FD closure | PASS (tested runtime) | FD 9 canary unavailable to parent/child client. |
| Resource ceilings | PASS (per-process / per-UID limits only) | Readback: CORE 0, CPU 10s, FSIZE 1 MiB, NOFILE 64, NPROC 64 per UID, AS 256 MiB. Not aggregate CPU or memory accounting. |
| Wall-clock hang containment | PASS (runner configuration) | Core 90s, seccomp 60s, cleanup 15s. |
| Real cleanup failure / quarantine | PASS (one failure class) | Mounted tmpfs removal returns EBUSY; persisted quarantine state prevents reuse; explicit unmount and cleanup recover. Owner record is fsync'd before/after atomic state replacement in the current test. |
| Output bounds / synthetic marker redaction | PASS (narrow fixture scope) | 4096-byte capture and exact synthetic marker only; not a general secret scanner. |
| cgroup v2 delegated resource control | BLOCKED | Controllers visible, cgroup2 hierarchy read-only; cannot create delegated child cgroups. |
| Landlock | UNAVAILABLE in tested runtime | landlock_create_ruleset returned ENOSYS; no Landlock policy installed. |
| LSM policy / kernel-escape resistance | NOT VERIFIED | No AppArmor/SELinux policy audit or kernel-escape certification. |
| General-purpose cleanup manager | NOT ACCEPTED | EBUSY quarantine probe is a focused lifecycle test, not broad resource-manager coverage. |
| Windows / macOS backend | NOT IMPLEMENTED | No cross-platform equivalence claim. |
| Real Agent / Provider / production credentials | NOT AUTHORIZED | Gate C remains closed; no such calls are included in this prototype. |

## Gate interpretation

- **Stage 2 Linux x86_64 synthetic prototype:** limited evidence is available for the rows marked PASS, on the tested runtime and exact listed probes.
- **Production Sandbox readiness:** NOT ACCEPTED. Aggregate resource control, a complete syscall allowlist, LSM policy, general secret handling, broad cleanup ownership, and kernel/runtime threat review remain outstanding.
- **Cross-platform readiness:** NOT ACCEPTED. Linux evidence does not transfer to Windows or macOS.
- **Stage 3 real Agent invocation:** CLOSED. It requires a separate platform security review and explicit, scope-specific authorization.

## Required closure conditions before any Stage 3 proposal

1. Provide aggregate process-tree CPU, memory and PID limits through delegated cgroup v2 or an equivalent external supervisor; test both exhaustion and cleanup.
2. Define the syscall policy for the actual approved client and justify every allowed syscall; the current denylist is not an allowlist.
3. Define and test the LSM / filesystem / network egress policy and host-socket exposure boundary.
4. Turn owner records, quarantine and recovery into a general resource manager with symlink/race/partial-creation tests and process-crash recovery.
5. Define secret handling and redaction beyond the single synthetic marker; prove bounded-output behavior before persistence.
6. Produce independent Windows and macOS backend evidence or explicitly scope SCP Sandbox support to Linux only.
7. Complete a security review and obtain explicit authorization for the exact Agent client, Provider, credentials and data boundary.

## Validation provenance

The post-commit source audit established exact Git Blob matches for seccomp-exec.c, run-seccomp-integration.sh and cleanup-failure-integration.sh. The matching seccomp wrapper/launcher passed twice; the exact cleanup helper passed three times. The RLIMIT-enhanced seccomp-child-test.c local reconstruction did not match the committed Blob SHA, so its RLIMIT assertions are behavior-tested but not exact-Blob verified. The compressed Python probe was not re-run because the local temporary gzip copy failed gzip validation; the prior three-run core-probe record remains separate. The PR's committed Blob identities and precise replay boundary are recorded in VALIDATION-REPORT.md.

## Repository governance

PR #11 remains Open + Draft. D0 is the only user-confirmed frozen decision. D1/D2/D3 and SCP fixture, Normalized Result and Run Manifest contracts remain Draft. This register records evidence and outstanding gates; it does not freeze a schema, enable CI gating, authorize production use or merge the PR.
