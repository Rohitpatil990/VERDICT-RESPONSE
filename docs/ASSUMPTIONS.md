# VERDICT — Architectural Decisions & Assumptions Record
*CodeAstra 2.0 Final · Problem Statement #2 · Team: print("Winners");*

## 1. Core Thesis & Consistency Guarantees
- **Separation of Concerns:**
  - **Observations (AP):** Accepted offline unconditionally. Causally ordered through version vectors and per-origin cryptographic hash chains. Conflicts (concurrent incompatible states) are NEVER silently overwritten via Last-Write-Wins; they are explicitly flagged as `Awaiting human review` and presented side-by-side.
  - **Commitments (Safe by construction):** Divisible resources use escrow shares (bounded counters). Indivisible items use home-region single-writer ownership. Incident resolution requires reviewer signature.
  - **Decisions (Gated):** Every operational action (dispatch, allocate, close) executes through the deterministic Decision Gate (`GO · CAUTION · HOLD`).
- **Verdict is Not a Prediction:** `GO` guarantees that the known operational state meets consistency and freshness invariants. It is not an assertion of physical ground truth.
- **Fail-Safe over Optimism:** If a region is disconnected, its status is strictly `UNKNOWN (offline, last contact t)`, never assumed up-to-date.

## 2. Infrastructure & Environment
- **Multi-Process Local Replication:** 3 distinct region services (Mumbai: 4001, Delhi: 4002, Bengaluru: 4003) running independent node processes with genuinely separated database files/instances.
- **Store Adapter:** `SqliteStore` is utilized as the zero-dependency local default, completely swappable with `PostgresStore` via `STORE=postgres`.
- **Link Controller:** In-process link gates intercept network exchanges between regions to simulate partition cuts, network latency, and bandwidth throttling deterministically.
- **Scope Trimming:** Toxicproxy / heavy multi-container Docker compose mesh, Byzantine-fault tolerance (BFT), and offline neural ASR models are out of scope for the 24-hour evaluation envelope.

## 3. Cryptography & Identity
- **Algorithm:** Ed25519 for signing, SHA-256 for canonical JSON hashing.
- **Role Hierarchy:** `VOLUNTEER` < `FIELD_OFFICER` < `OFFICIAL` < `REVIEWER` < `ADMIN`.
- **Authority Rule:** Mumbai is the designated authority territory for the demo scenario (Mumbai Flood context). Delhi/Bengaluru observing Mumbai roads during partitions will warn on lack of authority contact.
