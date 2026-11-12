# SCP Semantic Fixture Context Contract — Design Proposal

**Status:** Design proposal only. This is not yet a machine schema, fixture instance, Validator API or implementation authorization.

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

Until those decisions are confirmed:
- no `fixture-context.schema.json` is created;
- no machine fixture-context instances are added;
- no Fixture Runner or client adapter is implemented;
- current 4 / 9 / 19 Fixture Inventory is unchanged;
- SCP Packet Schema 0.2.0 remains unchanged and Draft.
