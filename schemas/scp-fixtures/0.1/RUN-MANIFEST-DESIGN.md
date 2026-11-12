# SCP Fixture Run Manifest — Design Proposal

**Status:** Design proposal only. No Run Manifest JSON Schema, Writer, store, Runner or CI integration is implemented.

## 1. Purpose and boundary

A Run Manifest records what one Harness/client-adapter attempt actually did when evaluating one immutable Fixture Context. It allows different clients and repeated attempts to be compared without modifying their shared test input.

It is a **test execution record**, not:
- an SCP Continuity Packet;
- a project task, requirement, ADR, decision or Evidence source;
- an authorization token or permission grant;
- a mutable “latest run” status file;
- a replacement for GitHub Actions/CI job logs or the project's verification record.

The authoritative project state remains in the project's existing intent/requirements/tasks/ADR/Evidence sources. The Run Manifest is owned by the fixture harness and only describes one conformance attempt.

## 2. Cardinality and immutability

- One Run Manifest represents one client + adapter + Harness attempt against one exact Context blob.
- One Context may have zero, one or many Run Manifests.
- Two clients must create separate manifests for the same Context.
- A retry always creates a new `run_id` and a new manifest; never overwrite or append to an earlier manifest.
- The manifest's own Git blob SHA/content digest is calculated externally after finalization; it must not contain its own hash.
- A comparison report across multiple manifests is a separate derived artifact, not a mutable field in any individual manifest.

A completed manifest is immutable. An interrupted process may produce a terminal `interrupted` manifest only if the Harness can safely finalize its partial record. If no record can be finalized, the external CI/Harness execution ledger remains the only evidence that an attempt started; do not fabricate a completed manifest.

## 3. Minimum logical data model

| Group | Minimum fields | Purpose |
|---|---|---|
| Manifest identity | `manifest_contract`, `manifest_version`, `run_id`, `attempt_number`, `started_at`, `finished_at` (nullable when interrupted) | Identifies one immutable attempt |
| Input pins | Context path/blob SHA, Context version, Packet path/blob SHA, Packet Schema path/blob SHA, repository revision | Reproducible exact input set |
| Harness identity | Harness name/version, registry snapshot/revision, client name/version, adapter name/version | Identifies implementation under test and its bridge |
| Driver/Profile pins | Driver ID/contract version/descriptor blob SHA/executable bundle SHA-256; Profile IDs/versions/blob SHAs; provider contract pins when used | Proves which allow-listed test resources were selected |
| Environment | OS/runtime/Git version, filesystem or capability profile reference, measured capabilities, clock source | Separates declared profile from actual measured behavior |
| Lifecycle | setup, stimulus, observation, evaluation, cleanup state axes | Keeps partial failure and cancellation precise |
| Event/observation refs | ordered event log ref, snapshot IDs, sanitized observation artifact refs | Links actual test evidence without duplicating large/raw content |
| Actual result | normalized actual claim results, operation-scoped recovery, reason codes | Captures what the client returned |
| Assertions | assertion outcomes and mismatch references | Compares actual result with Context expected result |
| Final outcome | conformance outcome and harness outcome (separate) | Distinguishes product non-conformance from broken test infrastructure |
| Cleanup | disposable root ID, cleanup result, quarantine reference if needed | Proves isolation cleanup attempt |

This is a logical model, not a frozen JSON shape. The first machine Schema should include only fields required to reproduce and interpret an attempt.

## 4. Separate state axes

Do not compress a run into a single `success=true/false`.

### 4.1 Harness lifecycle

- `setup_state`: `not_started` / `succeeded` / `failed` / `partial`
- `stimulus_state`: `not_started` / `completed` / `failed` / `partial`
- `observation_state`: `not_started` / `completed` / `failed` / `partial` / `not_applicable`
- `evaluation_state`: `not_started` / `completed` / `failed` / `partial`
- `cleanup_state`: `not_required` / `succeeded` / `failed` / `unknown`

### 4.2 Conformance outcome

- `conformant`: every applicable assertion passed using a valid deterministic fixture and sufficient observations. This axis describes client behavior only; Harness health and cleanup are evaluated separately.
- `non_conformant`: at least one client result contradicts a valid expected assertion under a successfully prepared deterministic fixture.
- `inconclusive`: the test reached evaluation, but missing capability, permission, ambiguous observation or uncertain input prevents a conformance decision.
- `not_run`: Context/schema/Registry validation failed or setup did not reach the point at which the client could be evaluated.

### 4.3 Harness outcome

- `healthy`: lifecycle completed and cleanup succeeded or was explicitly not required.
- `failed`: Harness setup, stimulus, observation, evaluator, assertion or cleanup infrastructure failed.
- `interrupted`: execution terminated before normal finalization; only partial data is available.
- `not_started`: no Harness attempt was initiated.

A client may be non-conformant even when cleanup later fails; preserve both facts. For release/CI policy, a failed cleanup must quarantine the affected disposable resource and prevent a subsequent run from reusing it. Do not silently convert a cleanup failure to success.

## 5. Result classification rules

| Situation | Conformance outcome | Harness outcome | Notes |
|---|---|---|---|
| Context invalid or unsupported | not_run | healthy or failed, depending on rejection handling | Client evaluation must not start |
| Driver is `contract_only` or not registered | not_run | healthy if safely rejected | No executable driver exists |
| Fixture setup cannot create required state | not_run | failed | Not client non-conformance |
| Required observation capability unavailable | inconclusive | healthy if correctly reported | Use not_applicable only when profile explicitly excludes it |
| Observation returns unknown due to permission/fault | inconclusive unless the expected assertion is specifically about fail-closed handling and that output is observed | healthy if correctly surfaced | Do not turn missing observation into pass |
| Client returns a state/action that violates expected output | non_conformant | healthy | Record claim/scope and expected-vs-actual references |
| All applicable assertions match; cleanup succeeds | conformant | healthy | This is a valid passing conformance run |
| Client assertions match but cleanup fails | conformance may remain conformant for semantic assertions | failed | Overall harness health is not green; quarantine disposable root |
| Process terminates before evaluation | not_run or inconclusive depending on available stage | interrupted | Never infer the missing result |
| Process terminates after evaluation but before cleanup | preserve evaluated result if safely finalized; otherwise inconclusive | interrupted | Cleanup remains unknown |

Overall run acceptance requires both `conformance_outcome=conformant` and `harness_outcome=healthy`; this is a result interpretation, not an implemented CI gate. If semantic assertions pass but cleanup fails, preserve `conformance_outcome=conformant` and set `harness_outcome=failed`; the overall run is not accepted and the disposable root is quarantined.

## 6. Actual result and assertion representation

The Run Manifest stores the actual normalized client output, not a copy of the expected result. Expected output remains in the pinned Context.

Each assertion should identify:
- assertion ID (stable for the Context version);
- claim reference or operation scope;
- expected value/reference;
- actual value/reference;
- outcome: `passed` / `failed` / `inconclusive` / `not_run`;
- diagnostic/evidence reference (optional, sanitized).

An assertion must compare protocol state, not natural-language messages. Reason codes remain under the fixture vocabulary `scp.fixture.*`; an unknown reason code is not implicitly success.

Do not collapse these axes:
- Context/schema validation;
- protocol compatibility;
- claim freshness;
- identity/path resolution;
- fingerprint coverage;
- operation-scoped recovery;
- conformance outcome;
- Harness outcome.

## 7. Observation/event evidence and data minimization

The manifest may contain or reference:
- snapshot IDs and event sequence numbers;
- HEAD, index snapshot digests and status path-set digests;
- measured capability values and profile revision;
- normalized provider response class and contract revision;
- sanitized diagnostic artifacts;
- fixture-root lifecycle and cleanup evidence.

It must not contain:
- file contents or raw secret-bearing diffs by default;
- passwords, tokens, cookies, authorization headers, SSH keys or credential-bearing URLs;
- real production repository credentials or provider request payloads;
- the full user's working directory or unrelated filesystem data;
- arbitrary command history outside the allow-listed driver event summary.

Prefer immutable evidence references with SHA over embedding large artifacts. When a raw artifact is essential for debugging, it must be generated inside the disposable fixture root, sanitized, explicitly scoped, and separately access-controlled.

## 8. Lifecycle and finalization

1. **Allocate:** create a unique run ID and a temporary run workspace outside the user's project. Record exact Context blob SHA.
2. **Preflight:** resolve exact Schema/Packet/Profile/Driver/provider refs; validate Context; reject unsupported/unknown fields and non-executable `contract_only` drivers.
3. **Prepare:** create isolated disposable fixture state. Record setup outcome and the disposable root identifier.
4. **Stimulate:** apply only declared ordered events; append event records to a temporary run log.
5. **Observe:** run read-only observation adapters and capture snapshot IDs/capabilities.
6. **Evaluate:** invoke the client adapter and normalize its actual result; compare against the pinned Context expectations.
7. **Cleanup:** delete only Harness-owned temporary resources; record success/failure/unknown and quarantine on failure.
8. **Finalize:** serialize one immutable manifest, calculate its external digest, store it in the test-artifact location, and link it to the CI/Harness run ID.

If the process crashes at any phase, do not rewrite a previous manifest. A resumed/retried execution is a new run with a new ID. A partially finalized manifest is explicitly interrupted/inconclusive and contains only observations that were successfully recorded.

## 9. Retention, access and trust

- Store manifests with test artifacts or a dedicated conformance evidence store, not in the project's authoritative task/ADR directory.
- Retention follows the Harness/CI artifact policy; no retention duration is imposed by SCP.
- A manifest is evidence about one declared test run, not a guarantee that the client is correct for other environments or inputs.
- Consumer must verify the manifest's externally stored digest and all referenced input artifact hashes before relying on it.
- Untrusted client output is data; it cannot modify Context, alter Registry allow-lists or issue further Harness commands.
- Manifest publication must apply redaction before persistence; post-hoc redaction is not an acceptable secret-handling boundary.

## 10. Minimum acceptance criteria before a Run Manifest Schema

1. All outcome/lifecycle axes and their derivation rules are agreed.
2. Expected and actual normalized result formats are stable enough for exact assertions.
3. Driver/Profile/Provider registry pinning and actual measured capability reporting are unambiguous.
4. Failure, interruption, retry, cleanup failure and quarantine cases have deterministic examples.
5. Data-minimization and credential-redaction rules have negative tests.
6. Two independent Harness implementations can emit manifests for the same Context and the result normalizer can compare them without discarding relevant state.
7. The manifest itself is externally content-addressed; no self-hash field is introduced.

Until these criteria are reviewed, keep this document as a proposal. Do not create `run-manifest.schema.json`, Writer, store or CI gate.

## 11. Adversarial review of outcome classification

The following cases prevent the Run Manifest from conflating a client fail-closed result with a Harness observation failure.

### 11.1 Expected unknown versus missing observation

- If the Context intentionally supplies a deterministic 403/429/timeout/ambiguous-404 observation and expects the client to return source freshness unknown, a matching client result is **conformant**.
- If the Context declares a required observation capability, but the Harness fails to collect/supply that observation, the run is **inconclusive** (or not_run if evaluation never began).
- If the Context explicitly declares a capability not_applicable and expects that result, a matching client output may be conformant.
- The manifest must record whether the unknown came from an intentional fixture input, a client decision, or a Harness collection failure.

### 11.2 Client crash versus client disagreement

- A completed client response that contradicts expected normalized output is non_conformant.
- A client crash, timeout or malformed output before a complete normalized result is available is inconclusive (Harness failed/interrupted according to cause), not automatically non_conformant.
- If the client returns a syntactically complete but semantically unsafe result (for example, promotes unknown identity to resolved), that is non_conformant.

### 11.3 Cleanup after successful assertions

- If semantic assertions pass and cleanup succeeds: conformant + healthy.
- If semantic assertions pass but cleanup fails: conformant + failed; overall run not accepted; quarantine the disposable root.
- If cleanup outcome itself cannot be observed: preserve cleanup_state=unknown and harness_outcome=failed/interrupted; do not reuse the resource.
- Cleanup failure must not rewrite the actual client result or erase passed/failed assertion records.

### 11.4 Retry and duplicate execution

- A retry always has a new run_id and attempt identity, even when the exact same Context/Driver/Profile pins are reused.
- A partial/interrupted manifest is terminal and never reopened for a retry.
- The Harness store must enforce uniqueness of manifest identity; duplicate run_id is a storage failure, not an overwrite request.
- A replayed event sequence under the same Context should be deterministic; if the observed snapshots differ, preserve separate manifests and classify according to the pinned event/capability inputs.

### 11.5 Invalid Context or Registry resolution

- Invalid/unsupported Context is rejected before fixture setup and client invocation; conformance outcome=not_run.
- Missing blob, wrong Git blob SHA, profile mismatch, unregistered Driver, `contract_only` Driver or executable digest mismatch is not_run/unknown and must not proceed to the Client Under Test.
- A Harness that executes anyway has violated the harness contract even if the client output looks correct.

### 11.6 Multi-client comparison is a separate derived record

Each client has its own immutable Run Manifest. A later comparison artifact may group manifests by identical Context/Packet/Schema/Profile/Driver pins and compare normalized actual results.

The comparison artifact:
- does not mutate or replace any per-client manifest;
- records capability mismatches instead of silently comparing unlike environments;
- never upgrades an individual inconclusive result to conformant;
- is not a project Evidence record or authorization source.

### 11.7 Minimum invariant

A Run Manifest must always answer independently:
1. What exact immutable inputs were selected?
2. Which setup/stimulus/observation steps actually occurred?
3. What did the client actually return?
4. Which assertions passed, failed, were inconclusive or never ran?
5. Did the Harness complete safely and clean up its disposable resources?

If any answer is unavailable, record it as unknown/not_run/interrupted; do not infer it from the intended Context.

## 12. Second-round review: retry identity, interruption trust and cleanup ownership

### 12.1 Run identity and retry lineage

A run attempt needs both a unique identity and a way to group retries:

- `run_id`: globally unique for one attempt; never reused.
- `retry_group_id`: stable identifier for the logical request/retry lineage.
- `attempt_number`: positive integer, starts at 1 and increases monotonically within one retry group.
- `retry_of`: optional immutable reference to the immediately preceding attempt manifest (path/URI + digest); absent for attempt 1.
- `context_blob_sha`: every attempt pins the same exact Context unless the caller explicitly starts a different logical test request.

Rules:
1. A retry is a new attempt, not a continuation or mutation of an interrupted manifest.
2. Duplicate `run_id` is a storage conflict; never overwrite, merge or append into an existing manifest.
3. A retry may use the same Context and exact artifact pins, but it must record any changed measured capability, client/adapter version or Harness version; results from unlike environments are not exact replays.
4. `attempt_number` ordering is scoped to one retry group, not globally comparable.
5. `retry_of` must resolve to the immediately preceding finalized/terminal attempt in the same retry group. If that reference is unavailable, keep the new attempt independent and record lineage as unknown; do not infer it from timestamps or filenames.
6. A previous non-conformant, inconclusive or interrupted attempt is never erased by a later conformant retry. Aggregation may report the latest attempt and the full history separately, but may not rewrite old records.

The Harness must distinguish an intentional retry (new run ID, same retry group) from duplicate event delivery inside one active attempt. Event idempotency keys belong to the temporary Harness execution journal; they do not change the immutable manifest identity.

### 12.2 Interruption and partial-result trust

A partial manifest is not a weaker form of completed conformance. It is a terminal record of what was durably observed before interruption.

- Before a complete normalized client result exists, `conformance_outcome` is `not_run` if evaluation did not start, otherwise `inconclusive`.
- If the complete normalized client result and all applicable assertions were durably recorded, but the process stops before cleanup/finalization, the semantic `conformance_outcome` may remain conformant/non_conformant; `harness_outcome` is interrupted/failed and the overall run is not accepted until cleanup is resolved.
- An assertion subset that all passed cannot make the run conformant when other required assertions never ran.
- A missing final manifest is not proof that the client did or did not pass. The external CI/Harness event ledger may prove an attempt started, but it does not substitute for a complete Run Manifest.
- A terminal partial manifest must declare which lifecycle phases completed, which assertions did not run, the last durable event sequence and whether cleanup is pending/unknown.
- Resuming after interruption creates a new attempt. The new attempt may reuse the same immutable Context and fixture recipe, but it must rebuild or independently verify the disposable fixture state; it must not trust a partially mutated worktree as a valid initial state.

Do not promote partial evidence to a full result because a process exit code is zero, a CI job was cancelled after tests, or the last visible assertion passed.

### 12.3 Cleanup ownership and quarantine

Cleanup is a security-sensitive destructive operation, even when it targets a temporary directory.

A Harness may delete a root only when all are true:
- the root was created by this Harness attempt;
- its canonical resolved path is beneath the Harness-owned temporary parent;
- an ownership marker matches the exact `run_id` and disposable-root ID;
- no symlink/reparse-point traversal redirects deletion outside the owned root;
- the cleanup target is not the user's checkout, worktree, home directory or project path.

If ownership cannot be proven, do **not** delete. Record `cleanup_state=unknown` or `failed`, quarantine the resource reference and require external operator review. A manifest is untrusted input and must never be allowed to nominate an arbitrary cleanup path.

Cleanup should be idempotent for the same owned root. A repeated cleanup request may verify the root is already absent; it must not broaden deletion scope or follow a path that has changed since preflight.

For cleanup failure:
- preserve the actual client result and assertion outcomes;
- set Harness outcome failed/interrupted as appropriate;
- mark the root quarantined/unavailable for reuse;
- do not start a retry using that root;
- any later garbage collection requires a separate ownership check and policy, not a client-provided path.

### 12.4 Diagnostic artifact and Evidence boundary

Run artifacts are not project Evidence and must not be stored under the project's authoritative Evidence directory.

- A manifest may reference only Harness-owned artifact-store objects using immutable URI/path + digest + artifact kind.
- By default, store normalized state, event IDs, snapshot IDs, Git OIDs/digests, capability values and sanitized diagnostics; do not copy file contents, full diffs or user working-tree files.
- A raw artifact may be retained only if the fixture explicitly requires it, it originated inside the disposable root, it passed secret/credential scanning and sanitization before persistence, and its scope/access policy is explicit.
- Redaction must happen before persistence. A later “redacted copy” does not make storing the original secret-safe.
- The manifest itself must not include access tokens, cookies, authorization headers, private keys, credential-bearing remote URLs or arbitrary environment variables.
- Do not point Run Manifest artifacts at project `evidence_refs`, project task/ADR files or user repository paths. A fixture's expected result may refer to a Packet claim; the actual diagnostic artifact belongs to the Harness artifact namespace.
- Artifact retention/deletion follows Harness policy. Expired artifact references become unavailable/unknown; they must not silently fall back to copies in the project repository.

This keeps the test execution record separate from the project's source-of-truth evidence model.

### 12.5 D2 recovery and permission boundary

The Run Manifest records what the client returned for each operation scope; it does not execute, grant or extend those actions.

- `recovery_mode` and permitted/prohibited actions in actual normalized output are conformance data only.
- `blocked` for an identity-dependent push does not necessarily block an unrelated local read-only operation; compare at the same operation-scope granularity as the Context.
- A `restricted` result is not write permission. The Harness never invokes client production write APIs as part of a semantic fixture.
- `normal` means the client found required sources usable for the named scope; it does not authorize a real repository write.
- The Context's expected actions are assertions, not commands. The Run Manifest's actual actions are observations, not instructions.
- If actual output omits a required operation scope, that assertion is inconclusive/not_run; it must not inherit another scope's recovery mode.

A multi-client comparison is meaningful only for the same Context/Packet/Schema/Driver/Profile/provider-contract pins and equivalent measured capability/permission profiles. If those inputs differ, report a capability/input mismatch or compare only explicitly common claims; do not average or silently normalize unlike environments.

### 12.6 Second-round review decision

The Run Manifest design now has explicit boundaries for:
- globally unique run IDs and retry lineage;
- terminal partial/interrupted attempts;
- separate conformance and Harness health axes;
- safe cleanup ownership and quarantine;
- immutable, sanitized Harness artifacts separate from project Evidence;
- operation-scoped D2 recovery output that never acts as authorization.

These additions do not require new SCP Packet or Fixture Context fields. They refine the future Run Manifest contract only. The Run Manifest remains design-only; no JSON Schema, Writer, Store, Runner, artifact service or CI gate is authorized or created by this review.
