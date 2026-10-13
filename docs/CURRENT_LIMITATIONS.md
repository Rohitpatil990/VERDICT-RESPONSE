# VERDICT — Current Limitations & Architecture Disclosures

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Scope:** Hackathon Prototype Truth & Engineering Disclosures  
**Last Updated:** October 2026 (500-Replica Scale Test Edition)

---

## 1. Top Engineering Disclosures for Judges

### 1. Local Logical Replica Simulation vs Independent Cloud Regions
- **What is Tested:** 500 concurrently active logical regional replicas (`region-0001` through `region-0500`) running inside a scalable replica runtime. Each replica maintains an isolated state machine, independent causal version vector, outbox queues, cryptographic Ed25519 keypair, and canonical SHA-256 state hashing.
- **What is NOT Claimed:** This is **not** 500 geographically independent physical cloud datacenters or cloud regions spanning the globe. It is a local multi-replica distributed protocol simulation executed on a single host.
- **Important Warning:** Do not describe a single-machine experiment as geographic disaster recovery. A host failure (power loss, OS crash) will terminate all simulated replicas on that host.

### 2. Actual OS Process and Docker Container Counts
- **OS Processes:** The 500-replica scale test runs inside **1 Node.js process runtime** using isolated memory-bounded `LogicalReplica` state instances.
- **Docker Containers:** The Docker Compose environment runs **4 reference containers**:
  1. `verdict-mumbai` (Regional Node — Port 4001)
  2. `verdict-delhi` (Regional Node — Port 4002)
  3. `verdict-bengaluru` (Regional Node — Port 4003)
  4. `verdict-gateway` (Consistency-Aware Gateway — Port 4000)
- **Why Not 500 Containers:** Spawning 500 separate Node.js processes or 500 Docker containers on a 16 GB RAM development machine would require 25–50 GB RAM, causing immediate host out-of-memory crashes and OS thrashing. The bounded chordal ring topology ($k=4$, 1,000 links) enables genuine verification of multi-hop routing, duplicate deduplication, and causal conflict detection with a lightweight ~364 MB heap footprint.

### 3. Tested Guarantees vs Untested Assumptions
- **Guarantees Tested & Proven (10/10 Passed):**
  - Unique Identity & Independent Logical State for all 500 replicas
  - Bounded-Degree Multi-Hop Replication ($k=4$ Chordal Ring)
  - Causal Conflict Preservation (side-by-side claim retention, no naive Last-Write-Wins overwrites)
  - Network Partition Local Writes (offline updates proceed without blocking on unreachable quorums)
  - Connectivity Restoration & Outbox Drain Reconciliation
  - Cryptographic Chain Integrity (Ed25519 signatures and SHA-256 hash chains)
  - Escrow Bounded Counters (resource allocations strictly bounded without negative balances)
  - PROVE-ONCE Idempotency (zero double-application across 50 duplicate deliveries)
  - Fast Commit Latency (p50: 2ms, p95: 2ms, p99: 3ms)
- **Untested / Out-of-Scope Assumptions:**
  - Physical WAN packet loss, high-jitter fiber optics, or transoceanic undersea cable severed latency.
  - Byzantine Fault Tolerance (BFT) against malicious peers intentionally forging invalid crypto proofs.
  - Disk storage scaling across millions of operational log entries over months of runtime.

### 4. Recovery and Availability Limitations
- **Atomic File Persistence:** Local durable storage for the 3 reference nodes utilizes atomic file writes (`writeStore` via `.tmp` renamed to `.json`) rather than an embedded LSM-tree engine like RocksDB. This ensures human-readable inspection during hackathon judging, but limits I/O operations per second to filesystem serialization speeds.
- **Application-Layer Partitioning:** Network link severance in the prototype is simulated programmatically by suppressing replication outbox flushes in the replication engine rather than host-level Linux `iptables` or `tc netem` traffic shaping rules.

### 5. Benchmark Hardware & Environment
- **Host Machine:** Windows 11 Workstation, 16 GB Physical RAM (DDR4), 8 CPU Cores (AMD/Intel 64-bit).
- **Available Free Memory at Test Time:** ~775 MB available RAM before execution; harness consumed ~364 MB peak heap.
- **Node.js Runtime:** v22.14.0 (x64) with native V8 optimization.
- **Throughput Measured:**
  - 100 Replicas: 157.2 ops/s
  - 250 Replicas: 74.7 ops/s
  - 500 Replicas: 29.3 ops/s (over 998,000 peer deliveries flushed)

---

## 2. Production Evolution Roadmap

| Architectural Component | Current Hackathon Prototype | Production Architecture (FUTURE DESIGN) |
| :--- | :--- | :--- |
| **Physical Topology** | 1 Host Process (500 Logical Replicas) + 4 Local Docker Containers | Multi-Region AWS (`ap-south-1`, `ap-south-2`) + GCP (`asia-south1`) |
| **Storage Engine** | JSON file per region | Local RocksDB instance per region + S3 cold outbox backup |
| **Transport Security** | Plaintext HTTP loopback | Mutual TLS (mTLS) with SPIFFE/SPIRE workload identities |
| **Load Balancing** | Fastify port 4000 gateway | Envoy Proxy cluster with custom Wasm consistency filter |
| **Network Partitioning**| Application-layer link controller | Chaos Mesh / AWS Fault Injection Simulator (FIS) |
| **Deduplication Window** | Full in-memory + file op log index | Distributed Redis sliding window + durable Bloom filter |
