# VERDICT Benchmark Report
*Generated on 2026-10-12T12:26:58.438Z*

### Host Environment
- **Platform:** win32 (x64)
- **CPUs:** AMD Ryzen 5 6600H with Radeon Graphics          (12 cores)
- **Node.js:** v24.12.0
- **Machine Memory:** 15 GB

### Measured Performance
| Component | Metric | Latency |
|---|---|---|
| Canonical JSON Serialization | 1,57,763 ops/sec | 0.0063 ms |
| SHA-256 Operation Hashing | 46,188 ops/sec | 0.0217 ms |
| Ed25519 Digital Signing | 921 ops/sec | 1.09 ms |
| Ed25519 Signature Verification | 279 ops/sec | 3.59 ms |
| Version Vector Causal Compare | 21,83,320 ops/sec | 0.00046 ms |
| Conflict Policy Folding | 2,67,814 ops/sec | 0.0037 ms |
| Decision Gate Evaluation | 3,76,610 ops/sec | 0.0027 ms |
| Escrow Bounded Counter Spend | 24,81,266 ops/sec | 0.0004 ms |
| Haversine Geodetic Distance | 50,69,966 ops/sec | 0.00020 ms |

*Rule of Honesty: All numbers measured directly on this local machine via `npm run bench`. No extrapolation to theoretical global scale.*
