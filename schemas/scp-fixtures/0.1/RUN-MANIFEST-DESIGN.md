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
| `actual_result` | conditional | Complete normalized client output when available; absent/null only when evaluation never produced one |
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

- The pinned Context `expected` determines the claim keys, operation-scope keys and field names that are in scope for this run.
- The adapter/normalizer may read the expected structure to discover those keys/field names, but it must not copy expected values into the actual result or use them to manufacture client observations.
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
      "operation_scope": "read_local_project_rules",
      "recovery_mode": "restricted",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["log_credential_material"]
    },
    {
      "operation_scope": "publish_using_project_repository_locator",
      "recovery_mode": "blocked",
      "permitted_actions": ["read_project_rules"],
      "prohibited_actions": ["persist_credentialed_locator", "push", "publish"]
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
