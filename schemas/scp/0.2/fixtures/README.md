# SCP 0.2.0 Fixture Contract (Draft)

These fixtures specify expected JSON Schema and semantic-validator behavior. They are not an executable validator suite yet.

## Positive fixtures

| File | Expected | Coverage |
|---|---|---|
| `../examples/checkpoint-minimal.json` | JSON Schema valid | Minimum checkpoint; no optional handoff, coordination, repository identity or fingerprint |
| `../examples/handoff-with-identity-and-fingerprint.json` | JSON Schema valid; illustrative shape only | Fork checkout vs canonical, separate remotes, branch tracking, index/worktree digests and an untracked path. Semantic validation requires a fixture harness to resolve the synthetic `fixture://` references and provide matching file/index bytes; the placeholder digests are not evidence.

## JSON Schema-invalid fixtures

| File | Expected failure |
|---|---|
| `invalid/schema/dirty-without-paths.json` | Dirty worktree has no uncommitted paths |
| `invalid/schema/fingerprint-complete-changed-capture.json` | Complete coverage cannot claim changed-during-capture |
| `invalid/schema/locator-only-identity-with-id.json` | Locator-only identity must not contain a stable ID |
| `invalid/schema/path-escapes-worktree.json` | Fingerprint path escapes root / is not portable |
| `invalid/schema/complete-with-unreadable-entry.json` | Complete coverage cannot include an unreadable path |
| `invalid/schema/complete-with-gitlink-entry.json` | Complete coverage cannot include a gitlink index entry |

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

## Expected handling

- JSON Schema-invalid packets are rejected before semantic processing.
- Semantic-invalid packets are rejected for the affected claims; they must not normalize into current/resolved.
- Unknown schema or fingerprint format is unsupported/incompatible, never silently interpreted.
- Partial/unknown fingerprint can support per-entry observations only where independently verifiable; it cannot establish whole-worktree current.
- Fixture pass is not evidence of real CLI/filesystem behavior or cross-client E2E compatibility.
