# VERDICT 3-Minute Live Demo Script
*CodeAstra 2.0 Final · Problem Statement #2*

### (0:00 - 0:20) Phase 1: Normal Converged State & Multi-Lingual Console
1. Open `http://localhost:3000`. Show the Operations Map centered on disaster logistics hubs and corridors.
2. Point to the top bar: **"Viewing from: Mumbai (Authority)"**. The live status dot is green.
3. Switch language to **मराठी** and **हिन्दी** via the top switcher. Point out that all navigation, gate checks, and indicators have native key parity.
4. Open the **Escrow Supplies** view: Show global Medical Kits stock = 5, divided into Mumbai rights = 3, Delhi rights = 2.

### (0:20 - 0:35) Phase 2: Partition Cut & Fog of Information
1. Navigate to **Regions & Sync**. Click **"Cut Link (DELHI)"**.
2. Immediately show the top **Partition Ribbon**: `"DEGRADED: MUMBAI↔DELHI down — local writes OK, escrow-limited commitments"`.
3. Return to **Operations Map**: Delhi's territory is now covered in an **indigo-grey hatch pattern veil (Fog of Information)**.
4. Show the legend chip: `"Fog: Delhi unreachable · last heard 12s ago · last known seq 120"`.
5. Point out the honest disclaimer: *"Fog means no recent information from this region. It does not mean nothing is happening there."*

### (0:35 - 1:05) Phase 3: Autonomous Writes & Decision Gate
1. In Mumbai, click **Report Here** on `access-corridor-north` and report **OPEN** (`FIELD_OFFICER` tier).
2. Open **Decision Gate**: Evaluate **"DISPATCH Team T-12 via access-corridor-north"**.
3. Mumbai Gate returns **GO** (Authority territory reachable, clean fresh observation). Commit receipt.
4. Switch **"Viewing from: Delhi"**. A field team in Delhi reports `access-corridor-north` **BLOCKED** (`OFFICIAL` tier).
5. Delhi evaluates the same dispatch: Gate returns **CAUTION** with reason: *"Mumbai (authority) unreachable; newer updates may exist"*.
6. Show that a non-reviewer attempting to close **Incident #101** receives **HOLD** (*"Closure requires reviewer confirmation"*).

### (1:05 - 1:30) Phase 4: Escrow Under Partition (5 / 3 / 4 Case)
1. Open **Supplies**: Mumbai allocates 3 medical kits against its local rights (3) -> **GO**.
2. Switch to Delhi: Delhi requests 4 medical kits.
3. Show the result: **2 granted** (Delhi's remaining quota), **2 queued as UNMET**.
4. Invariant chip: $\sum \text{spent} \le 5$ in every replica's view. Zero over-allocation!

### (1:30 - 2:00) Phase 5: Reconnect with Bandwidth Cap & Blast Radius
1. In **Regions & Sync**, click **"Reconnect (10 KB/s Cap)"**.
2. Critical operations (L1) sync first.
3. The Fog of Information recedes with a real counter: `"N operations revealed"`.
4. Open **Merge Reports**: Show the PR-style report diffing ops created, ops synced, and bandwidth savings (~97% reduction).
5. Show **Review Inbox**: `access-corridor-north` is flagged **Awaiting human review** with both claims side-by-side; neither was silently overwritten with LWW!
6. Open **Blast Radius**: Mumbai's earlier dispatch decision is flagged **NEEDS_RECHECK** with then-vs-now side-by-side diff.

### (2:00 - 2:20) Phase 6: Human Review Adjudication
1. In **Review Inbox**, Certified Reviewer Alice reviews ground sensor evidence and signs resolution: **BLOCKED**.
2. Click **"Re-evaluate in Gate Now"**: The new decision returns **HOLD** (route blocked), preventing dispatch onto an impassable corridor.

### (2:20 - 2:40) Phase 7: Regional Loss & Recovery Simulation (Local Multi-Process)
1. Run `node scripts/test-regional-loss-and-recovery.js`.
2. Demonstrate simulated catastrophic loss of Delhi's active database file.
3. Node restarts and auto-recovers from the local standby recovery replica snapshot with 0 data loss.
4. *Honesty Note:* Recovery copy is preserved on local standby replica storage (simulated DR; not multi-cloud or AWS).

### (2:40 - 3:00) Phase 8: Chaos Lab & Cryptographic Tamper Self-Healing
1. Open **Ledger & Verify**: Select an op. Click **Verify Cryptographic Chain** -> **VERIFIED**.
2. Click **"Flip 1 Byte"**: Payload mutated on disk. Verify now reports **FAILED** with exact hash mismatch.
3. Click **"Heal from Peer"**: Authoritative copy pulled from remote peer and re-verified -> **VERIFIED**.
4. Closing: *"VERDICT doesn't just replicate data. It tells you what you can't see, what you can safely commit, whether it is safe to act, and which decisions the new truth puts in question."*
