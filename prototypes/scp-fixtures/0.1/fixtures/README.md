# Synthetic fixture vectors

The context directory contains exact working copies of the three existing Context 0.1.0 examples. Tests verify each copied file Git blob SHA-1 against the repository pin before evaluation.

The observations directory contains separately authored synthetic observation packages. Records and executed event sequences are reconciled against each Context at runtime. Capability-observation source is always synthetic_profile_fixture; it is not a live capability probe.

The client-output directory contains fixed synthetic client-response vectors. They are not captured from an Agent product and are not generated from Context expected values at test runtime. They exercise the projection/normalization/Oracle pipeline only.

| Context fixture | Context Blob SHA | Expected assertion count |
|---|---|---:|
| credentialed-project-repository | 37ea051aae40443abfe425c59e46282962bac9fe | 12 |
| identity-source-reference-unresolvable | 9c42e9626e484a2b0c830a845097467450dfcd47 | 15 |
| fingerprint-path-set-mismatch | 542c5c6748fc5056c1fb4a080d9e2a4f8995789e | 13 |

The source Packet Schema Blob SHA used by all three Contexts is a2f2097a17c08bf0a2ae733ab43a8f1919b48813. Source repository revision: 1670320ea980368ed74cd4edd11cba4297467bde.
