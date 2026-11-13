# SCP Linux Sandbox Probe 0.1

**Status:** Linux x86_64 security-probe prototype. Gate A and Gate B core probes passed in the recorded execution environment. This is not a production sandbox certification.

## Run

From the repository root, in a disposable Linux x86_64 VM/container that allows user, mount, network and PID namespaces:

```sh
sudo sh prototypes/scp-sandbox/0.1/linux/run.sh
```

The current probe deliberately requires effective UID 0 to establish its explicit UID/GID maps. It also requires Python 3, `gzip`, `unshare`, `mount`, `chroot`, `setpriv`, `prlimit`, `ldd`, and BusyBox. The script fails closed when a required executable or namespace operation is unavailable. It does not silently downgrade to a temporary-directory-only test.

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

The launcher expands it into a fresh temporary file, runs Python, and removes the temporary source on exit.

## Known limits

- Linux x86_64 only; no Windows or macOS implementation.
- This probes namespace/chroot isolation inside the current execution environment. It is not a general-purpose sandbox manager or an approved Agent Runner.
- No seccomp syscall profile, Landlock policy, cgroup v2 delegation, AppArmor/SELinux policy or kernel-escape testing is included.
- Network evidence is limited to the isolated namespace and a host-loopback reachability probe. No live DNS/provider/network allow-list integration is implemented.
- The redactor only recognizes the exact synthetic test marker. It is not a general secret scanner.
- Cleanup quarantine was exercised with deterministic state/failure injection, not by forcing a real host filesystem deletion failure.
- No real Agent client, production credential, Provider request, user repository, production Git observer or persistent Run Manifest store is involved.

The result is therefore **Gate A + Gate B core-probe evidence for one Linux environment**, not production readiness. Gate C (real Agent invocation) remains closed pending a separate security review and explicit authorization.

This prototype is not invoked by the repository's existing CI workflow. No CI workflow or gate was added.
