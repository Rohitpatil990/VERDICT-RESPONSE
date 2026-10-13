# VERDICT — Test Execution Record & Operator Runbook

This document records the exact test suites executed against the VERDICT codebase, verified pass/fail results, and operational runbook commands for judges and operators.

---

## 1. Automated Test Execution Record

Vitest was executed across the entire monorepo workspace. **All 52 tests passed (100% pass rate).**

```
 RUN  v2.1.9 C:/Users/Rohit Patil/OneDrive/Documents/Final_PrintWinners

 ✓ packages/core/test/core.test.ts (10 tests) 106ms
 ✓ packages/region-service/test/service.test.ts (3 tests) 670ms
 ✓ packages/region-service/test/convergence.test.ts (10 tests) 726ms
 ✓ packages/region-service/test/e2e-ps2.test.ts (1 test) 761ms
 ✓ packages/region-service/test/dcr.test.ts (17 tests) 912ms
 ✓ packages/region-service/test/failover.test.ts (11 tests) 1239ms

 Test Files  6 passed (6)
      Tests  52 passed (52)
   Duration  4.26s
```

### Detailed Suite Breakdown

| Suite File | Scope & Invariants Tested | Tests | Result | Duration |
| :--- | :--- | :---: | :---: | :---: |
| [`packages/core/test/core.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/core/test/core.test.ts) | • Ed25519 signature validity & tamper detection<br>• Version vector supremacy & concurrency<br>• Decision Gate 7-check evaluation (`GO`, `CAUTION`, `HOLD`)<br>• Escrow bounded counters (5/3/4 invariant conservation)<br>• Conflict Blast Radius decision re-evaluation | 10 | **PASS ✓** | 106 ms |
| [`packages/region-service/test/service.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/service.test.ts) | • Fastify HTTP endpoints (`/api/v1/status`, `/api/v1/reports`, `/api/v1/decisions/evaluate`)<br>• Swagger documentation initialization | 3 | **PASS ✓** | 670 ms |
| [`packages/region-service/test/e2e-ps2.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/e2e-ps2.test.ts) | • End-to-end CodeAstra PS #2 lifecycle<br>• Permitted partition writes<br>• Reconnection and outbox replay<br>• Conflict detection on road corridor | 1 | **PASS ✓** | 761 ms |
| [`packages/region-service/test/convergence.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/convergence.test.ts) | • Canonical state hashing (`computeCanonicalStateHash`)<br>• Normalization excluding observation time drift<br>• Detection of divergence (`DIVERGED`)<br>• Resolution of conflicts to `CONVERGED` | 10 | **PASS ✓** | 726 ms |
| [`packages/region-service/test/dcr.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/dcr.test.ts) | • Dependency-Cone Recovery (DCR) causal graph traversal<br>• Fast-path recovery ordering for blocked operations<br>• Missing prerequisite and conflict blocker detection | 17 | **PASS ✓** | 912 ms |
| [`packages/region-service/test/failover.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts) | • **USP 1 (SAFE-ROUTE):** Scenarios 1, 2, 3, 8 (Deterministic fallback ring, degraded serving indicator, escrow quota fence, all-down safety)<br>• **USP 2 (PROVE-ONCE):** Scenarios 4, 5, 9, 10 (In-flight timeout `UNKNOWN`, stable `clientTxId` deduplication, cluster reconciliation, decision idempotency)<br>• **USP 3 (RECOVERY-PROOF):** Scenarios 6, 7, 11 (Crash survival, conflict preservation, isolated measured scorecard verification) | 11 | **PASS ✓** | 1239 ms |

---

## 2. Production Build Verification

Both TypeScript and production Vite bundles compile cleanly:

```bash
# 1. Compile backend regional service
npm run build --workspace=@verdict/region-service
# Result: tsc exits with code 0

# 2. Compile frontend Vite production bundle
npm run build --workspace=@verdict/web
# Result: vite v5.4 built in 10.19s, generated dist/index.html, dist/assets/
```

---

## 3. Operational Runbook & Startup Commands

### Command 1: Launch Local Multi-Region Cluster
Starts all 3 regional Fastify nodes and the web dashboard in development mode:
```powershell
node scripts/dev-local.js
```
- **Web Operations Console:** `http://localhost:3000`
- **Mumbai Regional API:** `http://localhost:4001/api/v1/status`
- **Delhi Regional API:** `http://localhost:4002/api/v1/status`
- **Bengaluru Regional API:** `http://localhost:4003/api/v1/status`

### Command 2: Execute Standalone Measured RECOVERY-PROOF Verification
Runs the isolated recovery harness in the OS temporary directory without modifying active databases:
```powershell
node scripts/run-recovery-proof.js
```

**Observed Measured Output:**
```
========================================================================
  VERDICT — RECOVERY-PROOF: Measured Recovery Verification Harness      
  Classification: Local Multi-Process Simulation (Not AWS/Cloud DR)     
========================================================================

[1/4] Initializing isolated test harness in OS temp workspace...
      (Guaranteed: Live demo databases are NOT touched)

[2/4] Scenario Execution Timeline:
      • Scenario: Regional Process Loss, Partition Writes & Restored Convergence
      • Start Time: 2026-10-12T17:49:38.050Z
      • Service Restoration Time: 2 ms
      • Cross-Region Sync Time:   27 ms
      • Time to Convergence:      29 ms

[3/4] Availability During Scenario:
      • Baseline:     100% (2/2 regional nodes operational)
      • During Outage: 50% (Mumbai operational, Delhi process terminated)
      • Post-Recovery: 100% (2/2 regional nodes restored & synchronized)

[4/4] Measured Continuity & Invariant Metrics:
      • Acknowledged Writes Tested:    7
      • Acknowledged Writes Preserved:  7 (100%)
      • Missing / Lost Writes:         0
      • Duplicates Prevented:          1
      • Pending Outbox Operations:     0
      • Conflicts Detected:            1
      • Conflicts Awaiting Review:     1
      • Canonical State Hash Match:    YES (Verified)

========================================================================
  FINAL VERDICT: PASS ✓
  All 7/7 acknowledged writes verified preserved across restored replicas. Zero data loss in tested scenario. Canonical state hashes matched.
========================================================================
```

### Command 3: Execute Automated 3-Minute Live Scripted Demo
While `node scripts/dev-local.js` is running, execute in a second terminal:
```powershell
node scripts/run-demo.js
```
Walks through partition cuts, concurrent conflicting edits on `access-corridor-north`, escrow spending under partition, and reconnection merge reports automatically.

### Command 4: Safe Backup and Clean Reset
Backs up current database state with a timestamp into `data/backups/` and seeds fresh baseline data:
```powershell
node scripts/backup-and-reset.js
npm run seed
```

---

## 4. Known Environmental Gotchas & Troubleshooting

1. **Port Conflicts (3000, 4001, 4002, 4003):**
   If `dev-local.js` is already running in another terminal, running a second instance will fail with `EADDRINUSE`. Use `Get-NetTCPConnection -LocalPort 4001, 4002, 4003` to inspect existing node processes before launching.
2. **Acceptance Test Isolation:**
   Acceptance tests in [`failover.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/failover.test.ts) use dedicated isolated test ports (`5901`, `5902`, `5903`) and temporary test directories (`./data/test-failover-suite/`) to ensure they can run safely even while `dev-local.js` is active.
