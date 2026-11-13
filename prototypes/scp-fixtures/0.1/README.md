# SCP Fixture Adapter Prototypes 0.1

**Status:** Executable local prototype only. Not production-ready and not a normative machine contract.

## What this prototype proves

This directory contains two independently authored implementations of the current design candidate:

- Node.js: adapter/projection, strict result normalizer and Oracle evaluator.
- Python: adapter/projection, strict result normalizer and Oracle evaluator.

Both implementations use only their respective standard libraries. Neither imports, shells out to, or calls the other implementation. They consume the same three pinned Context fixtures and separately authored synthetic observation/client-response vectors.

The test suite covers strict UTF-8 and duplicate JSON-member rejection, unpaired surrogates, exact Context Git blob SHA-1 verification, immutable reference propagation, values-stripped projection descriptors, observation/profile reconciliation, normalized enum/value validation, absent versus explicit unknown, empty set versus absent, null rejection, duplicate keys/members, unsupported fields, exact Unicode identifiers, non-conformance and pre-evaluation not_run. It also compares the generated request, normalized result and Oracle report byte-for-byte across implementations.

## Run

From the repository root:

    sh prototypes/scp-fixtures/0.1/run-parity.sh

Requirements: Node.js 20+ and Python 3.10+. No third-party package is required.

The script creates a fresh temporary directory outside the repository, generates artifacts there, compares nine outputs byte-for-byte, and removes the temporary directory on exit.

## Important limitations

1. Context files are exact working copies of the three existing repository fixtures. Their Git blob IDs are checked locally before use.
2. Packet, Packet Schema, Profile, Driver and Provider references are propagated as immutable pins; this prototype does not dereference and independently verify all remote/repository artifacts.
3. Existing Driver descriptors remain contract_only. No Driver executes.
4. Observation packages and client-output files are fixed synthetic vectors. No actual Git worktree, filesystem capability probe, Provider endpoint or live observer ran.
5. Client-output files are synthetic responses. No ChatGPT, Claude, Codex or other Agent client was invoked. A simulated conformant Oracle result proves only that a fixed response vector matches the expected projection; it is not Agent conformance evidence.
6. Tests verify that the Client Evaluation Request omits the full Context, expected values, assertion outcomes and oracle members. They do not provide OS-level process/container sandboxing or prove isolation against an Agent with unrestricted host access.
7. Raw-response secret scanning/redaction, disposable-root ownership, cleanup quarantine, immutable Run Manifest storage, retry persistence and finalization are not implemented.
8. No Normalized Result or Run Manifest Schema, Writer, Store, Runner, Harness Registry, executable Driver Bundle, CI gate or production write API is included.

Use these prototypes to review implementation divergence and tighten the interface. Do not describe their synthetic outputs as cross-Agent interoperability or production-ready security evidence.


## Validation provenance

The validation report distinguishes the local development working-copy run from the exact files committed to the current PR Head. The committed prototype script is intended to be rerun after checkout; the existing repository CI does not execute this prototype suite. No CI workflow or gate was added.
