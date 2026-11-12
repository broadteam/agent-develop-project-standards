# SCP Fixture Context 0.1.0 Validation Report

**Status:** Draft schema validation record. It does not freeze the Context Contract and does not report a Runner execution.

## Validation target

| Item | Value |
|---|---|
| Schema | `schemas/scp-fixtures/0.1/fixture-context.schema.json` |
| Schema Git blob SHA | `b730e86bd62c90723831ebea2ccd81a00b4bb8fd` |
| Dialect | JSON Schema Draft 2020-12 |
| Validator | Python `jsonschema 4.26.0` |
| Format validation | `FormatChecker()` enabled |

## Results

| Test | Count | Result |
|---|---:|---|
| Draft 2020-12 meta-schema check | 1 | PASS |
| Positive Context instances | 3 | 3/3 VALID |
| Negative Context instances | 5 | 5/5 REJECTED |
| Invalid `date-time` probe | 1 | REJECTED |
| Namespaced extension | 1 | ACCEPTED |
| Unqualified extension key | 1 | REJECTED |

Invalid date probe: `2026-13-40T30:70:70Z`.

## Positive Context Git blob IDs

| Context | Git blob SHA |
|---|---|
| `context/fingerprint-path-set-mismatch.json` | `84eee127f8e25dc3dec5706da132bbcc472c36e4` |
| `context/identity-source-reference-unresolvable.json` | `80161ad9b5deffa7a1a89c403e717d26bf7e9bca` |
| `context/credentialed-project-repository.json` | `7d864428c24ee988373a60347e06d3e1fe0f47aa` |

## Negative Context Git blob IDs

| Context | Rejection reason | Git blob SHA |
|---|---|---|
| `context-invalid/unknown-core-field.json` | Unknown top-level field | `60da605c96967a46f04dcfc00876071943fa1c40` |
| `context-invalid/arbitrary-driver-command.json` | Unknown executable command field under driver reference | `6d633567f3e9299a27565a5c8d02df0576c89c06` |
| `context-invalid/provider-authoritative-not-found-without-auth.json` | Authoritative not-found requires accepted authentication and authority evidence | `7e9f241c05abbea84f04984e7a63304e2725cafa` |
| `context-invalid/missing-capability-profile-blob.json` | Missing required immutable profile blob SHA | `9bf81a48cd90ac9ae2b0230b49c88f9496e8ee78` |
| `context-invalid/packet-path-escapes-repository.json` | Packet artifact path escapes the repository root | `3b965d4cdf22453e019866d741bef463a544ac14` |

## Pinned Capability Profile blob IDs

| Profile | Git blob SHA |
|---|---|
| `packet-only` | `a44342ea0007981a786784af61c44e36f101548b` |
| `local-git-contract` | `b0fc0273870f4591e5a53a51db7d189c012c826c` |
| `provider-stub` | `7784c321f69e5f812b2bca22184ca13335c985e1` |

## Pinned Driver descriptor bundle digests

SHA-256 values cover the exact UTF-8 descriptor file bytes, including the final newline. These are declarative `contract_only` artifacts and are not executable Runner bundles.

| Driver ID | SHA-256 |
|---|---|
| `packet.locator.inspection` | `sha-256:161a7df5bbc28e9cf61bca0080d9a433b8ac247df8058898bee21b16c1be3222` |
| `git.path-set.mismatch` | `sha-256:27a0df17005a22f3da6901c45c768a8fbbdd9a34e8eea67b1d7c5493173e37e9` |
| `provider.identity.lookup` | `sha-256:fb274c2eca75fdbaa9ad97f8e94bdfeb5a04bc2bf4757fe5abed6f593136770b` |

## Interpretation and limits

- The Draft 2020-12 meta-schema check passed for the schema blob listed above.
- The 3 design-only Context examples passed structural/format validation; the 5 negative examples were rejected for the intended structural constraints.
- The Contexts reference Packet schema blob `a2f2097a17c08bf0a2ae733ab43a8f1919b48813` and exact Packet Git blob IDs. Context validation does not revalidate those Packet instances; their separate results are in `schemas/scp/0.2/fixtures/VALIDATION-REPORT.md`.
- The profile references are immutable Git blob references. Profile document format is still owned by the Harness Registry and is not a separately frozen public API.
- The Driver files are declarative contract descriptors marked `contract_only`. No executable driver implementation, registry, Runner or adapter exists.
- No disposable Git repository or provider stub was actually created/executed by this report.
- Actual run manifests, Semantic Validator, Fixture Runner, client adapter and CI gate are not implemented.
- The existing Standards CI workflow does not validate this Context Schema.
- Context Schema 0.1.0 remains Draft. This report does not freeze D1, D2, D3 or this separate Context Contract.
