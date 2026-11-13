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

## 13. Minimum machine-field candidate (review draft; not a Schema)

This section proposes the smallest stable field model that can identify an attempt, reconstruct its exact input set, interpret the client result and audit Harness safety. It is a design candidate only. It does not authorize a JSON Schema, Writer, Store, Runner or CI integration.

### 13.1 Top-level contract

| Field | Required | Meaning and invariant |
|---|---:|---|
| `contract` | yes | Literal `scp-fixture-run-manifest`; prevents cross-contract interpretation |
| `manifest_version` | yes | Independent candidate version `0.1.0`; not coupled to Packet or Context versions |
| `run_id` | yes | Globally unique opaque attempt ID; UUID-shaped value is preferred, but consumers must not infer chronology from its contents |
| `retry` | yes | `retry_group_id`, positive `attempt_number`, and optional `retry_of` immutable manifest reference |
| `times` | yes | Wall-clock `started_at`, nullable `ended_at`, and `recorded_at`; all RFC 3339 timestamps with explicit offset |
| `inputs` | yes | Exact Context/Schema/Packet/Schema/repository and resolved dependency pins |
| `implementations` | yes | Harness, client, adapter and normalizer identities/versions; immutable build digests where available |
| `environment` | yes | Declared profile reference plus separately measured platform/runtime/capability/permission facts |
| `lifecycle` | yes | Independent preflight, setup, stimulus, observation, evaluation and cleanup states |
| `observation_refs` | yes | Ordered event-log reference and the snapshot references actually observed; empty only when the corresponding phase did not run |
| `actual_result` | conditional | Trustworthy normalized projection when available; it may be partial; absent when no trustworthy envelope can be normalized. JSON `null` is invalid |
| `assertions` | yes | One result for each expected comparison leaf, including explicit `not_run` or `inconclusive` outcomes |
| `outcomes` | yes | Separate `conformance_outcome` and `harness_outcome`; never a combined Boolean |
| `cleanup` | yes | Disposable-root identity, cleanup result and quarantine reference/state; no arbitrary filesystem path |
| `artifacts` | yes | Sanitized Harness-owned diagnostic/event artifacts using immutable references |
| `extensions` | optional | Namespaced non-core metadata; cannot override or shadow core fields |

The candidate intentionally has no mutable `latest`, `overall_success`, `ready`, or `authorized` field. Overall acceptance is derived from the two outcome axes and cleanup policy. A manifest does not authorize any production action.

### 13.2 Exact input-set pinning

A Run Manifest must identify the transitive input set that influenced evaluation, not merely the Context filename.

| Input role | Required pin |
|---|---|
| Context instance | Repository-relative path + Git blob SHA + `contract`/`context_version` |
| Context Schema | Repository-relative path + Git blob SHA + Draft 2020-12 dialect |
| Source repository | Exact `target.repository_revision` commit SHA taken from the pinned Context |
| Packet | Repository-relative path + Git blob SHA from the pinned Context |
| Packet Schema | Repository-relative path + Git blob SHA + Packet `schema_version` |
| Capability Profile | `profile_id` + `profile_version` + profile Git blob SHA |
| Driver descriptor | `driver_id` + `driver_contract_version` + descriptor path/blob SHA |
| Executable Driver bundle | Exact SHA-256 digest and immutable Registry resolution; descriptor SHA is not executable-bundle SHA |
| Provider contracts/evidence | Each referenced repository-relative path + Git blob SHA |
| Harness Registry | Immutable registry snapshot commit or content digest used to resolve allow-list entries |

The Context blob SHA is supplied by the caller/store and must not be embedded in the Context itself. The Manifest may carry a compact `resolved_artifacts[]` list keyed by role and stable ID rather than duplicating nested Context fields. The list must be complete for every transitive reference actually used, sorted canonically for deterministic comparison, and distinguish Git blob SHA from SHA-256 bundle digests.

A mutable branch name, `latest`, remote name, filesystem mtime, or Registry lookup performed after the run is not an acceptable substitute for a pinned input.

### 13.3 Implementation and environment pins

- `harness`, `client`, `adapter`, and `normalizer` each require stable ID and version. Record an immutable build/package digest when one exists; do not invent one for a non-reproducible local binary.
- The normalizer identity/version is required because two clients can emit equivalent protocol states only if the mapping into the normalized vocabulary is itself fixed.
- Preserve the Context's declared capability Profile reference separately from measured runtime capabilities. The former is a pinned test input; the latter is an observation.
- Record relevant OS, architecture, runtime and Git versions, plus measured filesystem/path/provider/permission capabilities actually used by assertions. An OS label alone is not a capability measurement.
- Keep deterministic fixture-clock input separate from wall-clock run timestamps. Simulated time must not be used to order retries or claim when the Harness actually ran.
- Do not serialize arbitrary environment variables, credentials, host home paths or unrelated machine details.

### 13.4 Lifecycle and evidence fields

Candidate lifecycle axes:

| Phase | States | Constraint |
|---|---|---|
| `preflight` | `not_started / succeeded / rejected / failed` | Resolves exact pins and validates Context/Registry before any fixture mutation |
| `setup` | `not_started / succeeded / failed / partial` | Mutates only a Harness-owned disposable root |
| `stimulus` | `not_started / completed / failed / partial` | Applies only declared ordered events |
| `observation` | `not_started / completed / failed / partial / not_applicable` | Captures only observations actually collected |
| `evaluation` | `not_started / completed / failed / partial` | Invokes the client/adapter and normalizes its actual output |
| `cleanup` | `not_required / succeeded / failed / unknown` | Never deletes a resource without proving Harness ownership |

The ordered event log is an immutable Harness artifact. Snapshot references identify actual observations, not planned snapshots from Context. Each artifact reference carries artifact kind, immutable locator, digest algorithm/value and sanitized status; the Run Manifest itself is externally content-addressed after finalization and must not contain its own digest.

The Manifest records only a disposable-root ID and ownership/quarantine evidence. It must not carry a client-controlled absolute cleanup path. A missing observation stays missing; expected Context observations cannot be copied into actual observations.

### 13.5 Actual result and stable assertion key

The `actual_result` mirrors the normalized result shape of Context `expected`:

- packet-level: `packet_schema_validation`, `protocol_compatibility`;
- claim-level: records keyed semantically by `claim_ref`, with only the normalized claim fields defined by Context 0.1.0;
- operation-level: records keyed semantically by `operation_scope`, with `recovery_mode`, `permitted_actions`, `prohibited_actions` and optional `user_decisions_needed`.

Array order is not semantic. Consumers match claim records by `claim_ref` and recovery records by `operation_scope`; duplicate keys are invalid. Action/reason-code collections are compared as sets after duplicate rejection, not by producer-specific array order.

The earlier generic `assertion_id` proposal is replaced by a structured deterministic key:

```json
{
  "subject_kind": "claim",
  "subject_ref": "claim-ref-from-context",
  "field": "freshness",
  "outcome": "passed"
}
```

- `subject_kind` is `packet`, `claim` or `recovery`.
- `subject_ref` is absent for packet-level fields, equals Context `claim_ref` for a claim, and equals Context `operation_scope` for a recovery record.
- `field` is one exact field name allowed for that subject kind by Context 0.1.0.
- The tuple `(subject_kind, subject_ref, field)` is unique within a Manifest. Do not concatenate opaque user-defined refs with delimiters or treat an array index as identity.
- Every normative leaf present in pinned Context `expected` maps to exactly one assertion tuple. No expected leaf may be silently skipped, and no assertion may refer to a field absent from Context `expected`.

Assertion outcomes are `passed / failed / inconclusive / not_run`. Expected values remain in the pinned Context; actual values remain in `actual_result`; an assertion stores the deterministic comparison outcome and optional sanitized diagnostic reference, not a second copy of either value.

### 13.6 Outcome derivation

Derivation is deterministic and applies to the full required assertion set:

1. If preflight rejects the Context/Registry/input set, or client evaluation never starts, `conformance_outcome=not_run`.
2. If evaluation starts and at least one fully observed assertion contradicts the pinned expectation, `conformance_outcome=non_conformant`, even if another assertion is inconclusive.
3. If evaluation starts but one or more required assertions are missing, inconclusive or not_run, and no proven contradiction exists, `conformance_outcome=inconclusive`.
4. Only when every required assertion is present and passed, with all required observations and exact input pins verified, may `conformance_outcome=conformant`.
5. `harness_outcome=healthy` requires lifecycle completion and cleanup success or a genuinely `not_required` cleanup. Setup/observation/evaluator/cleanup infrastructure failure yields `failed`; abnormal termination yields `interrupted`; an attempt never initiated yields `not_started`.
6. Overall acceptance is derived as `conformant + healthy`. No stored Boolean can override these rules.

An expected value of `unknown` is still a concrete expected protocol state. If a deterministic fixture injects a 403/429/timeout and the client correctly returns `unknown`, that assertion passes. If the Harness never supplies the required observation, it is inconclusive/not_run instead.

### 13.7 Retry and lifecycle cross-record invariants

- `run_id` is globally unique; a duplicate is a storage conflict.
- Within one `retry_group_id`, `attempt_number` starts at 1 and increases strictly; a later attempt's `retry_of`, when resolvable, points to the immediately preceding terminal Manifest in that same group.
- A retry after an unavailable predecessor may preserve `retry_lineage=unknown`; it must not invent a predecessor from timestamps or filenames.
- A retry never overwrites or resumes a terminal Manifest. The disposable fixture is rebuilt or independently revalidated from the pinned recipe.
- Preflight rejection means setup/stimulus/observation/evaluation did not run. Setup failure prevents client evaluation. Evaluation completion requires the actual result and the full assertion-set completeness decision to be recorded.
- Cleanup failure/unknown prevents overall acceptance and quarantines the disposable resource. A quarantined root cannot be reused for retry.
- An interrupted run may preserve a fully evaluated conformance outcome only when the complete normalized result and all required assertions were durably recorded before interruption. Otherwise it is inconclusive/not_run.

These rules span multiple Manifests and lifecycle records; JSON Schema alone cannot prove them.

## 14. Context-to-Manifest cross-record mapping

| Context 0.1.0 source | Manifest destination | Validation rule |
|---|---|---|
| Context file itself | `inputs.context` | Exact repository-relative path + Git blob SHA; no self-hash |
| Context contract/version | `inputs.context.contract/version` | Must match the pinned Context bytes |
| `target.repository_revision` | `inputs.source_repository_revision` | Exact commit SHA; never a moving ref |
| `target.packet` | `inputs.packet` | Path/blob SHA must match Context exactly |
| `target.packet_schema` | `inputs.packet_schema` | Path/blob SHA and Packet schema version must match Context/Packet |
| `environment.capability_profile` | `inputs.resolved_artifacts[capability_profile]` | Profile ID/version/blob SHA exact match; no fallback to latest |
| `setup.driver` | `inputs.resolved_artifacts[driver]` | Driver ID/contract version/descriptor SHA exact; executable bundle SHA separately verified |
| Provider authority evidence in events/observations | `inputs.resolved_artifacts[provider_contract]` | Exact path/blob SHA and contract revision; only included when referenced |
| `expected` | `assertions` | Every expected leaf has exactly one stable assertion tuple |
| `expected` (same) | `actual_result` | Actual output is compared to expectation; it must never be copied into Manifest as expected data |
| Event sequence / companion observations | `observation_refs` + event artifact | Actual sequence/snapshot observations must reconcile with Context stimuli; missing inputs cannot be synthesized |
| Declared Profile | `environment.declared_profile` | Preserve immutable Context reference |
| Runtime capabilities/permission | `environment.measured_capabilities` | Record actual measured values separately; profile mismatch is not silently normalized |
| Context fixture ID | `inputs.fixture_id` | Informational stable selector, not a substitute for Context blob SHA |

A Context can have many Manifests. A Manifest references exactly one Context blob and one attempt. The Context remains immutable and contains no actual run state.

## 15. Review vectors: positive, negative and non-accepting-but-valid records

These vectors are design examples, **not machine-readable fixtures and not Schema validation results**. They define expected semantic classification before a future Schema/Writer is considered.

### 15.1 Positive/valid records

| ID | Input and actual behavior | Required Manifest interpretation |
|---|---|---|
| RM-P01 | Context injects authenticated Provider 403 and expects source freshness/identity unknown; client returns those exact states; every expected leaf passes; cleanup succeeds | `conformance=conformant`, `harness=healthy`, accepted. Expected `unknown` is a pass because it is the exact expected state |
| RM-P02 | All actual normalized claims/recovery match; evaluation and assertions are durable; cleanup fails with ownership still proven | Preserve `conformance=conformant`; set `harness=failed`; quarantine root; overall not accepted |
| RM-P03 | Preflight safely rejects a `contract_only` Driver before setup; no client invocation occurs | `conformance=not_run`; Harness may be `healthy` if rejection is correctly handled; never client pass |
| RM-P04 | Observation adapter cannot measure a capability explicitly required by the profile; no client result is inferred | `conformance=inconclusive` or `not_run` depending on whether evaluation started; Harness state reflects the actual adapter failure |

RM-P02/03/04 are valid records of non-accepted attempts; “valid manifest” is not synonymous with “passing conformance”.

### 15.2 Negative semantic records

| ID | Contradiction | Required rejection/classification |
|---|---|---|
| RM-N01 | A required expected leaf has no assertion tuple, but Manifest says conformant | Invalid/incomplete assertion set; cannot be conformant |
| RM-N02 | Two assertion entries share the same `(subject_kind, subject_ref, field)` | Invalid duplicate assertion identity |
| RM-N03 | Context expects unknown for a deterministic 403, actual result says current/resolved, Manifest says conformant | Must be non_conformant; outcome claim is contradictory |
| RM-N04 | Preflight is rejected but setup, stimulus or client evaluation is also marked completed | Lifecycle contradiction; reject Manifest |
| RM-N05 | Cleanup is failed/unknown but Harness is healthy or overall run is accepted | Outcome contradiction; reject Manifest and quarantine disposable root |
| RM-N06 | Retry attempt 3 points to attempt 1 in another retry group, or attempt numbers regress/duplicate | Invalid retry lineage; do not aggregate |
| RM-N07 | Declared profile pins differ but comparison labels two runs an exact replay | Comparison is incompatible; never average/normalize as equivalent |
| RM-N08 | Artifact contains credentials, raw authorization material or points to a user checkout/project Evidence path | Security-policy violation; reject/quarantine artifact before persistence |
| RM-N09 | Only a subset of required assertions passed before interruption, yet conformance is conformant | Must be inconclusive/not_run; a passed subset is not full conformance |
| RM-N10 | A retry reuses a disposable root whose prior cleanup failed or ownership is unknown | Reject setup; root remains quarantined and unavailable |

### 15.3 Classification vocabulary

- **Schema-invalid**: malformed shape/type/enum/required fields, to be tested only after a future Schema is authorized.
- **Semantic-invalid**: cross-record/lifecycle/retry contradictions such as RM-N01/N02/N04/N05/N06/N09/N10.
- **Non-conformant client result**: a structurally/semantically valid Manifest faithfully records a client mismatch, such as RM-N03. Do not reject the record merely because the client failed the test.
- **Security-rejected artifact**: redaction/namespace/ownership violation; the untrusted artifact must not be persisted as accepted evidence.
- **Inconclusive/not_run**: legitimate outcomes when observation or evaluation is unavailable; not synonyms for schema-invalid.

## 16. Schema creation gate and decision

The minimum field mapping, Context linkage and deterministic review vectors are now sufficiently concrete for a future Schema proposal. However, the existing §10 acceptance criteria are not yet met:

| Gate | Current evidence | Status |
|---|---|---|
| Outcome/lifecycle axes and derivation | §§4–5, 11–13 define separate axes and deterministic rules | Design-complete, pending independent review |
| Expected/actual normalized shape | §13.5–§14 maps every expected leaf by stable structured key | Design-complete, not exercised by clients |
| Exact Registry/Driver/Profile pinning | Context pins and transitive dependency rules are defined; all current Drivers remain `contract_only` | Not executable |
| Deterministic failure/retry/interruption/cleanup examples | RM-P01–P04 and RM-N01–N10 | Design vectors only; no executable tests |
| Credential-redaction and artifact-boundary negative tests | Policy is defined in §7/§12/§15 | No sanitizer or negative test exists |
| Two independent Harness implementations | None exists; no client adapter or Harness Registry is implemented | Not met |
| External Manifest digest and immutable store | Digest boundary is defined; no store/finalizer exists | Not implemented |

**Decision: do not create `run-manifest.schema.json` in this iteration.** Creating it now would give untested assumptions a machine-contract appearance, especially around normalized client output, transitive Registry resolution, retry lineage and artifact sanitization.

Next prerequisite is not a Writer or CI Gate. It is an independently reviewable normalized-output contract plus two small, separate Harness/adapter implementations (or equivalent conformance producers) that consume the same pinned Context and emit the same normalized field/claim/scope set. After those results and redaction/cleanup contract tests exist, revisit the Schema gate. This is a design hold, not a freeze or rejection of the Run Manifest concept.

## 17. Normalized Actual Result Contract (design candidate)

This section defines the cross-client result representation used by future Harness adapters. It is a language-neutral logical contract, not a JSON Schema, runtime API or implementation. Candidate contract identity: `scp-fixture-normalized-result/0.1.0`, versioned independently from Packet, Context and Run Manifest.

### 17.1 Purpose and projection rule

A normalized result is a **test-scoped projection** of one client evaluation, not a complete dump of the client's internal state.

- The Harness control plane holds the pinned Context, including `expected`; the Client Under Test must not receive the full Context file/object or expected values.
- A projection descriptor may be derived from the expected structure, but it contains only the allowed claim refs, operation scopes and field names—never expected values. It is safe to provide this descriptor to the adapter/client only to define the requested output surface.
- The Oracle Evaluator retains expected values in a separate trust boundary and compares them only after the Client Under Test has returned. The result normalizer receives the projection descriptor and client output, not the expected values.
- The normalizer emits only values actually returned/observed by the Client Under Test for the in-scope projection.
- A claim/operation or field outside the Context projection is not added to the normalized result. Unknown field names or values in the adapter's normalized contract are rejected as unsupported/invalid; the normalizer must not silently reinterpret them.
- Missing actual values remain missing. They are not filled with Context expected values, cached values, another claim's value or a default.
- The result projection does not prove that the client has no additional internal claims; it only makes the exact tested surface deterministic.

This bounds the interface and prevents client-specific extra data from becoming an accidental compatibility requirement.

### 17.2 Candidate envelope and field catalogue

The conceptual envelope is:

```json
{
  "contract": "scp-fixture-normalized-result",
  "result_version": "0.1.0",
  "packet_schema_validation": "valid",
  "protocol_compatibility": "compatible",
  "claims": [
    {
      "claim_ref": "project.repository_identity.checkout",
      "freshness": "unknown",
      "applicability": "applicable",
      "identity_state": "unknown"
    }
  ],
  "recovery": [
    {
      "operation_scope": "read_local_project_rules",
      "recovery_mode": "restricted",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["cross_repository_write"]
    }
  ]
}
```

The top-level `contract`, `result_version`, `claims` and `recovery` envelope members are required. `claims` and `recovery` may be empty when no corresponding actual record was emitted; expected-but-missing records then produce incomplete assertions. The two packet-level result fields may be absent in a partial result. They are mandatory in Context 0.1.0 expected data, so their absence cannot pass those assertions.

Allowed normalized fields are exactly those already defined by Context 0.1.0:

| Subject | Key | Allowed value |
|---|---|---|
| packet | none | `packet_schema_validation`: valid / invalid / unsupported |
| packet | none | `protocol_compatibility`: compatible / unsupported / incompatible / unknown |
| claim | `claim_ref` | `freshness`: current / stale / conflict / unknown |
| claim | `claim_ref` | `applicability`: applicable / not_applicable / not_configured / unknown |
| claim | `claim_ref` | `identity_state`: resolved / provisional / ambiguous / conflict / unknown |
| claim | `claim_ref` | `path_identity_state`: unique / ambiguous / conflict / unknown |
| claim | `claim_ref` | `fingerprint_coverage`: complete / partial / unknown |
| claim | `claim_ref` | `observation_consistency`: stable / changed_during_capture / unknown |
| claim | `claim_ref` | `reason_codes`: unique strings in the `scp.fixture.*` namespace |
| recovery | `operation_scope` | `recovery_mode`: normal / restricted / blocked |
| recovery | `operation_scope` | `permitted_actions`: unique action identifiers |
| recovery | `operation_scope` | `prohibited_actions`: unique action identifiers |
| recovery | `operation_scope` | `user_decisions_needed`: unique exact strings |

A normalized claim row requires `claim_ref`; each recognized result field is optional so a partial observation can be represented without inventing a value. A normalized recovery row requires `operation_scope`; its result fields are optional for the same reason. A row with no actual result fields should be omitted. Duplicate claim keys, duplicate operation scopes, or duplicate values in set-valued arrays invalidate the normalized projection.

### 17.3 Missing, unknown, null and unsupported are different

These meanings are normative for this candidate:

| Representation | Meaning | Assertion handling |
|---|---|---|
| Field absent | Client/adapter supplied no value for this expected field | inconclusive if evaluation ran; not_run if evaluation never ran |
| Explicit enum `unknown` | Client explicitly concluded the value cannot be established | Compare exactly to expected; may pass when expected is `unknown` |
| Explicit `not_applicable` / `not_configured` | Client explicitly classified applicability/configuration | Compare exactly; never convert to freshness |
| JSON `null` | Not part of the normalized result vocabulary | Invalid normalized output; do not convert to absent or unknown |
| Unrecognized enum or core field | Result contract is unsupported/incompatible | Reject normalization; do not coerce to unknown |
| Malformed/undecodable client response | No trustworthy normalized value can be derived | Preserve diagnostics safely; assertion is inconclusive/not_run, not an invented pass/fail |

A deterministic fixture that injects a Provider 403 and expects freshness `unknown` should pass when the client explicitly returns `unknown`. The same expected field omitted from the actual projection is inconclusive. This is the central distinction between an observed unknown state and an unobserved state.

### 17.4 Key identity and string comparison

- Match claim rows by exact `claim_ref` and recovery rows by exact `operation_scope`.
- Compare identifiers as exact Unicode scalar sequences encoded in valid UTF-8. Do not trim whitespace, lowercase, case-fold, URL-decode, path-normalize, or Unicode-normalize these opaque IDs.
- Reject invalid UTF-8 and unpaired surrogate code points before comparison.
- Object member order is irrelevant.
- Claim and recovery array order is irrelevant; a canonical presentation sorts rows by their key's UTF-8 byte sequence.
- The sets `reason_codes`, `permitted_actions`, `prohibited_actions` and `user_decisions_needed` are order-insensitive. Reject duplicates, then compare as exact string sets; canonical presentation sorts by UTF-8 byte sequence.
- Empty array is a concrete empty set. It is not equivalent to a missing field.
- String equality is exact. Human-readable diagnostics are not compared and must never substitute for a protocol field.

The comparison is over parsed, typed values, not raw JSON text. Whitespace, object key order and array ordering of set-like collections do not create false differences. This section does not define a Manifest self-hash serialization algorithm.

### 17.5 Projection completeness and assertion derivation

For the pinned Context expected object, construct the required assertion key set mechanically:

1. Add packet keys `(packet, absent, packet_schema_validation)` and `(packet, absent, protocol_compatibility)`.
2. For each expected claim row, add one key `(claim, claim_ref, field)` for every result field present in that row, excluding the key field `claim_ref`.
3. For each expected recovery row, add one key `(recovery, operation_scope, field)` for every result field present in that row, excluding the key field `operation_scope`.
4. Arrays such as `reason_codes`, action lists and decision lists are one atomic set-valued field and therefore produce one assertion, not one assertion per array element.
5. Reject duplicate expected claim keys, operation scopes or assertion tuples before evaluation.

For every required key, exactly one assertion outcome is recorded in the Manifest:

- `passed`: an actual value exists and exactly matches the expected typed value after the declared set normalization.
- `failed`: an actual value exists and differs from the expected typed value.
- `inconclusive`: evaluation ran but the actual field/value could not be established or safely normalized.
- `not_run`: the evaluation stage for that field never ran.

No extra assertion key is allowed. A missing required assertion record is itself a Manifest completeness defect and cannot be treated as a pass. The normalizer does not generate assertion outcomes; the Harness evaluator derives them from pinned Context expected values and normalized actual values.

Conformance derivation from §13.6 remains unchanged: any proven mismatch yields non_conformant; absent/uncertain required values with no proven mismatch yield inconclusive; conformant requires every required assertion passed. A passing subset never establishes conformance.

### 17.6 Three concrete projection examples from Context 0.1.0

The following are design examples of the normalized actual-result contract, not run evidence. They show the exact expected projection surfaces for existing Context instances.

**A. Credential-bearing repository locator**

For `credentialed-project-repository`, the expected projection contains 2 packet fields, 4 claim fields and 6 recovery fields: 12 assertions.

```json
{
  "contract": "scp-fixture-normalized-result",
  "result_version": "0.1.0",
  "packet_schema_validation": "valid",
  "protocol_compatibility": "compatible",
  "claims": [
    {
      "claim_ref": "project.repository",
      "freshness": "unknown",
      "applicability": "applicable",
      "identity_state": "unknown",
      "reason_codes": ["scp.fixture.identity.credentialed_locator"]
    }
  ],
  "recovery": [
    {
      "operation_scope": "publish_using_project_repository_locator",
      "recovery_mode": "blocked",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["persist_credentialed_locator", "publish", "push"]
    },
    {
      "operation_scope": "read_local_project_rules",
      "recovery_mode": "restricted",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["log_credential_material"]
    }
  ]
}
```

**B. Authenticated authoritative Provider not-found**

For `identity-source-reference-unresolvable`, the expected projection contains 2 packet fields, 7 claim fields and 6 recovery fields: 15 assertions. The explicit `unknown` identity state for the checkout is a value, not a missing observation.

```json
{
  "contract": "scp-fixture-normalized-result",
  "result_version": "0.1.0",
  "packet_schema_validation": "valid",
  "protocol_compatibility": "compatible",
  "claims": [
    {
      "claim_ref": "project.repository_identity.checkout",
      "freshness": "unknown",
      "applicability": "applicable",
      "identity_state": "unknown"
    },
    {
      "claim_ref": "project.repository_identity.source_refs[0]",
      "freshness": "stale",
      "applicability": "applicable",
      "identity_state": "unknown",
      "reason_codes": ["scp.fixture.identity.authoritative_not_found"]
    }
  ],
  "recovery": [
    {
      "operation_scope": "read_local_project_rules",
      "recovery_mode": "restricted",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["cross_repository_write"]
    },
    {
      "operation_scope": "resolve_or_push_to_checkout_identity",
      "recovery_mode": "blocked",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["cross_repository_write", "publish", "push"]
    }
  ]
}
```

**C. Fingerprint path-set mismatch**

For `fingerprint-path-set-mismatch`, the expected projection contains 2 packet fields, 5 claim fields and 6 recovery fields: 13 assertions. The affected modify operation is blocked while the unrelated local read scope remains restricted.

```json
{
  "contract": "scp-fixture-normalized-result",
  "result_version": "0.1.0",
  "packet_schema_validation": "valid",
  "protocol_compatibility": "compatible",
  "claims": [
    {
      "claim_ref": "code.worktree_fingerprint",
      "freshness": "conflict",
      "applicability": "applicable",
      "fingerprint_coverage": "unknown",
      "observation_consistency": "stable",
      "reason_codes": ["scp.fixture.fingerprint.path_set_mismatch"]
    }
  ],
  "recovery": [
    {
      "operation_scope": "modify:notes/changed.md",
      "recovery_mode": "blocked",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["modify_affected_path", "push"]
    },
    {
      "operation_scope": "read_unrelated_project_rules",
      "recovery_mode": "restricted",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["write"]
    }
  ]
}
```

These examples are expected-result-shaped projections. A real run must source every actual value from the Client Under Test/adapter observation and then derive assertion outcomes; copying these values from Context would invalidate the test.

### 17.7 Cross-client comparison matrix

A comparison report is a separate derived test artifact. It does not alter either Manifest and does not establish project authorization or Evidence.

| Comparison condition | Classification | Permitted interpretation |
|---|---|---|
| Same Context/Schema/Packet/Packet Schema/source revision/Profile/Driver/Provider/Registry pins; same deterministic clock and event inputs; same relevant measured capability and permission observations; same normalized-result contract version; both projections complete and equal | `equal` | Normalized outputs are interoperable for this tested projection |
| Same comparable inputs; both projections complete but at least one expected field differs | `divergent` | Preserve both actual outputs; report exact mismatching assertion keys |
| Inputs are comparable but one/both projections omit required actual fields or lack required observations | `incomplete` | No parity pass; identify missing assertion keys |
| Context, schema, packet, profile, driver, provider, Registry or required input pins differ | `incomparable` | Do not combine or average these runs |
| A relevant measured capability/permission differs and Context 0.1.0 supplies no per-field capability dependency map | `incomparable` | No safe common-subset inference is available in 0.1.0 |
| A normalized result cannot be parsed or violates the result contract | `invalid_result` | Preserve sanitized diagnostics; no parity/conformance pass |

Important distinctions:

- Client, adapter and normalizer implementation identities are expected to differ in an interoperability exercise; record them rather than treating their difference as an input mismatch. The normalized-result **contract version** must match.
- Exact input equivalence compares immutable artifact pins, deterministic fixture inputs and the relevant observed capability/permission projection. OS name alone neither proves nor disproves equivalence.
- Attempt-specific run IDs, timestamps, temporary directory names and locally generated snapshot IDs are not parity values. Compare snapshot roles/phases and content digests; retain local IDs only for traceability.
- Because Context 0.1.0 does not declare capability dependencies per expected leaf, a material capability/permission difference makes the entire result incomparable. Do not invent a common subset. A future Context minor version may define explicit dependency mapping.
- `unknown` equals `unknown` only as an exact expected/result value; it is not a wildcard matching current, stale or any other state.
- `equal` parity does not prove conformance: two clients can return the same wrong value. Each Manifest's conformance outcome is evaluated independently against the pinned Context.
- `divergent` parity does not by itself identify which client is correct; evaluate each result against the same expected projection.

### 17.8 Review vectors for normalized output

| ID | Input | Output condition | Required interpretation |
|---|---|---|---|
| NR-P01 | Two clients evaluate the same authoritative-not-found Context | One emits claim/recovery rows in reverse array order; set-valued members also have different ordering | Equal after key/set normalization |
| NR-P02 | Context expects freshness unknown | Client explicitly emits `unknown` | Exact value; assertion may pass |
| NR-P03 | Context expects freshness unknown | Client omits the freshness field | Incomplete/inconclusive, not equal to unknown |
| NR-N01 | Same Context | Actual field is JSON null | Invalid normalized result |
| NR-N02 | Same Context | Duplicate `claim_ref` or `operation_scope` | Invalid normalized result |
| NR-N03 | Same Context | Claim key differs only by case, whitespace or Unicode normalization | Different opaque key; expected assertion is missing; no fuzzy match |
| NR-N04 | Same Context | Actual output includes a field not in the expected projection or an unrecognized core field | Reject as invalid/unsupported projection; do not silently drop/coerce |
| NR-N05 | Same Context | A required expected leaf is omitted from Manifest assertions | Manifest incomplete; cannot be conformant |
| NR-N06 | Same Context, same measured environment | Both outputs are complete but one expected field differs | Divergent parity; evaluate each conformance result separately |
| NR-N07 | Same Context, different relevant permission/capability observation | Outputs happen to match | Incomparable in Context 0.1.0; matching values cannot erase input difference |
| NR-N08 | Same Context | One client returns explicit `not_configured` where expected is `unknown` | Exact mismatch; applicability and unknown are not interchangeable |

These vectors are logical review cases only. They are not executable adapter tests or Schema-valid fixture files.

### 17.9 Design conclusion

The normalized projection is now precise enough for independent adapter prototypes to implement without inventing field names, ordering rules, missing-value semantics or assertion identities. This does not mean the prototypes have been authorized or implemented.

Before Run Manifest Schema creation, two independently implemented adapters must:
1. Consume the same pinned Context/Packet/Schema/Profile/Driver and deterministic observations.
2. Produce the same normalized-result contract version and required claim/scope/field projection.
3. Demonstrate exact equality for NR-P01 and the three existing Context projections.
4. Preserve absent versus explicit unknown, reject null/duplicate/unknown core data, and produce the expected incomplete/invalid classifications.
5. Produce independently pinned implementation/normalizer identities so shared code cannot hide a common adapter defect.

A third-party or second implementation must not be a copy of the first adapter with only a different client label. The two implementations need independently authored normalization/adapter paths, while sharing only this normative contract and immutable fixture inputs.

**Disposition:** normalized-result design candidate complete for independent review; no machine Schema, executable adapter, Harness Registry, Runner, Writer, Validator, Store or CI Gate is created in this section. The Run Manifest Schema gate in §16 remains closed pending independent implementation and redaction/cleanup evidence.

## 18. Independent adversarial review of Normalized Result (2026-11-13)

This review tests whether the result projection itself could leak the oracle, hide missing evidence, or compare unlike observations as equivalent. It does not authorize implementation.

### 18.1 Oracle separation is a mandatory execution boundary

The earlier “do not copy expected values” rule is insufficient if the full Context is visible to the Client Under Test. Future Harness architecture must keep three trust zones distinct:

1. **Harness control plane:** loads and validates the immutable Context; retains the complete `expected` object and exact input pins.
2. **Client sandbox:** receives the Packet, required protocol/schema bytes, fixture observations and a projection descriptor containing only allowed `claim_ref`, `operation_scope` and field names. It must not receive the Context file, expected values, assertion outcomes, validation report containing expected answers, or oracle artifact paths.
3. **Oracle Evaluator:** receives the pinned expected values and the normalized actual projection only after client evaluation. It computes assertion outcomes; it is not exposed as a client tool, workspace file or environment variable.

The projection descriptor is derived by stripping values from Context `expected`; it contains only record keys and property names. It is a transient Harness DTO, not a third persisted state file or a new Context field.

The adapter/normalizer is not permitted to pass hidden expected values through prompt text, tool metadata, environment variables, logs, filenames or diagnostics. When the Client Under Test is an Agent with filesystem/tool access, the Context/Run Manifest/oracle artifacts must reside outside its accessible project/worktree and connector scope. Passing a sanitized projection descriptor does not authorize mounting the source Context.

Harness preflight may validate Context Schema, artifact availability, blob pins, Registry allow-list and fixture setup. It must **not** substitute its own Packet validation result for the Client Under Test's normalized `packet_schema_validation` field. The latter is a behavior under test and is produced only by the Client Under Test. The same separation applies to `protocol_compatibility`.

If oracle isolation cannot be established, the run is invalid as a conformance experiment: mark it not_run/inconclusive and do not claim a client pass.

### 18.2 Fixture observation reconciliation precedes client evaluation

Context companion observations are declared fixture inputs/expected observations, not proof that setup actually produced them.

The Harness must:
1. Build only the declared disposable fixture from the pinned Driver/Profile.
2. Collect actual observations through the observation adapter.
3. Reconcile actual observations against the exact Context event sequence and companion-observation expectations.
4. Supply the reconciled observations to the Client Under Test.
5. Retain actual snapshot/event refs separately from Context inputs.

If required fixture observations are absent, differ from the expected input, have the wrong profile/provider contract revision, or cannot be verified, reject the fixture before client evaluation (`not_run`) or mark the affected evaluation `inconclusive` when the discrepancy is discovered after invocation. Never copy Context companion observations into the Manifest's actual-observation refs.

A Harness preflight success proves only that the exact test inputs and fixture environment are ready; it does not prove the Client Under Test has validated the Packet or produced a correct Bootstrap result.

### 18.3 Projection and extra-output handling

Three layers must not be conflated:

- **Raw client response:** client-specific output; it may contain unrelated internal metadata, which must not be copied into the normalized result or diagnostic artifacts without explicit sanitization.
- **Projection descriptor:** only the expected keys and field names, with all expected values removed.
- **Normalized projection:** strict candidate contract output containing only the selected keys/fields.

Recognized but out-of-scope client fields are excluded by the explicit projection rule; this is intentional filtering, not a claim that they were tested. An unknown core field/value in the normalized-result contract is invalid/unsupported and must not be silently discarded or coerced. A normalized projection containing a claim/scope/field outside the projection descriptor is invalid.

For an emitted normalized envelope, `claims` and `recovery` arrays are present. A missing expected row or field produces an incomplete assertion. An explicitly emitted empty set is a value: it passes only when the Context expected set is also empty. A missing array field is not an empty array. If no trustworthy envelope can be normalized at all, omit `actual_result` and record the failed/partial evaluation with sanitized diagnostics.

### 18.4 Cross-platform string and ordering stability

The review confirms the proposed exact-string semantics are portable only when implementations avoid locale APIs:

- Decode source JSON as strict UTF-8 and reject invalid encodings and unpaired surrogate values.
- Compare opaque keys by exact Unicode scalar sequence; no trimming, case folding, NFC/NFD normalization, URL decoding or filesystem path rewriting.
- For deterministic presentation, sort keys and set members lexicographically by **unsigned UTF-8 bytes**, not locale collation, language-default string sort or OS path sort.
- Equality is independent of JSON object-member order and claim/recovery array order.
- Set-valued arrays reject duplicates; after duplicate rejection, membership is exact. Empty set and absent property remain distinct.

Because valid UTF-8 byte order preserves Unicode scalar order, the specified byte comparator can be implemented consistently without relying on each language's locale configuration. This contract does not redefine Git path identity; path equivalence remains an input observation governed by the pinned capability profile.

### 18.5 Independent implementation is more than different labels

Two implementations do not count as independent merely because they have different client names, command wrappers or version strings.

For an interoperability acceptance claim:
- the two Harness/adapter/normalizer paths must be independently implemented and separately versioned/pinned;
- they must not call the same shared normalization library for the logic being tested;
- they may share this normative specification and immutable fixture artifacts;
- each must independently implement strict UTF-8 handling, exact key matching, missing/unknown/null semantics, set normalization and assertion projection;
- each must produce an observation-input digest that can be compared before client evaluation;
- each must produce a normalized output that can be independently checked against the same expected oracle;
- a second implementation should use a materially independent runtime or language where practical. A different language is useful evidence of implementation independence, but not sufficient if both wrappers delegate to the same hidden normalizer.

At least one vector must be run through two distinct Agent clients as well as two independent adapter paths. Harness-input parity and Client-output parity are separate acceptance results.

### 18.6 Additional adversarial vectors

| ID | Counterexample | Required handling |
|---|---|---|
| NR-N09 | Full Context or expected values are mounted into the Client Under Test workspace/tool scope | Oracle isolation failure; run not valid for conformance |
| NR-N10 | Harness preflight validates Packet and copies its result into Client actual `packet_schema_validation` | Invalid test architecture; packet validation must be emitted by the Client Under Test |
| NR-N11 | Context companion observation is copied into actual observation refs without collecting it from the disposable fixture | Missing observation; not_run/inconclusive |
| NR-N12 | Normalizer silently drops an unknown normalized core field or maps it to unknown | Invalid/unsupported result; no pass |
| NR-N13 | Cross-platform implementation sorts with locale collation or normalizes Unicode keys | Non-deterministic/incompatible comparison |
| NR-N14 | Two adapters use the same normalization library but claim independent implementations | Independence criterion not met |
| NR-N15 | Context expected set is empty and actual field is absent | Inconclusive; absence is not the empty set |
| NR-N16 | Context expected set is empty and actual explicitly emits [] | Exact empty-set match; may pass |

### 18.7 Review conclusion and next gate

The Normalized Result contract is design-complete only after these trust-zone and input-observation clarifications are incorporated. The previous §17 examples remain projections, not executed outputs. No Adapter has been run, and no interoperability evidence exists.

Before any Run Manifest Schema or CI gate, the next deliverable should be an adapter implementation blueprint specifying:
- a client-facing request DTO that excludes Context expected values;
- an observation input package with exact artifact pins and measured capability profile;
- a projection descriptor containing keys/field names only;
- a strict normalized-result response envelope;
- an Oracle Evaluator interface inaccessible to the Client Under Test;
- independent adapter test vectors for oracle leakage, missing observations, exact unknown, empty set, null, duplicate keys and cross-platform sorting;
- separate Harness-input parity and Client-output parity reports.

The prototype implementation itself remains a separate authorization step. Until that step is explicitly authorized, all work stays at the design and review level.

## 19. Two independent Adapter implementation blueprint (design only)

This blueprint defines the smallest independently implementable boundary without selecting a programming language, Agent vendor, transport or executable bundle. It is not a source-code API, JSON Schema, Driver, Runner or authorization to implement prototypes.

### 19.1 Logical components and trust zones

| Component | Receives | Must not receive | Responsibility |
|---|---|---|---|
| Context Loader / Harness Control Plane | Full Context, immutable artifact pins, Registry/Profile/Driver metadata | — | Validate Context, retain oracle values, resolve exact test inputs |
| Fixture Driver + Observation Adapter | Driver/Profile, disposable fixture recipe, event barriers | Expected assertion values | Create isolated fixture and collect actual observations |
| Projection Builder | Context expected structure | Client response not yet available | Emit keys/field names only; strip every expected value |
| Client Adapter | Client Evaluation Request and client transport | Full Context, expected values, assertion results, Run Manifest, oracle artifacts | Invoke one Agent client through its documented interface |
| Result Normalizer | Projection descriptor + client response | Expected values | Produce strict Normalized Actual Result projection |
| Oracle Evaluator | Expected values + normalized actual result | Client invocation authority / production write APIs | Generate assertion outcomes and conformance result |
| Manifest Finalizer | Lifecycle, pins, sanitized refs, normalized result, assertions, cleanup evidence | Raw credentials or unsanitized raw response | Finalize one immutable per-attempt record |

The Context file and expected values live only in the Harness control plane. A Client Adapter must not be given a path, URI, mounted directory, environment variable or tool that can read them.

### 19.2 Client Evaluation Request (conceptual DTO)

The only test input handed to a Client Adapter is a value object with the following logical fields:

| Field | Required | Content |
|---|---:|---|
| `request_id` | yes | Per-invocation opaque ID; not the retry-group identity |
| `packet` | yes | Exact Packet artifact bytes or read-only artifact handle, Git blob SHA and Packet schema version |
| `packet_schema` | yes | Exact pinned Packet Schema bytes or read-only handle and Git blob SHA |
| `observations` | yes | Actual reconciled observation records, ordered event/snapshot refs and content digests; synthetic only |
| `capability_profile` | yes | Exact immutable declared Profile reference plus measured relevant capabilities and permission observations |
| `projection` | yes | Packet field names, claim refs + field names, operation scopes + field names; contains no expected values |
| `fixture_clock` | yes | Deterministic Context clock input, distinct from Harness wall-clock timestamps |
| `protocol_contracts` | conditional | Exact protocol/schema compatibility material needed by the client; immutable refs/bytes |

The request contains no Context blob, Context path, `expected`, expected values, expected reason-code arrays, assertion outcomes, Run Manifest, test answer key or oracle artifact reference. It also contains no user's production repository/worktree or real credentials.

The Client Adapter must expose the Packet/Schema/observations read-only. The Agent may inspect the synthetic test Packet, including intentionally credential-shaped fixture strings, but the Adapter and logs must redact those values before diagnostic persistence.

### 19.3 Projection Descriptor (values stripped)

The projection descriptor is mechanically derived from Context `expected` by removing all values and retaining only the expected field inventory. Example:

```json
{
  "packet_fields": [
    "packet_schema_validation",
    "protocol_compatibility"
  ],
  "claims": [
    {
      "claim_ref": "project.repository_identity.checkout",
      "fields": ["freshness", "applicability", "identity_state"]
    },
    {
      "claim_ref": "project.repository_identity.source_refs[0]",
      "fields": ["freshness", "applicability", "identity_state", "reason_codes"]
    }
  ],
  "recovery": [
    {
      "operation_scope": "read_local_project_rules",
      "fields": ["recovery_mode", "permitted_actions", "prohibited_actions"]
    },
    {
      "operation_scope": "resolve_or_push_to_checkout_identity",
      "fields": ["recovery_mode", "permitted_actions", "prohibited_actions"]
    }
  ]
}
```

This descriptor says *which outputs are requested*, not *what the outputs should be*. It contains no expected enum values, expected action values or pass/fail labels. The Harness must verify by construction that stripping expected values leaves no literal answer material. It may be passed to the client as output-shape guidance, but the Client Under Test must not be able to read the original Context or Oracle Evaluator memory.

### 19.4 Invocation and response boundary

The adapter lifecycle is:

1. Validate Context, exact Schema/Packet/Profile/Driver/provider refs and Registry snapshot in the control plane.
2. Build the disposable fixture from the allow-listed Driver; collect actual observations and reconcile them with the Context-declared companion observations.
3. If fixture observations or required capabilities do not match, stop before client invocation and record not_run/inconclusive as applicable.
4. Build the values-stripped projection descriptor and read-only Client Evaluation Request.
5. Invoke the named Client Under Test using its supported interface. Do not call production write APIs, real provider endpoints or real repository mutations.
6. Capture a bounded client response in memory; classify returned/timeout/crashed/cancelled/malformed transport state. Do not persist raw output before secret redaction.
7. Normalize the client response using the pinned Normalized Result contract and projection descriptor. If no trustworthy result exists, leave actual_result absent and preserve sanitized diagnostic/transport state.
8. Pass normalized actual values and hidden expected values separately to the Oracle Evaluator. Persist assertion outcomes and then perform Harness-owned cleanup/finalization.

Harness preflight validates the *test input artifacts*. It does not supply the Client Under Test's `packet_schema_validation` or `protocol_compatibility` result. Those fields must come from client behavior.

### 19.5 Three distinct interoperability tests

Do not collapse the following into one “two clients passed” statement.

**A. Harness-input parity**

Both independently implemented Harness adapters consume the same pinned Context and construct a Client Evaluation Request. Compare:
- Packet and Packet Schema blob SHA/bytes;
- actual observation package by role/phase/content digest;
- Profile/Driver/Provider/Registry pins;
- deterministic clock and event sequence;
- measured relevant capability/permission map;
- values-stripped projection descriptor.

The input-parity report is `equal` only when all required inputs match. If an observation is missing or capability is unknown, report incomplete/incomparable, not equal.

**B. Normalizer contract parity**

Feed the same pinned synthetic raw-response vectors to the two independently implemented normalizers. Compare their output against the same Normalized Result contract vectors, including:
- exact IDs with whitespace/case/Unicode edge cases;
- reordered claim/recovery rows and set-valued arrays;
- missing vs explicit unknown vs empty set vs null;
- duplicate keys and duplicate set members;
- unknown enum/core properties;
- malformed UTF-8/unpaired surrogate input;
- sanitized diagnostics for credential-shaped values.

This detects common wrapper assumptions before a live Agent client is involved.

**C. Client-output parity and per-client conformance**

Invoke two distinct Agent clients with equivalent Client Evaluation Requests. Compare normalized output projections using §17.7 and evaluate each independently against the same hidden Context expected oracle. Report:
- each client's conformance outcome;
- input parity outcome;
- normalized result parity outcome;
- any Harness/normalizer validity failure.

No client is declared correct merely because it agrees with the other. Two clients can be identically wrong; parity and conformance remain separate.

### 19.6 Minimum acceptance matrix

| Test | Adapter A | Adapter B | Acceptance evidence |
|---|---|---|---|
| Context preflight | Same immutable fixtures | Same immutable fixtures | Equal resolved pins and exact Context/Packet/Schema checks |
| Fixture observations | Independently setup/observe | Independently setup/observe | Equal observation content digests and capability projection |
| Projection descriptor | Independently derive | Independently derive | Byte/structural equality; no expected values present |
| Normalizer positive vectors | Independent implementation | Independent implementation | Both match same normative normalized outputs |
| Normalizer negative vectors | Independent implementation | Independent implementation | Both reject or classify all NR negative vectors identically |
| Agent invocation | Client A via its documented connector | Client B via its documented connector | No oracle access; same equivalent request |
| Oracle evaluation | Separate hidden evaluator | Same hidden expected values | Per-client assertion completeness and conformance |
| Cleanup | Own disposable root only | Own disposable root only | Ownership proof, cleanup result and quarantine on uncertainty |

At least one fixture must exercise an intentionally unknown client state, one must exercise a missing observation, and one must exercise a credential-shaped synthetic Packet value without leaking it to logs/artifacts.

A meaningful interoperability claim requires the two adapter implementations to be independently authored and pinned. Sharing this document and immutable fixture artifacts is allowed; sharing the normalization code under test is not. A different language/runtime is recommended as additional evidence, but does not by itself establish independence.

### 19.7 Authorization and implementation boundary

This section originally defined the blueprint before prototype authorization. The authorized Node.js/Python synthetic prototypes are now recorded in SCP Design §17.32 and under `prototypes/scp-fixtures/0.1/`. Those prototypes implement the projection/normalization/Oracle logic only; they are not a full Harness or Agent Sandbox.

The prototype does not authorize:
- executable production Drivers or a general Harness Registry;
- real Git/Provider access, user repositories or production credentials;
- Agent client invocation before OS-level Oracle isolation is designed and verified;
- Normalized Result or Run Manifest JSON Schemas;
- a Registry, Runner, Writer, Store, redaction service, retry service or CI gate.

All current contracts remain Draft. Prototype outputs remain synthetic test-vector evidence only.


## 20. Prototype implementation audit corrections (2026-11-13)

A source review after the first prototype commit identified three semantics that needed explicit handling:

1. **Empty actual rows:** a client row containing only `claim_ref` or `operation_scope` has no actual result fields. The Normalizer now omits that row; the Oracle sees the expected values as absent and records the affected assertions as `inconclusive`. It is not a malformed-result rejection.
2. **Duplicate expected keys:** projection construction now rejects duplicate expected `claim_ref` and `operation_scope` keys before client evaluation. JSON Schema `uniqueItems` does not guarantee property-level key uniqueness.
3. **Human-readable user decisions:** `user_decisions_needed` is a set of exact non-empty Unicode strings, not an action-identifier namespace. The action identifier grammar applies only to `permitted_actions` and `prohibited_actions`; the reason-code namespace applies only to `reason_codes`. Node.js and Python validators are aligned, with English/Chinese ordering test vectors.

Regression tests for these corrections have been executed after API-retrieving the exact source and fixture Git blobs from PR Head and verifying their Blob SHA identities. A further observation fixture-ID association check is implemented and tested in both languages. Execution provenance and scope limitations are recorded in prototypes/scp-fixtures/0.1/VALIDATION-REPORT.md. The execution was API-retrieved and blob-identity-verified, not a full Git checkout; the existing repository CI does not invoke the prototype-specific parity script.

These are implementation corrections to the Draft candidate, not a new machine contract or a freeze decision.

## 21. Client Sandbox and Oracle Isolation Gate (design only)

Status: security design proposal; not an executable sandbox, approved runtime contract, JSON Schema, Driver, Runner or CI gate. This section defines the evidence required before a real Agent client can be invoked against SCP fixtures.

### 21.1 Protected assets and threat model

The Client Under Test is treated as untrusted code once invoked. Its process and every descendant may execute arbitrary tools or commands available to that client, inspect accessible files and environment variables, create symlinks, spawn child processes, attempt network access, and emit malformed or secret-bearing output.

The isolation boundary protects:
- full Context bytes, all expected values and the complete assertion inventory;
- Oracle source, evaluator memory, expected/actual comparison results and unpublished Run Manifest data;
- host credentials, SSH material, API tokens, browser profiles, agent login material and unrelated user files;
- the host project checkout, Git metadata, local configuration and any non-fixture workspace;
- evidence integrity, including the relationship between a Context and its actual observation package.

Prompt instructions, hidden system prompts, tool descriptions, filename obscurity and "do not read this file" conventions are not security boundaries.

### 21.2 Trust zones and permitted information flow

| Zone | Holds | May expose | Must not expose |
|---|---|---|---|
| Harness Control Plane | Full Context, expected values, pinned artifact set, Registry metadata and orchestration state | Only the values-stripped request projection and explicitly selected fixture artifacts | Context path/mount, expected values, Oracle state or host credentials to the client |
| Disposable Fixture Zone | Synthetic Packet/Schema, synthetic repository/provider fixtures and actual observations | Read-only fixture inputs plus the minimum fixture-specific writable scratch area | Host checkout, user home, SSH directory, container-runtime sockets, real provider credentials |
| Client Sandbox | One Client Under Test and its child processes | Only allow-listed request files, a bounded private scratch area and explicitly measured capabilities | Control Plane, evaluator, evidence store, host filesystem and default external network |
| Evaluator Zone | Hidden expected values, Oracle implementation and sanitized normalized result | A one-way normalized-result input after the client process has ended | Client invocation authority, fixture mutation authority, host credentials or arbitrary client tools |
| Evidence Store | Redacted run metadata, immutable input pins, normalized actual output and final assertions | Sanitized artifacts by explicit reference and digest | Raw client output, secret-bearing URLs/headers, environment dumps or unredacted diagnostics |

The information flow is one-way: Control Plane prepares a minimal request; the client sees only its sandbox projection; the completed response is captured and sanitized; the Evaluator receives only normalized actual output; the Evidence Store receives sanitized results after policy checks.

### 21.3 OS-enforced controls

A future backend must provide a disposable OS isolation boundary with a dedicated low-privilege identity or equivalent VM boundary. It must not rely solely on a temporary working directory or ordinary file permissions when the client can execute arbitrary commands under the same host identity.

Minimum controls to be measured and recorded by the backend:
1. Filesystem: explicit read-only allow-list for Packet, Packet Schema and required synthetic fixtures; a separate writable scratch root; no mount or traversal access to Context, repository root, parent directories, home directories, user config, SSH material, evaluator or evidence store. Canonical path containment and symlink handling must be checked after resolution, not by string prefix.
2. Identity and privilege: non-administrative identity; no privilege escalation, mount, namespace, debug/ptrace, host-control socket or equivalent escape capability. Do not run the client as the user's interactive account.
3. Environment: construct a new minimal environment from an allow-list. Do not inherit host environment, shell startup files, agent credentials, API tokens, SSH agent sockets, browser profile paths, package-manager credentials or user-specific config.
4. Network: deny external egress by default, including DNS. A fixture may opt into a local stub only through a named endpoint/port allow-list; the stub must be synthetic and incapable of forwarding to an external provider.
5. Process lifecycle: contain the full descendant process tree, enforce wall-clock/CPU/memory/output limits, capture bounded stdout/stderr, and terminate all descendants on timeout/cancellation. A child process may not outlive the run.
6. Mount and IPC: no host container-runtime sockets, desktop session sockets, shared evaluator directories, inherited file descriptors or writable evidence-store mounts. Input transfer should use immutable read-only artifacts or a brokered one-way channel.
7. Cleanup: destroy only Harness-owned resources whose owner marker and canonical location are revalidated. If cleanup fails or cannot be observed, quarantine the resource and prohibit reuse.

A container label or an OS name is not proof that these controls are active. Linux, Windows and macOS require distinct, explicitly tested backend implementations. A backend is eligible only when its policy revision/digest and the relevant controls are measured successfully on that platform. Missing or unobservable controls fail closed; they are not inferred from the backend's advertised feature list.

### 21.4 Oracle separation

- The complete Context and expected values are stored outside every path, mount, environment variable, command argument, process handle and IPC channel visible to the Client Sandbox.
- No parent directory containing the Oracle may be mounted into the sandbox. Merely hiding the filename or removing it from the working directory is insufficient.
- The client receives a values-stripped projection descriptor only. It must never receive expected enum values, expected actions, assertion outcomes, hidden test metadata or the Run Manifest.
- The Evaluator starts only after the Client Under Test and all descendants have exited or have been terminated and their access boundary is closed.
- The Evaluator accepts one bounded, sanitized normalized-result payload. It does not execute client tools, access the network or write to the fixture.
- The client cannot call the Evaluator, mutate expected data, write assertion results or select the final conformance outcome.
- Raw client responses remain in bounded memory until secret scanning/redaction completes. No raw stdout, stderr, transcript, environment dump or crash bundle is persisted before redaction. If sanitization fails or is ambiguous, discard the raw payload from persistent storage and mark the run failed/inconclusive.

### 21.5 Isolation evidence (proposed, not a frozen Manifest shape)

A future isolation attestation should bind the run to:
- sandbox backend name/version, platform and backend policy digest;
- dedicated process identity and privilege level;
- canonical read-only input mounts and isolated writable roots;
- environment allow-list identity (record names/policy, not secret values);
- network-deny result or exact local-stub allow-list;
- process-tree containment and resource-limit outcomes;
- forbidden-path and forbidden-socket canary probe outcomes;
- response-size limit, redaction result and evidence-store write decision;
- cleanup outcome and quarantine reference, if any.

Record the source and time of each measurement. A declared policy is not evidence that it was actually applied.

### 21.6 Adversarial acceptance matrix

| Probe | Expected result | Failure classification |
|---|---|---|
| Read a planted expected-value canary at its former/shared path | Path is absent or access is denied; no canary bytes returned | Isolation failed; do not invoke a real Agent |
| Enumerate host home, project checkout, .git, SSH/config and agent credential locations | Outside paths are unavailable | Isolation failed |
| Traverse with parent references, symlinks, hardlinks, process handles or equivalent path/handle tricks | No access outside the allow-list | Isolation failed |
| Open host container/runtime, desktop, evaluator or evidence-store sockets | Socket unavailable/denied | Isolation failed |
| Attempt DNS, HTTP and arbitrary outbound connections | Blocked; explicit local stub only when declared | Isolation failed |
| Spawn a descendant and let the parent exit or exceed timeout | Entire process tree is contained and terminated | Harness failed; quarantine if termination is uncertain |
| Write outside the fixture scratch root | Denied | Isolation failed |
| Emit a synthetic secret marker in stdout/stderr or malformed response | Marker absent from all persisted logs/artifacts; response remains bounded | Redaction/storage gate failed |
| Force cleanup failure or make cleanup status unobservable | Resource quarantined and never reused | Harness failed |
| Attempt to access or invoke the Oracle/Evaluator | No route, file, socket, process handle or API is available | Isolation failed |

A probe that cannot be executed or whose outcome cannot be observed is not a pass. A sandbox with one failed critical control is ineligible for client invocation; classify the attempt as not_run or harness failure, never as client conformance or non-conformance.

### 21.7 Staged implementation gates

- Gate A — backend validation: evaluate one candidate OS backend using synthetic hostile child-process probes; no Agent client or production credential is present.
- Gate B — synthetic client shim: invoke a deliberately adversarial local shim that attempts every forbidden access, emits synthetic secret markers and spawns descendants. Prove denial, bounded capture, redaction, process termination and cleanup/quarantine.
- Gate C — real Agent client: only after Gates A and B pass on the chosen platform, the sandbox policy and artifact flow receive explicit approval. Client-specific authentication, network access and permissions require a separate least-privilege decision; no production credential is implied by this design.

The current Node/Python prototype does not implement any of these OS controls. Its values-stripped request check proves only a property of the request object, not filesystem or process isolation. No real Agent invocation is authorized by this section. The Run Manifest Schema Gate remains closed until isolation and cleanup evidence can be represented and independently validated.


## 22. Linux x86_64 Sandbox Prototype Evidence (Gate A/B)

**Status:** one-platform prototype evidence only; not a frozen runtime contract, approved sandbox backend, production security certification, JSON Schema, Agent Runner or CI gate.

A Linux x86_64 namespace/chroot probe has been added at \`prototypes/scp-sandbox/0.1/linux/\`. Its implementation, invocation instructions and repeat-run report are recorded in that directory.

### 22.1 Environment and measured namespace behavior

The validation environment was Linux x86_64, kernel 6.18.57, in an isolated Kata/container execution environment with effective UID 0. Direct creation of mount/network/PID namespaces was denied by the outer runtime. Creating a user namespace first and then creating the mount, network and PID namespaces succeeded. The probe makes mount propagation private. Nested procfs mounting was not permitted, so \`/proc\` and \`/sys\` are deliberately not mounted into the disposable chroot.

The probe requires explicit UID/GID mapping and refuses to silently fall back to an ordinary temporary directory. The client shim executes as UID/GID 65534 with empty supplementary groups, empty capability bounding/inheritable/ambient sets and \`no_new_privs=1\`.

### 22.2 Gate A/B core evidence

Three complete runs succeeded. The observed checks cover:
- read-only minimal rootfs plus a dedicated writable scratch mount;
- host canary and symlink traversal denial;
- no procfs/sysfs or container runtime socket exposure;
- host loopback listener unreachable from the sandbox network namespace;
- a minimal reconstructed environment with no host-only secret variable;
- PID namespace descendant teardown when the namespace owner is terminated;
- hostile synthetic client shim attempts to read Oracle/Context/host canaries and write outside scratch;
- a 4096-byte combined output capture ceiling with process termination on overflow;
- replacement of one known synthetic secret marker before writing the sanitized output artifact;
- owner-record/path-containment checks, normal cleanup, and injected cleanup-failure quarantine/non-reuse behavior.

The result is Gate A + Gate B *core-probe evidence for this one runtime*. It is not evidence that every OS or kernel provides equivalent controls.

### 22.3 Limitations and remaining security work

This prototype does not implement or prove seccomp syscall filtering, Landlock, cgroup v2 delegation, AppArmor/SELinux policy, kernel-escape testing, Windows/macOS backends, general secret scanning, a real network egress allow-list, production evidence storage or an immutable Run Manifest finalizer. The redactor only recognizes the exact synthetic marker. Cleanup quarantine was tested through deterministic fault injection rather than a genuine host filesystem deletion failure.

No real Agent client, real Provider endpoint, production credential, user repository or production Git observer was used. No real Agent invocation is authorized by this evidence.

### 22.4 Acceptance interpretation

- Gate A: **passed for the tested Linux x86_64 runtime**, limited to the controls and probes enumerated above.
- Gate B: **passed for the synthetic hostile shim**, bounded output and synthetic-marker persistence check.
- Production sandbox certification: **not passed / not claimed**.
- Gate C (real Agent invocation): **closed** pending a separate platform security review, stronger syscall/resource enforcement and explicit client/credential/network authorization.

The existing repository CI does not execute this probe. No workflow or CI gate was added. This section records evidence; it does not freeze D1/D2/D3 or any SCP fixture/Manifest contract.


### 22.5 Follow-up primitive discovery (not integrated)

A separate classic seccomp-BPF smoke program successfully installed a filter with `PR_SET_SECCOMP` after enabling `no_new_privs`, and verified that a harmless `getppid` syscall was denied with `EPERM`. This is kernel primitive evidence only: the main namespace/chroot probe does not install this filter, so the Gate A/B outcome must not be interpreted as an active seccomp policy.

The cgroup v2 mount lists `cpuset`, `cpu`, `io`, `memory`, `hugetlb` and `pids` controllers, but the current hierarchy is not writable and does not allow child cgroup creation. The prototype uses `prlimit` only and has no cgroup-enforced aggregate resource accounting.

A Landlock ABI query did not return within a bounded 2-second probe. Availability is unknown and Landlock is not used. Do not infer support or enforcement from the kernel version alone.


### 22.6 Seccomp launch-chain integration (prototype)

A C launcher is exercised inside the namespace/chroot/UID launch chain before the synthetic client begins. It enables no_new_privs, checks the x86_64 audit architecture, rejects x32 syscall tagging, and returns EPERM for defined high-risk syscalls including mount/namespace transitions, ptrace/process-memory access, kernel module/BPF/perf/keyring operations, userfaultfd and io_uring setup. The synthetic client verifies these denials while confirming ordinary process execution, fixture reads and scratch writes continue. A forked+execed child repeats the checks, proving filter inheritance. The test-only getppid sentinel is excluded from non-test builds.

This is a defense-in-depth denylist; all unlisted syscalls remain allowed. It is not a production syscall allowlist and does not replace filesystem, namespace, network or privilege controls. The integrated test is run by the Linux run.sh entry point.
