# VERDICT — Complete Feature & USP Inventory

This document provides a line-by-line audit of every core capability, verified differentiator (USP), and proposed enhancement in VERDICT, detailing implementation status, code locations, API routes, automated tests, and limitations.

---

## 1. Core Platform Capabilities

| Capability | Implementation Status | Primary Source Files | API / UI Entry Points | Automated Test Evidence | Limitations & Disclosures |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Three Regional Nodes** | `IMPLEMENTED_AND_TESTED` | [`packages/region-service/src/index.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/index.ts) | Ports 4001, 4002, 4003 | [`service.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/service.test.ts) | Local OS processes on loopback ports; not cloud regions |
| **Local Persistence** | `IMPLEMENTED_AND_TESTED` | [`packages/region-service/src/store/file-store.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/store/file-store.ts) | `data/*.db.json` | [`failover.test.ts:183`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts#L183) | JSON snapshot serialization; not distributed SQL engine |
| **Transactional Outbox** | `IMPLEMENTED_AND_TESTED` | [`packages/region-service/src/sync/sync-engine.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/sync/sync-engine.ts) | `store.addToOutbox()`, `store.getOutbox()` | [`e2e-ps2.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/e2e-ps2.test.ts) | Drained periodically on 1500ms heartbeat loop |
| **Partition Simulation** | `IMPLEMENTED_AND_TESTED` | [`packages/region-service/src/network/link-controller.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/network/link-controller.ts) | `POST /admin/link`, UI Regions View | [`failover.test.ts:210`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts#L210) | In-memory link gate; binary up/down and latency simulation |
| **Causal Version Vectors** | `IMPLEMENTED_AND_TESTED` | [`packages/core/src/vector.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/vector.ts) | `compareVectors()`, `mergeVectors()` | [`core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts) | Vector length scales with cluster node count (3 nodes) |
| **Causal Conflict Folding** | `IMPLEMENTED_AND_TESTED` | [`packages/core/src/policy.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/policy.ts) | `foldOperations()` | [`failover.test.ts:210`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts#L210) | Conflicting fields preserved as `AWAITING_REVIEW`; never LWW |
| **Cryptographic Signatures** | `IMPLEMENTED_AND_TESTED` | [`packages/core/src/crypto.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/crypto.ts) | `calculateOpHash()`, `createSignedOp()` | [`core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts) | Pre-seeded deterministic seed keys for demo reproducibility |
| **Canonical State Hashing** | `IMPLEMENTED_AND_TESTED` | [`packages/core/src/convergence.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/convergence.ts) | `GET /api/v1/convergence` | [`convergence.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/convergence.test.ts) | Sorts entity keys and claims to eliminate nondeterminism |

---

## 2. Signature Differentiators (Verified USPs)

### USP 1 — SAFE-ROUTE: Consistency-Aware Regional Failover
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/web/src/api/client.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/api/client.ts), [`packages/web/src/components/Shell.tsx`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/components/Shell.tsx)
- **Mechanisms:**
  - Deterministic fallback ring order: Mumbai &rarr; Delhi &rarr; Bengaluru.
  - Safe read failover (`readWithFailover`) triggers only on connection failure or HTTP 5xx; client errors (400, 404) are returned directly without failover.
  - UI top bar explicitly displays `Serving Primary (MUMBAI)` or `Degraded Failover: Served via DELHI`.
  - Escrow spending is strictly fenced (`EscrowQuotaFenceError`), preventing automatic cross-region quota diversion.
  - Throws `AllRegionsUnavailableError` when all cluster nodes are unreachable.
- **Tests:** [`packages/region-service/test/failover.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts) (Scenarios 1, 2, 3, 8).

### USP 2 — PROVE-ONCE: Duplicate-Safe Writes & Explicit Outcomes
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/web/src/api/client.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/api/client.ts), [`packages/region-service/src/sync/sync-engine.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/sync/sync-engine.ts), [`packages/region-service/src/server.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/server.ts)
- **Mechanisms:**
  - Client injects stable `clientTxId` across retries.
  - Server-side deduplication in `SyncEngine.submitLocalOp()` and `applyIncomingOp()` checks existing operations and returns existing commitments without duplicate sequence assignment.
  - Decisions endpoint (`POST /api/v1/decisions`) checks existing decision IDs before creating receipts.
  - Endpoint `GET /api/v1/tx/:clientTxId` provides direct transaction lookup.
  - Cluster reconciliation (`queryOperationOutcome`):
    - `COMMITTED`: Verified present on reachable replica.
    - `NOT_COMMITTED`: Verified absent across all cluster replicas.
    - `UNKNOWN`: In-flight timeout or candidate replicas unreachable. An operation missing from one replica is **never** falsely declared `NOT_COMMITTED`.
- **Tests:** [`packages/region-service/test/failover.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts) (Scenarios 4, 5, 9, 10).

### USP 3 — RECOVERY-PROOF: Measured Recovery Verification Scorecard
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/region-service/src/recovery/recovery-harness.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/recovery/recovery-harness.ts), [`scripts/run-recovery-proof.js`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/scripts/run-recovery-proof.js), [`packages/web/src/views/LabView.tsx`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/views/LabView.tsx)
- **Mechanisms:**
  - Executes an isolated deterministic recovery scenario in OS temporary directory without touching demo databases.
  - Records real measured timestamps: restoration time (2–3 ms), sync time (25–35 ms), time to convergence (28–38 ms).
  - Verifies 100% of acknowledged writes survive across both restored replicas (7/7 tested).
  - Verifies duplicate write prevention during partition (1 prevented).
  - Verifies conflict preservation (`AWAITING_REVIEW`) and canonical state hash match (`computeCanonicalStateHash`).
  - Scorecard rendered in the Lab view with on-demand trigger and CLI script.
- **Tests:** [`packages/region-service/test/failover.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts) (Scenarios 6, 7, 11).

### Decision Gate (`evaluateDecisionGate`)
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/core/src/gate.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/gate.ts)
- **Mechanisms:**
  - Pure deterministic evaluator assessing 7 operational rules: Conflict clean, Cryptographic integrity, Authority reachability (Blind-spot rule), Observation freshness window, Cross-region replication, Escrow quota, Reviewer confirmation role.
  - Aggregates to `GO`, `CAUTION`, or `HOLD`.
  - Produces actionable explanation tree and `whatWouldChange` remedies.
- **Tests:** [`packages/core/test/core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts).

### Conflict Blast Radius (`reevaluateDecision`)
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/core/src/reevaluation.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/reevaluation.ts)
- **Mechanisms:**
  - Decisions capture cryptographic dependency snapshots.
  - Post-merge synchronization re-evaluates past decision receipts against merged state.
  - Categorizes outcomes as `STILL_VALID`, `NEEDS_RECHECK`, or `INVALIDATED` (e.g. road was OPEN at dispatch time, but newer post-merge update reveals it is BLOCKED).
- **Tests:** [`packages/core/test/core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts).

### Escrow Bounded Counters
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/core/src/escrow.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/escrow.ts)
- **Mechanisms:**
  - Scarce divisible supplies (medical kits, rescue boats) allocate partitioned quotas ($\sum \text{rights} \le \text{Total}$).
  - Regions spend local quota independently during partitions; requests exceeding quota queue as unmet demand.
  - Mathematical invariant $\sum \text{spent} \le \text{Total}$ holds under all partition schedules. Verified in 5/3/4 test case.
- **Tests:** [`packages/core/test/core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts).

### Fog of Information
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/core/src/fog.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/fog.ts), [`packages/web/src/views/MapView.tsx`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/views/MapView.tsx)
- **Mechanisms:**
  - Leaflet map layer renders an indigo-grey hatch pattern veil over territories of unreachable regions.
  - Displays elapsed contact timer and "operations revealed" count upon reconnection.

### PR-Style Merge Reports
- **Status:** `IMPLEMENTED_AND_TESTED`
- **Source Files:** [`packages/region-service/src/sync/sync-engine.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/sync/sync-engine.ts), [`packages/web/src/views/MergeReportsView.tsx`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/views/MergeReportsView.tsx)
- **Mechanisms:**
  - Partitions tracked as `PartitionEpisode` records (`ep-<timestamp>`).
  - Upon link recovery, compiles countable diff report: local ops, remote ops, conflicts surfaced, decisions re-evaluated, and measured delta bandwidth savings (~97% reduction over full-state snapshots).

---

## 3. Proposed Enhancements Audit

| Proposed Feature Name | Actual Status in Codebase | Overlap with Existing Architecture | Location / Evidence |
| :--- | :--- | :--- | :--- |
| **Dependency-Cone Recovery (DCR)** | `IMPLEMENTED_AND_TESTED` | Expedited recovery of prerequisite causal dependency graph before bulk outbox drain | [`packages/core/src/dcr.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/src/dcr.ts), [`dcr.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/dcr.test.ts) (17 tests) |
| **Session Continuity Capsule** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Overlaps with client-side failover state in `ApiClient`; no distinct cryptographic capsule token exists | Not found in codebase |
| **Failover Router** | `PARTIAL` | Functionality integrated directly into `ApiClient` class (`readWithFailover`, `writeWithIdempotency`, `FALLBACK_RINGS`); not a standalone proxy microservice | [`packages/web/src/api/client.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/api/client.ts) |
| **Outcome Ledger** | `PARTIAL` | Transaction commit status is stored directly in durable append-only operation log and queried via `GET /api/v1/tx/:clientTxId`; not a separate table/service | [`packages/region-service/src/server.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/src/server.ts) |
| **Continuity Oracle** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Conceptually handled by `ApiClient.queryOperationOutcome()`; no standalone oracle process exists | Not found in codebase |
| **Recovery Leverage Scheduling** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Overlaps with existing 4-tier Priority Lanes (L0–L3) in `SyncEngine`; no dynamic graph leverage algorithm exists | Not found in codebase |
| **Conflict-Budget Admission** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Not implemented; observations are accepted unconditionally offline (AP) | Not found in codebase |
| **Gray-Failure Detection** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Link failures are modeled as binary up/down via `LinkController`; no packet-loss degradation heuristics | Not found in codebase |
| **Epoch-Fenced Session Ownership** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Single-writer ownership is static by designated home region (Mumbai authority); no dynamic epoch leasing | Not found in codebase |
| **Production-Grade Load Balancing** | `PROPOSED_ONLY` / `NOT_IMPLEMENTED` | Web client talks directly to ports 4001, 4002, 4003; no L4/L7 load balancer exists | Documented in `06_LOAD_BALANCER_ASSESSMENT.md` |
