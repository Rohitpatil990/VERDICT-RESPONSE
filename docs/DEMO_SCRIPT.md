# VERDICT Response — 3-Minute Live Scripted Demo Script
CodeAstra 2.0 Final · PS #2 "Geo-Distributed Disaster Data Replication with Graceful Degradation"

---

## **Minute 0:00 — Introduction & Map Operations**
- **Action:** Open browser at `http://localhost:3000`.
- **Display:** Full-screen interactive map opens centered on Mumbai (Kurla West). All three regions (Mumbai, Delhi, Bengaluru) show status `L0_FULL` (Green beacons). Inter-region link lines are active and solid green.
- **Presenter says:**
  > *"Welcome to VERDICT Response. This is a working prototype of a geo-distributed disaster intelligence platform designed for catastrophic network partitions. Unlike conventional dashboards that show a single shared cloud database, VERDICT operates three genuinely independent regional nodes in Mumbai, Delhi, and Bengaluru, each running its own local SQLite persistence store."*
- **Action:** Click language switcher at top right to `मराठी` (Marathi) and back to `English` to demonstrate first-class Devanagari localization.

---

## **Minute 0:20 — Field Worker Reporting & Acknowledgement Ladder**
- **Action:** Click **"Report at this location"** at Kurla West junction.
- **Form:** Select `Urban Flooding`, enter: *"Submerged subway with 3ft rising water"*, confirm severity `HIGH`. Click **"Sign & Submit"**.
- **Display:** Show the real-time acknowledgement ladder:
  1. *Saved on device* (Local buffer)
  2. *Saved in Mumbai local store* (Atomic SQLite transaction + outbox commit)
  3. *Replicating across regions...*
- **Verification:** Switch **"Viewing from"** selector to `Delhi`. The marker immediately appears in Delhi’s view! All 3 nodes hold the signed op.

---

## **Minute 0:40 — Network Partition & Concurrent Contradictory Updates**
- **Action:** Navigate to **Chaos Lab** tab. Under *Network Partition Simulation*, click **"Sever Link"** on `Mumbai ↔ Delhi`.
- **Display:** The link line between Mumbai and Delhi turns dashed red. Degradation ladder transitions from `L0_FULL` to `L1_DEGRADED`.
- **Action:**
  1. In **Mumbai view**, submit a road report on `road-lbs-marg`: Status `BLOCKED` (submerged).
  2. Switch to **Delhi view**, submit a report on the *same road* `road-lbs-marg`: Status `OPEN` (drone survey).
  3. In Delhi view, request 4 units of medical trauma kits. In Mumbai view, request 3 units of the same 5-unit stock (Total 7 > 5).
- **Presenter says:**
  > *"During this partition, both regions continue accepting local writes with zero downtime. Notice the markers show dashed rings indicating 'Pending synchronization'. Neither region falsely claims remote receipt."*

---

## **Minute 1:15 — Reconnection with Bandwidth Throttling & Delta Anti-Entropy**
- **Action:** In Chaos Lab, click **"Restore Link"** on `Mumbai ↔ Delhi` with simulated 80ms latency.
- **Display:** The link line turns green. Anti-entropy exchanges version vectors.
- **Verification:**
  - Critical medical and stranded reports replicate first on the L1 priority lane.
  - The **Efficiency Panel** displays measured numbers: *90% bandwidth saved* using delta ops vs sending a full state snapshot.
  - Version vectors and Merkle state roots re-converge.

---

## **Minute 1:45 — Explicit Conflict Resolution & Bounded Escrow Settlement**
- **Action:** Open **Conflicts & Review** tab.
- **Display:** The road `road-lbs-marg` is flagged as `Awaiting human review` due to safety-critical contradiction (BLOCKED vs OPEN).
- **Action:** Click **"Choose This State"** on Mumbai's BLOCKED report with justification: *"Ground inspection verified heavy waterlogging"*. Submit signed resolution.
- **Action:** Open **Relief Supplies** tab.
  - Show the 5 available medical kits.
  - Mumbai requested 3, Delhi requested 4.
  - Show the settled outcome: Delhi granted 4 kits, Mumbai granted 1 kit + 2 kits **Backordered** with full policy trace. Zero kits oversold.

---

## **Minute 2:15 — SourceTrace Drawer & Decision-Safe Intelligence**
- **Action:** On the map, click the Kurla incident marker to open the **SourceTrace Drawer**.
- **Display:** Show the **Six Standalone Indicators**:
  1. **Source:** Field Officer (origin: Mumbai)
  2. **Freshness:** < 15 min (Server verified)
  3. **Conflict:** None (Resolved)
  4. **Replication:** Synchronized (3 of 3 regions)
  5. **Integrity:** Verified (Ed25519 signature valid)
  6. **Resolution:** Settled under policy
- **Presenter points out:**
  > *"Notice we never collapse these into a single fake 'trust score'. Each indicator informs a distinct operational decision. And notice our mandatory cryptographic footnote: A verified signature proves the record was signed by the key and untampered; it does not claim the observation is factually true."*

---

## **Minute 2:35 — Cryptographic Tamper & Self-Healing**
- **Action:** In Chaos Lab, click **"Flip 1 Byte in DB"**.
- **Display:** Open SourceTrace on the tampered record. The Integrity chip immediately flips to **Integrity FAILED**, identifying the exact canonical hash mismatch!
- **Action:** Click **"Heal Ledger"**. The record is restored and re-verifies as **Verified**.

---

## **Minute 2:50 — Conclusion**
- **Presenter closes:**
  > *"VERDICT Response doesn't just show where a disaster is reported. It shows how far each report can be relied on, traces where it originated, how it propagated across disconnected regions, and why its final state was accepted, without losing the evidence behind conflicting updates."*
