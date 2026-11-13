# Prototype validation report

**Date:** 2026-11-13  
**Status:** Local prototype checks passed; no production interoperability claim.

## Environment

- OS: Linux x86_64
- Node.js: v22.16.0
- Python: 3.13.5
- Third-party dependencies: none
- Command: sh prototypes/scp-fixtures/0.1/run-parity.sh

## Results

| Check | Result |
|---|---:|
| Pinned Context copies verified by Git blob SHA | 3 / 3 |
| Node.js test suite | PASS |
| Python test suite | PASS |
| Expected assertion projections | 12 + 15 + 13 = 40 |
| Client Evaluation Request byte comparisons | 3 / 3 equal |
| Normalized Result byte comparisons | 3 / 3 equal |
| Oracle report byte comparisons | 3 / 3 equal |
| Cross-implementation generated artifacts | 9 / 9 byte-identical |

Covered negative/edge vectors include duplicate JSON members, invalid UTF-8, unpaired surrogate, missing field, explicit unknown, empty set, missing set, null, duplicate claim key, duplicate set member, unsupported core field/enum, out-of-projection row, event-sequence mismatch, observation mismatch, profile-capability mismatch, exact Unicode identifier mismatch, value mismatch and pre-evaluation not_run.

## Interpretation

Node.js and Python independently produced byte-identical requests, normalized projections and Oracle reports for the three fixed synthetic vectors. This is evidence of parity for the implemented DTO/normalization rules only.

## Not tested / not claimed

- No Agent client was invoked.
- No real Git, filesystem, submodule or Provider observer ran.
- No executable Driver, Harness Registry, sandbox isolation, secret-redaction service, cleanup ownership/quarantine, retry store or immutable Manifest store exists.
- Packet/Schema/Profile/Driver/Provider refs are propagated as pins, but not all referenced artifacts are fetched and dereferenced by these prototypes.
- Current Drivers remain contract_only.
- Synthetic conformant means only that the fixed response vector matches this Context expected projection; it is not Agent conformance evidence.
- No Normalized Result or Run Manifest JSON Schema was created and no CI gate was changed.
