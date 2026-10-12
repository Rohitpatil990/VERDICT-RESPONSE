# VERDICT Response — Judging Q&A Sheet
CodeAstra 2.0 Final · PS #2 "Geo-Distributed Disaster Data Replication with Graceful Degradation"

---

### **Q1: Why not pure CRDTs (Conflict-Free Replicated Data Types) alone?**
**Answer:** Pure CRDTs are excellent for commutative, monotonic operations (like append-only notes or PN-counters), but disaster response has **non-monotonic safety constraints**:
1. *Bounded physical resources*: If two disconnected regions both claim the last 5 medical kits, an additive CRDT would oversell 7 units. Physical supplies cannot be negative or created out of thin air.
2. *Safety-critical contradictions*: If one sensor reports a bridge is OPEN and a citizen reports it has COLLAPSED, a Last-Write-Wins (LWW) CRDT would pick whichever report has a newer timestamp (which is trivially manipulated or misaligned by clock drift). In VERDICT, safety-critical contradictions trigger **Awaiting human review** rather than silent automated selection.

---

### **Q2: Why not Raft or Paxos?**
**Answer:** Raft and Paxos require a **quorum (majority)** to accept writes. During an active disaster (e.g. undersea cable severing or power grid collapse), a partitioned region with 1 node cannot achieve majority and would be forced to reject writes (CP mode). In a disaster, workers on the ground must be able to log trapped citizens and road blockages locally without being blocked. VERDICT adopts an **Availability-First (AP) model during partitions** with deterministic settlement and bounded invariant verification upon reconnection.

---

### **Q3: What if the last unit of relief supply is claimed while offline for days?**
**Answer:** Local writes to bounded resources are explicitly marked **Tentative**. In VERDICT, a tentative view shows local claims, but the allocation is only **Settled** once included in a certified round. If total claims exceed available quota when the partition heals, the deterministic policy grants up to available capacity and marks the excess as **Backordered** with a full audit trace. Nothing is silently lost or oversold.

---

### **Q4: How do you prevent stale certificate replay?**
**Answer:** Every Round Certificate includes `{ round, prevCertHash, opSetRoot, policyVersion, stateRoot }`. Replicas verify that `round = latestRound + 1` and that `prevCertHash` matches the cryptographic hash of the previous certificate in their local chain. Stale or replayed certificates are rejected.

---

### **Q5: Can a malicious region forge records?**
**Answer:** Each region has a pre-shared Ed25519 public key in the shared registry. Every operation is cryptographically signed by its author and origin region. If a corrupted node modifies an existing op or injects an invalid signature, the receiver's integrity check marks the operation **FAILED** upon arrival and isolates it in staging. Full Byzantine Fault Tolerance (BFT) against arbitrary malicious collusions is on the roadmap; for the hackathon scope, we guarantee tamper detection and non-repudiation.

---

### **Q6: What does "2 of 3" signing guarantee and not guarantee?**
**Answer:** 
- **Guarantees:** It proves that at least 2 regions independently replayed the exact operation set, verified policy invariants, and calculated identical Merkle state roots.
- **Does NOT guarantee:** It does *not* claim the third disconnected region has received the update, and it does *not* guarantee that the physical observation on the ground is true.

---

### **Q7: What breaks first as the system scales?**
**Answer:**
1. *Full-mesh network replication*: Point-to-point replication between N regions is O(N²). For N > 10 regions, this must transition to a gossip/relay mesh (RelayMesh).
2. *Per-region SQLite/PostgreSQL write throughput*: Sustained ingestion rates exceeding 5,000 ops/sec per node would require batch streaming or distributed storage partitions.
3. *Pending op backlog size*: Extremely prolonged partitions with millions of uncompacted ops require snapshot catch-up.

---

### **Q8: Is this a simulated demo or a real multi-region deployment?**
**Answer:** It is a **local multi-process simulation** running three genuine Node.js Fastify services on distinct ports (4001, 4002, 4003) with **genuinely separate SQLite databases** (`data/mumbai.db`, `data/delhi.db`, `data/bengaluru.db`). There is zero shared memory between services. Network cuts are simulated via the `LinkController` abstraction.

---

### **Q9: Did you use AI tools in building this?**
**Answer:** Yes. In full accordance with our AI-assisted development disclosure, AI coding tools were utilized for rapid scaffolding of types, boilerplate Fastify routes, and UI layout. All core distributed algorithms (vector causality, canonical hashing, priority lane sync, and invariant assertions) were reviewed and validated via integration tests.

---

### **Q10: Does a valid cryptographic signature mean the incident report is true?**
**Answer:** **NO.** A valid Ed25519 signature proves only that the record was authored by the owner of the key and has not been altered in transit or in the database. It does not prove that floodwaters are actually 3 feet high. That is why VERDICT maintains **six separate indicators** and never collapses integrity into factual truth.

---

### **Q11: What happens if there is no internet connection for voice or translation?**
**Answer:** Manual form reporting and local database persistence continue with zero network requirement. The `StaticLexiconTranslator` operates completely offline using bundled Devanagari keyword dictionaries. Remote translation APIs are disabled gracefully without blocking local operations.

---

### **Q12: Where do your efficiency benchmark numbers come from?**
**Answer:** Directly from `npm run bench` (`packages/region-service/src/bench.ts`). It runs 500 atomic transactions, measures actual p50/p95 disk write latencies, calculates real Merkle roots, and compares the exact byte length of delta JSON payloads against full-state serialization on the host machine.

---

### **Q13: Why is there no single "Trust Score" (e.g. 87% trust)?**
**Answer:** A single score creates dangerous complacency. A report could have 100% cryptographic integrity (signed by a sensor) but be 12 hours old (low freshness), or it could be submitted by a trusted field officer but conflict with three other officers. Combining these into a single number conceals the actual failure mode. Showing the six separate indicators empowers operators to make informed, decision-safe judgments.
