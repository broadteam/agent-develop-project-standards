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
