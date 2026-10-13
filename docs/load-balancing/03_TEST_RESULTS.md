# VERDICT — Load Balancer Acceptance Test Results & Performance Metrics

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Test Suite:** [`packages/region-service/test/gateway.test.ts`](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/region-service/test/gateway.test.ts)  
**Execution Tool:** Vitest v2.1.9  
**Execution Timestamp:** 2026-10-13T01:16:01Z  

---

## 1. Summary of Test Execution

| Suite | File Path | Total Tests | Passed | Failed | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gateway & Load Balancer** | `packages/region-service/test/gateway.test.ts` | 8 | 8 | 0 | 108 ms |
| **Failover & PROVE-ONCE** | `packages/region-service/test/failover.test.ts` | 11 | 11 | 0 | 1,043 ms |
| **Dependency-Cone Recovery** | `packages/region-service/test/dcr.test.ts` | 17 | 17 | 0 | 985 ms |
| **Hash Convergence Verification**| `packages/region-service/test/convergence.test.ts` | 10 | 10 | 0 | 670 ms |
| **Service Integration** | `packages/region-service/test/service.test.ts` | 3 | 3 | 0 | 644 ms |
| **End-to-End PS #2 Workflow** | `packages/region-service/test/e2e-ps2.test.ts` | 1 | 1 | 0 | 625 ms |
| **Core Distributed Engine** | `packages/core/test/core.test.ts` | 10 | 10 | 0 | 86 ms |
| **Total Monorepo Regression**| **7 Suites** | **60** | **60** | **0** | **4.51 s** |

---

## 2. Detailed Breakdown of Phase 5 Acceptance Tests

### Test A — Healthy-Node Distribution Across Eligible Requests
- **Objective:** Verify that eligible stateless read queries are distributed across healthy candidate nodes without hot-spotting.
- **Observed Behavior:** Sent 4 consecutive GET requests to `/api/v1/records/road-*`.
  - Request #1 $\to$ `mumbai` (`ROUND_ROBIN`)
  - Request #2 $\to$ `delhi` (`ROUND_ROBIN`)
  - Request #3 $\to$ `bengaluru` (`ROUND_ROBIN`)
  - Request #4 $\to$ `mumbai` (`ROUND_ROBIN`)
- **Result:** **PASS** (100% deterministic distribution cycling).

### Test B — Unavailable Service Exclusion and Automatic Fallback
- **Objective:** Simulate a node outage (Mumbai marked down) and verify that the gateway excludes it from the rotation and routes targeted reads to the next healthy peer.
- **Observed Behavior:**
  - Mumbai excluded; healthy pool reduced to `['delhi', 'bengaluru']`.
  - Stateless reads distributed exclusively between Delhi and Bengaluru.
  - Sticky read with `X-Preferred-Region: mumbai` deterministically failed over to `delhi` (`FAILOVER`).
- **Result:** **PASS**.

### Test C — All Services Unavailable
- **Objective:** Verify that when all 3 backends are offline, the gateway returns a clean HTTP 503 error without entering an infinite retry loop or hanging connections.
- **Observed Behavior:** Returned immediate structured error:
  `"All regional service instances are currently unavailable."` in 1 ms.
- **Result:** **PASS**.

### Test D — Service Recovery Re-eligibility
- **Objective:** Verify that when a recovered backend passes its health probe, the gateway immediately re-admits it to the active round-robin pool.
- **Observed Behavior:** Bengaluru marked recovered; subsequent read queries immediately included Bengaluru in the round-robin rotation.
- **Result:** **PASS**.

### Test E — Data Correctness & Escrow Quota Fencing
- **Objective:** Prove that authority-sensitive escrow spends cannot be arbitrarily load-balanced to alternative regions.
- **Observed Behavior:**
  - Healthy Delhi permits authoritative spend (`AUTHORITATIVE_FENCED`).
  - When Delhi is marked down, an escrow spend targeting Delhi is rejected with `EscrowQuotaFenceError` (HTTP 409) rather than being blindly redirected to Mumbai or Bengaluru.
- **Result:** **PASS**.

### Test F — Ambiguous Write Idempotency Protection
- **Objective:** Ensure stable client transaction identity headers (`x-client-tx-id`) are preserved during request forwarding.
- **Observed Behavior:** Client transaction ID `tx-abc-12345` was captured and forwarded without alteration.
- **Result:** **PASS**.

### Test G — Diagnostic Endpoint Real-Time Reflection
- **Objective:** Verify that `/api/v1/lb/status` reflects accurate backend health, probe latencies, and request counts.
- **Observed Behavior:** HTTP GET to `/api/v1/lb/status` returned valid JSON containing all 3 backend states and active request counters.
- **Result:** **PASS**.

### Test H — Local Concurrent Request Test & Performance Measurement
- **Objective:** Measure routing latency and request distribution under concurrent local load.
- **Configuration:** 30 concurrent read requests.
- **Measured Metrics:**
  - Requests Attempted: **30**
  - Successful Responses: **30**
  - Failures: **0**
  - Regional Distribution:
    - Mumbai: **10** (33.3%)
    - Delhi: **10** (33.3%)
    - Bengaluru: **10** (33.3%)
  - Total Routing Duration: **< 100 ms** (Average route decision latency < 0.5 ms)
- **Result:** **PASS**.
