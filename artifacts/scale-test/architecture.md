# VERDICT — 500-Replica Runtime Architecture & Topology

## 1. Architecture Overview
The 500-replica scale test utilizes **Isolated Logical Replicas** interconnected via a **Bounded Chordal Ring Topology** ($k=4$).

### Key Invariants Maintained:
1. **Independent State:** Each replica maintains an isolated operation log, version vector clock ($V$), materialized entity cache, and outbox queue.
2. **Bounded Topology:** Full-mesh replication ($500 \times 500 = 250,000$ links) causes OS socket exhaustion. VERDICT employs chordal links where node $i$ connects to $i \pm 1$ and $i \pm \lfloor\sqrt{N}\rfloor$. This yields diameter $O(\sqrt{N}) \approx 22$ with only 1,000 active links cluster-wide.
3. **Multi-Hop Gossip:** Operations propagate causally along chordal paths, ensuring full cluster convergence.
4. **Cryptographic Parity:** Each node possesses its own deterministic Ed25519 keypair and signs every operation with SHA-256 hash chains.
5. **Causal Conflict Accounting:** Split-brain writes on partitioned nodes are detected via $V_A \parallel V_B$ and preserved side-by-side rather than silently overwritten.