# SCP 0.2 Schema and Compatibility Policy (D1 Draft)

**Status:** Draft for review. This contract is not frozen and is not an implementation gate.

## Authority and representation

- `schemas/scp/0.2/continuity-packet.schema.json` is the sole machine-readable contract proposed for SCP 0.2.0.
- JSON instances target JSON Schema Draft 2020-12. Consumers MUST enable format assertion for `date-time`; annotation-only validation is non-conforming.
- The 0.2.0 schema drafts three optional core objects: `project.repository_identity`, `code.worktree_fingerprint`, and `code.branch_tracking`.
- Markdown summaries remain generated views. YAML is non-normative explanatory material only.

## Versioning and compatibility

- `protocol` identifies the family (`scp`); `schema_version` identifies the exact packet contract.
- 0.1.0 remains unchanged. A strict 0.1.0 consumer rejects 0.2.0 because it does not recognize the version and new core fields.
- A 0.2.0 consumer may support 0.1.0 explicitly. When consuming 0.1.0, identity/fingerprint are not provided; it must not infer stable repository identity or dirty-path content freshness.
- An unsupported consumer MUST stop protocol-driven writes and use the existing read-only/manual fallback. It must not ignore unknown core fields and continue.
- During 0.x, changes to core field shape, requiredness, enums, validation or semantics require a new minor schema version, including optional additions. Patch changes may correct wording/metadata only when instance validity and semantics are unchanged.
- Schema versioning is independent from project release version. This draft does not request a project version bump or tag.

## Authority and observation boundaries

- Existing project files/records remain authoritative for intent, requirements, tasks, roadmap, ADRs, evidence and project configuration. Packets reference them; they do not replace them.
- `project.project_id`, when present, is a project-configured stable namespaced URI for the logical project. It is not a provider repository ID and must not be derived from a remote URL or directory name.
- `project.repository` is a human-readable locator only. Repository identity comparisons use namespace + stable ID, subject to basis and semantic validation.
- `project.repository_identity` distinguishes checkout repository from canonical repository and records effective remote fetch/push observations. Remote aliases are local configuration, never stable identity. Fetch and push locators for one remote may differ, but must resolve to the same repository identity; use separate remotes for upstream-fetch/fork-push workflows.
- Branch tracking upstream and default push remote are separate observations. Actual fetch/push target resolution must be repeated from live Git configuration before the operation.
- Locator-only identities are provisional. They cannot prove URL migration, fork/mirror relations or stable checkout identity.
- `code.worktree_fingerprint` captures Git-status-visible non-ignored paths. It is not a backup, atomic filesystem snapshot, editor-buffer snapshot or write authorization.
- Fingerprint paths and `code.uncommitted_paths` are UTF-8 paths relative to Git worktree root, using POSIX separators. `project.root` identifies the logical project subdirectory and does not change the path base.
- Fingerprinting records index stages and worktree state separately. SHA-256 is computed from raw file bytes or raw symlink-target bytes; Git object IDs are not protocol content digests.
- Submodule internals are not recursively fingerprinted in this version. Dirty/unobservable submodule state reduces coverage to partial/unknown.
- Sensitive paths excluded by project policy are not hashed. Hashes are not guaranteed to be non-reversible for low-entropy secrets; exclusion reduces coverage rather than being treated as redaction.
- A complete fingerprint is limited to supported regular-file/symlink entries and explicit absent-path states; unreadable, unsupported and gitlink entries force partial/unknown coverage. It describes the captured path set and per-path checks only and does not prove a globally atomic worktree snapshot. Consumers re-observe live HEAD, index, status and relevant file contents.
- Dynamic Git/PR/CI state is last-known at packet generation. Consumers bootstrap live state before depending on it.

## JSON Schema versus semantic validation

JSON Schema enforces object shape and local conditionals. A conforming semantic validator must additionally enforce at least:

1. Fingerprint paths are strict UTF-8 relative paths with no NUL, absolute/drive/UNC paths, empty components, `.`/`..` components or platform-ambiguous aliases; entries are ordered by UTF-8 byte order.
2. `entries[].path` is unique by path value; `index_entries[].stage` is unique per path and consistent with merge-conflict rules.
3. When coverage is complete, entry paths exactly equal `code.uncommitted_paths`; for partial coverage they are a subset. Completeness requires readable HEAD, stable observation and successful re-enumeration of HEAD/index/status.
4. Index modes, stage objects and their SHA-256 values are derived from actual index blobs; worktree mode/kind/digest is derived from the current filesystem object without following symlinks.
5. Entry mode and kind agree; absent files do not carry digest; unreadable/unsupported/gitlink/secret-excluded entries are not treated as complete regular-file fingerprints.
6. `completed_at` is not earlier than `started_at`; changed HEAD/index/status or per-path replacement is retried or downgraded, never labelled complete.
7. Repository identity `namespace + id` is compared as a pair. `basis=normalized_locator_only` is provisional and cannot contain a stable ID.
8. Each remote name is unique in one mapping snapshot. A resolved fetch requires a fetch target; a resolved push requires at least one effective push target.
9. Fetch and effective push targets of one remote resolve to the same repository identity. Multiple push targets must not be silently collapsed when their identities differ.
10. `relation_to_canonical=canonical` requires target identity to match declared canonical identity. Fork/mirror relations require provider-verifiable relationship data or an explicit project configuration reference.
11. Branch tracking remote and push remote must resolve against current remote mapping. Detached HEAD, missing upstream, ambiguous push target and unavailable configuration remain separate states.
12. Locator strings must be sanitized: no userinfo, passwords, access tokens, signed query parameters or credential fragments. A locator is not itself proof of identity.
13. Source references for identity and provenance must resolve to the expected authoritative source revision at consumption time. Conflicts remain conflicts; timestamps do not select an authority.
14. Packet-local decision ID uniqueness and authoritative evidence resolution from 0.1 remain in force.

These are semantic requirements, not an implemented validator in this PR.

## Fixture contract

- `examples/checkpoint-minimal.json` is a minimal valid 0.2.0 checkpoint without optional handoff, coordination, identity or fingerprint.
- `examples/handoff-with-identity-and-fingerprint.json` shows a fork checkout, canonical repository, separate upstream/fork remotes, branch tracking and a complete per-path fingerprint.
- `fixtures/README.md` classifies negative fixtures into JSON Schema-invalid and semantic-invalid classes.
- Fixtures are design/test contracts only. No fixture runner, validator, CLI adapter or CI gate is implemented by this draft.
