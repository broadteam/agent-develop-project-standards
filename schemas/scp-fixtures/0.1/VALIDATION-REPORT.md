# SCP Fixture Context 0.1.0 Validation Report

**Status:** Draft schema validation record. This report validates the current Schema blob and the exact Context fixture bytes pinned below. It does not report a Fixture Runner execution and does not freeze the Context Contract.

## Validation target

| Item | Value |
|---|---|
| Schema | `schemas/scp-fixtures/0.1/fixture-context.schema.json` |
| Schema Git blob SHA | `9348e22ac0ee450ce6689cec4fb87f0aa985104c` |
| Dialect | JSON Schema Draft 2020-12 |
| Validator | Python `jsonschema 4.26.0` |
| Instance format validation | `FormatChecker()` enabled |

## Results

| Test | Count | Result |
|---|---:|---|
| Draft 2020-12 meta-schema check (`Draft202012Validator.check_schema`) | 1 | PASS |
| Positive Context instances | 3 | 3/3 VALID |
| Negative Context instances | 5 | 5/5 REJECTED |
| Valid RFC 3339 date-time probe | 1 | ACCEPTED |
| Invalid date-time probe | 1 | REJECTED |
| Namespaced extension key | 1 | ACCEPTED |
| Unqualified extension key | 1 | REJECTED |

Invalid date probe: `2026-13-40T30:70:70Z`.

## Positive Context Git blob IDs

| Context | Git blob SHA |
|---|---|
| `context/fingerprint-path-set-mismatch.json` | `542c5c6748fc5056c1fb4a080d9e2a4f8995789e` |
| `context/identity-source-reference-unresolvable.json` | `9c42e9626e484a2b0c830a845097467450dfcd47` |
| `context/credentialed-project-repository.json` | `37ea051aae40443abfe425c59e46282962bac9fe` |

## Negative Context Git blob IDs

| Context | Rejection reason | Git blob SHA |
|---|---|---|
| `context-invalid/unknown-core-field.json` | Unknown top-level field | `60da605c96967a46f04dcfc00876071943fa1c40` |
| `context-invalid/arbitrary-driver-command.json` | Unknown executable command field under Driver reference | `6d633567f3e9299a27565a5c8d02df0576c89c06` |
| `context-invalid/provider-authoritative-not-found-without-auth.json` | Authoritative not-found requires accepted authentication, authority flag and evidence reference | `7e9f241c05abbea84f04984e7a63304e2725cafa` |
| `context-invalid/missing-capability-profile-blob.json` | Missing required immutable profile blob SHA | `9bf81a48cd90ac9ae2b0230b49c88f9496e8ee78` |
| `context-invalid/packet-path-escapes-repository.json` | Packet artifact path escapes the repository root | `3b965d4cdf22453e019866d741bef463a544ac14` |

The Git blob SHA of each positive and negative instance was recalculated locally from the exact pretty-printed UTF-8 JSON bytes (including the final newline) and matched the GitHub blob SHA above.

## Pinned Capability Profile blob IDs

| Profile | Git blob SHA |
|---|---|
| `packet-only` | `a44342ea0007981a786784af61c44e36f101548b` |
| `local-git-contract` | `b0fc0273870f4591e5a53a51db7d189c012c826c` |
| `provider-stub` | `7784c321f69e5f812b2bca22184ca13335c985e1` |

## Pinned Provider authority contract artifact

| Contract | Git blob SHA |
|---|---|
| `github-rest-fixture-not-found-semantics/1` | `6573628ce89d1e9f0e43ad2ecc341dc99b29e887` |

This is synthetic local-stub fixture evidence only. It is not documentation or a claim about the behavior of the real GitHub API.

## Pinned Driver descriptor bundle digests

The values below are SHA-256 over the exact UTF-8 descriptor file bytes, including the final newline. The descriptors are marked `contract_only`; these hashes pin their descriptor bytes, **not executable Driver bundles**.

| Driver ID | SHA-256 |
|---|---|
| `packet.locator.inspection` | `sha-256:161a7df5bbc28e9cf61bca0080d9a433b8ac247df8058898bee21b16c1be3222` |
| `git.path-set.mismatch` | `sha-256:27a0df17005a22f3da6901c45c768a8fbbdd9a34e8eea67b1d7c5493173e37e9` |
| `provider.identity.lookup` | `sha-256:fb274c2eca75fdbaa9ad97f8e94bdfeb5a04bc2bf4757fe5abed6f593136770b` |

All three descriptor SHA-256 values were recalculated from the fetched file bytes and matched the values pinned by the Context instances.

## Interpretation and limits

- The current Schema blob `9348e22ac0ee450ce6689cec4fb87f0aa985104c` passed the Draft 2020-12 meta-schema check.
- The 3 positive and 5 negative instances listed above were validated with this exact Schema using `Draft202012Validator(schema, format_checker=FormatChecker())`. Their reconstructed canonical JSON bytes were checked against the Git blob IDs; all 8 matched the repository's exact blob IDs.
- All three Context instances pin source repository revision `1670320ea980368ed74cd4edd11cba4297467bde`, which was verified to contain the exact Packet, Packet Schema, Profile, Driver descriptor and Provider contract artifacts they reference. The Context instances also pin the Packet Schema blob `a2f2097a17c08bf0a2ae733ab43a8f1919b48813` and the individual Packet Git blob IDs. Context validation does not revalidate those Packet instances; the separate Packet report is `schemas/scp/0.2/fixtures/VALIDATION-REPORT.md`.
- The authoritative not-found Context pins the synthetic provider evidence artifact above. A boolean authority flag without this artifact reference is rejected.
- Profile references are immutable Git blob references. Registry-level capability resolution remains a Harness responsibility.
- Driver descriptors are `contract_only`; no executable Driver implementation, allow-list Registry, Runner or adapter exists.
- The tests validate JSON Schema structure and declared formats only. No disposable Git repository, provider stub, filesystem mutation or client observation was executed.
- Actual Run Manifests, Semantic Validator, Fixture Runner, client adapters and CI gate are not implemented.
- The existing Standards CI workflow does not validate this Context Schema; the results above come from the independent Python Validator run.
- Context Schema 0.1.0 remains Draft. This report does not freeze D1, D2, D3 or the separate Context Contract.
