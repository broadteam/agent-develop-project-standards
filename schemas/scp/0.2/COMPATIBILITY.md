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
- `project.repository` is a human-readable locator only. It is subject to the same credential-sanitization rule as `identity_target.locator`. Repository identity comparisons use namespace + stable ID, subject to basis and semantic validation.
- `project.repository_identity` distinguishes checkout repository from canonical repository and records effective remote fetch/push observations. Remote aliases are local configuration, never stable identity. `fetch_state=resolved` / `push_state=resolved` means the effective Git configuration target(s) were selected unambiguously; the target's `basis` separately indicates whether the identity is stable or only provisional. Fetch and push locators for one remote may differ, but must resolve to the same repository identity; use separate remotes for upstream-fetch/fork-push workflows.
- Branch tracking upstream and default push remote are separate observations. Actual fetch/push target resolution must be repeated from live Git configuration before the operation.
- Locator-only identities are provisional. They cannot prove URL migration, fork/mirror relations or stable checkout identity.
- `code.worktree_fingerprint` captures Git-status-visible non-ignored paths. It is not a backup, atomic filesystem snapshot, editor-buffer snapshot or write authorization.
- Fingerprint paths and `code.uncommitted_paths` are UTF-8 paths relative to Git worktree root, using POSIX separators. `project.root` identifies the logical project subdirectory and does not change the path base.
- Fingerprinting records index stages and worktree state separately. SHA-256 is computed from raw file bytes or raw symlink-target bytes; Git object IDs are not protocol content digests. A gitlink commit OID is a separate pointer value, not a file-content digest.
- Submodule internals are not recursively fingerprinted in this version. A clean, initialized submodule may be represented by its gitlink commit pointer (Git mode `160000`) in the index/worktree entries; the semantic validator must verify the submodule is initialized, checked out at the recorded pointer and clean. A dirty, missing, uninitialized or unobservable submodule reduces coverage to partial/unknown. The gitlink OID is a commit pointer, not a file-content digest.
- Sensitive paths excluded by project policy are not hashed. Hashes are not guaranteed to be non-reversible for low-entropy secrets; exclusion reduces coverage rather than being treated as redaction.
- A complete fingerprint permits supported regular-file/symlink entries, explicit absent-path states, and gitlink pointers whose submodules are live-verified initialized and clean. Unreadable/unsupported entries and dirty, missing, uninitialized or unobservable submodules force partial/unknown coverage. It describes the captured path set and per-path checks only and does not prove a globally atomic worktree snapshot. Consumers re-observe live HEAD, index, status and relevant file contents.
- Dynamic Git/PR/CI state is last-known at packet generation. Consumers bootstrap live state before depending on it.

## JSON Schema versus semantic validation

JSON Schema enforces object shape and local conditionals. A conforming semantic validator must additionally enforce at least:

1. Fingerprint paths are strict UTF-8 relative paths with no NUL, absolute/drive/UNC paths, empty components, `.`/`..` components or platform-ambiguous aliases; entries are ordered by UTF-8 byte order.
2. `entries[].path` is unique by exact path value and ordered by UTF-8 byte order. Do not case-fold or Unicode-normalize paths. `index_entries[]` is ordered by stage; stage values are unique per path and consistent with merge-conflict rules (stage 0 must not coexist with stages 1/2/3).
3. When coverage is complete, entry paths exactly equal `code.uncommitted_paths`; for partial coverage they are a subset. Completeness requires readable HEAD, stable observation and successful re-enumeration of HEAD/index/status.
4. Index modes, stage objects and their SHA-256 values are derived from actual index blobs; worktree mode/kind/digest is derived from the current filesystem object without following symlinks.
5. Entry mode and kind agree; absent files do not carry digest; unreadable/unsupported/secret-excluded entries are not treated as complete fingerprints. A gitlink may be included in complete coverage only when live Git status proves the submodule is initialized, index gitlink OID equals its checked-out HEAD OID, and its worktree is clean; its OID is not a content digest.
6. `completed_at` is not earlier than `started_at`; changed HEAD/index/status or per-path replacement is retried or downgraded, never labelled complete. Capture timestamps describe the scan window and do not prove global atomicity.
7. Repository identity `namespace + id` is compared as a pair. `basis=normalized_locator_only` is provisional and cannot contain a stable ID.
8. Each remote name is unique by exact Git configuration subsection name in one mapping snapshot. A resolved fetch requires a fetch target; a resolved push requires at least one effective push target.
9. For a remote mapping reported as resolved, the fetch target and every effective push target must resolve to the same repository identity (namespace + stable ID, or a consistent explicitly provisional locator basis). If effective push targets resolve to different repository identities, that remote's push resolution is conflict/ambiguous, never resolved; preserve all observed targets rather than selecting one.
10. `relation_to_canonical=canonical` requires target identity to match declared canonical identity. Fork/mirror relations require provider-verifiable relationship data or an explicit project configuration reference.
11. `branch_tracking.branch_state` must agree with `code.branch` (attached requires a non-empty branch name; detached requires a null branch). Configured upstream and resolved push remote aliases must exist in the live Git configuration and, when `repository_identity.remote_mappings` is present, in that observed mapping. If remote mappings are absent, a local alias observation does not prove cross-repository identity. Detached HEAD, missing upstream, unknown configuration and ambiguous push target remain separate states.
12. `project.repository` and all identity target locators must be sanitized: no userinfo, passwords, access tokens, signed query parameters or credential fragments. A locator is not itself proof of identity.
13. Source references for identity and provenance must resolve to the expected authoritative source revision at consumption time. Conflicts remain conflicts; timestamps do not select an authority.
14. Packet-local decision ID uniqueness and authoritative evidence resolution from 0.1 remain in force.
15. `branch_tracking.branch_state` and `code.branch` must describe one observation: attached requires a non-empty branch; detached requires `code.branch=null`; unknown must not be silently promoted. If a remote-mapping snapshot is present, configured upstream and resolved push aliases must match an entry by exact name.
16. Partial fingerprint entries must be a subset of the observed `code.uncommitted_paths`; partial means omissions are allowed, not extra or invented paths. Complete requires set equality. The Packet's `uncommitted_paths` order is not itself normative; `worktree_fingerprint.entries` order is.
17. If repository identity source_refs describe project configuration/provider evidence, each assertion must be traceable to the referenced source and its observed revision; source conflicts are not resolved by latest timestamp.
18. A fixture requiring live Git/provider context is `not_run/unknown` without that companion context. In particular, a matching gitlink OID does not prove a clean submodule; live status is required.

These are semantic requirements, not an implemented validator in this PR.

## Fixture contract

- `examples/checkpoint-minimal.json` is a minimal valid 0.2.0 checkpoint without optional handoff, coordination, identity or fingerprint.
- `examples/handoff-with-identity-and-fingerprint.json` shows a fork checkout, canonical repository, separate upstream/fork remotes, branch tracking and a complete per-path fingerprint.
- `fixtures/README.md` classifies negative fixtures into JSON Schema-invalid and semantic-invalid classes; `fixtures/SEMANTIC-CONTEXT.md` specifies the companion state each semantic fixture requires.
- Fixtures are design/test contracts only. No fixture runner, validator, CLI adapter or CI gate is implemented by this draft.

## Branch tracking and remote-resolution detail

- `branch_tracking.branch_state` is `attached`, `detached` or `unknown`; it must agree with the contemporaneous `code.branch` observation.
- For an attached branch, `upstream.state=configured` requires both `remote_name` and `merge_ref`; `not_configured` means no branch tracking upstream; `unknown` means the configuration could not be read. A detached HEAD has no active branch upstream and should report `not_applicable`.
- `push.state=resolved` records a selected default push remote and requires `remote_name` plus `resolution_basis`. Supported bases are `branch_push_remote`, `remote_push_default`, `branch_upstream` and `default_remote`. The field does not record refspec selection or authorize a push.
- Branch tracking remote aliases must resolve against the current remote configuration when available. If a Packet contains no `repository_identity.remote_mappings`, the consumer may still report the local alias observation but cannot claim cross-repository identity resolution.
- `fetch_state` / `push_state` describe whether Git's effective configuration target(s) were selected unambiguously. They do not upgrade a `normalized_locator_only` target into a stable identity.
