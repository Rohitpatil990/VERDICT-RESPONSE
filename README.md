# VERDICT — Verifiable Settlement for Multi-Region Data
**Operational Consistency Engine · CodeAstra 2.0 Final**  
*Cloud Computing & Distributed Systems · Problem Statement #2 "Geo-Distributed Disaster Data Replication with Graceful Degradation"*  
**Team: print("Winners");** · **Product:** VERDICT Response  
**Tagline:** *Observe anywhere. Commit safely. Decide with eyes open.*

---

## 1. Problem & Our Thesis

### Official Brief
> "Design a multi-region data service prototype with local write capability, synchronization after partition and a defined conflict-resolution policy. Demonstrate what happens when regions disagree and connectivity is restored."

### The VERDICT Thesis
Most distributed replication engines only ask: *"Are the replicas equal yet?"*  
In an active disaster scenario, responders cannot wait for global consensus. The actual operational question is:  
**"Is it safe to act on what I see right now?"**

VERDICT makes consistency **decision-aware**. We partition data into three distinct semantic classes, granting each the exact guarantee it requires:
1. **Observations (AP):** Field reports, damage claims, notes. Accepted unconditionally offline. Causally ordered via per-origin Ed25519 hash chains and version vectors. Conflicts are surfaced side-by-side; **never silently overwritten** using Last-Write-Wins (LWW).
2. **Commitments:** Supply allocations, rescue team assignments, incident closures. **Safe by construction** during partitions: divisible scarce resources use **escrow shares (bounded counters)**; indivisible assets use home-region single-writer ownership; incident closures require certified reviewer digital signatures.
3. **Decisions:** Field dispatches, resource deployments, and road clearances. Every action executes through the pure, deterministic **Decision Gate**, yielding an operational verdict: **GO · CAUTION · HOLD**.

---

## 2. Five Signature Capabilities

1. **Decision Gate:** Evaluates operational safety based on 7 deterministic invariant checks (Conflict, Cryptographic Integrity, Authority Reachability blind-spot rule, Freshness window, Multi-region Replication, Escrow quota, Reviewer Confirmation). Outputs an explanation tree and remedies.
2. **Decision Receipts + Conflict Blast Radius:** Decisions record a cryptographic snapshot of what they saw at decision time. Upon network healing, VERDICT re-evaluates past decisions against merged truth, flagging impacted decisions as `STILL_VALID`, `NEEDS_RECHECK`, or `INVALIDATED`.
3. **Fog of Information:** Map layer rendering an indigo-grey hatch pattern veil over territories of unreachable regions, with an elapsed contact timer and real "operations revealed" counter upon healing.
4. **Escrow-Backed Scarce Resources:** Divisible resources (medical kits, rescue boats) use bounded counters ($\sum \text{spent} \le \text{Total}$ in every replica's view). Under network partitions, regions spend only local quota; excess requests queue as unmet demand. Zero over-allocation by construction.
5. **PR-Style Merge Reports:** A partition is a branch; reconnection is a merge. Generates countable diff reports: ops created, ops exchanged, conflicts surfaced, decisions re-evaluated, and measured delta bandwidth savings (~97% reduction over full-state copies).

---

## 3. The Rule of Honesty

- **A Verdict is Not a Prediction:** `GO` means the information this decision relies on satisfies the configured consistency rules. It does **not** mean the action is physically safe in the real disaster world.
- **Nothing is Faked:** All latencies, throughputs, byte counts, and convergence times are measured from the live running system.
- **Fail-Safe over Optimism:** Unreachable regions are labelled `UNKNOWN (offline, last contact t)`, never assumed up-to-date.
- **Signatures Prove Origin Only:** A valid Ed25519 signature proves key origin and byte integrity; it does not prove that a field report is factually true.

---

## 4. Architecture & Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          VERDICT Web Console (:3000)         │
                  │   Operations Map · Gate · Blast Radius · i18n│
                  └──────────────────────┬───────────────────────┘
                                         │ REST / SSE
           ┌─────────────────────────────┼─────────────────────────────┐
           ▼ :4001                       ▼ :4002                       ▼ :4003
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│     MUMBAI NODE       │     │      DELHI NODE       │     │    BENGALURU NODE     │
│ (Territory Authority) │     │ (Regional Logistics)  │     │   (Field Logistics)   │
├───────────────────────┤     ├───────────────────────┤     ├───────────────────────┤
│ • Fastify REST / SSE  │◄───►│ • Fastify REST / SSE  │◄───►│ • Fastify REST / SSE  │
│ • SyncEngine / Outbox │Link │ • SyncEngine / Outbox │Link │ • SyncEngine / Outbox │
│ • mumbai.db.json (WAL)│Gate │ • delhi.db.json (WAL) │Gate │ • bengaluru.db.json   │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

- **3 Regional Services:** Running on independent ports (`4001`, `4002`, `4003`) with completely isolated disk database files.
- **LinkController:** In-process software link gate simulating physical partition cuts, latency, and bandwidth throttling deterministically.
- **Transactional Outbox:** Operations, materialized views, and outbox records commit atomically to disk.

---

## 5. Consistency Model Defense

| Dimension | VERDICT Policy | Theoretical Basis |
|---|---|---|
| Observations | AP (Eventual Causal Convergence) | Dynamo / Bayou |
| Conflict Detection | Flagged as `Awaiting human review`, never LWW | Operational Consistency |
| Scarce Resources | Bounded Counters ($\sum \text{spent} \le T$) | Balegas et al. (Escrow) |
| Indivisible Teams | Home-Region Single-Writer Ownership | Coordination Avoidance (Bailis et al.) |
| Operational Actions | Decision Gate (`GO · CAUTION · HOLD`) | Invariant Confluence |

---

## 6. Feature Implementation Status Matrix

| Subsystem | Status | Description |
|---|---|---|
| 3 Independent Regional Nodes | **Implemented** | Mumbai, Delhi, Bengaluru running on ports 4001, 4002, 4003. |
| Separate Local Database Persistence | **Implemented** | Dedicated JSON/WAL databases on disk per region (`data/*.db.json`). |
| Safe Demo Backup & Reset | **Implemented** | `scripts/backup-and-reset.js` timestamps existing DBs to `data/backups/`. |
| Regional Loss & Recovery Simulation | **Implemented** | `scripts/test-regional-loss-and-recovery.js` validates standby replica recovery (Local Multi-Process Simulation; honest local standby, not cloud DR). |
| Cryptographic Operation Log | **Implemented** | SHA-256 hash chains + Ed25519 signing via `@noble/ed25519`. |
| Causal Version Vectors | **Implemented** | Component-wise supremacy, vector diffing, and concurrency detection. |
| Durable Transactional Outbox | **Implemented** | Survives crash and restarts without losing un-replicated ops. |
| Priority Replication Lanes | **Implemented** | L0 Control → L1 Critical → L2 Normal → L3 Blobs. |
| Decision Gate | **Implemented** | 7 invariant checks, GO/CAUTION/HOLD, what-would-change remedies. |
| Conflict Blast Radius | **Implemented** | Re-evaluation of past decisions with then-vs-now diffs. |
| Fog of Information | **Implemented** | Leaflet hatch pattern layer with elapsed time ramp. |
| Escrow Scarce Resources | **Implemented** | 5/3/4 case verified: 2 granted, 2 unmet queue, zero over-allocation. |
| PR-Style Merge Reports | **Implemented** | Real countable categories diffing post-partition states. |
| Review Inbox | **Implemented** | Side-by-side conflict adjudication for Incident #101 & access corridor. |
| Tamper & Self-Healing | **Implemented** | Admin flip 1 byte test detects corruption; heals from peer. |
| Multi-Lingual Console | **Implemented** | Full key parity across English, हिन्दी, and मराठी. |

---

## 7. Exact PowerShell Commands

Run all commands from the project root `c:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners` using PowerShell:

### A. Reset State (Clean Safe Reset)
```powershell
node scripts/backup-and-reset.js
npm run seed
```
*Backs up existing SQLite/JSON database state to `data/backups/` and seeds fresh generic disaster data.*

### B. Run Automated Verification & Tests
```powershell
# 1. Run all core invariant and region service integration tests
npm test

# 2. Run regional database loss and standby recovery simulation test
node scripts/test-regional-loss-and-recovery.js

# 3. Run full automated system acceptance suite
node scripts/verify-all.js
```

### C. Start Application (Dev / Demo Mode)
```powershell
# Launches Mumbai (:4001), Delhi (:4002), Bengaluru (:4003), and Web Console (:3000)
node scripts/dev-local.js
```
Open **`http://localhost:3000`** in your browser.

### D. Execute Automated 3-Minute Live Demo Walkthrough
```powershell
# While dev-local.js is running, run in a separate terminal:
node scripts/run-demo.js
```

---

## 8. Prior Art & AI Disclosure

- **Prior Art:** Bayou (Terry et al.), Escrow/Bounded Counters (Balegas et al.), Invariant Confluence (Bailis et al.), Conflict-free Replicated Data Types (Shapiro et al.), Delay-Tolerant Networking.
- **AI-Assisted Development Disclosure:** Antigravity IDE and generative AI tools were used for code boilerplate scaffolding, TypeScript typing, and UI styling. Core architecture, consistency model defense, and protocol invariants were authored and verified by Team print("Winners");.
