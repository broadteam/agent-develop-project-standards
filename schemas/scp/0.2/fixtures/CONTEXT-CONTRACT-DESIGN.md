# SCP Semantic Fixture Context Contract — Design Proposal

**Status:** Approved design direction; Context Schema 0.1.0 Draft has been created. This document remains the design rationale, not the machine contract itself or an implementation authorization.

## 1. Problem statement

The current `SEMANTIC-CONTEXT.md` and `SEMANTIC-EXECUTION-CONTRACT.md` explain the external Git/filesystem/provider facts needed by semantic fixtures. Markdown is readable but leaves too much room for clients and test harnesses to interpret setup, capability and expected-result details differently.

A future Fixture Runner needs a deterministic, versioned input format without turning companion context into a second project state database or embedding arbitrary shell commands.

## 2. Decision proposal

Create a **separate Fixture Context Contract** with its own JSON Schema Draft 2020-12 version. It is not part of the SCP Continuity Packet and must not be added under `Packet.extensions`.

Proposed identity:

- Contract name: `scp-fixture-context`
- Initial context schema version: `0.1.0`
- Dialect: JSON Schema Draft 2020-12 with `date-time` format assertion enabled.
- Proposed path if separately approved: `schemas/scp-fixtures/0.1/fixture-context.schema.json`
- Fixture context instances remain alongside the SCP fixture suite, for example `schemas/scp/0.2/fixtures/context/<fixture-id>.json`.

The Context Contract version is independent of Packet `schema_version=0.2.0`, project release version and Git tags. Either side may evolve independently, but each Context must pin the exact Packet Schema blob SHA it targets.

**Why separate it:** Packet is a recovery artifact consumed by project clients. Fixture Context is test-harness input consumed by conformance tooling. They have different lifecycles, privileges, required fields and compatibility needs. Mixing them would make consumers parse test-only fields and risk turning a test description into runtime authority.

## 3. Scope and non-goals

The Context document describes only:

1. the exact Packet and Packet Schema under test;
2. the environment profile and declared capabilities;
3. the deterministic setup driver reference;
4. ordered stimuli/events and companion observations;
5. expected normalized D2/Semantic outcomes.

It does not store:
- project requirements, tasks, roadmap, ADRs, decisions or authoritative Evidence;
- actual user credentials, access tokens, cookies, SSH keys or authorization headers;
- arbitrary shell commands or executable scripts;
- real user repository paths or production provider URLs;
- actual client run results as if they were expected input;
- permission to write to a project repository.

The context is a test vector, not a source of project truth.

## 4. Minimal logical data model

A future JSON Schema should enforce a closed top-level object with the following conceptual groups.

| Group | Required information | Boundary |
|---|---|---|
| Contract identity | `contract`, `context_version`, `fixture_id` | Identifies the test input format and stable fixture case |
| Target pins | Packet path + blob SHA; Packet Schema path + blob SHA; source repository revision | Binds the vector to exact inputs, not a branch name such as “latest” |
| Environment | Profile IDs, deterministic clock, explicit capability profile | Describes the test environment; do not infer capabilities from OS name |
| Setup driver | Allow-listed driver ID and driver revision | References harness code; does not embed shell |
| Stimulus | Ordered event IDs, trigger points and mutation kinds | Mutations are limited to disposable fixture resources |
| Companion observations | Typed Git, filesystem, identity/provider and permission observations | Synthetic or sandbox-only observations, not project authority |
| Expected result | Per-claim freshness/status, fingerprint applicability, identity state and operation-scoped D2 recovery | Expected normalized result only; not an authorization token |

The Context contract should use discriminated typed records for Git, filesystem and provider observations. It should reject unknown core fields. Future producer-specific test data may use namespaced extensions, but extensions may not redefine core expectations.

## 5. Example shape (illustrative, not normative JSON)

~~~json
{
  "contract": "scp-fixture-context",
  "context_version": "0.1.0",
  "fixture_id": "fingerprint-reenumeration-race-untracked-added",
  "target": {
    "packet": {
      "path": "schemas/scp/0.2/examples/handoff-with-identity-and-fingerprint.json",
      "blob_sha": "0e2f3ef416235e1a7f607aba0e2e41c858667b06"
    },
    "packet_schema": {
      "path": "schemas/scp/0.2/continuity-packet.schema.json",
      "blob_sha": "a2f2097a17c08bf0a2ae733ab43a8f1919b48813"
    },
    "repository_revision": "2d73c5d013ca467a27c37815761cb03be4a3d74b"
  },
  "environment": {
    "profiles": ["local_git", "fault_injection"],
    "clock": "2026-11-12T00:00:00Z",
    "capability_profile": "git-observation-contract/1"
  },
  "setup": {
    "driver_id": "git.reenumeration-race.untracked-added",
    "driver_revision": "1"
  },
  "stimulus": {
    "events": [
      {"sequence": 1, "event": "initial_observation_complete"},
      {"sequence": 2, "event": "mutation_applied", "mutation": "add_untracked"},
      {"sequence": 3, "event": "final_observation_started"},
      {"sequence": 4, "event": "final_observation_complete"}
    ]
  },
  "companion_observations": {
    "initial_snapshot_id": "snapshot-before",
    "final_snapshot_id": "snapshot-after",
    "changed_components": ["status_path_set"],
    "mutation_path": "tmp/new-file.txt"
  },
  "expected": {
    "claims": [
      {
        "claim_ref": "code.worktree_fingerprint",
        "freshness": "stale",
        "applicability": "stale"
      },
      {
        "claim_ref": "live_worktree_observation",
        "freshness": "unknown",
        "applicability": "unknown"
      }
    ],
    "recovery": [
      {
        "operation_scope": "read_unrelated_project_rules",
        "recovery_mode": "restricted",
        "permitted_actions": ["read_project_rules"],
        "prohibited_actions": ["write"]
      },
      {
        "operation_scope": "modify:tmp/new-file.txt",
        "recovery_mode": "blocked",
        "permitted_actions": ["read_project_rules"],
        "prohibited_actions": ["modify_affected_path", "push"]
      }
    ]
  }
}
~~~

The example intentionally contains only synthetic paths, IDs and values. A future normative schema must refine each observation union and identifier grammar before any fixture instance is adopted.

## 6. Required semantic separation

The Context Schema must keep these axes separate:

- **Packet schema validation:** valid / invalid / unsupported.
- **Protocol compatibility:** compatible / unsupported / incompatible / unknown.
- **Claim freshness:** current / stale / conflict / unknown.
- **Repository identity:** resolved / provisional / ambiguous / conflict / unknown.
- **Path identity:** unique / ambiguous / conflict / unknown.
- **Fingerprint coverage:** complete / partial / unknown.
- **Observation consistency:** stable / changed_during_capture / unknown.
- **Applicability/capability:** applicable / not_applicable / not_configured / unknown.
- **Recovery mode:** normal / restricted / blocked, evaluated per named operation scope.

No single `semantic_validation=true/false` may erase which claim failed or why. The actual client output should be normalized into the same result vocabulary for comparison.

## 7. Setup driver and adapter boundary

Do not put executable command strings in Context. Use a versioned, allow-listed `driver_id` resolved by the harness registry. The driver may create only a disposable fixture root owned by the harness.

Conceptual adapter responsibilities:

1. **Fixture Driver:** creates temporary Git/filesystem/provider-stub state from a known driver ID.
2. **Stimulus Controller:** applies declared events to disposable state at explicit barriers; never touches a user's repository.
3. **Read-only Observation Adapter:** returns observation snapshots and capability declarations without mutating the fixture under test.
4. **Client Under Test:** evaluates Packet + observations and returns normalized state; its production write APIs are not invoked.
5. **Result Normalizer:** maps implementation-specific output to the conformance vocabulary without upgrading unknown/stale/conflict.
6. **Cleanup Controller:** removes only the harness-owned disposable root.

These are logical roles, not a mandated process model or language-specific API. A client may use an in-process adapter or an external test adapter, provided the same contract inputs and results are preserved.

## 8. Run manifest is separate from Context

A test run must produce a separate immutable run manifest containing:
- Context blob SHA;
- Packet blob SHA and Packet Schema blob SHA;
- client name/version and adapter version;
- environment profile and measured capability values;
- actual observation snapshot IDs and event log;
- normalized actual result;
- assertion outcome and diagnostic references;
- cleanup result.

The run manifest is output/evidence, not a mutation of the input Context. Re-running the same Context with another client creates another run manifest. This preserves reproducibility and avoids a mutable “latest result” field inside the test input.

## 9. Reason-code boundary

Recommendation: reason codes are **Fixture Conformance vocabulary**, not SCP Packet fields and not yet a public SCP runtime API.

Proposed properties:
- stable, language-neutral identifiers;
- namespaced under `scp.fixture.`;
- one primary reason per failed claim, with optional additional evidence references;
- human-readable messages remain non-normative;
- unknown reason code must not be silently treated as success;
- reason-code version is tied to Fixture Context Contract version, not Packet schema version.

Initial candidate examples:
- `scp.fixture.fingerprint.observation_changed`
- `scp.fixture.fingerprint.path_object_replaced`
- `scp.fixture.fingerprint.path_alias_collision`
- `scp.fixture.identity.provider_forbidden`
- `scp.fixture.identity.provider_rate_limited`
- `scp.fixture.identity.provider_timeout`
- `scp.fixture.identity.ambiguous_not_found`

Do not add these codes to Packet `extensions` or D1 Schema. Promoting any reason code into the runtime SCP protocol requires a separate compatibility and versioning decision.

## 10. Security and determinism requirements

- No real credentials or production network calls.
- Synthetic provider identities use an isolated namespace and local stub.
- Setup driver IDs are allow-listed; arbitrary shell/JS/Python is forbidden in context input.
- Every filesystem/Git mutation is constrained to a unique disposable root.
- Observation phase is read-only.
- Clock, event order, path bytes, commit IDs and provider responses are pinned.
- Environment capability is explicit and measured; OS labels alone are insufficient.
- Missing context/capability is not_run/unknown, never pass.
- Context path and blob SHA must match the checked-out tree before execution.
- The same context/packet/observation/capability input yields the same normalized expectation across clients.

## 11. Compatibility and change policy

- Context version is independent from Packet schema version.
- Core field additions, removals, enum changes or semantic changes require a new Context Contract minor version during 0.x, even when the field is optional.
- Patch changes may clarify documentation only if accepted instances and meaning are unchanged.
- Unknown context versions or unknown core fields must stop conformance evaluation; clients must not ignore and continue.
- Markdown documentation is generated/explanatory view; JSON Schema is the sole machine contract once this proposal is accepted.
- Existing `SEMANTIC-CONTEXT.md` remains the human review source until a Context Schema and migration/validation plan are explicitly approved. Do not maintain two independent authoritative inventories.

## 12. Decisions required before formalizing a machine Schema

1. Accept separate Fixture Context versioning and the proposed `schemas/scp-fixtures/0.1` namespace.
2. Accept typed declarative observations plus allow-listed driver IDs, rather than executable setup scripts.
3. Accept the run-manifest separation and no actual result written back to Context.
4. Accept reason codes as test-harness vocabulary only.
5. Decide whether capability profiles are embedded inline or referenced by immutable profile IDs with separately pinned profile documents.

**Historical pre-approval boundary (superseded):** The five decisions were subsequently approved under §15, and the initial reviewable Context Schema plus design-only instances were created. The no-Runner/no-adapter boundary remains in force.

## 13. Recommended disposition of the five pending decisions

This is the recommended design outcome for the next review; it does not create a formal schema.

| Decision | Recommendation | Reason |
|---|---|---|
| Separate Context Contract and version namespace | **Accept** `scp-fixture-context/0.1.0` independently from Packet 0.2.0 | Prevents test-only fields and lifecycle from leaking into runtime Packet |
| Typed declarative observations + allow-listed driver IDs | **Accept**; no executable commands in Context | Language-neutral, reviewable, safer to validate and reproducible |
| Separate run manifest | **Accept**; actual results never mutate Context | Keeps inputs immutable and allows multiple clients/runs to be compared |
| Reason codes | **Fixture-only vocabulary** under `scp.fixture.*` | Avoids accidentally creating a public runtime error API before product semantics are approved |
| Capability profiles | **Immutable external profile reference + blob SHA** | Reuse one tested capability definition across fixtures without copy drift |

### 13.1 Pin the setup driver as well as its ID

The proposed example's `driver_revision="1"` alone is not enough to reproduce a run. A formal Context Schema should require:

- `driver_id`: allow-listed registry identifier;
- `driver_contract_version`: version of the driver interface;
- `driver_bundle_sha256`: digest of the exact driver package or immutable bundle.

A driver lookup by a mutable name such as `latest` is forbidden. The driver package is code owned by the test harness, not code supplied by the fixture author.

### 13.2 Pin capability profiles independently

A capability profile reference should include:
- immutable `profile_id`;
- `profile_version`;
- `profile_blob_sha`.

The profile describes declared capabilities and expected probe semantics. The run manifest records actual measured capabilities from the disposable test root. A mismatch is an applicability/failure result; it must not rewrite the profile or input Context.

Do not allow free-form per-fixture capability overrides in the first Context version. When a fixture needs a materially different capability set, define another immutable profile. This avoids hidden inheritance and override precedence across clients.

### 13.3 Pin the Context itself in each run

The Context cannot contain its own blob SHA without self-reference. Instead, each run manifest pins:
- Context blob SHA;
- Packet blob SHA;
- Packet Schema blob SHA;
- setup driver bundle SHA;
- capability profile blob SHA;
- client and adapter versions.

This makes the exact input set reproducible without embedding self-referential hashes.

## 14. Acceptance criteria for a future Context Schema

A formal Context Contract must not be frozen, marked runnable or adopted as a conformance gate until all criteria below are met. The initial reviewable Draft Schema may be created before cross-client harness adapters exist:

1. Top-level contract/version/fixture ID and all referenced Packet/Schema/driver/profile revisions are immutable and resolvable.
2. All event sequences are explicitly ordered and do not depend on wall-clock timing.
3. Observation records are typed by profile (Git, filesystem, provider, permission/fault injection); unknown core records are rejected.
4. The expected normalized output expresses claim-level states and operation-scoped recovery, not a single pass/fail boolean.
5. Context never contains actual run result, credential material or arbitrary executable code.
6. A missing profile/driver/input is not_run/unknown or not_applicable as appropriate; never pass by omission.
7. JSON Schema Draft 2020-12 meta-schema and positive/negative context instances have a separately pinned validation report.
8. Two independently implemented harness adapters can load the same Context and produce identical normalized input observations before client evaluation.

The five design recommendations were approved on 2026-11-12 and the initial reviewable Context Schema Draft 0.1.0 has been created. `SEMANTIC-CONTEXT.md` remains the human-readable review catalog; the JSON Context instances are a pinned machine representation of the same test vectors, not a second project-state inventory. They describe only test inputs/expected outputs and do not create project requirements, tasks, ADRs or Evidence.

## 15. User decision and drafting authorization

On 2026-11-12, the user approved all five recommendations in §13:

1. Separate `scp-fixture-context/0.1.0` version namespace.
2. Typed declarative observations with allow-listed, pinned setup drivers; no executable commands in Context.
3. Immutable input Context and separate per-run manifest.
4. `scp.fixture.*` reason codes remain fixture-conformance vocabulary only.
5. Capability profiles use immutable external references with blob SHA; no free-form per-fixture overrides in the first version.

This approval authorizes creation of the first reviewable JSON Schema Draft 2020-12 and a small number of context examples/negative schema fixtures. It does not authorize a Fixture Runner, Semantic Validator, client adapter, run-manifest writer or CI gate.

The Context Schema must remain a test-only contract and must not add fields to SCP Continuity Packet 0.2.0.

The initial Draft 0.1.0 is now at `schemas/scp-fixtures/0.1/fixture-context.schema.json`; examples and validation are listed in its `README.md` and `VALIDATION-REPORT.md`. The three Driver descriptors referenced by current examples are explicitly `contract_only`, so the examples are schema-valid but not runnable.

## 16. Context Schema 0.1.0 Draft implementation record

The user-approved design has been materialized as a separate Draft 2020-12 schema:

- `schemas/scp-fixtures/0.1/fixture-context.schema.json`
- `schemas/scp-fixtures/0.1/README.md`
- `schemas/scp-fixtures/0.1/VALIDATION-REPORT.md`

The schema requires:
- exact Packet and Packet Schema artifact references (repository-relative path + Git blob SHA) and a source repository commit;
- declared profile types, deterministic clock, and immutable capability profile reference;
- setup Driver ID, driver contract version and SHA-256 bundle pin;
- disposable-root isolation, local-stub/disabled network and synthetic-only credentials;
- typed, discriminated stimulus events and companion observations (Git snapshots, filesystem identity, path equivalence, provider lookup and permission);
- claim-level freshness/applicability plus separate identity/path/fingerprint state axes;
- operation-scoped recovery mode and permitted/prohibited action lists.

The Context Schema deliberately has no `execution_status` field. A Context must not declare itself runnable; the external Harness Registry determines whether the exact driver/profile artifacts are available and executable. Actual execution result and readiness belong in the separate Run Manifest.

Three positive Context examples are schema-valid and five negative Context examples are rejected. The Driver descriptors they reference are `contract_only`, not executable packages. Their SHA values pin the exact declarative descriptor bytes; no Runner exists.

The first schema draft passed Draft 2020-12 meta-schema validation using Python `jsonschema 4.26.0` with `FormatChecker()`. The separate validation report pins the schema blob SHA and sample blob IDs.

### 16.1 Remaining boundaries

- Capability Profile files are immutable JSON references; their registry-level semantics are still a Harness-owned contract, not a frozen public API.
- Driver descriptor files are allow-list metadata only. An executable Driver bundle must be separately registered and pinned before a context can be run.
- Run Manifest shape is still conceptual; no Run Manifest Schema is created.
- No context migration tool, validator CLI, fixture runner, client adapter or CI gate is implemented.
- Context Contract 0.1.0 remains Draft; acceptance/freeze requires the §14 criteria, including two independent harness adapters producing identical normalized input observations.

## 17. Provider authority evidence and semantic cross-reference refinement

The first Schema draft was tightened after an adversarial review:

- `event_path_relation.profile_revision` and `path_relation.profile_revision` are now required, so every path-equivalence observation is tied to the exact capability profile revision it used.
- `authoritative_not_found` provider events and observations now require `not_found_authority_evidence`, an immutable artifact reference (repository-relative path + Git blob SHA).
- The evidence must establish the exact provider namespace/contract revision, authentication requirements, exact resource/revision scope and visibility-masking behavior.
- `not_found_authority=true` alone is insufficient. For success/forbidden/rate_limited/timeout and ambiguous_not_found response classes, authority must be false.
- Added synthetic fixture contract `schemas/scp-fixtures/providers/0.1/github-rest-not-found-contract.json`, Git blob SHA `6573628ce89d1e9f0e43ad2ecc341dc99b29e887`. It describes only the isolated local stub and makes no claim about the real GitHub API.

The accompanying `schemas/scp-fixtures/0.1/COMPATIBILITY.md` defines cross-record rules that JSON Schema cannot express alone: unique/strictly increasing event sequence, matching provider event/observation records, profile and Driver allow-list compatibility, unique claim/scope identifiers, disjoint permitted/prohibited actions, and operation-scoped normal/restricted/blocked semantics.

After the schema refinement, the current schema blob is `9348e22ac0ee450ce6689cec4fb87f0aa985104c`. Python `jsonschema 4.26.0` `Draft202012Validator.check_schema` passed with `FormatChecker()`; representative Context positives/negatives and format/extension probes were re-run. The latest detailed counts and scope are in `schemas/scp-fixtures/0.1/VALIDATION-REPORT.md`.

This remains a schema/design review. The current Driver descriptors are still `contract_only`; the Registry and Runner do not exist. Context Schema 0.1.0 remains Draft.
