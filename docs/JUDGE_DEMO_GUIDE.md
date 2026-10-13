# VERDICT — Judge Demonstration Guide (30 Seconds to 3 Minutes)

**Hackathon:** CodeAstra 2.0 (Problem Statement #2)  
**Team:** `print("Winners");`  
**Domain:** Cloud Computing & Distributed Systems  

---

## 1. The Core 30-Second Story

Every judge can grasp our solution in 30 seconds with this single narrative:

$$\text{Incident Created} \longrightarrow \text{Network Failure} \longrightarrow \text{Local Operation} \longrightarrow \text{Reconnection} \longrightarrow \text{Recovery Verified}$$

> *"In disaster situations, cross-region fiber cuts are inevitable. Distributed systems face an impossible dilemma: either lock all writes to prevent inconsistency (which stops first responders), or allow uncoordinated writes (which causes data loss and inventory overdrafts).*  
>  
> *VERDICT resolves this through **Graceful Degradation with Verifiable Convergence**:  
> 1. Nodes maintain local autonomous JSON persistence and causal version vectors.  
> 2. When partitioned, local writes proceed safely under escrow bounded counter quotas without distributed locks.  
> 3. Upon reconnection, transactional outboxes flush in priority order, concurrent updates are preserved side-by-side, and bit-level canonical state hash consensus is proven cryptographically."*

---

## 2. One-Click Automatic Demo Mode (“▶ Run Automatic Demo”)

For hackathon judging, presenter nervousness or repeated clicking is eliminated by **Automatic Presentation Mode**:

1. Click **“▶ Run Automatic Demo”** once from either the **Overview** or **Recovery Demo** screen.
2. A dedicated presentation cursor labeled **“VERDICT Demo Guide”** smoothly glides to each UI component in sequence.
3. Target elements receive a glowing blue focus ring while a floating explanatory tooltip guides the judge through each step.
4. Each step executes real backend Fastify operations, waits for genuine HTTP responses, and displays the real results before pacing to the next step.
5. The sticky **Presenter Control Bar** allows live interaction:
   - **Pause / Resume:** Freeze playback at any point to explain deep architecture to a judge.
   - **Step Navigation:** Skip forward (`Next`) or back (`Prev`).
   - **Speed Control:** Toggle between `0.5×`, `1×`, `1.5×`, and `2×` without restarting.
   - **Restart & Exit:** Cleanly cleans up and restores replication links if altered by the demo.
6. Upon conclusion, a verified **Completion Summary** modal highlights genuine results returned by the backend.

---

## 3. Four Clean Navigation Views

The web dashboard is organized into four judge-friendly primary screens:

1. **Overview** — Live 3-region health cards (Mumbai, Delhi, Bengaluru), real network condition status answering the 4 core operational questions, latest incident summary, and one-click demo launch.
2. **Incidents** — Simple field report management: Title and detailed Description validation and preservation, status filtering pills, stable deduplicated IDs, origin region, replication status, and conflict alerts.
3. **Recovery Demo** — The centerpiece 6-step demo: Partition → Local Save → Reconnect → Outbox Sync → Cryptographic Verification (supports both Automatic and Manual execution).
4. **Verification** — Clean 4-pillar scorecard:
   - 1. Operation Signature (Ed25519 asymmetric verification)
   - 2. History Integrity (SHA-256 hash chains linking ops)
   - 3. Replica Comparison (Canonical SHA-256 state-hash digests)
   - 4. Recovery Evidence (Latest recovery-test result, distinguishing local simulation from physical cloud DR)

*Note:* All advanced technical tools (500-Region Scale Test, Map, Decision Gate, Receipts, Supplies Escrow, Topology, Merge Reports, Review Inbox, Audit Ledger, Lab Bench) are preserved inside the collapsible **Technical Details** menu.

---

## 4. Step-by-Step 6-Stage Demo Script

| Step | Stage Name | Explanation Shown to Judges | Internal Distributed Systems Logic |
| :---: | :--- | :--- | :--- |
| **1** | **Incident Created** | *“An emergency report has been saved by the selected region.”* | Writes to Mumbai local store (`data/mumbai.db.json`). Generates stable UUIDv4 `clientTxId` for deduplication. Increments causal vector clock. |
| **2** | **Network Partition** | *“Communication between the selected regions is interrupted.”* | Calls `LinkController` to sever replication between Mumbai and Delhi. Replicas enter `L1_DEGRADED` autonomous mode. |
| **3** | **Local Update** | *“The connected region saves an eligible update locally, even while replication is disconnected.”* | Mumbai commits landslide report locally under escrow bounds without distributed locks. Op enqueued in transactional outbox. |
| **4** | **Reconnection** | *“The network link is restored.”* | `LinkController` re-enables transport link. Heartbeat sweeps unpause. |
| **5** | **Synchronization** | *“The regions exchange pending operations and process updates that were missed.”* | P2P priority outbox flushes in causal dependency order. Outbox drops to 0 ops. Concurrent updates identified via $V_A \parallel V_B$. |
| **6** | **Verification** | *“We check the actual regional health, synchronization status, and any remaining conflicts.”* | Queries `/api/v1/convergence`. Verifies canonical state hash parity across replicas and displays any unreviewed conflicts. |

---

## 5. Key Questions & Honest Technical Answers

### Q: "Why not use Last-Write-Wins (LWW) with timestamps?"
> *"Physical system clocks drift and can be manipulated. If two rescue teams in Mumbai and Delhi update a blocked bridge status concurrently during a disaster, a timestamp rule silently discards one team's report. VERDICT uses causal version vectors ($V_A \parallel V_B$) to preserve concurrent updates side-by-side until human review."*

### Q: "How do you prevent duplicate operations during timeouts?"
> *"Every write carries a client-generated UUIDv4 `clientTxId`. Our PROVE-ONCE transaction outcome API reconciliation ensures that retried network requests return the original committed receipt without duplicate processing."*

### Q: "What prevents over-allocating emergency supplies during a partition?"
> *"Escrow Bounded Counters allocate pre-approved local spending allowances per region. If Mumbai has an escrow quota of 200 kits, it can commit up to 200 kits locally while completely disconnected from Bengaluru. If an operation exceeds the escrow limit, it is placed on HOLD rather than risking an overdraft."*

---

## 6. System Runbook

- **Docker Startup:** `docker compose up --build`
- **Local Dev:** `node scripts/dev-local.js`
- **Dashboard:** `http://localhost:3000`
- **Safe Shutdown:** `docker compose down` (preserves named data volumes)
- **Notice:** Avoid `docker compose down -v` as it wipes persistent regional JSON volumes.
