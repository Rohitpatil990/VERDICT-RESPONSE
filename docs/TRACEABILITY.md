# Requirements Traceability Matrix

| Brief / Prompt Requirement | Implementation File(s) | Verification / Test |
|---|---|---|
| **Two or more replicas with separate persistence** | `packages/region-service/src/index.ts`, `packages/region-service/src/store/file-store.ts` | `data/{mumbai,delhi,bengaluru}.db.json` |
| **Replication Protocol with delta anti-entropy** | `packages/core/src/vector.ts`, `packages/region-service/src/sync/sync-engine.ts` | `packages/core/test/core.test.ts` (diffVectors) |
| **Partition simulation & Link Controller** | `packages/region-service/src/network/link-controller.ts`, `POST /admin/link` | `test/service.test.ts`, Lab View |
| **Defined Conflict Resolution Policy** | `packages/core/src/policy.ts` (Incident #101 & Road R7 fold) | `test/core.test.ts`, Review Inbox |
| **Recovery & PR-Style Merge Report** | `packages/region-service/src/sync/sync-engine.ts`, `packages/web/src/views/MergeReportsView.tsx` | Merge Reports screen, `npm run demo` |
| **Consistency Status API** | `packages/region-service/src/server.ts` (`/status`, `/fog`, `/trace`) | `contracts/openapi.yaml`, Swagger UI |
| **Operational Dashboard (SaaS-grade)** | `packages/web/src/components/Shell.tsx`, `packages/web/src/views/*` | `npm run build --workspace=@verdict/web` |
| **Decision Gate (GO · CAUTION · HOLD)** | `packages/core/src/gate.ts`, `packages/web/src/views/GateView.tsx` | `test/core.test.ts`, Decision Gate screen |
| **Decision Receipts & Conflict Blast Radius** | `packages/core/src/reevaluation.ts`, `packages/web/src/views/BlastRadiusView.tsx` | `test/core.test.ts`, Blast Radius screen |
| **Fog of Information** | `packages/core/src/fog.ts`, `packages/web/src/views/MapView.tsx` | Map hatch pattern, `test/core.test.ts` |
| **Escrow Bounded Counters** | `packages/core/src/escrow.ts`, `packages/web/src/views/SuppliesView.tsx` | `test/core.test.ts` (verifyEscrowInvariant) |
| **Multi-Lingual Parity (EN, HI, MR)** | `assets/i18n/{en,hi,mr}.json`, `packages/web/src/i18n.ts` | `scripts/verify-all.js` parity check |
| **Cryptographic Signing & Tamper Healing** | `packages/core/src/crypto.ts`, `POST /admin/tamper`, `POST /admin/heal` | `test/service.test.ts`, Ledger screen |
| **Transactional Outbox Crash Recovery** | `packages/region-service/src/store/file-store.ts` | `test/service.test.ts` (outbox survives crash) |
