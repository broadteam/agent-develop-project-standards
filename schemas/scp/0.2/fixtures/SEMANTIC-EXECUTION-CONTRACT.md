# SCP 0.2.0 Semantic Fixture Execution Contract (Draft)

**Status:** Design contract only. This document does not implement a Semantic Validator, Fixture Runner, CLI adapter, test service or CI gate.

## 1. Purpose and scope

`SEMANTIC-CONTEXT.md` lists the additional facts required by each semantic-invalid Packet. This document standardizes how a future test harness supplies those facts and compares client results.

The harness must distinguish four different things:

1. Packet shape: whether the instance is valid under the pinned JSON Schema.
2. Fixture environment: the deterministic Git/filesystem/provider state accompanying the Packet.
3. Semantic result: whether each Packet claim is supported, stale, conflicting, unknown or out of scope.
4. Recovery policy: which actions may proceed for a specified operation scope.

A fixture result is not a single global boolean. An identity conflict should not erase an independently verifiable worktree observation; a dirty worktree should not invalidate unrelated project intent references.

## 2. Normative source hierarchy for a fixture run

Each run is bound to:

- One exact Schema blob SHA.
- One exact Packet fixture blob SHA.
- One exact companion-context revision.
- One declared environment profile and capability set.
- One deterministic clock value.
- One client adapter version.

The Packet and companion context are test inputs, not project authority. The harness must not resolve synthetic `fixture://` references by reaching a real provider or using the developer's credentials.

A missing companion input is `not_run/unknown`; it is never an implicit pass.

## 3. Four-phase execution lifecycle

### Phase A — Prepare isolated fixtures

Preparation may mutate only a newly created disposable fixture root owned by the harness. It may create temporary Git repositories, bare remotes, files, index states, submodules, configuration, provider stubs and synthetic permission responses.

Preparation must not:
- Open or modify the user's working repository.
- Reuse the user's real Git config, credentials, SSH agent or provider token.
- Fetch from or push to a real remote.
- Write fixture caches, reports, locks or generated files into the target project.
- Change global/system Git configuration.

Each fixture receives a unique temporary root and a deterministic fixture clock. Setup data must be self-contained or explicitly declared as a harness capability.

### Phase B — Observe read-only state

The observation phase exercises the same read-only adapter boundary intended for SCP Bootstrap:

- Git status uses porcelain v2 and NUL-delimited paths, with `--untracked-files=all`, `--ignore-submodules=none` and `--no-optional-locks`.
- Remote URL observation uses Git's effective fetch/push URL semantics, including configured rewrites; no network connection is made.
- Branch tracking and default push remote are read from the temporary repository's effective configuration.
- Index entries and worktree objects are read without changing the index or worktree.
- Provider facts are supplied by a deterministic local stub with explicit status/result values.
- Filesystem capability observations (case sensitivity, Unicode normalization behavior, symlink support, executable-bit visibility) are supplied by a declared platform profile or a disposable probe root.

If the observation adapter cannot guarantee read-only behavior, the observation is `not_run/unknown`; the harness must not silently permit the side effect.

### Phase C — Evaluate and normalize

The client first validates the Packet against the exact supported Schema version with Draft 2020-12 format assertion enabled.

It then evaluates semantic claims using both Packet and companion observations. The result must preserve independent axes:

- protocol compatibility;
- repository/project identity;
- per-source freshness;
- branch/tracking/push resolution;
- per-path fingerprint applicability;
- evidence applicability;
- recovery mode for the requested operation scope;
- permitted and prohibited actions;
- user decisions still required.

Clients may be more conservative than the reference expectation, but they must never upgrade unknown/stale/conflict to current/resolved/authorized.

### Phase D — Assert and clean up

Assertions compare normalized outcomes, not human-readable wording or provider-specific diagnostic text.

The harness removes only its own disposable fixture root and provider stub state. Cleanup failure is a harness failure and must not trigger a cleanup attempt against the user's repository.

## 4. Fixture environment profiles

| Profile | Used for | Required deterministic inputs |
|---|---|---|
| `packet_only` | Duplicate JSON members-by-value, time interval, ordering, index stage list shape | Exact Packet bytes; fixed format assertion settings |
| `local_git` | Paths/status/index/remotes/branch tracking | Temporary repository, fixed commits, local bare remotes, Git config, worktree/index mutations |
| `local_git_submodule` | Gitlink pointer, initialized/uninitialized/dirty submodule | Parent repo, local submodule remote, index gitlink OID, checkout HEAD OID, submodule status and dirty/untracked state |
| `provider_stub` | Native repository IDs, canonical/fork relationships, source reference resolution, not-found vs forbidden | Explicit namespace/ID records and deterministic response mapping; no network |
| `filesystem_profile` | Path aliases, case/Unicode collisions, symlink and executable-bit support | Declared OS/filesystem capability profile and disposable probe paths |
| `fault_injection` | Scan races, permission loss, interrupted reads, stale remote response | Deterministic hook points and event ordering; no sleep-based race tests |

A fixture may require more than one profile. Profile combinations must be explicit in the fixture context; clients must not infer missing capabilities.

## 5. Determinism rules

- Use a fixed clock; never compare against the wall clock during a fixture assertion.
- Use exact byte content for file and symlink-target digest inputs. Example Packets' placeholder digests are not test evidence.
- Use fixed commit trees and deterministic repository IDs. Avoid random IDs, generated branch names, locale-dependent ordering or host-specific temporary paths in normalized output.
- Sort only where the protocol explicitly requires canonical ordering. The validator must reject non-canonical fixture input rather than silently sorting it before assertion.
- Provider stubs must distinguish authoritative not-found, permission denied, rate limited, timeout and malformed response. They are not interchangeable.
- Race injection must be event-driven (for example, mutate the disposable index after initial enumeration and before final re-enumeration), not timing-based sleeps.
- The same Packet, companion snapshot, capability profile and permission profile must yield the same normalized result on two independent clients, modulo permitted conservative downgrades.

## 6. Per-fixture setup / observation / expected outcome mapping

The detailed synthetic facts remain in `SEMANTIC-CONTEXT.md`. This table identifies the environment profile and assertion class for each current semantic vector.

| Fixture | Profile | Observation that must be supplied | Expected assertion |
|---|---|---|---|
| `duplicate-remote-name` | `packet_only` | Two mapping records with the same exact remote alias | Reject duplicate alias; never select by array order |
| `fingerprint-path-set-mismatch` | `local_git` | Git status path set equals Packet paths but differs from complete fingerprint entries | Complete claim rejected/downgraded |
| `duplicate-fingerprint-path` | `packet_only` | Two entries carry the same exact path | Reject duplicate path identity |
| `canonical-relation-mismatch` | `provider_stub` | Checkout and canonical stable IDs are distinct; relation claim contradicts them | Relation claim conflict |
| `credentialed-locator` | `packet_only` | Credential-bearing identity locator | Reject/redact before persistence/logging; never echo secret |
| `duplicate-index-stage` | `packet_only` | Same path has duplicate stage number | Reject duplicate index stage |
| `complete-with-dirty-submodule` | `local_git_submodule` | Gitlink OID matches checkout HEAD, but submodule worktree is dirty | Complete coverage rejected/downgraded |
| `fingerprint-time-window-reversed` | `packet_only` | completed_at precedes started_at | Reject impossible capture interval |
| `partial-fingerprint-outside-path-set` | `local_git` | Fingerprint entry is outside observed status path set | Reject extraneous entry; partial allows omission only |
| `unsorted-fingerprint-entries` | `packet_only` | Entry array is not ordered by UTF-8 path bytes | Reject non-canonical ordering; do not auto-sort |
| `mixed-index-conflict-stages` | `packet_only` | One path contains stage 0 and unmerged stage 2 | Reject malformed stage combination |
| `remote-fetch-push-identity-mismatch` | `local_git` + `provider_stub` | Effective fetch and push targets resolve to different stable repository IDs | Remote mapping conflict; no push target authorization |
| `multiple-push-targets-different-identities` | `local_git` + `provider_stub` | Effective push URL list resolves to multiple repository IDs | Push mapping ambiguous/conflict; preserve every target |
| `branch-tracking-unknown-remote` | `local_git` | Configured upstream alias does not exist in remote mapping | Tracking unresolved; do not invent remote |
| `branch-state-code-branch-mismatch` | `local_git` | Packet says attached; live symbolic-ref observation says detached | Packet branch observation stale/conflict |
| `credentialed-project-repository` | `packet_only` | Top-level project.repository contains userinfo/token | Reject/redact before persistence/logging |
| `gitlink-pointer-mismatch` | `local_git_submodule` | Index gitlink OID differs from checked-out submodule HEAD OID | Complete coverage rejected/downgraded |
| `identity-source-reference-unresolvable` | `provider_stub` | Authoritative source returns not-found; separate cases needed for 403/timeout | Identity unresolved; no stale-cache promotion |
| `branch-push-remote-unknown` | `local_git` | Effective default push remote alias cannot be resolved in live config/mapping | Push target unknown/conflict; no fallback alias |

## 7. Expected normalized result model (illustrative)

This is an explanatory shape for cross-client fixture assertions, not a new Packet schema and not a frozen machine API:

~~~json
{
  "schema_validation": "valid",
  "semantic_validation": "rejected",
  "claims": [
    {
      "claim": "repository_identity.remote_mappings[origin]",
      "status": "conflict",
      "reason_code": "fetch_push_identity_mismatch"
    },
    {
      "claim": "code.worktree_fingerprint",
      "status": "current"
    }
  ],
  "recovery_mode": "restricted",
  "permitted_actions": ["read_project_rules"],
  "prohibited_actions": ["push"]
}
~~~

Rules:
- A claim status is local to the claim; a conflict in one claim must not erase independent observations.
- `schema_validation` and `semantic_validation` are separate.
- `not_run`/unknown is required when a profile, permission or companion observation is absent.
- `recovery_mode` is calculated for a requested operation scope; it is not a packet-wide authorization.
- Reason codes must be stable and language-neutral if later adopted as a machine contract.

## 8. Conformance assertions for two independent clients

For each fixture, compare the normalized semantic result under identical Packet bytes, companion context, clock, capabilities and permission profile.

The clients must agree on:
- schema validity;
- identity confidence and conflict state;
- freshness/applicability of each claim;
- complete/partial/unknown fingerprint treatment;
- recovery mode for the specified operation scope;
- prohibited actions and any required user decision.

One client may downgrade a claim further when its observation capability is weaker, but it must report that capability limitation explicitly. It must not promote a claim another client marked unknown/conflict under the same inputs.

## 9. Remaining design questions before a future Fixture Runner

1. Whether to introduce a machine-readable companion-context format in addition to this Markdown contract.
2. How to pin and distribute deterministic local Git fixture bundles without relying on host Git version quirks.
3. Which OS/filesystem profiles are mandatory for the first interoperability baseline.
4. How to expose deterministic fault-injection hooks without coupling clients to one implementation language.
5. Whether normalized reason codes should be part of the SCP protocol or remain test-harness-only.

These are design decisions. This document does not authorize implementation or adding CI gates.

## 10. Proposed next semantic vectors (not part of the current 19)

The following gaps emerged from cross-platform and failure-mode review. They are proposals for a later fixture inventory expansion; they do not change the current 4 / 9 / 19 counts.

### A. Fingerprint re-enumeration race

**Candidate ID:** `fingerprint-reenumeration-race`

- Profile: `local_git` + `fault_injection`.
- Prepare an isolated repository with one dirty path and a Packet that claims `coverage=complete`, `observation=per_path_stable`.
- After the initial status enumeration and during fingerprint capture, deterministically add an untracked non-ignored path or mutate the index; do so before the final HEAD/index/status re-enumeration.
- The final observation must detect that the path set or index snapshot changed during capture.
- Expected result: reject/downgrade the complete/current claim; return stale/conflict/unknown for the affected fingerprint scope. Never pass by relying only on the first status result or timestamps.
- The test must use a deterministic hook/barrier, not sleep. The hook may modify only the disposable fixture root.

### B. File identity replacement during digest read

**Candidate ID:** `fingerprint-file-object-replaced-during-read`

- Profile: `local_git` + `fault_injection`.
- During streaming SHA-256 of a regular file, replace the path with a different inode/object or change its contents between pre-read and post-read checks.
- Expected result: the affected entry is unknown/changed-during-capture; complete coverage is rejected or downgraded. Do not combine bytes from two file objects into one digest.
- The adapter should assert object identity using the strongest portable file-handle/path metadata available; where the OS cannot provide a reliable check, capability is insufficient and the result is unknown.

### C. Case and Unicode path alias collision

**Candidate ID:** `fingerprint-path-alias-collision`

- Profile: `filesystem_profile` plus a declared case-sensitive/case-insensitive and Unicode-normalizing/non-normalizing capability profile.
- Supply distinct UTF-8 path strings such as `src/Foo.ts` and `src/foo.ts`, or NFC/NFD spellings of the same visible name. The fixture must declare the actual byte sequences, not only rendered glyphs.
- Expected result: on a target filesystem where the two names alias or cannot be represented distinctly, mark the relevant path identity ambiguous/conflict and coverage partial/unknown. Never case-fold, Unicode-normalize or silently choose one path.
- On a filesystem that can represent both distinctly, exact path identities remain separate; client output must identify the tested capability profile.

### D. Provider authorization failure versus authoritative not-found

**Candidate ID:** `identity-source-permission-denied`

- Profile: `provider_stub`.
- Reuse the same referenced repository source with separate deterministic responses: 403/permission denied, 404 authoritative not-found, 429/rate-limited and timeout.
- Expected result: 403/429/timeout produce unknown/not_run as appropriate; only an authoritative 404 may support not-found for that exact source at that exact revision. Neither failure nor hidden visibility may be converted into proof that the repository does not exist.
- This complements `identity-source-reference-unresolvable`, which currently covers authoritative not-found only.

These vectors should be added only after the current fixture context is accepted as the shared execution baseline. They require no new Packet fields; they exercise observation integrity, capability reporting and fail-closed semantics.
