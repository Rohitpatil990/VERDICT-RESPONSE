# VERDICT — Judge Q&A & Technical Defense Sheet

### Q1: Why not Last-Write-Wins (LWW)?
**A:** In a disaster, clock synchronization across partitioned field devices is impossible (NTP drifts, network partitions isolate hardware clocks). LWW silently destroys critical safety data based on unverified clock timestamps. For example, if Mumbai municipal team reports Road R7 open at 10:00 and Delhi NDRF reports it washed away at 10:01 with a skewed clock, LWW would pick one and erase the other. VERDICT surfaces concurrent claims side-by-side as `Awaiting human review` and defaults to conservative safety (BLOCKED).

### Q2: Why not just use pure CRDTs?
**A:** State-based and operation-based CRDTs are excellent for data structures with merge lattices (like our set-union notes and monotone person statuses). However, CRDTs cannot express scarce divisible resources without coordinating invariants (such as preventing two regions from over-allocating the same 5 physical medical kits). VERDICT augments CRDT observations with escrow bounded counters for commitments.

### Q3: Why not Raft or Paxos?
**A:** Consensus protocols like Raft require a strict majority quorum ($> N/2$). In a 3-region deployment across disconnected disaster zones (Mumbai, Delhi, Bengaluru), an isolated single region has 1/3 of the nodes and cannot form a quorum, halting all operations. In an earthquake or flood, responders MUST record observations and deploy locally available supplies even when completely cut off from the rest of the country.

### Q4: What does the Decision Gate guarantee, and what does it NOT guarantee?
**A:** The Gate guarantees that the decision satisfies configured multi-region consistency invariants: no unresolved conflicts, cryptographic chain integrity, reachability of the territory authority, observation freshness, and sufficient local escrow quota. **It does NOT guarantee physical ground truth.** `GO` means it is safe under known consistency rules; it is not a real-world disaster prediction.

### Q5: What is the cost of Escrow bounded counters?
**A:** Stranded quotas. If Mumbai is allocated 3 medical kits and Delhi 2, and Delhi experiences an influx of 4 casualties while partitioned from Mumbai, Delhi can only grant 2 kits and must queue the remaining 2 as unmet demand—even if Mumbai has 3 unused kits sitting on a shelf. Safety against over-allocation comes at the cost of potential local supply refusal during partitions.

### Q6: What if a node is malicious or Byzantine?
**A:** VERDICT is designed for crash-recovery and network partitions among protocol-following disaster agencies, not Byzantine Fault Tolerance (BFT). We enforce pre-shared Ed25519 digital signatures and hash chains to prevent message tampering and spoofing, but a compromised node with a valid private key could issue malicious operations within its quota. Full BFT consensus is out of scope.

### Q7: Does a valid cryptographic signature mean the report is true?
**A:** No. A signature proves that the payload was authored by the holder of the associated private key and was not altered in transit. It does not prove that the report is factually accurate in the physical world.

### Q8: Why is there no "Trust Score"?
**A:** Trust scores create false security by averaging independent dimensions into a single opaque number. A report with a valid signature from an unverified citizen 2 hours ago is not "73% trustworthy". VERDICT explicitly displays separate indicators: Source Tier, Freshness, Conflict State, Replication Lineage, Cryptographic Integrity, and Operational Resolution.

### Q9: Where do your performance numbers come from?
**A:** All numbers are measured directly from the running host via `npm run bench` and live scenario runs. Zero metrics are hard-coded or fabricated.
