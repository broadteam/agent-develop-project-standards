# Prototype validation report

**Date:** 2026-11-13  
**Status:** Local development working-copy checks passed; submitted prototype files remain independently unverified in GitHub Actions. No production interoperability claim.

## Environment used for the local run

- OS: Linux x86_64
- Node.js: v22.16.0
- Python: 3.13.5
- Third-party dependencies: none
- Command: sh run-parity.sh from the isolated prototype development directory

## Results from the local development working copy

| Check | Result |
|---|---:|
| Pinned Context copies verified by Git blob SHA-1 | 3 / 3 |
| Node.js test suite | PASS |
| Python test suite | PASS |
| Expected assertion projections | 12 + 15 + 13 = 40 |
| Client Evaluation Request byte comparisons | 3 / 3 equal |
| Normalized Result byte comparisons | 3 / 3 equal |
| Oracle report byte comparisons | 3 / 3 equal |
| Cross-implementation generated artifacts | 9 / 9 byte-identical |

Negative/edge vectors exercised in the local development working-copy run included duplicate JSON object members, invalid UTF-8, unpaired surrogate, missing field versus explicit unknown, empty set versus missing array, JSON null, duplicate claim/scope keys, duplicate set members, unsupported fields/enums, exact Unicode identifiers (including NFC/NFD distinction), event-sequence mismatch, observation mismatch, capability/profile mismatch, value mismatch and pre-evaluation not_run.

The committed Node.js source additionally includes an assertion for safe handling of an own "__proto__" JSON member, and the committed Python suite adds duplicate/malformed capability-profile observation cases. These additional assertions are present in the PR files but are **not** included in the local run results above.

## Execution provenance and required re-run

The test run above was performed against the isolated local development working copy before the prototype source files were mirrored into this PR branch. The files now committed under prototypes/scp-fixtures/0.1/ were independently authored to the same contract and are intended to be executed with the documented run-parity.sh, but this report does **not** claim that the exact Git blobs at the current PR Head have already been executed.

After checking out the PR branch, run:

    sh prototypes/scp-fixtures/0.1/run-parity.sh

The repository's existing GitHub Actions checks do not currently execute this prototype suite. No workflow or CI gate was added.

## Interpretation

The local development implementation demonstrated byte-identical Client Evaluation Requests, normalized projections and Oracle assertion reports across independent Node.js and Python standard-library implementations for the three fixed synthetic Context vectors. This validates the tested projection/normalization rules in that working copy only.

## Not tested / not claimed

- No ChatGPT, Claude, Codex or other Agent client was invoked; client-output fixtures are synthetic vectors, not captured Agent responses.
- No real Git worktree, filesystem capability probe, submodule, Provider endpoint or live observation adapter ran.
- No executable Driver exists; the referenced repository Driver descriptors remain contract_only.
- The prototype propagates exact Packet/Schema/Profile/Driver/Provider pins but does not fetch and independently dereference every transitive artifact.
- The prototype checks that the Client Evaluation Request omits Context expected values, assertion outcomes and Oracle members. It does not provide OS-level process/container sandboxing or prove isolation against an Agent with unrestricted host access.
- No general-purpose credential redaction service, cleanup ownership/quarantine implementation, retry store, immutable Run Manifest store/finalizer, Harness Registry or production write API exists.
- No Normalized Result or Run Manifest JSON Schema, Writer, Store, Runner or CI gate was created.
- A synthetic Oracle result of conformant only means that a fixed response vector matches the Context expected projection; it is not Agent conformance evidence.

## Post-baseline source review changes (not yet executed)

After the baseline local working-copy run, source review produced additional changes on the PR branch:

- empty actual rows are omitted by both Normalizers and should lead to inconclusive assertions;
- duplicate expected claim refs and operation scopes are rejected when building the projection;
- `user_decisions_needed` accepts non-empty exact Unicode/natural-language strings, while action-ID syntax is limited to permitted/prohibited actions;
- regression cases for these behaviors were added to both Node.js and Python test suites.

These post-baseline source and test changes have **not** been executed in this environment. A direct checkout attempt of the PR branch failed because this runtime could not resolve `github.com`; do not infer test success from source inspection or the repository's unrelated existing CI checks. The exact committed suite remains pending execution in an environment that can checkout the PR Head.

The successful baseline numbers above apply only to the earlier local working copy and must not be attributed to the later committed changes.
