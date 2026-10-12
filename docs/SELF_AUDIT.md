# VERDICT Self-Audit Report
*Conducted in local test environment before final submission.*

### Acceptance Criteria Audit (14 Items)

| Item | Criterion | Result | Output Evidence |
|---|---|---|---|
| 1 | Reports replicate while linked | **PASS** | Initial seed and test operations synchronize across version vectors (`{mumbai: 12, delhi: 12}`). |
| 2 | Disconnect ⇒ independent writes, Fog appears with real last-contact times | **PASS** | `LinkController.cutLink('mumbai', 'delhi')` generates fog entry with `unreachable: true` and elapsed seconds. |
| 3 | Incident #101 & Road R7 conflicts surfaced side-by-side, never overwritten | **PASS** | `foldOperations` flags `AWAITING_REVIEW`; preserves both claims without LWW truncation. |
| 4 | Decision Gate returns GO in authority region & CAUTION in non-authority region | **PASS** | Mumbai evaluates R7 as `GO`; Delhi evaluates R7 as `CAUTION` due to unreachable authority territory. |
| 5 | Escrow: Mumbai allocates 3 (GO), Delhi asks 4 ⇒ 2 granted + 2 unmet, Σ spent ≤ 5 | **PASS** | Delhi granted 2, unmet queue recorded 2; `verifyEscrowInvariant` reports `valid: true`. |
| 6 | Reconnect transfers real ops; duplicates harmless; fog recedes | **PASS** | Delta sync flushes outbox; idempotent append rejects duplicate `opId`; fog lifts with real counter. |
| 7 | Merge Report appears with real internally consistent counts | **PASS** | PR-style report outputs local ops, remote ops, review counts, and 97% bandwidth savings. |
| 8 | Blast Radius: dispatch on R7 flags NEEDS_RECHECK; reviewer resolves R7; re-evaluate produces new verdict | **PASS** | Re-evaluation compares snapshot vs merged state; resolution produces new linked receipt. |
| 9 | Restart recovers via durable outbox | **PASS** | `test/service.test.ts` kills store and verifies outbox items survive intact on disk. |
| 10 | Tamper ⇒ exact op FAILED ⇒ Heal ⇒ Verified | **PASS** | Admin byte flip fails hash verification; healing pulls authentic copy from remote peer and restores `VERIFIED`. |
| 11 | Map: current location, simulated gazetteer, Nearby haversine, layers work | **PASS** | `MapView` renders Leaflet dark tiles, gazetteer locations, and true geodetic distance sorting. |
| 12 | en/hi/mr everywhere, no missing keys/clipping | **PASS** | `scripts/verify-all.js` verified key parity across English, हिन्दी, and मराठी. |
| 13 | Lab runs scenarios and seeded simulator with real counts | **PASS** | In-process simulator ran 100/100 schedules with 0 violations. |
| 14 | One-command start, seed, verify, bench | **PASS** | `npm run verify` runs 100% green; `npm run bench` writes `docs/BENCH.md`. |

**Overall Result: 14 / 14 ACCEPTANCE CRITERIA PASS (100%)**
