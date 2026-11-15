# SCP 0.2.0 Semantic Fixture Context (Draft)

**Status:** Contract documentation only. No semantic validator or executable fixture harness is implemented.

A semantic fixture is not necessarily self-sufficient JSON. Some claims require a synthetic repository/configuration snapshot or filesystem observation in addition to the Packet instance. The JSON file documents the candidate Packet; this file defines the additional inputs a future fixture runner must provide and the expected normalized failure. A JSON-only checker must not claim to have tested these external facts.

## Fixture matrix

| Fixture | Required companion context | Expected semantic result |
|---|---|---|
| `duplicate-remote-name.json` | One repository identity snapshot containing two distinct remote-mapping records with the same exact `remote_name`; no case folding or Unicode normalization is applied. | Reject duplicate remote alias records. Do not choose one by order. |
| `fingerprint-path-set-mismatch.json` | Captured Git status path set equals the Packet's `code.uncommitted_paths`; the fingerprint contains a different path set. | Reject `coverage=complete`; downgrade/reject the fingerprint claim. |
| `duplicate-fingerprint-path.json` | No extra external state required; two entry objects use the same exact path but different digest values. | Reject duplicate path identity before path comparison. |
| `canonical-relation-mismatch.json` | Canonical identity is namespace `https://github.com` + ID `canonical-456`; origin target is checkout ID `checkout-123`, but its relation claims `canonical`. | Reject the relation claim; do not infer equality from locator resemblance. |
| `credentialed-locator.json` | No remote lookup required; inspect all locator-bearing fields in the Packet. | Reject or redact the credential-bearing locator before persistence/logging; never echo the secret value. |
| `duplicate-index-stage.json` | No filesystem context required; one path has two stage-0 index entries. | Reject duplicate index stage. |
| `complete-with-dirty-submodule.json` | Synthetic Git worktree with submodule path `vendor/lib`, index gitlink and checked-out submodule HEAD both at commit `eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`, but submodule status/worktree reports local modifications or untracked non-ignored content. | Reject/downgrade `coverage=complete` to partial/unknown. The pointer matching alone does not prove clean state. |
| `fingerprint-time-window-reversed.json` | Packet times are the only input; completed_at is earlier than started_at. | Reject the capture interval. |
| `partial-fingerprint-outside-path-set.json` | Current Git status path set equals `code.uncommitted_paths`; one fingerprint entry names a path outside that set. | Reject the extraneous entry; partial coverage permits omission, not invented/out-of-scope paths. |
| `unsorted-fingerprint-entries.json` | No external state required; compare UTF-8 bytes of each path in array order. | Reject non-canonical entry ordering; clients must not silently sort before validating a signed/observed Packet. |
| `mixed-index-conflict-stages.json` | No external state required; the same path includes stage 0 and stage 2. | Reject impossible/malformed stage combination; an unmerged path uses applicable stages 1/2/3 and no stage 0. |
| `remote-fetch-push-identity-mismatch.json` | Effective Git config for `origin` resolves fetch to checkout ID `checkout-123` and effective push targets to canonical ID `canonical-456`. | Mark the remote mapping conflict/ambiguous; never call it resolved. |
| `multiple-push-targets-different-identities.json` | Effective push target list for one remote contains checkout ID `checkout-123` and canonical ID `canonical-456`. | Mark push target resolution conflict/ambiguous; preserve every observed target. |
| `branch-tracking-unknown-remote.json` | Live branch config says upstream remote `missing-remote`; observed remote mapping contains only `origin` and `upstream`. | Mark branch tracking reference unresolved/unknown; do not synthesize a remote mapping. |
| `branch-state-code-branch-mismatch.json` | Packet says `code.branch=feature/scp-schema` and `branch_tracking.branch_state=attached`; companion live Git observation returns detached HEAD (no symbolic branch ref). | Mark the Packet branch observation stale/conflict; do not trust the internal Packet fields over live state. |
| `credentialed-project-repository.json` | No remote lookup required; inspect the required top-level `project.repository` locator. | Reject/redact credential material before persistence/logging; do not echo the credential. |
| `gitlink-pointer-mismatch.json` | Synthetic submodule at `vendor/lib`; Git index gitlink OID is `eeee…`, checked-out submodule HEAD is `ffff…`, while the Packet claims complete coverage. | Reject/downgrade complete coverage; pointer mismatch means the submodule path is not clean at the indexed commit. |
| `identity-source-reference-unresolvable.json` | The referenced provider resource `fixture://provider/github.com/repos/deleted-999` returns authoritative not-found (not a permission-denied/timeout response). | Keep repository identity unknown/unresolved; do not use stale cache or locator resemblance to promote it to resolved. |
| `branch-push-remote-unknown.json` | Live branch push configuration selects `missing-push-remote`; observed mappings contain only `origin` and `upstream`. | Mark push resolution unknown/conflict; do not invent the remote or select another alias. |

## Shared semantic requirements

1. Semantic validation is performed after JSON Schema validation and before any Packet claim is promoted to current/resolved.
2. The validator reads live Git state read-only. It must not fetch, checkout, update submodules, write index, refresh project caches, or otherwise mutate the worktree to make a fixture pass.
3. The validator binds each result to the observed repository identity, HEAD, Git index snapshot, worktree status, and the Packet's source revision context.
4. A missing companion context is `unknown/not_run`, not pass. A failed external lookup is not evidence that the corresponding object does not exist.
5. For a conflict, preserve all conflicting observations and stop only actions that depend on that claim. Do not resolve by array order, timestamp, remote alias preference, or Agent intuition.
6. A semantic-invalid fixture must remain valid under the JSON Schema. If a later schema revision causes one of these fixtures to fail structurally, classify it again and update the fixture matrix; do not keep labeling a schema-invalid input as a semantic-only test.
7. Placeholder repository IDs, digest strings and timestamps in the example Packets are illustrative. They must not be presented as real provider data, verified file contents, or a live clean Git repository.

## Boundary

This document does not define a validator API, implementation language, CLI command, fixture runner, CI job, or write/persistence operation. Those require a separate implementation decision. The current PR remains a design/schema draft.
