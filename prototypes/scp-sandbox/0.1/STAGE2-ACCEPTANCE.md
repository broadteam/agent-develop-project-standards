# SCP Stage 2 Sandbox Acceptance Register

**Snapshot:** 2026-11-14  
**Scope:** Synthetic Linux x86_64 security prototype only  
**Decision:** Limited Linux x86_64 prototype evidence is recorded for the controls listed below. Production Sandbox acceptance and Stage 3 authorization remain closed. The close_range and standard-I/O harness corrections passed three consecutive executions.

## Acceptance status

| Control / gate | Status | Evidence and boundary |
|---|---|---|
| User + mount + network + PID namespaces | PASS (tested runtime) | Prior three-run core-probe record; namespace operations fail closed when unavailable. |
| Read-only rootfs / chroot / host path / symlink / cwd boundary | PASS (tested runtime) | Core probe plus targeted cwd canary regression. |
| UID/GID 65534, empty groups and capability sets, no_new_privs | PASS (tested runtime) | Readback in seccomp client; parent and fork+exec child. |
| Seccomp architecture check, x32 rejection, clone/clone3 namespace bypass | PASS (targeted x86_64) | Denylist only; test-mode EACCES distinguishes rule match; production mode retains EPERM. |
| Seccomp syscall regression list | PASS (listed denylist probes only) | The exact latest integration compiled test/production variants and verified the listed probes, including `setsid` and `setpgid`, in initial and fork+exec clients. Not a complete allowlist; unlisted syscalls default ALLOW. |
| Bounded scratch | PASS (tested runtime) | 32 MiB / 4096 inode tmpfs with nosuid,nodev,noexec. |
| Inherited host FD closure | PASS (latest exact entry, 3/3) | Current exact `run-seccomp-integration.sh` Blob `091c9a64c5573d4158c2fe92b73b921bc5eb362e`: close_range closes FD 9/100; forced-unavailable exits 69 before client exec. All three full `linux/run.sh` replays passed. |
| Standard I/O descriptors 0–2 | PASS (latest exact entry) | Current exact harness binds stdin to `/dev/null` and stdout/stderr to pipes; the client verifies FD 0–2 in parent and fork+exec paths in test and production modes. Synthetic Runner contract only. |
| Resource ceilings | PASS (per-process / per-UID limits only) | Readback: CORE 0, CPU 10s, FSIZE 1 MiB, NOFILE 64, NPROC 64 per UID, AS 256 MiB. Not aggregate CPU or memory accounting. |
| Wall-clock hang containment | PASS (exact Linux prototype entry) | Core probe 90s, seccomp parent 60s with direct process-group ownership and TERM/KILL teardown, cleanup helper 15s. All three full entry runs completed. |
| Real cleanup failure / quarantine | PASS (one failure class) | Mounted tmpfs removal returns EBUSY. The synthetic admission path admits only `active` and explicitly rejects `quarantining`, `quarantined` and `cleaned`; explicit unmount and cleanup recover. Owner record is fsync'd before/after atomic state replacement. This is not a production resource manager. |
| Combined `linux/run.sh` end-to-end | PASS (3/3 latest exact-Blob runs) | All six current Git Blob identities were checked before execution. The full core + seccomp + real cleanup entry returned exit code 0 three times on Linux x86_64 / kernel 6.18.57, including the new normal-exit orphaned-descendant teardown regression. One-runtime synthetic evidence, not production certification. |
| Residual descendants after normal leader exit | PASS (3/3 latest exact-Blob runs) | Parent scans `/proc` for live non-zombie members of its owned PGID after leader exit and terminates them with TERM/KILL escalation. Regression closes descendant stdio, ignores TERM and proves its delayed marker is never written. | 
| `/proc` inspection behavior | PASS (3/3 latest exact-Blob runs) | Four malformed/unreadable stat cases fail closed; unreadable `/proc` root enumeration also fails closed. Positive fixtures verify live-member detection (including a `comm` containing `)`), unrelated-PGID exclusion and zombie exclusion. `FileNotFoundError` and `ProcessLookupError` between enumeration and open are tolerated as PID-disappearance races. All new cases passed in each full entry run. |
| Output bounds / synthetic marker redaction | PASS (bounded prototype evidence only) | Core probe capture is capped at 4096 bytes and redacts one exact synthetic marker only. Latest seccomp harness enforces a 64 KiB combined streaming cap and process-group teardown on overflow/timeout; exact-limit, overflow and silent-timeout probes passed in all three full entry runs. Not a general secret scanner or production Runner. |
| Host preflight — prototype prerequisites | PASS (2026-11-15, tested runtime) | Exact compressed source SHA-256 `a55e3bf55285f1b90ac169750283c8d6333fbd20623d8a6f3a51d6c76bf35f8d`; six unit tests passed; live Linux x86_64 preflight confirmed namespace/tmpfs, `/proc`, required tools and seccomp primitive. This is host capability evidence only. |
| Host preflight — production host controls | BLOCKED (tested runtime) | cgroup v2 hierarchy is read-only and has no delegated `cpu`/`memory`/`pids` subtree controls; aggregate process-tree enforcement is unavailable. Strict preflight exit code 3. |
| Landlock / LSM policy | UNAVAILABLE / NOT VERIFIED | Landlock syscall returned `ENOSYS`; LSM policy interfaces were not readable/auditable in this runtime. No policy is claimed. |
| Host socket / egress / production syscall allowlist / general secret scanning | NOT VERIFIED | These require a final mount/network plan, client-version-pinned policy and independent review; host capability probing cannot self-certify them. |
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

All six required source Blobs for `linux/run.sh` were checked and the complete entry was executed three consecutive times with exit code 0 on Linux x86_64 / kernel `6.18.57`. This includes the exact compressed core probe, latest seccomp parent/C sources with `setsid` / `setpgid` denials, the FD 9/100 and controlled-stdio assertions, bounded capture / process-group timeout probes, and real tmpfs EBUSY quarantine recovery. Exact source IDs and run details are recorded at the end of VALIDATION-REPORT.md. This closes only the combined synthetic Linux entry-point execution gap.

## Repository governance

PR #11 remains Open + Draft. D0 is the only user-confirmed frozen decision. D1/D2/D3 and SCP fixture, Normalized Result and Run Manifest contracts remain Draft. This register records evidence and outstanding gates; it does not freeze a schema, enable CI gating, authorize production use or merge the PR.
### Latest seccomp parent revision

The current seccomp script Blob `57784e61845b16e7f3145c182affdd93af55d9dc` was executed as part of the full `linux/run.sh` entry three completed times. The parent observes leader exit with `waitid(WNOWAIT)`, terminates residual members while the unreaped leader still pins the PGID, then reaps it. Any inspection failure during the initial scan or TERM grace-period scan triggers SIGKILL before a hard teardown error is propagated; an unverifiable cleanup is never reported as successful. Dedicated real-process regressions verify that a same-PGID descendant which ignores TERM and has already announced readiness does not write its delayed survivor marker after either failure point. Mock assertions separately verify signal ordering and error propagation. All `/proc` parser/race/fail-closed cases, 64 KiB streaming capture, orphan/overflow/timeout self-tests and current C client were exercised in each run.
### Process-group escape denials

The exact current seccomp wrapper/client Blobs were compiled and executed in test and production modes. Both `setsid` and `setpgid` denial probes passed in the initial and fork+exec processes. The orphaned-descendant-after-normal-exit regression also passed in all three full entry runs.
