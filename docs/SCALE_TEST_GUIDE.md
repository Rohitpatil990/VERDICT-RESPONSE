# VERDICT — 500 Regional Replicas Scale Test Guide

## 1. Overview & Objective

This guide explains how to build, run, stress-test, and verify **500 Concurrent Regional Replicas** (`region-0001` through `region-0500`) for **CodeAstra 2.0 (Problem Statement #2: Geo-Distributed Disaster Data Replication)**.

The scale test demonstrates that VERDICT's causal conflict detection, transactional outbox replication, Ed25519 cryptographic signatures, SHA-256 hash chains, escrow resource bounds, and PROVE-ONCE idempotency scale robustly across 500 concurrent logical nodes without architectural failure or memory exhaustion.

---

## 2. Prerequisites & System Requirements

- **Operating System:** Windows 10/11, macOS, or Linux
- **Runtime:** Node.js v20.x or v22.x LTS, npm v10.x+
- **Hardware:**
  - Minimum 4 CPU cores
  - Minimum 2 GB free RAM (scale test consumes ~364 MB peak heap)
  - 500 MB free disk space for test artifacts and logs
- **Docker (Optional):** Docker Desktop v4.20+ with Docker Compose v2 for multi-container deployment.

---

## 3. Build & Installation

From the project root:

```powershell
# 1. Install dependencies across all monorepo workspaces
npm install

# 2. Build core library, regional service, and web dashboard
npm run build
```

Verify that all existing acceptance and unit tests pass:

```powershell
npm test
```

---

## 4. How to Execute the Scale Test

### Option A: Command-Line Interface (Recommended for Automated CI/CD)

Run the automated 3-stage harness directly:

```powershell
npm run scale-test
```

This runs `scripts/run-scale-test.js`, executing:
1. **Stage 1 (100 Replicas):** Chordal ring mesh ($k=4$, 200 links). 110 operations, baseline replication, concurrency tests.
2. **Stage 2 (250 Replicas):** Chordal ring mesh ($k=4$, 500 links). 275 operations, duplicate delivery, partition resilience.
3. **Stage 3 (500 Replicas):** Chordal ring mesh ($k=4$, 1,000 links). 550 operations, sustained writes, causal conflict preservation, cryptographic hash-chain verification.

### Option B: Interactive Judge Dashboard

1. Start the VERDICT multi-region development stack:
   ```powershell
   node scripts/dev-local.js
   ```
2. Open your web browser at:
   ```
   http://localhost:3000/?tab=scale-test
   ```
3. Click the prominent **"▶ Run 500-Region Scale Test"** button. The dashboard will trigger the backend test runner and display real-time progress, throughput, latency percentiles, and assertion outcomes.

---

## 5. Workload Scenarios & Reproducibility

The workload generator (`packages/region-service/src/scale/workload-harness.ts`) executes 10 distinct distributed scenarios:

1. **Baseline Replication:** Single-hop and multi-hop gossiping across the chordal ring.
2. **Concurrent Regional Writes:** Simultaneous writes from all 500 replicas to independent state entities.
3. **High-Volume Multi-Hop Deliveries:** Routing operations through bounded peers until all replicas converge.
4. **Duplicate Delivery (PROVE-ONCE):** Sending identical `clientTxId` payloads repeatedly to verify zero duplicated side-effects.
5. **Concurrent Conflicting Updates:** Simultaneous conflicting writes to `access-corridor-shared` verifying side-by-side claim preservation for human review.
6. **Network Partition with Local Writes:** Disconnecting partition sets and verifying that eligible offline writes succeed locally.
7. **Connectivity Restoration & Reconciliation:** Re-linking partitioned regions and verifying outbox draining.
8. **Regional Service Failure & Recovery:** Simulating crashed node reboot and log replay.
9. **Signature & Hash-Chain Integrity:** Verifying Ed25519 signatures and SHA-256 tamper-evident logs.
10. **Sustained-Load Test:** High-throughput burst writes measuring memory and latency percentiles.

---

## 6. Metric Definitions

| Metric | Definition | Measurement Window / Formula |
| :--- | :--- | :--- |
| **Configured Replicas** | Number of logical node identities declared in the topology (`region-0001` .. `region-0500`). | Static target count (100, 250, 500) |
| **Active Replicas** | Replicas initialized in memory with active version vectors and outbox queues. | `state.active === true` |
| **Healthy Replicas** | Replicas reporting 0 unhandled fatal errors and passing internal invariant checks. | `healthCheck() === 'healthy'` |
| **Participating Replicas** | Replicas that authored, forwarded, or applied at least one operation during the stage. | Replicas with `opsApplied > 0` or `opsAuthored > 0` |
| **Throughput (ops/s)** | Accepted workload operations divided by stage duration in seconds. | $\text{opsAttempted} / (\text{durationMs} / 1000)$ |
| **p50 / p95 / p99 Latency** | Time in milliseconds from local write invocation to atomic local state commit. | Wall-clock elapsed time measured with `performance.now()` |
| **Multi-Hop Deliveries** | Total pairwise operation deliveries across all peer connections in the mesh. | Sum of all outbox flush transmissions across $k=4$ links |
| **State Hash Consensus** | Percentage of replicas sharing the exact same canonical SHA-256 state digest. | Replicas with equivalent state / Total active replicas |
| **Memory Footprint** | Process heap usage measured via `process.memoryUsage().heapUsed`. | Megabytes allocated |

---

## 7. How to Inspect Evidence & Results

All results are automatically persisted in `artifacts/scale-test/`:

- `summary.json`: Complete machine-readable summary of all 3 stages.
- `summary.md`: Human-readable summary report with tables.
- `metrics.csv`: Performance measurements and latency distributions.
- `region-results.json`: Per-region health, outbox depth, and version vector states.
- `operation-results.jsonl`: Traceable operation log with `clientTxId` and outcomes.
- `failed-assertions.json`: Log of any failed assertions (empty when test passes).
- `environment.json`: Host CPU, RAM, OS, Node.js version, and process metadata.
- `test-config.json`: Configuration parameters (stages, topology, links).
- `run.log`: Full verbose execution log.
- `architecture.md`: Detailed architecture documentation of the chordal ring mesh runtime.
- `VERDICT_500_REGION_SCALE_TEST.png`: Live browser screenshot captured directly from the running web console.

---

## 8. Interpreting Failures & Correctness Assertions

Every stage executes 6 strict distributed assertions:

1. **Causal Conflict Preservation:** Verifies that simultaneous writes without causal precedence are never overwritten silently by a naive Last-Write-Wins (LWW) timestamp rule. Both claims must be preserved side-by-side for reviewer adjudication.
2. **Partition Autonomy & Local Writes:** Verifies that a disconnected node continues accepting eligible local operations without blocking on quorum.
3. **Cryptographic Chain Integrity:** Verifies that every applied operation contains a valid Ed25519 signature and SHA-256 `prevHash` link.
4. **Escrow Bounded Invariants:** Verifies that resource budgets cannot be overdrafted offline.
5. **Unique Identity & State Isolation:** Verifies that all 500 regions maintain distinct states, keypairs, and sequences.
6. **PROVE-ONCE Idempotency:** Verifies that duplicate delivery of identical `clientTxId` payloads returns the cached result without modifying state twice.

If any assertion fails:
1. Check `artifacts/scale-test/failed-assertions.json`.
2. Inspect the failed operation in `artifacts/scale-test/operation-results.jsonl`.
3. Check `artifacts/scale-test/run.log` for stack traces.

---

## 9. Known Limitations to Disclose

1. **Local Scale Simulation:** 500 logical replicas running on a single physical host simulate the multi-hop routing and causal protocols of a 500-node network. They are **not** 500 physical cloud datacenters across 500 geographic continents.
2. **In-Memory Link Transport:** Peer-to-peer delivery in the 500-replica runtime uses asynchronous bounded queues rather than 1,000 open TCP sockets to prevent OS socket exhaustion.
3. **Host Hardware Ceiling:** On a 16 GB RAM developer workstation, running 500 full Node.js processes or 500 Docker containers would require 25–50 GB RAM and trigger out-of-memory kernel termination. The isolated LogicalReplica architecture allows genuine protocol stress-testing within ~364 MB heap.
