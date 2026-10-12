import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';
import {
  ApiClient,
  AllRegionsUnavailableError,
  WriteOutcomeUnknownError,
  EscrowQuotaFenceError,
  FALLBACK_RINGS,
  generateClientTxId
} from '../../web/src/api/client.js';

describe('VERDICT — Client Failover & Reliability Acceptance Suite', () => {
  const testDir = path.resolve('./data/test-failover-suite');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  // Scenario 1: Normal requests to the preferred region
  it('Scenario 1: Normal requests to preferred region resolve directly without failover', async () => {
    const storeMumbai = new FileStore('mumbai', testDir);
    await storeMumbai.init();
    const linkCtrl = new LinkController();
    const syncMumbai = new SyncEngine('mumbai', storeMumbai, [], linkCtrl);
    await syncMumbai.init();

    const appMumbai = buildServer({
      regionId: 'mumbai',
      port: 4001,
      store: storeMumbai,
      syncEngine: syncMumbai,
      linkController: linkCtrl,
      peers: [],
      territories: []
    });

    await appMumbai.listen({ port: 4001, host: '127.0.0.1' });

    try {
      const client = new ApiClient('mumbai');
      const status = await client.getStatus('mumbai');

      expect(status.region).toBe('mumbai');
      expect(status._servingRegion).toBe('mumbai');
      expect(status._isFailover).toBe(false);
      expect(client.failoverState.isFailover).toBe(false);
      expect(client.failoverState.activeRegion).toBe('mumbai');
    } finally {
      await appMumbai.close();
      await storeMumbai.close();
    }
  });

  // Scenario 2: Preferred region unavailable; safe fallback to another region
  it('Scenario 2: Preferred region unavailable triggers deterministic safe read fallback', async () => {
    // Mumbai (4001) is offline. Delhi (4002) is online.
    const storeDelhi = new FileStore('delhi', testDir);
    await storeDelhi.init();
    const linkCtrl = new LinkController();
    const syncDelhi = new SyncEngine('delhi', storeDelhi, [], linkCtrl);
    await syncDelhi.init();

    const appDelhi = buildServer({
      regionId: 'delhi',
      port: 4002,
      store: storeDelhi,
      syncEngine: syncDelhi,
      linkController: linkCtrl,
      peers: [],
      territories: []
    });

    await appDelhi.listen({ port: 4002, host: '127.0.0.1' });

    try {
      const client = new ApiClient('mumbai');
      // Mumbai ring is ['mumbai', 'delhi', 'bengaluru']
      const status = await client.getStatus('mumbai');

      expect(status.region).toBe('delhi');
      expect(status._servingRegion).toBe('delhi');
      expect(status._isFailover).toBe(true);
      expect(client.failoverState.isFailover).toBe(true);
      expect(client.failoverState.preferredRegion).toBe('mumbai');
      expect(client.failoverState.activeRegion).toBe('delhi');
    } finally {
      await appDelhi.close();
      await storeDelhi.close();
    }
  });

  // Scenario 3: All regions unavailable
  it('Scenario 3: When all regions in ring are unreachable, throws AllRegionsUnavailableError', async () => {
    // No servers listening on 4001, 4002, 4003
    const client = new ApiClient('mumbai');

    await expect(client.getStatus('mumbai')).rejects.toThrow(AllRegionsUnavailableError);
  });

  // Scenario 4: A write times out after it may have been accepted
  it('Scenario 4: In-flight write timeout surfaces explicit WriteOutcomeUnknownError without blind retry', async () => {
    const client = new ApiClient('mumbai');
    const clientTxId = generateClientTxId();

    // Mock fetch that simulates timeout abort while request is in-flight
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const abortErr = new Error('The operation was aborted due to timeout');
      abortErr.name = 'AbortError';
      throw abortErr;
    }) as any;

    try {
      await expect(
        client.submitReport({ entityId: 'access-corridor-north', status: 'OPEN', clientTxId }, 'mumbai')
      ).rejects.toThrow(WriteOutcomeUnknownError);

      try {
        await client.submitReport({ entityId: 'access-corridor-north', status: 'OPEN', clientTxId }, 'mumbai');
      } catch (err: any) {
        expect(err).toBeInstanceOf(WriteOutcomeUnknownError);
        expect(err.clientTxId).toBe(clientTxId);
        expect(err.targetRegion).toBe('mumbai');
        expect(err.message).toContain('Write outcome UNKNOWN');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Scenario 5: Retrying an operation with same transaction ID does not duplicate it
  it('Scenario 5: Retrying with same clientTxId is strictly idempotent on same node and cross-cluster', async () => {
    const store = new FileStore('mumbai', testDir);
    await store.init();
    const linkCtrl = new LinkController();
    const sync = new SyncEngine('mumbai', store, [], linkCtrl);
    await sync.init();

    const clientTxId = 'tx-test-idempotency-101';
    const payload = { incidentType: 'road_condition', status: 'OPEN', clientTxId };

    // 1. Initial local submission
    const op1 = await sync.submitLocalOp('REPORT', 'access-corridor-north', payload, 'agent-1');
    const opsAfterFirst = await store.getOps();
    expect(opsAfterFirst.length).toBe(1);

    // 2. Retry with same clientTxId (response was lost)
    const op2 = await sync.submitLocalOp('REPORT', 'access-corridor-north', payload, 'agent-1');
    const opsAfterRetry = await store.getOps();

    // Exactly 1 operation exists in the store! Zero duplication!
    expect(opsAfterRetry.length).toBe(1);
    expect(op2.opId).toBe(op1.opId);
    expect(op2.seq).toBe(op1.seq);

    // 3. Test incoming replication idempotency with same clientTxId
    const remoteOp = {
      ...op1,
      opId: 'delhi:99', // even if another node assigned a different opId for same clientTxId
      region: 'delhi' as const,
      seq: 99
    };
    const incomingResult = await sync.applyIncomingOp(remoteOp);
    expect(incomingResult.status).toBe('duplicate');
    const opsAfterRemote = await store.getOps();
    expect(opsAfterRemote.length).toBe(1); // Still exactly 1!

    await store.close();
  });

  // Scenario 6: Acknowledged local writes survive tested restart/recovery scenario
  it('Scenario 6: Acknowledged local writes survive crash and persistent store restart', async () => {
    let store = new FileStore('delhi', testDir);
    await store.init();
    const linkCtrl = new LinkController();
    let sync = new SyncEngine('delhi', store, [], linkCtrl);
    await sync.init();

    const clientTxId = 'tx-survive-restart-202';
    const op = await sync.submitLocalOp('REPORT', 'corridor-alpha', { status: 'OPEN', clientTxId }, 'author-delhi');
    expect(op.opId).toBe('delhi:1');

    // Crash simulation
    await store.close();

    // Restart from persistent database file
    const restartedStore = new FileStore('delhi', testDir);
    await restartedStore.init();

    const loadedOp = await restartedStore.getOp('delhi:1');
    expect(loadedOp).not.toBeNull();
    expect(loadedOp?.payload?.clientTxId).toBe(clientTxId);
    expect(loadedOp?.entityId).toBe('corridor-alpha');

    await restartedStore.close();
  });

  // Scenario 7: Conflicting updates are still preserved after reconnection
  it('Scenario 7: Conflicting updates remain preserved side-by-side with AWAITING_REVIEW status', async () => {
    const storeMumbai = new FileStore('mumbai', testDir);
    const storeDelhi = new FileStore('delhi', testDir);
    await storeMumbai.init();
    await storeDelhi.init();

    const linkCtrl = new LinkController();
    const peers = [
      { id: 'mumbai', name: 'Mumbai', port: 4001, authority: true },
      { id: 'delhi', name: 'Delhi', port: 4002, authority: false }
    ];

    const syncMumbai = new SyncEngine('mumbai', storeMumbai, peers, linkCtrl);
    const syncDelhi = new SyncEngine('delhi', storeDelhi, peers, linkCtrl);
    await syncMumbai.init();
    await syncDelhi.init();

    // Partition cut
    linkCtrl.cutLink('mumbai', 'delhi', true);

    // Mumbai writes OPEN
    const mumOp = await syncMumbai.submitLocalOp(
      'REPORT',
      'access-corridor-north',
      { status: 'OPEN', incidentType: 'road_condition' },
      'mumbai-user'
    );

    // Delhi writes BLOCKED
    const delOp = await syncDelhi.submitLocalOp(
      'REPORT',
      'access-corridor-north',
      { status: 'BLOCKED', incidentType: 'road_condition' },
      'delhi-user'
    );

    // Reconnection & sync
    linkCtrl.restoreLink('mumbai', 'delhi', null, true);
    await syncMumbai.applyIncomingOp(delOp);
    await syncDelhi.applyIncomingOp(mumOp);

    const mergedMumbai = await storeMumbai.getEntity('access-corridor-north');
    const mergedDelhi = await storeDelhi.getEntity('access-corridor-north');

    expect(mergedMumbai?.conflict?.status).toBe('AWAITING_REVIEW');
    expect(mergedDelhi?.conflict?.status).toBe('AWAITING_REVIEW');
    expect(mergedMumbai?.status).toBe('BLOCKED'); // Conservative fail-safe preserved
    expect(mergedDelhi?.status).toBe('BLOCKED');

    await storeMumbai.close();
    await storeDelhi.close();
  });

  // Scenario 8: Dashboard & ApiClient accurately shows selected region, failover state, and quota fencing
  it('Scenario 8: Escrow spending is quota-fenced and blocks cross-region diversion', async () => {
    const client = new ApiClient('mumbai');

    // Attempting to spend escrow on an unreachable node throws EscrowQuotaFenceError
    // rather than silently diverting the spend to another region's quota!
    await expect(client.spendEscrow('medical_kits', 2, 'mumbai')).rejects.toThrow(EscrowQuotaFenceError);

    try {
      await client.spendEscrow('medical_kits', 2, 'mumbai');
    } catch (err: any) {
      expect(err).toBeInstanceOf(EscrowQuotaFenceError);
      expect(err.targetRegion).toBe('mumbai');
      expect(err.message).toContain('Cannot failover spendEscrow to another region');
    }
  });
});
