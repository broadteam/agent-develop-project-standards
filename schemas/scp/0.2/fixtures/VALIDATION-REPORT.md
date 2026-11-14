# SCP 0.2.0 JSON Schema Validation Report

**Status:** Draft verification record; not a D1 freeze decision and not a semantic-validator implementation.

## Validation target

| Item | Value |
|---|---|
| Schema | `schemas/scp/0.2/continuity-packet.schema.json` |
| Schema blob SHA | `a2f2097a17c08bf0a2ae733ab43a8f1919b48813` |
| Schema dialect | JSON Schema Draft 2020-12 |
| Validator | Python `jsonschema 4.26.0` |
| Instance format checking | `FormatChecker()` enabled |
| Repository snapshot used for fixture blob IDs | `2d73c5d013ca467a27c37815761cb03be4a3d74b` |

## Results

| Test group | Count | Expected result | Observed result |
|---|---:|---|---|
| Schema meta-schema | 1 | `Draft202012Validator.check_schema` succeeds | PASS |
| Positive instances | 4 | Every example validates | 4/4 PASS |
| JSON Schema-invalid fixtures | 9 | Every fixture is rejected | 9/9 REJECTED |
| Semantic-invalid fixture packets | 19 | Every Packet remains JSON Schema-valid; semantic/context layer must reject or downgrade the claim | 19/19 SCHEMA-VALID |
| Date-time format assertion | 2 probes | Valid RFC 3339 accepted; invalid date-time rejected | PASS |

The date-time probe accepted a valid RFC 3339 timestamp and rejected `2026-13-40T30:70:70Z`.

## Interpretation and limits

- The 4 positive and 9 structural negative instances were validated with the same Schema blob SHA recorded above. The Schema blob has not changed since that run.
- The 19 semantic-invalid Packet instances were checked with Draft 2020-12 validation and `FormatChecker()`; all 19 remain structurally valid. Their intended rejection/downgrade depends on the companion context in `SEMANTIC-CONTEXT.md`.
- A post-review schema refinement now requires an indexed gitlink and its worktree path to both be present in `coverage=complete`. The new missing-gitlink-worktree negative fixture is rejected; the clean gitlink positive and pointer-mismatch semantic case remain valid at the Schema layer.
- Schema-valid does **not** mean semantically valid, current, resolved, safe to write, or backed by real Git/provider evidence.
- The semantic companion contexts are deterministic test-input specifications, not a running Git/provider fixture environment. No real Git repositories, provider API responses, permission failures, file digests or submodule states were executed by this report.
- The fixture JSON uses synthetic IDs, digests and revisions. These values are placeholders, not proof of repository identity or file contents.
- This report is a manual verification record. No Validator, Fixture Runner, CLI adapter or CI gate is added by this change.
- The repository's current `.github/workflows/standards-ci.yml` runs syntax and regression tests; it does not run this SCP schema validation. Its green result must not be presented as the evidence above.
- This report does not freeze D1, D2 or D3. D0 remains the only confirmed frozen stage.

## Positive fixture blob IDs

| Fixture | Blob SHA |
|---|---|
| `examples/checkpoint-minimal.json` | `f49109a2d32e50cc7477af6bb6dc3f888d9b0b58` |
| `examples/handoff-clean-gitlink-fingerprint.json` | `e10dd86f3bed8dcc6d7cc1acb753860c62ab02b5` |
| `examples/handoff-partial-fingerprint.json` | `3c21555f9e5bc21eb4e60fe7af2af9ebde0e73ed` |
| `examples/handoff-with-identity-and-fingerprint.json` | `0e2f3ef416235e1a7f607aba0e2e41c858667b06` |

## JSON Schema-invalid fixture blob IDs

| Fixture | Blob SHA |
|---|---|
| `invalid/schema/complete-with-gitlink-entry.json` | `f3e887b3b61dfe7fa236ae19d1e0e1df5d771ab6` |
| `invalid/schema/complete-with-missing-gitlink-worktree.json` | `7041c591001d4373788ae22cf0b0e14d5d1fefb2` |
| `invalid/schema/complete-with-unreadable-entry.json` | `57234f4f215d661c3d195770ac54fa9f632ba3e8` |
| `invalid/schema/dirty-without-paths.json` | `a3a028ce813b0362c175c7d9cf017d98103b9b72` |
| `invalid/schema/fingerprint-complete-changed-capture.json` | `7c8b4aed703312fd0a3e10c629b349860efd0244` |
| `invalid/schema/locator-only-identity-with-id.json` | `4a85b7374e1d6cca1dd343b74a6f82d468c55447` |
| `invalid/schema/path-escapes-worktree.json` | `ee63433e089b0ded2296bc249854135acf233e8c` |
| `invalid/schema/unknown-core-field.json` | `893820659f5070fe21de56aa23924f5f112e2ac8` |
| `invalid/schema/wrong-schema-version.json` | `89c4b45b3d1756b61a77b6db673df77dd8874b63` |

## Semantic-invalid fixture blob IDs

| Fixture | Blob SHA |
|---|---|
| `invalid/semantic/branch-push-remote-unknown.json` | `b647a15a9256ef4ac106235d14af282d45769615` |
| `invalid/semantic/branch-state-code-branch-mismatch.json` | `7d6f4dd73a48c544fabdc7b1f628ff096eb816ca` |
| `invalid/semantic/branch-tracking-unknown-remote.json` | `df320ba2678e8bf6f8fc5b8cfd4b22f191c1913f` |
| `invalid/semantic/canonical-relation-mismatch.json` | `c76ee6a2b9ced922f1afb06a6b38c0d8a99bd4ad` |
| `invalid/semantic/complete-with-dirty-submodule.json` | `7635bdaabfe71e63fc37bdcd02cf6933bb739723` |
| `invalid/semantic/credentialed-locator.json` | `b7638147dcca41918ee51a3356f39c09b4b72c4d` |
| `invalid/semantic/credentialed-project-repository.json` | `017e84a13f24d3a4a16d85f6b2f757083f63aaba` |
| `invalid/semantic/duplicate-fingerprint-path.json` | `f5ba7b530e9f6e21a3ca7108560a402dba5253bc` |
| `invalid/semantic/duplicate-index-stage.json` | `3cd64e86eeb552669bf9c741e38721afbbb0a3e1` |
| `invalid/semantic/duplicate-remote-name.json` | `d813edd72bf809200164773f7c9c8b227fd611c8` |
| `invalid/semantic/fingerprint-path-set-mismatch.json` | `e2a77fe916bc5188bf97d528f2e46c5af1a7a8dd` |
| `invalid/semantic/fingerprint-time-window-reversed.json` | `f46044b50cfb86364709dc3510a58dd75b9c407a` |
| `invalid/semantic/gitlink-pointer-mismatch.json` | `64a0937da8a6b2c9b0a0ed9e7144a45f68dd419e` |
| `invalid/semantic/identity-source-reference-unresolvable.json` | `37984b42595431526dcb7798fd48642d3e701328` |
| `invalid/semantic/mixed-index-conflict-stages.json` | `e21fcf7d76c2116bac24002d3cbc95d8abdfa7ff` |
| `invalid/semantic/multiple-push-targets-different-identities.json` | `a2fa973c77a587f5fbe98d2627196b75fa5fac7d` |
| `invalid/semantic/partial-fingerprint-outside-path-set.json` | `eb08bf9c078c7d0001e2871c3ac5855b5d0e8640` |
| `invalid/semantic/remote-fetch-push-identity-mismatch.json` | `730c50ab5626826f650bad0d6a34c91e2a1b51c0` |
| `invalid/semantic/unsorted-fingerprint-entries.json` | `d909e035c38a75a3e5f69585c7d90be6f1468088` |


## 2026-11-14 current-Head fixture pin audit

At PR Head `529b13caaffa782b25cd5da366edfd5f6d78c65d`, the current Git tree `438f127e9fa8e37c04f32ff87852c0d5d079f679` was queried recursively (the response was not truncated). All fixture paths and Blob IDs listed in this report were compared to that exact tree:

- Positive examples: 4/4 Blob IDs match.
- JSON Schema-invalid fixtures: 9/9 Blob IDs match.
- Semantic-invalid fixtures: 19/19 Blob IDs match.
- Total: 32/32 exact path-to-Blob matches; no missing paths or mismatched Blob IDs.
- Schema `schemas/scp/0.2/continuity-packet.schema.json`: current Blob remains `a2f2097a17c08bf0a2ae733ab43a8f1919b48813`, matching the validation target above.

This is a Git object identity/provenance audit only. It does not rerun Draft 2020-12 validation, semantic assertions, or any Agent/Provider execution, and it does not freeze D1.
