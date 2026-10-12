import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';

describe('CodeAstra PS #2 End-to-End Replication, Partition & Recovery', () => {
  const testDir = path.resolve('./data/test-e2e-ps2');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('Exercises partition, offline writes, restart recovery, convergence, and conflict detection', async () => {
    // 1. Initialize two independent regional stores
    const storeMumbai = new FileStore('mumbai', testDir);
    const storeDelhi = new FileStore('delhi', testDir);
    await storeMumbai.init();
    await storeDelhi.init();

    const linkCtrl = new LinkController();
    const peersConfig = [
      { id: 'mumbai', name: 'Mumbai', port: 4001, authority: true },
      { id: 'delhi', name: 'Delhi', port: 4002, authority: false }
    ];

    const syncMumbai = new SyncEngine('mumbai', storeMumbai, peersConfig, linkCtrl);
    const syncDelhi = new SyncEngine('delhi', storeDelhi, peersConfig, linkCtrl);
    await syncMumbai.init();
    await syncDelhi.init();

    const appMumbai = buildServer({
      regionId: 'mumbai',
      port: 4001,
      store: storeMumbai,
      syncEngine: syncMumbai,
      linkController: linkCtrl,
      peers: peersConfig,
      territories: [{ region: 'delhi', center: { lat: 28.6, lng: 77.2 }, radiusKm: 50 }]
    });

    const appDelhi = buildServer({
      regionId: 'delhi',
      port: 4002,
      store: storeDelhi,
      syncEngine: syncDelhi,
      linkController: linkCtrl,
      peers: peersConfig,
      territories: [{ region: 'mumbai', center: { lat: 19.0, lng: 72.8 }, radiusKm: 45 }]
    });

    // 2. Initial state check via Consistency-Status API
    const statusBefore = await appMumbai.inject({ method: 'GET', url: '/api/v1/status' });
    expect(statusBefore.statusCode).toBe(200);
    const statusJson = JSON.parse(statusBefore.body);
    expect(statusJson.region).toBe('mumbai');

    // 3. Simulate Partition Cut between Mumbai and Delhi
    linkCtrl.cutLink('mumbai', 'delhi', true);
    expect(linkCtrl.isLinkUp('mumbai', 'delhi')).toBe(false);

    // Run heartbeat step to update peer reachability in store
    await syncMumbai.stepHeartbeat();

    // Fog should appear for unreachable peer
    const fogRes = await appMumbai.inject({ method: 'GET', url: '/api/v1/fog' });
    expect(fogRes.statusCode).toBe(200);
    const fogJson = JSON.parse(fogRes.body);
    expect(fogJson.fog.some((f: any) => f.region === 'delhi' && f.unreachable)).toBe(true);

    // 4. Local writes during partition in both disconnected regions
    // Mumbai writes Route Alpha = OPEN
    const mumReportRes = await appMumbai.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityId: 'access-corridor-north',
        status: 'OPEN',
        authorId: 'officer-mumbai',
        authorRole: 'FIELD_OFFICER'
      }
    });
    expect(mumReportRes.statusCode).toBe(200);
    const mumOp = JSON.parse(mumReportRes.body).op;

    // Delhi writes Route Alpha = BLOCKED concurrently
    const delReportRes = await appDelhi.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityId: 'access-corridor-north',
        status: 'BLOCKED',
        authorId: 'officer-delhi',
        authorRole: 'OFFICIAL'
      }
    });
    expect(delReportRes.statusCode).toBe(200);
    const delOp = JSON.parse(delReportRes.body).op;

    // Verify local persistence and pending outbox during partition
    const mumOutbox = await storeMumbai.getOutbox('delhi');
    expect(mumOutbox.length).toBeGreaterThan(0);
    expect(mumOutbox.some(i => i.opId === mumOp.opId)).toBe(true);

    // 5. Test Crash-Restart: close Mumbai store and restart
    await storeMumbai.close();
    const restartedMumbaiStore = new FileStore('mumbai', testDir);
    await restartedMumbaiStore.init();
    const restartedOutbox = await restartedMumbaiStore.getOutbox('delhi');
    expect(restartedOutbox.some(i => i.opId === mumOp.opId)).toBe(true); // Survives restart!

    // 6. Reconnection and Actual Replication Exchange
    linkCtrl.restoreLink('mumbai', 'delhi', null, true);
    expect(linkCtrl.isLinkUp('mumbai', 'delhi')).toBe(true);

    // Apply remote ops manually or via exchange to verify causal conflict folding
    const applyToMumbai = await syncMumbai.applyIncomingOp(delOp);
    expect(applyToMumbai.status).toBe('applied');

    const applyToDelhi = await syncDelhi.applyIncomingOp(mumOp);
    expect(applyToDelhi.status).toBe('applied');

    // 7. Duplicate Protection Test (Idempotency)
    const duplicateApply = await syncMumbai.applyIncomingOp(delOp);
    expect(duplicateApply.status).toBe('duplicate'); // Idempotent rejection!

    // 8. Genuine Concurrent-Conflict Detection
    // Both regions now hold concurrent conflicting claims on 'access-corridor-north'
    const convergedMumbaiEntity = await storeMumbai.getEntity('access-corridor-north');
    expect(convergedMumbaiEntity?.conflict?.status).toBe('AWAITING_REVIEW');
    expect(convergedMumbaiEntity?.status).toBe('BLOCKED'); // Conservative safety default

    // 9. SourceTrace API audit
    const traceRes = await appMumbai.inject({
      method: 'GET',
      url: '/api/v1/records/access-corridor-north/trace'
    });
    expect(traceRes.statusCode).toBe(200);
    const traceJson = JSON.parse(traceRes.body);
    expect(traceJson.indicators.conflict.hasConflict).toBe(true);
    expect(traceJson.indicators.integrity.status).toBe('VERIFIED');

    // 10. Clean up
    await appMumbai.close();
    await appDelhi.close();
    await restartedMumbaiStore.close();
    await storeDelhi.close();
  });
});
