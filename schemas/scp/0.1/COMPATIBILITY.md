# SCP 0.1 Schema and Compatibility Policy (D1 Draft)

**Status:** Draft for review. This document and the schema are not yet an implementation gate.

## Authority and representation

- `schemas/scp/0.1/continuity-packet.schema.json` is the sole machine-readable contract for SCP 0.1.
- JSON instances are validated against JSON Schema Draft 2020-12.
- Markdown summaries, if introduced, are generated views. They must never be independently edited as a second copy of packet facts.
- YAML may be used in explanatory prose only; it is not a normative representation.

## Versioning

- `protocol` identifies the protocol family (`scp`); `schema_version` identifies the exact packet contract.
- A published schema version is immutable. A change that alters field meaning, requiredness, accepted values, or validation behavior requires a new schema version.
- During the 0.x design phase, any incompatible contract change increments the minor version (for example, 0.1.0 to 0.2.0); a patch revision may correct wording or schema metadata only when instance validity and semantics are unchanged.
- A future 1.x policy may adopt conventional major/minor/patch compatibility guarantees only after D1 review.
- Producers must emit the exact schema version they target. Consumers must not silently reinterpret an unknown version.

## Unknown fields and extensions

- Unknown fields in core objects are rejected (`additionalProperties: false`) to catch misspellings and accidental semantic drift.
- Forward-compatible producer-specific data belongs under top-level `extensions`, namespaced by reverse-DNS-like keys (for example, `com.example.client`).
- Extensions are advisory only. Consumers may ignore an unknown extension namespace; extensions must not redefine core SCP fields or carry duplicate task/requirement/intent/verification state.
- A consumer that cannot safely process an unknown protocol/schema version must stop protocol-driven writes and fall back to read-only/manual recovery.

## State and authority boundaries

- References point to existing authoritative files/records; packets do not replace them.
- `coordination` is optional. Include it when real concurrent writing or explicit ownership boundaries matter; ordinary single-agent work must not be forced to create coordination metadata.
- Missing optional capabilities are represented by omission, not by fabricated paths or placeholder records.
- Dynamic Git/PR/CI state must be refreshed at consumption time. Packet values are last-known observations, not live truth.
- `head_sha: null` is permitted only when the revision cannot be observed; the producer must pair it with an honest `worktree_state` and must not claim revision-bound verification.
- `observed_clean` and `observed_dirty` describe only tool-observable filesystem/Git state, never unsaved editor buffers. The canonical worktree observation is `code.worktree_state`; it must not be duplicated in checkpoint fields.
- A packet claiming `verification_state: passed` or `review_state: reviewed` must include at least one `evidence_refs` entry. Consumers should validate date-time formats as RFC 3339, not merely accept arbitrary strings.
- A confirmed decision is scoped to its own `decision_id` and source. It is not blanket authorization for other actions.

## Validation scope

D1 defines the data contract only. Validator implementation, fixture runners, CLI adapters, and mandatory gates are separate deliverables and require their own review and evidence.
