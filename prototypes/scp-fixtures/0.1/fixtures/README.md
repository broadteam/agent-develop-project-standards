# Synthetic fixture vectors

The context directory contains exact working copies of the three existing Context 0.1.0 examples. Tests verify each copied file Git blob SHA-1 against the repository pin before evaluation.

The observations directory contains separately authored synthetic observation packages. Records and executed event sequences are reconciled against each Context at runtime. Capability-observation source is always synthetic_profile_fixture; it is not a live capability probe.

The client-output directory contains fixed synthetic client-response vectors. They are not captured from an Agent product and are not generated from Context expected values at test runtime. They exercise the projection/normalization/Oracle pipeline only.

| Context fixture | Context Blob SHA | Expected assertion count |
|---|---|---:|
| credentialed-project-repository | eead3afee0d0183a5bc8c5ca0c4fe5d776d184c8 | 12 |
| identity-source-reference-unresolvable | 16217a4f6aa01464e54c912d6836dec5e1f0c76f | 15 |
| fingerprint-path-set-mismatch | d3661577a6585afc65003d635768257308e688a0 | 13 |

The source Packet Schema Blob SHA used by all three Contexts is a2f2097a17c08bf0a2ae733ab43a8f1919b48813. Source repository revision: 1670320ea980368ed74cd4edd11cba4297467bde.
