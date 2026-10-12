# VERDICT Response — Verifiable Settlement for Multi-Region Data
**CodeAstra 2.0 Final · Cloud Computing & Distributed Systems · PS #2**  
*Geo-Distributed Disaster Data Replication with Graceful Degradation*  
**Team: print("Winners");** · Solution: **VERDICT Response**

---

> [!NOTE]
> **Simulated Demo Data Notice:** All incident, location, and disaster data contained in this repository is simulated synthetic scenario data for demonstration and benchmarking purposes. It does not represent live emergency-service information or an official government dispatch system.

---

## 1. Executive Summary & Problem-Solution Alignment

In catastrophic disaster scenarios (e.g., severe monsoon flooding in Mumbai), field communications collapse, power lines sever, and inter-city fiber backbones experience extended network partitions. Conventional cloud-centralized emergency systems fail because workers cannot write to a partitioned database, while naive multi-master systems overwrite critical reports with unverified "last-write-wins" timestamps.

**VERDICT Response** is an offline-first disaster intelligence platform with verifiable settlement across geo-distributed regions:
1. **Genuine Regional Independence:** 3 regional services (Mumbai, Delhi, Bengaluru) operate completely independent local persistence stores (`data/mumbai.db`, `data/delhi.db`, `data/bengaluru.db`).
2. **Local Write Capability During Partition:** Regional nodes persist reports locally in atomic SQLite transactions with a transactional outbox, immediately acknowledging writes to field workers as *Saved in region*.
3. **Delta-Only Anti-Entropy Replication:** Upon link restoration, nodes exchange lightweight version vectors and replicate missing signed operations in strict priority lanes (L0 Control → L1 Critical Medical/Stranded → L2 Normal → L3 Blobs).
4. **Decision-Safe Disaster Intelligence (The 6 Indicators):** Rather than collapsing complex reliability signals into a deceptive single "trust score", every record carries six independent, verifiable indicators.
5. **Bounded Resource Escrow:** Competing resource claims (e.g. 5 available medical kits claimed concurrently by Mumbai for 3 and Delhi for 4) are deterministically settled under invariant safety (allocated ≤ available), marking remainder as *Backordered* with zero silent drops.

---

## 2. Consistency Model Defence

**Model:** *Availability-First (AP) during partitions, deterministic convergence after reconnection, strong mathematical invariants at certified settlement rounds.*

- **During Partition (AP Mode):** Every region accepts local writes without waiting for remote quorums. A quorum-based protocol (like Raft or Paxos) would reject writes in an isolated region with < 50% nodes, blocking frontline rescue workers. Local writes are immediately committed and marked **Tentative**.
- **Operation-Based Replication:** Replication is op-based. Every op is an immutable envelope:
  $$\text{op} = \{\text{opId}, \text{region}, \text{seq}, \text{type}, \text{entityId}, \text{payload}, \text{deps}, \text{prevHash}, \text{hash}, \text{sig}\}$$
  Each region maintains its own SHA-256 hash chain and signs ops with an Ed25519 keypair.
- **Causality via Version Vectors:** Op $B$ causally supersedes Op $A$ *if and only if* $B$'s dependencies show its author had seen $A$ ($B.\text{deps}[A.\text{region}] \ge A.\text{seq}$). If neither has seen the other, the updates are **concurrent**.
- **Conflict Policy v1:**
  - `NOTE` / Annotations: Append-only set union.
  - `PERSON_STATUS`: Monotonic policy (SAFE/FOUND strictly supersedes MISSING; evidence preserved).
  - `FACT` (Road Status): Causally later supersedes. Concurrent updates from differing sources with safety-critical contradictions (e.g. `BLOCKED` vs `OPEN`) transition to **Awaiting human review**.
  - `RESOURCE_CLAIM`: Invariant $\sum \text{allocated} \le \text{available}$. Ordered by class priority (`MEDICAL` > `WATER` > `FOOD` > `SHELTER`) then `opId`. Excess claims are **Backordered** with full justification.
- **Settlement Rounds & Certificates:** Certified rounds close over held ops. A Round Certificate binds $\{\text{round}, \text{prevCertHash}, \text{opSetRoot}, \text{policyVersion}, \text{stateRoot}\}$. Signers independently verify invariants and sign the Merkle `stateRoot`.

---

## 3. The USP — Six Decision-Safe Indicators

| Indicator | Meaning | Values & Criteria |
|---|---|---|
| **1. Source** | Authority tier, channel, and origin region | Defined by shared registry (OFFICIAL_SENSOR > FIELD_OFFICER > VOLUNTEER > CITIZEN); never self-claimed. |
| **2. Freshness** | Age of observation timestamp | Age buckets (<15 min, <1 h, <6 h, older); flags *Clock anomaly* if timestamp is in the future. |
| **3. Conflict** | Agreement status across competing reports | `None` · `Conflicting (n)` · `Awaiting human review` · `Resolved by policy` · `Resolved by reviewer`. |
| **4. Replication** | Verified receipt across regional databases | `Saved locally` · `Pending synchronization` · `Synchronized (3/3)`; per-region `RECEIVED` / `PENDING` / `UNKNOWN`. |
| **5. Integrity** | Cryptographic hash chain and envelope check | `Verified` · `FAILED (exact reason)` · `Unverified`. |
| **6. Resolution** | Policy status of the record | `Tentative` · `Settled under policy` · `Awaiting human review` · `Superseded` · `Backordered`. |

> [!IMPORTANT]
> **Mandatory Cryptographic Disclaimer:** *"A verified signature shows the record was signed by the associated key and not altered since. It does not show that the report itself is true."*

---

## 4. System Architecture & Flow

```
[Field Worker / Sensor]
        │
        ▼ (Local Submit)
[Regional Fastify Service]
        │
   (Atomic Tx) ──► [Local SQLite Store: data/<region>.db]
        │         ├── operations (Immutable hash-chained log)
        │         ├── receipts (Hop tracking & verification)
        │         └── outbox (Transactional delta buffer)
        │
        ▼ (Anti-Entropy Sync)
[Priority Lanes: L0 Control | L1 Critical | L2 Normal | L3 Blobs]
        │
  (LinkController) ──► Simulated Partition / Latency Throttle
        │
        ▼ (Reconnection & Settlement)
[Deterministic Replay + Invariant Checks] ──► [Round Certificate (2-of-3)]
```

---

## 5. Feature Implementation Matrix

| Subsystem / Feature | Status | Technical Implementation |
|---|---|---|
| **Multi-Region Replicas** | **IMPLEMENTED** | 3 independent services on ports 4001, 4002, 4003 with separate SQLite databases. |
| **Local Persistence** | **IMPLEMENTED** | Node 24 native C-engine `DatabaseSync` (`node:sqlite`) with atomic transactional outbox. |
| **Replication Protocol** | **IMPLEMENTED** | Delta anti-entropy exchanging version vectors and missing sequence ranges. |
| **Priority Sync Lanes** | **IMPLEMENTED** | 4 strict lanes (L0 Control → L1 Critical Medical/Stranded → L2 Normal → L3 Blobs). |
| **Partition Link Controller** | **IMPLEMENTED** | `LinkController` simulating cuts, restorations, artificial latency, and bandwidth caps. |
| **Conflict Resolution Engine** | **IMPLEMENTED** | Per-type policy v1 + human reviewer signed `RESOLVE` ops with side-by-side evidence. |
| **Bounded Resource Claims** | **IMPLEMENTED** | 5/3/4 medical kit scenario settled deterministically with zero overselling. |
| **Tamper Detection & Heal** | **IMPLEMENTED** | Single-byte corruption detection in SQLite DB with instant `FAILED` status and ledger heal. |
| **Consistency Status API** | **IMPLEMENTED** | `/api/v1/status` exposing degradation levels, vectors, and Merkle `stateRoot`. |
| **Interactive Map Dashboard** | **IMPLEMENTED** | Full-screen Leaflet map with dark tiles, regional switcher, and SourceTrace drawer. |
| **Multilingual UI (i18n)** | **IMPLEMENTED** | Complete English, हिन्दी (Hindi), and मराठी (Marathi) localizations. |
| **Disaster Scenario Data** | **SIMULATED** | Synthetic Mumbai monsoon flooding dataset (Kurla, Dharavi, Powai, CSMT). |
| **Offline Whisper WASM** | **PLANNED** | Roadmap integration for on-device browser neural voice transcription. |

---

## 6. Real Measured Benchmarks (`npm run bench`)

Metrics measured directly on the host machine running Node.js v24:

- **Local Ingestion Throughput:** **135+ ops/sec** (including canonical JSON, SHA-256 hash chaining, Ed25519 signing, and atomic SQLite transaction).
- **Write Latency p50 / p95:** **7.06 ms / 9.07 ms** during complete network partition.
- **Merkle State Root Recomputation:** **8.20 ms** over test leaves.
- **Replication Bandwidth Efficiency:** **90.0% bandwidth saved** using delta anti-entropy compared to sending full-state snapshots.

*Full benchmark breakdown available in [BENCH.md](file:///c:/Users/Rohit%20Patil/OneDrive/Documents/MCT%20HACKATHON/docs/BENCH.md).*

---

## 7. AI-Assisted Development Disclosure & Third-Party Libraries

- **AI Disclosure:** Developed with AI pair-programming assistance for rapid 24-hour hackathon execution. Core distributed algorithms (vector causality, canonical hashing, priority lane sync, and invariant assertions) were reviewed and validated via integration tests.
- **Third-Party Libraries:**
  - Runtime: Node.js v24 (built-in `node:sqlite` and `node:crypto`)
  - Server: Fastify v5, `@fastify/cors`
  - Frontend: React 19, Vite 6, Leaflet 1.9, Lucide React
  - Testing: Node.js native test runner (`node:test`, `node:assert`)
