# SCP Fixture Context 0.1.0 Compatibility and Semantic Rules

**Status:** Draft companion specification for `fixture-context.schema.json`. The JSON Schema is the machine shape contract; this document defines cross-reference, registry and event-order checks that JSON Schema alone cannot prove.

## 1. Validation order

A future Harness must process a Context in this order:

1. Parse UTF-8 JSON; reject duplicate object member names before ordinary object deserialization can discard them.
2. Validate against the exact `scp-fixture-context/0.1.0` Draft 2020-12 Schema with `FormatChecker()`.
3. Resolve Packet, Packet Schema, profile, driver descriptor and provider evidence references by repository-relative path and exact Git blob SHA.
4. Validate cross-reference semantics and Registry allow-list membership.
5. Only then pass the Context to a deterministic fixture driver/evaluator.

A schema-valid Context is not automatically runnable. Unknown contract version, missing blob, SHA mismatch, unregistered driver, `contract_only` driver, profile mismatch or missing required capability is `not_run/unknown`, never pass.

## 2. Immutable artifact references

- `target.packet.path` and `target.packet_schema.path` are repository-relative paths under the pinned `target.repository_revision`.
- `blob_sha` uses Git's object blob SHA as returned by GitHub/Git, not SHA-256 of file contents.
- Harness must read the exact blob at the pinned repository revision and compare the returned Git blob SHA. Branch names such as `main`, `HEAD`, `latest` or moving refs are not accepted in place of the commit.
- `target.packet_schema.blob_sha` identifies the exact Packet Schema; it is not interchangeable with the Context Schema SHA.
- Context's own blob SHA is not stored in itself. The eventual Run Manifest pins the Context blob SHA externally.

## 3. Capability Profile references

A Context `capability_profile` reference is an immutable tuple:
`profile_id + profile_version + profile_blob_sha`.

The Harness Registry must verify all three values against the retrieved profile document. The profile's `supported_profiles` must contain every environment profile requested by the Context. No per-Context override is permitted in 0.1.0.

Measured runtime capabilities are recorded in the Run Manifest, not written back to the profile or Context. If the environment does not provide a declared required capability:
- profile explicitly excludes it: `not_applicable`;
- expected capability is missing or observation failed: `unknown/not_run`;
- do not convert either condition into pass.

## 4. Setup Driver references

A Driver reference is pinned by:
- `driver_id`;
- `driver_contract_version`;
- `driver_bundle_sha256`.

The Registry must check the exact triple against an allow-listed descriptor and separately resolve an executable bundle with matching digest before execution. In the current Draft, all three driver descriptors are `implementation_status=contract_only`. Their SHA-256 values pin descriptor bytes only; **they are not executable driver packages** and must be rejected for execution.

A Context never carries commands, shell fragments, source code or executable payloads. Registry lookup by mutable alias alone is forbidden.

Driver `allowed_profiles` must include every requested environment profile. Driver `input_kinds` must cover all observation/fixture kinds used by the Context. `mutation_scope=none` permits no fixture mutations; `disposable_fixture_only` confines all setup mutation to the Harness-owned temporary root.

## 5. Stimulus event semantics

- Event `sequence` values must be unique positive integers and strictly increasing in array order.
- Observation events identify the exact snapshot phase and ID; the same snapshot ID must not be reused for two different snapshots.
- Mutation events must occur only between explicit observation barriers and may target only the disposable fixture root.
- Provider response events and companion provider observations must agree on namespace, resource ID, requested revision, principal, response class and contract revision.
- A path-equivalence event must reference the exact capability profile revision used for that relation; `profile_revision` must equal the declared `environment.capability_profile.profile_version`.
- Missing event, missing barrier, missing referenced snapshot or ambiguous ordering is `not_run/unknown`, not pass.

These rules are cross-record semantics; the Schema validates event record shape but does not establish the whole event sequence.

## 6. Provider not-found authority

For `response_class=authoritative_not_found`, both the stimulus event and companion provider observation must include `not_found_authority_evidence` referencing an immutable provider contract artifact by path + Git blob SHA. The current synthetic contract is `schemas/scp-fixtures/providers/0.1/github-rest-not-found-contract.json`.

The pinned provider contract must establish:
- exact provider namespace/endpoint contract revision;
- authentication is required and accepted for the principal;
- the query is scoped to the exact resource ID and requested revision;
- the endpoint does not mask hidden/private resources as not-found for that accepted principal;
- the declared response class is authoritative for this fixture.

A boolean `not_found_authority=true` without resolvable evidence is insufficient. A raw HTTP status, unauthenticated 404, stale cache, response message or locator resemblance is not evidence. The fixture Provider contract in this repository is synthetic and must not be applied as a claim about the real GitHub API.

For `forbidden`, `rate_limited`, `timeout`, and `ambiguous_not_found`, `not_found_authority` must be false. These observations normalize to source freshness unknown and identity unknown/unresolved.

## 7. Expected normalized result

- Claim `claim_ref` values must be unique within one Context.
- Recovery `operation_scope` values must be unique within one Context.
- `permitted_actions` and `prohibited_actions` must be disjoint within a recovery entry.
- `normal` is permitted only when all sources required by that operation scope are readable/current and no relevant conflict/unknown remains.
- `restricted` permits only actions independent of affected unknown/stale/conflict claims.
- `blocked` must identify at least one prohibited action; blocking is scoped to the named operation, not automatically global.
- Reason codes must be namespaced under `scp.fixture.*`; unknown codes are non-success and require explicit compatibility handling.

These are conformance semantics for a future Harness; expected values remain test input, not an authorization grant to a production client.

## 8. Run Manifest boundary

A Run Manifest is a separate immutable execution record, not part of Context 0.1.0 and not implemented yet. Its proposed minimum model, retry/interruption rules, cleanup ownership, artifact/Evidence boundary and lifecycle are in `RUN-MANIFEST-DESIGN.md` §1–§12. It must externally pin Context/Packet/Packet-Schema/Profile/Driver/provider-contract blob IDs, client and adapter versions, measured capabilities, observations, ordered event log, actual normalized result, assertion result and cleanup outcome.

Never write actual observation or result into the input Context. Multiple clients/runs produce multiple manifests referencing the same immutable Context.

## 9. Version compatibility

- Unknown `context_version` or unknown core field: stop Context evaluation.
- Optionality does not imply forward compatibility for unknown semantics.
- Context schema, capability profile, Driver contract, provider contract and reason-code vocabulary are separately pinned/versioned.
- A change to required event meaning, output axes or cross-field rules requires a new Context Contract version; documentation-only clarification may remain a patch.
- `scp.fixture.*` reason codes remain test-conformance vocabulary only and do not become SCP Packet fields or a public runtime API.

## 10. Context-to-Run-Manifest cross-record contract (design candidate)

The Run Manifest is a separate immutable output record. It is not a Context field, not part of Context 0.1.0 validation, and is not yet a machine contract. The current minimum field and outcome proposal is in [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md) §§13–16.

### 10.1 Input pin equality

For a Manifest that claims to evaluate a Context:

1. `inputs.context` must resolve to the exact Context path and Git blob SHA used for evaluation; its declared contract/version and fixture ID must match the parsed bytes.
2. The Manifest's Context Schema pin must identify the exact Draft 2020-12 Schema used, not merely the contract label.
3. `inputs.source_repository_revision`, Packet path/blob SHA and Packet Schema path/blob SHA must exactly match Context `target` and the Packet's own schema version.
4. The declared Capability Profile reference must exactly match Context `environment.capability_profile` (ID, version and blob SHA).
5. The Driver ID/contract version must match Context `setup.driver`; the descriptor pin and executable bundle digest are distinct artifacts. A matching descriptor SHA does not make a `contract_only` Driver executable.
6. Every provider authority contract referenced by Context stimulus/observations must resolve to the same path/blob SHA and contract revision in the Manifest's resolved dependency set.
7. The Harness Registry snapshot used for allow-list resolution must be immutable and recorded. A later Registry lookup must not silently replace the version used during the run.

A missing or mismatched required pin makes the run `not_run` if detected before evaluation, or `inconclusive` if discovered too late to establish which inputs were used. It must never be normalized away.

### 10.2 Expected/actual result mapping

Context `expected` is the only expected-value source. The Manifest stores actual normalized output and comparison outcomes; it must not copy expected values into itself.

- Packet-level fields map directly: `packet_schema_validation` and `protocol_compatibility`.
- Claim-level records are matched by unique `claim_ref`; array order is ignored.
- Recovery records are matched by unique `operation_scope`; array order is ignored.
- A field is asserted exactly when that leaf exists in Context `expected`. Missing actual leaves produce `inconclusive`/ `not_run`; they cannot inherit a value from another claim or operation.
- Additional unknown core fields are incompatible with Context 0.1.0. Namespaced diagnostic metadata may be carried separately but cannot change the normalized result.
- Collections whose semantics are set-like (actions and reason codes) compare as sets after duplicate detection; object/array serialization order is not a semantic difference.

### 10.3 Deterministic assertion identity

Do not use array indexes, natural-language descriptions or a producer-generated sequential counter as assertion identity.

Each comparison uses the structured tuple:

`(subject_kind, subject_ref, field)`

- `packet`: `subject_kind=packet`, no `subject_ref`, field is a packet-level expected field.
- `claim`: `subject_kind=claim`, `subject_ref=claim_ref`, field is one expected claim field.
- `recovery`: `subject_kind=recovery`, `subject_ref=operation_scope`, field is one expected recovery field.

The tuple must be unique. Each expected leaf maps to exactly one tuple, and no tuple may point to an absent expected leaf. This preserves arbitrary Unicode or delimiter-bearing identifiers without concatenation/escaping ambiguity.

### 10.4 Lifecycle consistency

- Preflight rejection prevents setup, stimulus, observation and client evaluation from being marked completed.
- Setup failure prevents client evaluation; a missing observation cannot be copied from Context's planned companion observations and represented as actual.
- Evaluation completion requires a normalized actual result and a completeness decision for the full expected assertion set.
- If all required assertion outcomes are passed, conformance may be conformant; any proven mismatch is non_conformant; missing/uncertain required assertions without a proven mismatch are inconclusive; if evaluation never starts, not_run.
- A failed/unknown cleanup prevents overall acceptance and quarantines the disposable root even when semantic assertions were conformant.
- An interruption after all assertions were durably recorded may preserve the semantic outcome but makes the Harness outcome interrupted/failed; an interrupted subset cannot be promoted to conformant.

### 10.5 Cross-client comparison boundary

Two Manifests are exact-comparable only when they pin the same Context, Context Schema, Packet, Packet Schema, Profile, Driver descriptor/executable, provider contracts, source repository revision and semantically equivalent measured capability/permission profiles. Client/adapter/normalizer versions remain distinct dimensions to compare, not reasons to erase differences.

If a measured capability or permission set differs, comparison must be reported as incompatible or restricted to a declared common assertion subset. Do not average results, coerce unknown to not_applicable, or silently treat two OS labels as equivalent capability evidence.

### 10.6 Artifact, retry and cleanup integrity

- Event/snapshot/diagnostic artifacts belong to the Harness artifact namespace and carry immutable locators plus digests. They must not point into the user's checkout, project Evidence/task/ADR directories or production storage.
- Credentials, auth headers, cookies, private keys, credential-bearing URLs and arbitrary environment variables are prohibited before persistence. Redaction must precede artifact storage.
- Retry lineage is cross-Manifest: `run_id` is unique; `attempt_number` increases within a `retry_group_id`; a resolvable `retry_of` points to the immediately preceding terminal attempt in the same group.
- Cleanup can target only a Harness-owned disposable root whose run ID/ownership marker and canonical containment are revalidated. A failed/unknown cleanup quarantines the root; later attempts cannot reuse it.
- These relationships cannot be established by this Context Schema alone. Until a Run Manifest Schema/semantic validator is separately approved, treat these clauses as design review rules, not executable validation.

## 11. Normalized Actual Result contract (design companion)

The candidate result contract is documented in [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md) §17. Its candidate identity is `scp-fixture-normalized-result/0.1.0`. It is separate from Context 0.1.0 and is not currently a JSON Schema or runtime API.

### 11.1 Projection and exact key mapping

- The pinned Context `expected` is the source of the tested claim refs, operation scopes and expected field names.
- The adapter/normalizer may use that structure to select the projection keys and fields, but must not copy expected values into actual output.
- Actual claims match by exact `claim_ref`; recovery records match by exact `operation_scope`.
- Each output record may contain only result fields in the corresponding expected projection. It must not add unrelated records/fields or unknown core properties.
- Claim/recovery array ordering is ignored; duplicate keys are invalid.
- A complete assertion inventory contains exactly one tuple `(subject_kind, subject_ref, field)` for every expected property except its record key (`claim_ref` / `operation_scope`). Packet-level expected fields use `subject_kind=packet` and no subject ref.
- A set-valued property (reason codes, permitted actions, prohibited actions, user decisions needed) is one assertion, not one assertion per element.

### 11.2 Values and missing-state rules

The Context 0.1.0 field enums are reused without coercion. Exact values compare exactly. In particular:

- explicit enum `unknown` is an observed protocol state;
- absent field is missing output and makes that assertion inconclusive/not_run;
- `null` is invalid;
- an unrecognized enum/core field is unsupported/invalid, not coerced to unknown;
- `not_applicable` and `not_configured` remain applicability values and never become freshness values;
- empty array means an explicitly observed empty set and differs from absence.

Opaque IDs compare as exact Unicode scalar sequences. Do not trim, case-fold, URL-decode, path-normalize or Unicode-normalize them. Reject malformed UTF-8/unpaired surrogates. Array order for claim/recovery rows and set-valued properties is non-semantic; canonical presentation sorts keys and set members by UTF-8 byte sequence.

### 11.3 Conformance and parity are independent

The evaluator builds expected assertion tuples from the pinned Context and compares them with actual values. The Manifest records exactly one outcome per expected tuple: passed, failed, inconclusive or not_run. No missing required tuple can be treated as pass.

Cross-client parity is a separate derived artifact with four result classes:

- `equal`: comparable inputs and complete normalized projections are equal;
- `divergent`: comparable inputs and complete projections differ;
- `incomplete`: inputs are comparable, but at least one projection/required observation is incomplete;
- `incomparable`: a required immutable input pin or relevant capability/permission observation differs.

Malformed or unsupported normalized output is rejected as `invalid_result`, not counted as a parity result.

Exact comparison requires matching Context/Schema/Packet/Packet Schema/source revision/Profile/Driver/Provider/Registry pins, deterministic clock/event inputs, normalized-result contract version and relevant measured capability/permission observations. Client/adapter/normalizer implementation identity may differ and must be recorded. Attempt IDs, timestamps and temporary paths are traceability metadata, not parity values.

Context 0.1.0 has no per-assertion capability dependency map. Therefore a material capability/permission difference makes the entire run pair incomparable; do not invent a shared assertion subset. A future Context contract may explicitly define dependencies before common-subset comparison is allowed.

Equal parity does not imply conformance: two clients can agree on the same wrong value. Each Manifest is independently evaluated against Context expected values. Unknown is an exact value, never a wildcard.

These rules are companion design semantics. They do not alter Context Schema 0.1.0 and are not mechanically enforced today.


### 11.5 Observation-to-Context identity binding

A synthetic or live observation package is scoped to exactly one Context fixture. Its fixture_id must exactly equal the pinned Context fixture_id before event, observation or capability reconciliation is accepted. Matching event sequences or byte-identical records do not make an observation package from another fixture interchangeable. A mismatch is a pre-invocation provenance failure (not_run / Harness failure), not an ordinary client result and not a value that may be normalized away.

This identity check is implemented in both prototype reconcilers and covered by a negative vector in each language. It does not add a Context field or freeze Context Contract 0.1.0.

## 12. Adapter trust boundary and interoperability design

The two-adapter blueprint is in [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md) §19 and the OS-level sandbox gate is in §21. These are design proposals; no executable Agent sandbox or client invocation interface exists.

### 12.1 Oracle isolation

- Full Context and `expected` values stay in the Harness control plane.
- This is a logical trust-zone rule, not proof of runtime isolation: the OS boundary must ensure the Client Under Test cannot read control-plane accounts, memory, paths, mounts, environment or IPC endpoints.
- Client Under Test receives Packet/Packet Schema bytes or immutable read-only handles, reconciled actual fixture observations, relevant measured capabilities, deterministic clock and a values-stripped projection descriptor.
- It must not receive the Context file/path, expected values, assertions, answer key, Run Manifest or Oracle Evaluator artifacts.
- Oracle Evaluator compares the normalized result only after client evaluation.
- Harness preflight validates test artifact pins and Context readiness; it cannot substitute its own Packet Schema validation or protocol compatibility result for client output.

### 12.2 Actual observation inputs

Context `companion_observations` describe what the fixture is expected to produce. The Harness must collect actual observations from its disposable fixture and reconcile them before client evaluation. Context observation data cannot be copied into actual run evidence.

If required observation inputs are missing or disagree with the pinned Context/event/profile expectations, do not invoke the client on a fixture claimed to be valid. Record not_run/inconclusive and preserve the mismatch.

### 12.3 Independent interoperability dimensions

Report three results separately:

1. Harness-input parity: two independent adapters produce identical pinned Packet/Schema, observation, capability/permission, event and values-stripped projection inputs.
2. Normalizer parity: independent normalizers process the same synthetic response vectors and produce the same strict normalized projections/classifications.
3. Client-output parity plus per-client conformance: distinct Agent clients evaluate equivalent requests; normalized results are compared, while each client is independently checked against the hidden expected oracle.

Sharing the normative specification and immutable fixtures is allowed. Sharing the normalization implementation under test is not. Different language/runtime adds evidence but does not alone prove independence.

No client is correct merely because it agrees with another client; parity equality and conformance are independent results.


### 11.4 Set member syntax

Set normalization is shared across clients, but member validation is field-specific:
- `reason_codes` must use the `scp.fixture.*` namespace.
- `permitted_actions` and `prohibited_actions` must use stable action identifiers.
- `user_decisions_needed` contains non-empty exact Unicode strings and may contain spaces or natural-language text, including Chinese. It must not be forced through the action-identifier grammar.

All four fields remain order-insensitive sets with duplicate rejection.

### 12.4 Linux sandbox prototype evidence boundary

A Linux x86_64 namespace/chroot probe now provides limited Gate A/B evidence for one tested runtime. It demonstrates a read-only fixture root, dedicated writable scratch, unprivileged UID/GID 65534, capability drop, \`no_new_privs\`, host-path/symlink denial, isolated network namespace, hidden proc/sys, descendant teardown, bounded output and a synthetic-shim redaction/cleanup test.

These results are not a portable guarantee and do not establish production isolation. The Linux launcher runs a separate x86_64 seccomp-BPF denylist integration harness after the namespace/chroot core probe; this is defense-in-depth evidence for the synthetic client path, not a general Agent Runner policy or production syscall allowlist. Landlock, cgroup v2 delegation, LSM policy, kernel-escape testing, general secret scanning, Windows/macOS implementations and real client authentication/network policy remain unimplemented. See [the sandbox prototype validation report](../../../prototypes/scp-sandbox/0.1/VALIDATION-REPORT.md) for exact provenance and non-claims. Gate C remains closed.

The standalone `seccomp-smoke.c` file is only a historical kernel-primitive check; it is not the active policy test. The integrated test uses `seccomp-exec.c` and `seccomp-child-test.c` through `run-seccomp-integration.sh`. cgroup v2 delegation was unavailable because the cgroup2 mount is read-only; Landlock returned ENOSYS in the tested kernel/runtime. Per-process `prlimit` bounds are not equivalent to cgroup-level accounting. These distinctions are recorded in the sandbox validation report; no capability is inferred merely because a kernel/controller advertises a name.


### 12.5 Seccomp launch-chain test boundary

The Linux prototype now tests a seccomp-BPF denylist after namespace/chroot/UID setup and before a synthetic child client executes. Test builds return a unique EACCES value for denied syscall rules; production builds retain EPERM and allow the test sentinel getppid call. The synthetic client has explicit checks for the current denylist entries, clone/clone3 namespace paths and x32 ABI rejection, and verifies filter inheritance across fork+exec plus permitted fixture/scratch I/O. It remains a denylist with default ALLOW, not a full production allowlist. No cross-platform or production Agent syscall policy is inferred.


### 12.6 Modern syscall and chroot cwd regression boundary

The Linux seccomp regression client now verifies modern mount API denial, pidfd/process-handle denial, and chroot working-directory containment. A host-only canary is placed in the parent temporary directory; the host-side cwd is moved there before chroot, and the client must not read it by relative path. The parent and fork+exec child repeat the relevant checks. See the Linux Sandbox validation report for exact source Blob identities and test scope.

These are targeted x86_64 denylist probes. They do not establish full syscall mediation, kernel-escape resistance or portability to other architectures.


A direct Landlock ABI probe returned ENOSYS; this is a tested-runtime unavailability result, not an unknown timeout. The cgroup v2 hierarchy exposes controllers but is read-only and cannot delegate child cgroups. Neither mechanism is active in the prototype.


### 12.7 Bounded tmpfs scratch boundary

The Linux seccomp integration now uses a private 32 MiB tmpfs scratch mount with nosuid,nodev,noexec instead of a writable host bind mount. The synthetic client verifies tmpfs type, mount flags, size ceiling and write behavior in both parent and fork+exec child. This reduces host filesystem exposure and bounds scratch capacity, but does not provide aggregate CPU/memory/PID accounting.


### 12.8 Inherited descriptor and scratch quota boundary

The seccomp exec wrapper closes non-standard inherited descriptors before client invocation; a host-only FD 9 canary must be unavailable to the client and fork+exec child. The dedicated tmpfs scratch is bounded by both 32 MiB and 4096 inodes, with nosuid,nodev,noexec flags verified by the synthetic client. This reduces host-FD leakage and scratch-storage exhaustion but is not a replacement for cgroup-level CPU/memory/PID accounting.


### 12.9 Runtime privilege-state verification

The synthetic client verifies UID/GID 65534, no supplementary groups, no_new_privs, active seccomp mode, empty capability sets and empty capability bounding set in both parent and fork+exec child. The checks read back kernel state after exec; they do not rely only on the launcher command line.


### 12.10 Real filesystem cleanup-failure quarantine boundary

A supplemental Linux regression mounts a disposable tmpfs below an owned resource root and confirms that removing the mountpoint returns the real kernel error EBUSY. The test persists `quarantining` before moving the resource tree, persists `quarantined`, verifies the owner-record reuse guard and then explicitly unmounts and cleans the quarantined resource before marking it `cleaned`.

This is targeted evidence for a real mountpoint-busy cleanup failure and a fail-closed quarantine lifecycle. The core probe's owner-state-machine failure path remains deterministic injection; this supplemental test is not a complete production cleanup manager or a test of all filesystem deletion failure modes.
