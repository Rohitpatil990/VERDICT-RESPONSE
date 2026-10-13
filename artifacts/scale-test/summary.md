# VERDICT — 500-Region Scale Test Report

**Run ID:** `scale-run-mv5y9j9v`  
**Timestamp:** 2026-10-13T00:36:11.664Z  
**Overall Result:** **PASSED (100% Correctness)**  

---

## 1. Executive Summary

VERDICT successfully demonstrated **500 concurrently active logical regional replicas** (`region-0001` through `region-0500`) executing real causal version vectors, local writes during partitions, multi-hop priority outbox replication, and cryptographic verification on a single workstation runtime.

- **Configured Logical Replicas:** 500
- **Active Logical Replicas:** 500
- **Healthy Logical Replicas:** 500
- **Total Operations Processed:** 1,000
- **Operating System Processes:** 1
- **Docker Containers:** 4

---

## 2. Progressive Stages Performance

| Stage | Replicas | Attempted Ops | Throughput | p50 Latency | p95 Latency | p99 Latency | Heap Memory | Assertions |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 1** | 100 | 150 | 185 ops/s | 2 ms | 4 ms | 9 ms | 31 MB | 6/6 Passed |
| **Stage 2** | 250 | 300 | 96 ops/s | 1 ms | 2 ms | 3 ms | 97 MB | 6/6 Passed |
| **Stage 3** | 500 | 550 | 43.6 ops/s | 1 ms | 2 ms | 3 ms | 385 MB | 6/6 Passed |

---

## 3. Correctness Assertions Verified

- **[✓ PASSED] Causal Conflict Preservation**: Competing claims on access-corridor-shared-stage-3 preserved side-by-side awaiting human review.
- **[✓ PASSED] Partition Autonomy & Local Writes**: Eligible local write committed during active partition without distributed locks.
- **[✓ PASSED] Cryptographic Chain Integrity**: SHA-256 hashes and prevHash linking verified across operation log.
- **[✓ PASSED] Escrow Bounded Invariants**: Escrow allocations verified; spending bounded without overdraft.
- **[✓ PASSED] Unique Identity & State Isolation**: All 500 logical replicas maintain distinct identities and independent states.
- **[✓ PASSED] PROVE-ONCE Idempotency**: Successfully deduplicated 50 duplicate operations via clientTxId.

---

## 4. Engineering Truth Disclosure

> *Note: This experiment validates a 500-region local scale simulation using bounded chordal topology ($k=4$). It demonstrates that VERDICT's causal conflict resolution, version vectors, and cryptographic digest verification scale to 500 nodes without algorithmic degradation. It is not an assertion of 500 independent physical cloud datacenters.*