# VERDICT Response — Setup & Reproduction Guide
CodeAstra 2.0 Final · PS #2 "Geo-Distributed Disaster Data Replication with Graceful Degradation"

---

## 1. System Prerequisites
- **Node.js:** v20.x or v22.x+ (tested on Node v24.12.0)
- **Package Manager:** npm (v10+ or v11+)
- **Operating System:** Windows, macOS, or Linux
- **No external database server or Docker daemon required:** Each regional node runs a genuine, independent SQLite database file (`data/mumbai.db`, `data/delhi.db`, `data/bengaluru.db`) utilizing Node's built-in C-engine `DatabaseSync` (`node:sqlite`). Zero flaky setup!

---

## 2. Quick Start (One Command)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build All Packages
```bash
npm run build
```

### Step 3: Seed Synthetic Disaster Scenario Data
```bash
npm run seed
```
*Seeds the synthetic Mumbai monsoon flooding scenario (Kurla waterlogging, Dharavi shelters, road statuses, and the 5-stock trauma medical kits) through the signed operation hash-chain pipeline.*

### Step 4: Launch the Full Multi-Region System
```bash
npm run dev
```
This starts:
- **Mumbai Regional Service:** `http://localhost:4001` (Store: `data/mumbai.db`)
- **Delhi Regional Service:** `http://localhost:4002` (Store: `data/delhi.db`)
- **Bengaluru Regional Service:** `http://localhost:4003` (Store: `data/bengaluru.db`)
- **Operations Dashboard:** `http://localhost:3000`

Open `http://localhost:3000` in your browser.

---

## 3. Running Verification & Automated Tests

To run the complete unit, cryptographic, and multi-region integration test suites:
```bash
npm test
```
Or run individual test suites:
```bash
# Pure core tests (Canonical JSON, Ed25519, Version Vectors, Bounded Claims)
node --test packages/core/test/core.test.js

# Multi-region partition, sync, conflict, and tamper integration tests
node --test packages/region-service/test/integration.test.js
```

---

## 4. Running System Benchmarks
To measure local write throughput, p50/p95 latencies, state root recomputation times, and delta bandwidth efficiency on your machine:
```bash
npm run bench
```
*Outputs measured results directly to `docs/BENCH.md`.*

---

## 5. Simulating Failures & Partitions
All failure scenarios can be triggered interactively from the **Chaos Lab** tab in the dashboard at `http://localhost:3000`:
- **Sever/Restore Links:** Cut links between Mumbai, Delhi, and Bengaluru to simulate network partitions.
- **Flip 1 Byte in DB:** Injects single-byte hash corruption in the SQLite database to trigger cryptographic integrity failure.
- **Heal Ledger:** Restores the corrupted record and validates the hash chain.
- **Run 3-Min Scripted Demo:** Automates the complete competition walkthrough!
