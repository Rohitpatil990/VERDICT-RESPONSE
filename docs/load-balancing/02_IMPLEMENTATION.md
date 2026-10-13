# VERDICT — Consistency-Aware Gateway & Load Balancer Implementation

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Component:** `VerdictGateway` (`packages/region-service/src/gateway/gateway.ts`)  
**Active Port:** `http://localhost:4000`  

---

## 1. Architectural Overview

To demonstrate production-inspired load balancing without violating VERDICT's distributed safety guarantees, we introduced a dedicated **Consistency-Aware Gateway Layer** on port 4000.

The Gateway sits between incoming client traffic and the three regional replicas, actively monitoring backend health and routing requests according to operation semantics.

```mermaid
graph TD
    subgraph Client ["Client Layer"]
        Web[Web Console<br>Port 3000]
    end

    subgraph Gateway ["VERDICT Gateway & Load Balancer (Port 4000)"]
        GW[VerdictGateway Fastify Service]
        HC[Active Health Prober<br>Polls /api/v1/status every 2.5s]
        Router[Semantic Route Selector]
        Stats[Routing Diagnostics & Metrics Engine]
    end

    subgraph Backends ["Regional Replicas (Loopback Ports)"]
        MB[Mumbai Region<br>Port 4001 (Authority)]
        DL[Delhi Region<br>Port 4002]
        BL[Bengaluru Region<br>Port 4003]
    end

    subgraph Data ["Local Storage & Peer Sync"]
        MStore[(mumbai.db.json)]
        DStore[(delhi.db.json)]
        BStore[(bengaluru.db.json)]
    end

    Web -->|HTTP Requests| GW
    GW --> Router
    HC -. Background Probes .-> MB
    HC -. Background Probes .-> DL
    HC -. Background Probes .-> BL
    Router -->|1. Round-Robin Reads<br>2. Sticky Reads<br>3. Fenced Writes| MB
    Router --> DL
    Router --> BL

    MB --- MStore
    DL --- DStore
    BL --- BStore

    MB <== "Priority Outbox Sync" ==> DL
    DL <== "Priority Outbox Sync" ==> BL
    MB <== "Priority Outbox Sync" ==> BL
```

---

## 2. Four Semantic Routing Modes

The gateway evaluates every incoming request against a four-tier routing policy:

### Mode 1: `ROUND_ROBIN` (Eligible Stateless Reads)
- **Applicable Routes:** `GET /api/v1/records/:id`, `GET /api/v1/map`, `GET /api/v1/fog`, `GET /api/v1/status`, `GET /api/v1/convergence/local`.
- **Precondition:** Request does not specify a strict preferred region, or includes header `X-Load-Balance: true`.
- **Behavior:** Requests cycle sequentially across healthy instances:
  $$\text{Target} = \text{HealthyNodes}[\text{index} \pmod N]$$
- **Guarantee:** Eliminates hot-spotting on the primary node during read-heavy operational queries.

### Mode 2: `STICKY_PREFERRED` (Targeted Regional Context)
- **Applicable Routes:** Requests carrying `X-Preferred-Region: <region>`.
- **Behavior:** If the preferred region is healthy, it is served directly by that node.
- **Guarantee:** Preserves "read-your-own-writes" causal monotonicity for an operator actively managing a specific geographical command post.

### Mode 3: `FAILOVER` (Deterministic Ring Fallback)
- **Precondition:** The requested preferred region is marked unhealthy by the background prober.
- **Behavior:** Automatically walks the fallback ring ([client.ts](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/Final_PrintWinners/packages/web/src/api/client.ts)):
  - Mumbai down $\to$ falls back to Delhi.
  - Mumbai & Delhi down $\to$ falls back to Bengaluru.
- **Response Header:** Injects `X-VERDICT-Routing-Mode: FAILOVER` and `X-VERDICT-Serving-Region: delhi` so the client is explicitly notified of degraded state.

### Mode 4: `AUTHORITATIVE_FENCED` (Escrow Quota Protection)
- **Applicable Routes:** `POST /api/v1/escrow/spend`.
- **Behavior:** Escrow quotas cannot be arbitrarily round-robined or failed over. If Mumbai holds the authorized budget for emergency medical kits and Mumbai goes down, the gateway **blocks** the request with HTTP 409:
  ```json
  {
    "error": "Escrow quota fence: Cannot load-balance spendEscrow to alternative region. Quotas are strictly fenced to [MUMBAI].",
    "routingMode": "AUTHORITATIVE_FENCED",
    "targetRegion": "mumbai"
  }
  ```
- **Guarantee:** Absolute mathematical prevention of negative supply quotas during network partitions.

---

## 3. Background Health Check Engine

The gateway executes continuous background probes:
- **Frequency:** Every 2000 ms (`healthCheckIntervalMs`).
- **Endpoint:** `GET /api/v1/status` on each backend.
- **Probe Timeout:** 1000 ms (`probeTimeoutMs`).
- **Thresholds:**
  - 1 successful response immediately marks node as `healthy: true`.
  - 1 connection failure immediately marks node as `healthy: false`, tracks failure reason, and triggers instant failover rerouting for subsequent requests.

---

## 4. Diagnostic & Visibility API

The gateway exposes `GET /api/v1/lb/status`:
```json
{
  "service": "VERDICT Consistency-Aware Gateway & Load Balancer",
  "version": "1.0.0",
  "activePort": 4000,
  "healthyCount": 3,
  "totalBackends": 3,
  "healthyRegions": ["mumbai", "delhi", "bengaluru"],
  "backends": {
    "mumbai": { "id": "mumbai", "port": 4001, "healthy": true, "latencyMs": 2, "activeRequests": 0 },
    "delhi": { "id": "delhi", "port": 4002, "healthy": true, "latencyMs": 3, "activeRequests": 0 },
    "bengaluru": { "id": "bengaluru", "port": 4003, "healthy": true, "latencyMs": 2, "activeRequests": 0 }
  },
  "metrics": {
    "totalRequests": 42,
    "requestsByRegion": { "mumbai": 14, "delhi": 14, "bengaluru": 14 },
    "requestsByMode": { "roundRobin": 42, "stickyPreferred": 0, "failover": 0, "authoritativeFenced": 0 }
  }
}
```
