# VERDICT — Load Balancer Demonstration & Operator Runbook

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Component:** Consistency-Aware Gateway & Load Balancer  
**Working Directory:** `C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners`  

---

## 1. Startup Procedure

To launch the complete environment (Web Dashboard, Gateway, and 3 Regional Nodes) from a single terminal:

```powershell
node scripts/dev-local.js
```

### Active Port Allocation

| Process | URL | Role |
| :--- | :--- | :--- |
| **Web Operations Console** | **`http://localhost:3000`** | Enterprise SaaS React dashboard |
| **VERDICT Gateway (LB)** | **`http://localhost:4000`** | Consistency-aware reverse proxy & load balancer |
| **Mumbai Region Node** | `http://localhost:4001` | Regional replica #1 (Primary Authority) |
| **Delhi Region Node** | `http://localhost:4002` | Regional replica #2 |
| **Bengaluru Region Node** | `http://localhost:4003` | Regional replica #3 |

---

## 2. Step-by-Step Live Demonstration Script for Judges

### Demo 1: Multi-Region Load Distribution (All Nodes Healthy)

**Objective:** Prove that eligible stateless read queries are dynamically balanced across Mumbai, Delhi, and Bengaluru without operator intervention.

1. **Dashboard Demonstration:**
   - Navigate to the **Regions** tab (`http://localhost:3000`).
   - Locate the card titled **"Consistency-Aware Gateway & Load Balancer"**.
   - Click the button: **"Simulate 3 Balanced Reads"**.
   - **Observable Outcome:**
     The live trace displays:
     - `Req #1 → MUMBAI [ROUND_ROBIN]`
     - `Req #2 → DELHI [ROUND_ROBIN]`
     - `Req #3 → BENGALURU [ROUND_ROBIN]`
2. **Terminal / CLI Demonstration:**
   Run three consecutive requests to the gateway on port 4000:
   ```powershell
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   ```
   **Observable Outcome:** Look at the `X-VERDICT-Serving-Region` header in the responses. Each response alternates: `mumbai` $\to$ `delhi` $\to$ `bengaluru`.

---

### Demo 2: Single Node Outage & Automatic Exclusion

**Objective:** Prove that when one regional service becomes unreachable, the gateway immediately excludes it from the rotation and routes traffic to the remaining healthy replicas.

1. **Simulate Outage via Diagnostics API:**
   ```powershell
   curl -X POST http://localhost:4000/api/v1/lb/override-health -H "Content-Type: application/json" -d "{\"region\":\"mumbai\",\"healthy\":false,\"reason\":\"Simulated power failure\"}"
   ```
2. **Send Eligible Reads:**
   ```powershell
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   ```
   **Observable Outcome:** The gateway only routes between `delhi` and `bengaluru`. Mumbai is never selected.
3. **Verify Sticky Failover:**
   Send a request explicitly requesting Mumbai:
   ```powershell
   curl -i http://localhost:4000/api/v1/status -H "X-Preferred-Region: mumbai"
   ```
   **Observable Outcome:** Returns HTTP 200 with headers:
   - `X-VERDICT-Routing-Mode: FAILOVER`
   - `X-VERDICT-Serving-Region: delhi`

---

### Demo 3: Node Recovery & Automatic Re-admission

**Objective:** Demonstrate that a recovering node is re-integrated into the active pool without restarting the gateway.

1. **Restore Node Health:**
   ```powershell
   curl -X POST http://localhost:4000/api/v1/lb/override-health -H "Content-Type: application/json" -d "{\"region\":\"mumbai\",\"healthy\":true}"
   ```
2. **Send Read Queries:**
   ```powershell
   curl -i http://localhost:4000/api/v1/records/access-corridor-north
   ```
   **Observable Outcome:** Mumbai is immediately re-admitted to the active round-robin rotation.

---

### Demo 4: Data Correctness & Escrow Quota Fencing

**Objective:** Prove that the gateway strictly protects distributed consistency and refuses to load-balance authority-sensitive operations.

1. **Mark Delhi as Unhealthy:**
   ```powershell
   curl -X POST http://localhost:4000/api/v1/lb/override-health -H "Content-Type: application/json" -d "{\"region\":\"delhi\",\"healthy\":false}"
   ```
2. **Attempt Escrow Spend on Delhi:**
   ```powershell
   curl -i -X POST http://localhost:4000/api/v1/escrow/spend -H "Content-Type: application/json" -H "X-Preferred-Region: delhi" -d "{\"resource\":\"medical_kits\",\"qty\":1}"
   ```
3. **Observable Outcome:**
   The gateway **blocks** the request with **HTTP 409 Conflict**:
   ```json
   {
     "error": "Escrow quota fence: Cannot load-balance spendEscrow to alternative region. Quotas are strictly fenced to [DELHI].",
     "routingMode": "AUTHORITATIVE_FENCED",
     "targetRegion": "delhi"
   }
   ```
   **Judge Explanation:** *"Notice that unlike naive load balancers that would route this spend to Mumbai or Bengaluru, VERDICT's gateway understands that supply budgets belong strictly to Delhi's territory. Bypassing Delhi would violate regional quota invariants."*
