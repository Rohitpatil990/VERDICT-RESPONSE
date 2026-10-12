import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';

describe('Region Service & Integration', () => {
  const testDir = path.resolve('./data/test-tmp');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('Durable Outbox survives crash and restart without data loss', async () => {
    // 1. Initial startup
    let store = new FileStore('mumbai', testDir);
    await store.init();

    const peers = [{ id: 'delhi', name: 'Delhi', port: 4002, authority: false }];
    const linkCtrl = new LinkController();
    let sync = new SyncEngine('mumbai', store, peers, linkCtrl);
    await sync.init();

    // Create an op while peer is unreachable
    linkCtrl.cutLink('mumbai', 'delhi');
    const op = await sync.submitLocalOp('REPORT', 'road-r7', { status: 'OPEN' }, 'author-1');

    const outboxBefore = await store.getOutbox('delhi');
    expect(outboxBefore.length).toBe(1);
    expect(outboxBefore[0].opId).toBe(op.opId);

    // Simulate crash/restart: close and reload from disk
    await store.close();

    // 2. Restart from persistent files
    const restartedStore = new FileStore('mumbai', testDir);
    await restartedStore.init();

    const outboxAfter = await restartedStore.getOutbox('delhi');
    expect(outboxAfter.length).toBe(1);
    expect(outboxAfter[0].opId).toBe(op.opId);

    const reloadedOp = await restartedStore.getOp(op.opId);
    expect(reloadedOp).not.toBeNull();
    expect(reloadedOp?.entityId).toBe('road-r7');

    await restartedStore.close();
  });

  it('Regional Fastify server handles status, reports, and gate evaluation', async () => {
    const store = new FileStore('mumbai', testDir);
    await store.init();
    const linkCtrl = new LinkController();
    const sync = new SyncEngine('mumbai', store, [], linkCtrl);
    await sync.init();

    const app = buildServer({
      regionId: 'mumbai',
      port: 4999,
      store,
      syncEngine: sync,
      linkController: linkCtrl,
      peers: [],
      territories: []
    });

    // Test GET /api/v1/status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/status'
    });
    expect(statusRes.statusCode).toBe(200);
    const statusData = JSON.parse(statusRes.body);
    expect(statusData.region).toBe('mumbai');

    // Test POST /api/v1/reports
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityId: 'road-r7',
        status: 'OPEN',
        authorId: 'test-user',
        authorRole: 'FIELD_OFFICER'
      }
    });
    expect(reportRes.statusCode).toBe(200);

    // Test POST /api/v1/decisions/evaluate (Decision Gate)
    const gateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/decisions/evaluate',
      payload: {
        type: 'DISPATCH',
        entityId: 'road-r7',
        params: { routeEntityIds: ['road-r7'] },
        actorId: 'operator',
        actorRole: 'OFFICIAL'
      }
    });
    expect(gateRes.statusCode).toBe(200);
    const gateData = JSON.parse(gateRes.body);
    expect(gateData.verdict).toBe('GO');
    expect(gateData.disclaimer).toContain('GO means the information this decision relies on');

    await app.close();
  });

  it('Tamper and Verify API accurately detects byte mutation', async () => {
    const store = new FileStore('mumbai', testDir);
    await store.init();
    const linkCtrl = new LinkController();
    const sync = new SyncEngine('mumbai', store, [], linkCtrl);
    await sync.init();

    const app = buildServer({
      regionId: 'mumbai',
      port: 4998,
      store,
      syncEngine: sync,
      linkController: linkCtrl,
      peers: [],
      territories: []
    });

    const op = await sync.submitLocalOp('REPORT', 'road-r1', { status: 'OPEN' }, 'test-user');

    // Verify initially passes
    const verifyBefore = await app.inject({
      method: 'POST',
      url: `/api/v1/ops/${op.opId}/verify`
    });
    expect(JSON.parse(verifyBefore.body).status).toBe('VERIFIED');

    // Admin flips 1 byte
    const tamperRes = await app.inject({
      method: 'POST',
      url: '/admin/tamper',
      payload: { opId: op.opId }
    });
    expect(tamperRes.statusCode).toBe(200);

    // Verify now reports FAILED
    const verifyAfter = await app.inject({
      method: 'POST',
      url: `/api/v1/ops/${op.opId}/verify`
    });
    expect(JSON.parse(verifyAfter.body).status).toBe('FAILED');

    await app.close();
  });
});
