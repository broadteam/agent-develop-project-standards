# SCP 0.2.0 Fixture Contract (Draft)

These Packet fixtures specify expected JSON Schema and semantic-validator behavior. They are not an executable validator suite yet. Semantic-invalid JSON files require companion repository/configuration context described in [SEMANTIC-CONTEXT.md](./SEMANTIC-CONTEXT.md); the Packet alone cannot prove live Git or provider facts.

**Current inventory:** 4 positive examples, 9 JSON Schema-invalid fixtures, and 19 semantic-invalid vectors. The standard Draft 2020-12 validation results and pinned Packet fixture blob IDs are recorded in [VALIDATION-REPORT.md](./VALIDATION-REPORT.md). Context Schema validation is separately recorded in `schemas/scp-fixtures/0.1/VALIDATION-REPORT.md`. The proposed test lifecycle and environment profiles are in [SEMANTIC-EXECUTION-CONTRACT.md](./SEMANTIC-EXECUTION-CONTRACT.md). The separate companion-input contract is drafted as `scp-fixture-context/0.1.0` under `schemas/scp-fixtures/0.1/`; its rationale remains in [CONTEXT-CONTRACT-DESIGN.md](./CONTEXT-CONTRACT-DESIGN.md). Three design-only Context examples and five Context-schema-invalid examples are stored separately; they do not change the Packet Fixture inventory below.

## Positive fixtures

| File | Expected | Coverage |
|---|---|---|
| `../examples/checkpoint-minimal.json` | JSON Schema valid | Minimum checkpoint; no optional handoff, coordination, repository identity or fingerprint |
| `../examples/handoff-with-identity-and-fingerprint.json` | JSON Schema valid; illustrative shape only | Fork checkout vs canonical, separate remotes, branch tracking, index/worktree digests and an untracked path. Semantic validation requires a fixture harness to resolve the synthetic `fixture://` references and provide matching file/index bytes; the placeholder digests are not evidence.
| `../examples/handoff-partial-fingerprint.json` | JSON Schema valid | Per-path stable capture with one unreadable file; coverage is partial rather than complete |
| `../examples/handoff-clean-gitlink-fingerprint.json` | JSON Schema valid; illustrative shape only | A clean submodule is represented by its gitlink commit pointer without recursively hashing its inner files; attached branch configuration may independently be unknown.

## JSON Schema-invalid fixtures

| File | Expected failure |
|---|---|
| `invalid/schema/dirty-without-paths.json` | Dirty worktree has no uncommitted paths |
| `invalid/schema/fingerprint-complete-changed-capture.json` | Complete coverage cannot claim changed-during-capture |
| `invalid/schema/locator-only-identity-with-id.json` | Locator-only identity must not contain a stable ID |
| `invalid/schema/path-escapes-worktree.json` | Fingerprint path escapes root / is not portable |
| `invalid/schema/complete-with-unreadable-entry.json` | Complete coverage cannot include an unreadable path |
| `invalid/schema/complete-with-gitlink-entry.json` | Gitlink index entry requires a `gitlink_commit`; it is not a file-content digest |
| `invalid/schema/complete-with-missing-gitlink-worktree.json` | Complete coverage cannot include an indexed gitlink whose worktree submodule path is absent |
| `invalid/schema/wrong-schema-version.json` | Instance version must match the 0.2.0 schema |
| `invalid/schema/unknown-core-field.json` | Unknown fields in strict core objects are rejected |

## Semantic-invalid fixtures

These examples intentionally satisfy the JSON shape but violate relationships requiring cross-field or live repository inspection.

| File | Expected failure |
|---|---|
| `invalid/semantic/duplicate-remote-name.json` | Duplicate `remote_name` in one mapping |
| `invalid/semantic/fingerprint-path-set-mismatch.json` | Complete entry paths do not exactly equal `code.uncommitted_paths` |
| `invalid/semantic/duplicate-fingerprint-path.json` | Duplicate entry path values |
| `invalid/semantic/canonical-relation-mismatch.json` | Remote claims canonical relation but target ID differs from canonical |
| `invalid/semantic/credentialed-locator.json` | Locator includes userinfo/token-like credentials |
| `invalid/semantic/duplicate-index-stage.json` | One path contains duplicate index stage numbers |
| `invalid/semantic/complete-with-dirty-submodule.json` | JSON shape is valid, but the fixture's live Git observation marks the submodule dirty; complete coverage must be rejected/downgraded |
| `invalid/semantic/fingerprint-time-window-reversed.json` | `completed_at` precedes `started_at`; schema shape is valid, but the capture interval is impossible |
| `invalid/semantic/partial-fingerprint-outside-path-set.json` | Partial fingerprint includes a path absent from `code.uncommitted_paths` |
| `invalid/semantic/unsorted-fingerprint-entries.json` | Fingerprint entries are not ordered by UTF-8 path byte order |
| `invalid/semantic/mixed-index-conflict-stages.json` | Index stage 0 is mixed with an unmerged stage for the same path |
| `invalid/semantic/remote-fetch-push-identity-mismatch.json` | A resolved remote fetch target and push target have different stable repository identities |
| `invalid/semantic/multiple-push-targets-different-identities.json` | One remote's effective push target list resolves to more than one repository identity |
| `invalid/semantic/branch-tracking-unknown-remote.json` | Configured branch upstream names a remote absent from the observed remote mappings |
| `invalid/semantic/branch-state-code-branch-mismatch.json` | Packet reports an attached branch while companion live Git observation reports detached HEAD |
| `invalid/semantic/credentialed-project-repository.json` | `project.repository` contains URL userinfo/credential material and must be rejected/redacted |
| `invalid/semantic/gitlink-pointer-mismatch.json` | Index gitlink OID and checked-out submodule HEAD OID differ while the Packet claims complete coverage |
| `invalid/semantic/identity-source-reference-unresolvable.json` | Referenced provider identity source cannot be resolved at the required revision; identity must remain unknown, not resolved |
| `invalid/semantic/branch-push-remote-unknown.json` | Default push remote alias is absent from the live/Packet remote mapping |

## Expected handling

- JSON Schema-invalid packets are rejected before semantic processing.
- Semantic-invalid packets are rejected for the affected claims; they must not normalize into current/resolved.
- Unknown schema or fingerprint format is unsupported/incompatible, never silently interpreted.
- Partial/unknown fingerprint can support per-entry observations only where independently verifiable; it cannot establish whole-worktree current.
- Fixture pass is not evidence of real CLI/filesystem behavior or cross-client E2E compatibility.
- A semantic fixture without its required companion context is not a pass; classify it as not_run/unknown.
