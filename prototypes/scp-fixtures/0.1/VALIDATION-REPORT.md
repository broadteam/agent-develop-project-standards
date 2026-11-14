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

## Post-baseline source review changes (historical status; superseded below)

After the baseline local working-copy run, source review produced additional changes on the PR branch:

- empty actual rows are omitted by both Normalizers and should lead to inconclusive assertions;
- duplicate expected claim refs and operation scopes are rejected when building the projection;
- `user_decisions_needed` accepts non-empty exact Unicode/natural-language strings, while action-ID syntax is limited to permitted/prohibited actions;
- regression cases for these behaviors were added to both Node.js and Python test suites.

At the time this section was first written, these post-baseline changes had not yet been executed because a direct Git checkout could not resolve github.com. This was the historical state before the API-assisted source reconstruction and execution recorded below. The successful baseline numbers above still apply only to the earlier working copy.


## Launcher portability review

The committed launcher now accepts `NODE` and `PYTHON` executable overrides and probes `python3` then `python`. It still requires a POSIX-compatible shell and standard `mktemp`/`cmp` utilities. This source update is not part of an executed exact-Head run.


## 2026-11-13 API-assisted execution of the PR Head sources

The container could not resolve `github.com` for a Git clone. The prototype files were therefore retrieved through the GitHub Contents API at PR Head `d6090eb51194ce3272816b2da10aa75e0c3da4c2` and reconstructed in an isolated temporary directory.

Before test-harness corrections, the retrieved implementation and fixture files were checked against their Git object identities:
- 14/14 unchanged files matched the Head blob SHA exactly: Node/Python adapters and Oracles, the launcher, and all nine Context/observation/client-output fixtures.
- Both original test files were also independently checked against their Head blob SHA before correction (16/16 original blobs verified in total).

The first execution exposed test-harness defects, not adapter/Oracle implementation failures:
- Node selected `claims[0]` for a negative `reason_codes` test, but that row does not declare the field. The test therefore failed on projection-scope validation before reaching the intended invalid-reason-code check.
- Python had the same wrong-row assumption, omitted the `ordered` helper from its imports, and expected the error text `invalid set member` although the adapter consistently reports `invalid action identifier`.

The tests are corrected to select a claim that declares `reason_codes`, import `ordered`, and assert the adapter's actual action-identifier error. No Node/Python adapter or Oracle implementation changes were needed for these corrections.

After those test-only corrections, the isolated run completed:
- Node.js: 3 pinned Context fixtures and 40 Oracle assertions passed.
- Python: both test cases passed.
- Context Git blob SHA-1 checks: 3/3 passed.
- Cross-language generated artifacts: all 9 Request / Normalized Result / Oracle Report files were byte-identical.

The prior Head CI run 43387906296 completed 8/8 matrix jobs successfully. For PR Head db0d26f5e82997b664ebb15871dc3d9e80ab4c53, the subsequent existing-workflow runs 43408727534 and 43408720794 each completed 8/8 matrix jobs successfully. The workflow does not invoke prototypes/scp-fixtures/0.1/run-parity.sh; these CI results are separate from prototype-suite execution.

This remains a synthetic fixture prototype. No live Agent client, Provider endpoint, Git observer, OS-level sandbox, or production Runner was exercised. The corrected test files were committed in the next PR update. The later exact-blob execution and fixture-identity correction are recorded below.


## 2026-11-13 follow-up: observation fixture identity and Stage 1 closeout

A further provenance review found that both observation reconcilers validated the package contract/source, event sequence, companion observations, Profile pin and capability set, but did not bind the observation package to the Context that requested it. A package from another fixture could therefore be paired with the current Context if its other records happened to match.

The Node.js and Python implementations now require the observation package fixture_id to exactly equal the Context fixture_id. Both test suites include a negative case that substitutes a different fixture ID and requires rejection before request construction. This is a provenance association check; it does not change Context 0.1.0 or add a new protocol field.

The correction was committed to the Draft PR in commit f37bc16a4976a389494e33139cba93b0e8f2a1d0:
- Node adapter and test: Blob SHAs 834b5d10f9ffcd6a9a867762c992b9ff31e605c5 and b512d848c0df00fd83b7d6fd8408e721da219169.
- Python adapter and test: Blob SHAs dc687c1127d34c045295fc96944c6a50bd2ae0b4 and 443bdc7e2c8b41e6ffdae516f59a42bc0af49594.

After this correction, the full command sh prototypes/scp-fixtures/0.1/run-parity.sh was run in the isolated execution directory and passed:
- Node.js test suite: PASS; three Context fixtures and 40 expected assertion leaves checked.
- Python test suite: 2/2 tests PASS.
- Context Git Blob SHA-1 checks: 3/3 PASS.
- Generated Client Evaluation Requests: 3/3 byte-identical across implementations.
- Generated Normalized Results: 3/3 byte-identical.
- Generated Oracle reports: 3/3 byte-identical.
- Total cross-language artifacts: 9/9 byte-identical.
- Negative tests include fixture-ID mismatch, event-sequence mismatch, observation mismatch, capability mismatch, duplicate JSON members/keys, Unicode scalar validation, duplicate expected keys, empty-row omission, null/unknown distinction, invalid enums/actions/reason codes and exact Unicode IDs.

### Source execution provenance

The runtime could not complete git clone because DNS resolution for github.com failed. Source and fixture files were fetched from the GitHub Contents API at the exact PR Head, reconstructed in an isolated temporary directory and independently checked against their Git Blob SHA values before execution. This is an API-retrieved, blob-identity-verified execution, not a full Git checkout. The Node/Python adapter and Python test changes from commit f37bc16 were subsequently checked against the final PR files. A duplicate let declaration remained in the Node test file from that update; it was corrected in commit 17e14191, and the local execution was rerun with source bytes whose Git Blob SHA values match the final four PR files.

### GitHub Actions result (separate from prototype execution)

For PR Head db0d26f5e82997b664ebb15871dc3d9e80ab4c53, the existing workflow runs 43408727534 and 43408720794 each completed 8/8 matrix jobs successfully. Those checks validate the repository's existing standards CI matrix. The workflow does not invoke the SCP prototype parity script, and the result is not counted as prototype-suite execution. The fixture-ID correction in f37bc16 triggers a separate CI run; its result must be checked against that exact Head.

### Stage 1 closeout boundary

The Node.js/Python synthetic adapter, normalizer and oracle prototype is complete for the three pinned Context fixtures and the test vectors listed above. This does not establish real Agent conformance, real Provider authority, a live Git observer, OS-level sandbox enforcement, credential-redaction guarantees or production Runner/Manifest/Store behavior. Those are separate gates. D0 remains the only user-confirmed frozen decision; D1/D2/D3 and the associated schemas/contracts remain Draft.


## 2026-11-13 final Head verification

Final prototype source and test files at PR Head 17e14191ab184e974247df2a81444a73fe566793 were retrieved through the GitHub Contents API. Their Git Blob SHA values match the files executed in the isolated temporary directory:

| File | Remote Git Blob SHA | Local executed bytes |
|---|---|---|
| node/adapter.cjs | 834b5d10f9ffcd6a9a867762c992b9ff31e605c5 | exact match |
| python/adapter.py | dc687c1127d34c045295fc96944c6a50bd2ae0b4 | exact match |
| node/test.cjs | f93d8bf95a8271138c0e723533c8ad37001f15b3 | exact match |
| python/test_adapter.py | 443bdc7e2c8b41e6ffdae516f59a42bc0af49594 | exact match |

The final Node test correction replaces a second let declaration with assignment for the existing test variable. This was caught by comparing the local test file's Git Blob SHA with the PR file, corrected on the PR, then verified by matching the local executed bytes to the new remote Blob SHA. The full parity script was rerun after this correction and passed.

For the final executable source set:
- Node.js: PASS, three Context fixtures and 40 expected assertions.
- Python: 2/2 tests PASS.
- Context Blob SHA checks: 3/3 PASS.
- Request/Normalized Result/Oracle outputs: 9/9 byte-identical.

For final PR Head 17e14191ab184e974247df2a81444a73fe566793, the two existing Standards CI runs completed successfully:
- 43411433407: 8/8 matrix jobs success.
- 43411426571: 8/8 matrix jobs success.

These GitHub Actions runs do not execute the SCP prototype parity script. They are separate CI evidence. No CI workflow or gate was added.


## 2026-11-14 Draft Context descriptor-pin rename

The Context Driver pin field was renamed to `driver_descriptor_sha256` to describe its actual semantics: SHA-256 of the exact `contract_only` descriptor bytes, not an executable Driver package. The three Context blob pins changed and both Node.js/Python test pin arrays were updated. This metadata/fixture identity correction does not change adapter or normalizer behavior. The existing recorded parity execution predates these new Context bytes; the exact updated fixture/test sources must be rerun before extending the Stage 1 execution claim to the renamed Context blobs. No Driver was made executable and no Harness Registry or Agent client was implemented.


## 2026-11-14 exact-Blob Stage 1 rerun after Driver descriptor pin rename

This section supersedes the preceding note that the renamed Context fixtures still required execution. The Stage 1 Node.js/Python synthetic prototype was rerun against the exact files committed at PR #11 Head cfd237dbb53ae10aba0de6a914839904fb598d3b.

### Execution environment and method

- OS/runtime: Linux x86_64, kernel 6.18.57.
- Node.js: v22.16.0.
- Python: 3.13.5.
- Source acquisition: repository GitHub Contents/Blob API; a normal Git checkout was not available in this isolated execution environment.
- Before execution, the 15 source/fixture files below were reconstructed and each local Git Blob SHA-1 was recalculated using Git's blob object framing. All 15 matched the exact expected remote Blob SHA.
- The committed Node test entry point and Python unittest entry point were executed separately with isolated output directories. Their nine generated Request / Normalized Result / Oracle JSON artifacts were then compared byte-for-byte. The shell wrapper itself was not invoked.

### Exact Blob identity set

| File | Git Blob SHA-1 |
|---|---|
| node/adapter.cjs | 834b5d10f9ffcd6a9a867762c992b9ff31e605c5 |
| node/oracle.cjs | 0adbfac3ed78193db21ad6f388a110d3d2fb48ef |
| node/test.cjs | bc9598e4247ba20f1a0cea261408c44108a9b54d |
| python/adapter.py | dc687c1127d34c045295fc96944c6a50bd2ae0b4 |
| python/oracle.py | b9f73ac77702b5183f1b674c64c105d59711d7da |
| python/test_adapter.py | b3e6978f8538870e0bf9c00330a637d1c50cb4bd |
| fixtures/context/credentialed-project-repository.json | eead3afee0d0183a5bc8c5ca0c4fe5d776d184c8 |
| fixtures/context/identity-source-reference-unresolvable.json | 16217a4f6aa01464e54c912d6836dec5e1f0c76f |
| fixtures/context/fingerprint-path-set-mismatch.json | d3661577a6585afc65003d635768257308e688a0 |
| fixtures/observations/credentialed-project-repository.json | 3f71a9fbac9fb5120d15fcdb41470d88481dbdaa |
| fixtures/observations/identity-source-reference-unresolvable.json | 024ad682c52c168623ff18139c53139fe565e21c |
| fixtures/observations/fingerprint-path-set-mismatch.json | edc3dcde97e36d546a3af6fb2f0fd08cbbb5f1ce |
| fixtures/client-output/credentialed-project-repository.json | cf8c2abfc5a5f829b80798311cd87703b449bf75 |
| fixtures/client-output/identity-source-reference-unresolvable.json | 4171f09d90e380f593a9b36b0136a069dcb5f6fe |
| fixtures/client-output/fingerprint-path-set-mismatch.json | 358724ca28ba3a16702887b8ecf68db7fca3619e |

### Results

- Exact Git Blob identity: 15/15 PASS.
- Node.js prototype: PASS; three pinned Contexts, 40 expected assertion leaves and adversarial regression cases.
- Python prototype: 2/2 tests PASS; same three pinned Contexts and 40 expected assertion leaves.
- Generated Client Evaluation Requests: 3/3 byte-identical.
- Generated Normalized Results: 3/3 byte-identical.
- Generated Oracle reports: 3/3 byte-identical.
- Total cross-implementation artifacts: 9/9 byte-identical.

Negative coverage includes duplicate JSON members, invalid UTF-8, unpaired surrogates, __proto__ handling, duplicate expected/actual keys, missing versus explicit unknown, null rejection, unknown fields/enums, duplicate set members, invalid reason/action identifiers, human-readable Unicode decisions, observation fixture-ID/event/profile mismatch, and non-conformant/not_run/inconclusive classifications.

### Interpretation and boundary

The descriptor pin rename is now covered by the exact committed Context Blob pins and exact committed Node/Python test files. This closes the previously pending Stage 1 rerun.

All observations and Client Under Test responses remain fixed synthetic fixtures. No executable Driver, Harness Registry, live Git observer, live Provider endpoint, ChatGPT/Claude/Codex invocation, OS-level client isolation, real credential or user repository was used. A synthetic response that matches the hidden fixture projection is not evidence of real Agent conformance or interoperability. The existing Standards CI remains separate and does not run this Stage 1 suite; no CI workflow or gate was added. D0 remains the only user-confirmed frozen decision; D1/D2/D3 and related contracts remain Draft.
