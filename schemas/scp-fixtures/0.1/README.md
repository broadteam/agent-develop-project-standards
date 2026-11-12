# SCP Fixture Context 0.1.0

**Status:** Draft machine contract. No Fixture Runner, Semantic Validator, client adapter or CI gate is implemented.

## Contract

- Schema: `fixture-context.schema.json`
- Contract ID: `scp-fixture-context`
- Context version: `0.1.0`
- Dialect: JSON Schema Draft 2020-12
- Format validation: consumers must enable `date-time` format assertion.
- Cross-reference and event-order semantics: see [COMPATIBILITY.md](./COMPATIBILITY.md).
- Context versioning is independent of SCP Packet `schema_version=0.2.0`.

The Context is test-harness input. It is not an SCP Packet, project state source, authorization token, or runtime recovery artifact.

## Design rules

- Context pins Packet path/blob SHA, Packet Schema path/blob SHA and the source repository revision.
- Capability Profiles are immutable external JSON artifacts, referenced by `profile_id`, `profile_version` and Git blob SHA.
- Setup Drivers are allow-listed references pinned by `driver_id`, `driver_contract_version` and SHA-256 of the exact driver bundle bytes.
- The current Driver files are `contract_only` descriptors. Their SHA pins the descriptor bytes, not an executable implementation. A future Harness Registry must reject them for execution until an allow-listed runnable bundle is separately published and pinned.
- Context contains typed stimulus and companion observations, plus expected claim-level states and operation-scoped recovery results.
- Context contains no arbitrary command/script, user credential, actual run result or authority to mutate a user repository.
- Actual observations/results belong in a separate immutable Run Manifest; they are never written back to the input Context. The lifecycle and state model remains a proposal in [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md); there is no Run Manifest Schema or Writer.
- Readiness is not a Context field. Whether a driver/profile is executable is determined by the external Harness Registry and recorded in a Run Manifest.

## Capability Profile artifacts

| Profile | File | Git blob SHA |
|---|---|---|
| packet-only | `../profiles/0.1/packet-only.json` | `a44342ea0007981a786784af61c44e36f101548b` |
| local-git-contract | `../profiles/0.1/local-git-contract.json` | `b0fc0273870f4591e5a53a51db7d189c012c826c` |
| provider-stub | `../profiles/0.1/provider-stub.json` | `7784c321f69e5f812b2bca22184ca13335c985e1` |

## Provider contract evidence

| Contract | File | Git blob SHA |
|---|---|---|
| github-rest-fixture-not-found-semantics/1 | `../providers/0.1/github-rest-not-found-contract.json` | `6573628ce89d1e9f0e43ad2ecc341dc99b29e887` |

## Driver contract descriptors

Git blob SHA identifies the file in the pinned repository snapshot. SHA-256 identifies the exact descriptor bytes and is the value currently pinned in Context examples. They are not interchangeable.

| Driver ID | Descriptor | Driver bundle SHA-256 | Status |
|---|---|---|---|
| `packet.locator.inspection` | `../drivers/0.1/packet-locator-inspection.json` | `sha-256:161a7df5bbc28e9cf61bca0080d9a433b8ac247df8058898bee21b16c1be3222` | contract_only |
| `git.path-set.mismatch` | `../drivers/0.1/git.path-set-mismatch.json` | `sha-256:27a0df17005a22f3da6901c45c768a8fbbdd9a34e8eea67b1d7c5493173e37e9` | contract_only |
| `provider.identity.lookup` | `../drivers/0.1/provider.identity-lookup.json` | `sha-256:fb274c2eca75fdbaa9ad97f8e94bdfeb5a04bc2bf4757fe5abed6f593136770b` | contract_only |

## Context examples

These files are schema-valid, design-only Context instances that pin existing Packet fixtures:

| Context | Target Packet | Environment |
|---|---|---|
| `../../scp/0.2/fixtures/context/fingerprint-path-set-mismatch.json` | Semantic fingerprint path-set mismatch | local_git |
| `../../scp/0.2/fixtures/context/identity-source-reference-unresolvable.json` | Provider identity authoritative not-found | provider_stub |
| `../../scp/0.2/fixtures/context/credentialed-project-repository.json` | Credential-bearing project.repository locator | packet_only |

They are not runnable until the referenced Driver IDs resolve to executable bundles in an allow-listed Harness Registry.

## Negative Context instances

Five invalid Context examples are under `../../scp/0.2/fixtures/context-invalid/`:

- unknown core field;
- arbitrary driver command;
- authoritative not-found without authenticated authority;
- missing capability profile blob SHA;
- Packet path escaping the repository root.

## Run Manifest design

See [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md) for the proposed immutable per-attempt record, separate conformance/Harness outcome axes, cleanup semantics, retry lineage, interruption trust, artifact/Evidence separation and acceptance criteria. It is design-only and is not a machine schema.

## Validation

See [VALIDATION-REPORT.md](./VALIDATION-REPORT.md) for the pinned Schema SHA, tool version, positive/negative instance results and artifact blob IDs.

Validation does not mean a Harness exists or any Git/provider operation was executed. The Context Schema is not wired into the repository's existing Standards CI workflow.

## Run Manifest design status

The field mapping, Context 0.1.0 cross-record rules and review vectors are recorded in [RUN-MANIFEST-DESIGN.md](./RUN-MANIFEST-DESIGN.md) §§13–16 and [COMPATIBILITY.md](./COMPATIBILITY.md) §10.

Current disposition: **design candidate complete; Schema gate not met**. No `run-manifest.schema.json`, Writer, Store, finalizer, Harness/Client Adapter, Runner or CI Gate exists. The main blockers are the absence of two independent Harness implementations emitting equivalent normalized results, executable Driver/Registry infrastructure, and executable redaction/cleanup negative tests. The examples in §§15 are design review vectors, not schema-valid fixtures or execution evidence.

This review does not change Context 0.1.0 or Packet 0.2.0 fields and does not freeze either contract.
