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
| Seccomp syscall regression list | PASS (listed syscalls only) | Not a complete allowlist; unlisted syscalls default ALLOW. |
| Bounded scratch | PASS (tested runtime) | 32 MiB / 4096 inode tmpfs with nosuid,nodev,noexec. |
| Inherited host FD closure | PASS (prior exact harness revision) | The three POSIX-sh runs used `run-seccomp-integration.sh` Blob `14c7bb8504b2da6ed637501bf6f8a29085d6be5f`: close_range closes FD 9/100, and forced-unavailable exits 69 before client exec. The latest parent-wrapper revision has not yet been re-run end-to-end. |
| Standard I/O descriptors 0–2 | PASS (prior exact harness revision) | The prior `14c7bb...` revision bound stdin to /dev/null and stdout/stderr to pipes; the client verified FD 0–2 in parent and fork+exec paths. This does not certify a production Runner. |
| Resource ceilings | PASS (per-process / per-UID limits only) | Readback: CORE 0, CPU 10s, FSIZE 1 MiB, NOFILE 64, NPROC 64 per UID, AS 256 MiB. Not aggregate CPU or memory accounting. |
| Wall-clock hang containment | PASS (runner configuration) | Core 90s, seccomp 60s, cleanup 15s. |
| Real cleanup failure / quarantine | PASS (one failure class) | Mounted tmpfs removal returns EBUSY. The synthetic admission path admits only `active` and explicitly rejects `quarantining`, `quarantined` and `cleaned`; explicit unmount and cleanup recover. Owner record is fsync'd before/after atomic state replacement. This is not a production resource manager. |
| Output bounds / synthetic marker redaction | PASS (core probe) / PARTIAL (latest seccomp parent) | Core probe capture is capped at 4096 bytes and redacts one exact synthetic marker only. Latest seccomp parent Blob `cfd709e8...` implements a 64 KiB combined streaming capture cap; exact/overflow/timeout helper tests passed 3/3 in a separate local harness, but the integrated latest script remains pending execution. Not a general secret scanner or production Runner. |
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

The post-commit source audit established exact Git Blob matches for seccomp-exec.c, seccomp-child-test.c, run-seccomp-integration.sh and cleanup-failure-integration.sh. The exact-Blob seccomp harness passed twice, including all six RLIMIT readbacks in parent and fork+exec child. The cleanup helper was then corrected to exercise its test-only resource admission path and rerun three times from exact Blob `bde76808b7dbf7af1dcf895fa207fe19e880d6e1`; each run verified real EBUSY, active-only admission, explicit denial in `quarantining` / `quarantined` / `cleaned`, quarantine preservation and recovery. On 2026-11-14, the exact committed compressed Python core probe also passed gzip validation and execution after compressed/decompressed Git Blob SHA verification. The combined linux/run.sh wrapper was not executed end-to-end in one invocation; component evidence is recorded separately in VALIDATION-REPORT.md.

## Repository governance

PR #11 remains Open + Draft. D0 is the only user-confirmed frozen decision. D1/D2/D3 and SCP fixture, Normalized Result and Run Manifest contracts remain Draft. This register records evidence and outstanding gates; it does not freeze a schema, enable CI gating, authorize production use or merge the PR.
### Latest seccomp parent revision

The prior bounded-capture script Blob was `cfd709e8a668c578228bc34946c099730584dc3f`. The current script removes nested GNU `timeout`, launches `unshare` directly in a new session, corrects the double-escaped flood self-test and gives the parent ownership of the 60-second process-group timeout. The capture algorithm passed 3/3 separate local tests; the current integrated script and full seccomp launch-chain have not yet been re-run.
