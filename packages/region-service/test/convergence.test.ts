import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  computeCanonicalStateHash,
  computeOperationLogHash,
  evaluateConvergencePair,
  canonicalJson,
  createSignedOp,
  calculateOpHash,
  verifySignature,
  getPublicKey,
  SEED_PRIVATE_KEYS,
  Entity,
  EscrowResourceState,
  Operation
} from '@verdict/core';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';

describe('VERDICT — Hash-Based Convergence Verification Acceptance Suite', () => {
  const testDir = path.resolve('./data/test-convergence');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  // 1. Identical canonical states produce identical hashes
  it('Scenario 1: Identical canonical states produce identical hashes', () => {
    const entityA: Entity = {
      entityId: 'road-alpha',
      type: 'road',
      authorityRegion: 'mumbai',
      status: 'OPEN',
      attributes: { width: 12, surface: 'asphalt' },
      versionVector: { mumbai: 2, delhi: 1 },
      participatingOpIds: ['mumbai:1', 'mumbai:2', 'delhi:1'],
      integrity: 'VERIFIED',
      lastObservedAt: 1000,
      lastUpdatedAt: 1000
    };

    const entityB: Entity = {
      entityId: 'road-alpha',
      type: 'road',
      authorityRegion: 'mumbai',
      status: 'OPEN',
      attributes: { width: 12, surface: 'asphalt' },
      versionVector: { mumbai: 2, delhi: 1 },
      participatingOpIds: ['delhi:1', 'mumbai:2', 'mumbai:1'], // Different array order
      integrity: 'VERIFIED',
      lastObservedAt: 9999, // Local wall clock observation jitter
      lastUpdatedAt: 9999
    };

    const escrowA: EscrowResourceState = {
      resource: 'fuel_liters',
      total: 5000,
      rights: { mumbai: 3000, delhi: 2000 },
      spent: { mumbai: 500 },
      unmetQueue: []
    };

    const escrowB: EscrowResourceState = {
      resource: 'fuel_liters',
      total: 5000,
      rights: { delhi: 2000, mumbai: 3000 }, // Different key order
      spent: { mumbai: 500 },
      unmetQueue: []
    };

    const hashResultA = computeCanonicalStateHash([entityA], [escrowA]);
    const hashResultB = computeCanonicalStateHash([entityB], [escrowB]);

    expect(hashResultA.hash).toBe(hashResultB.hash);
    expect(hashResultA.hash).toHaveLength(64);
  });

  // 2. Different logical states produce different hashes in tested cases
  it('Scenario 2: Different logical states produce different hashes in tested cases', () => {
    const entityOpen: Entity = {
      entityId: 'road-alpha',
      type: 'road',
      authorityRegion: 'mumbai',
      status: 'OPEN',
      attributes: { hazardLevel: 'none' },
      versionVector: { mumbai: 1 },
      participatingOpIds: ['mumbai:1'],
      integrity: 'VERIFIED',
      lastObservedAt: 1000,
      lastUpdatedAt: 1000
    };

    const entityBlocked: Entity = {
      entityId: 'road-alpha',
      type: 'road',
      authorityRegion: 'mumbai',
      status: 'BLOCKED',
      attributes: { hazardLevel: 'flood' },
      versionVector: { mumbai: 2 },
      participatingOpIds: ['mumbai:1', 'mumbai:2'],
      integrity: 'VERIFIED',
      lastObservedAt: 1000,
      lastUpdatedAt: 1000
    };

    const hashOpen = computeCanonicalStateHash([entityOpen]);
    const hashBlocked = computeCanonicalStateHash([entityBlocked]);

    expect(hashOpen.hash).not.toBe(hashBlocked.hash);
  });

  // 3. Different object-key ordering does not change canonical hash
  it('Scenario 3: Different object-key ordering does not change canonical hash', () => {
    const ent1: any = {
      entityId: 'shelter-1',
      type: 'shelter',
      authorityRegion: 'delhi',
      status: 'ACTIVE',
      attributes: { capacity: 200, occupants: 120, water: true },
      versionVector: { delhi: 3 },
      participatingOpIds: ['delhi:1'],
      integrity: 'VERIFIED'
    };

    const ent2: any = {
      attributes: { water: true, occupants: 120, capacity: 200 },
      integrity: 'VERIFIED',
      authorityRegion: 'delhi',
      status: 'ACTIVE',
      type: 'shelter',
      entityId: 'shelter-1',
      versionVector: { delhi: 3 },
      participatingOpIds: ['delhi:1']
    };

    const res1 = computeCanonicalStateHash([ent1]);
    const res2 = computeCanonicalStateHash([ent2]);

    expect(res1.hash).toBe(res2.hash);
  });

  // 4. Replicas with missing operations are not marked converged
  it('Scenario 4: Replicas with missing operations are not marked converged', () => {
    const local = {
      region: 'mumbai',
      stateHash: '1111111111111111111111111111111111111111111111111111111111111111',
      outboxPending: 2, // Operations waiting to replicate
      unresolvedConflicts: 0,
      versionVector: { mumbai: 5, delhi: 2 }
    };

    const peer = {
      region: 'delhi',
      reachable: true,
      stateHash: '1111111111111111111111111111111111111111111111111111111111111111',
      outboxPending: 0,
      unresolvedConflicts: 0,
      versionVector: { mumbai: 3, delhi: 2 } // Missing ops 4 and 5
    };

    const evalRes = evaluateConvergencePair(local, peer);
    expect(evalRes.status).toBe('SYNCING');
    expect(evalRes.status).not.toBe('CONVERGED');
  });

  // 5. A network partition results in an appropriate non-converged status when states differ
  it('Scenario 5: A network partition results in an appropriate non-converged status when states differ', async () => {
    const storeMumbai = new FileStore('mumbai', testDir);
    const storeDelhi = new FileStore('delhi', testDir);
    await storeMumbai.init();
    await storeDelhi.init();

    const linkCtrl = new LinkController();
    const peersConfig = [
      { id: 'mumbai', name: 'Mumbai', port: 4881, authority: true },
      { id: 'delhi', name: 'Delhi', port: 4882, authority: false }
    ];

    const syncMumbai = new SyncEngine('mumbai', storeMumbai, peersConfig, linkCtrl);
    const syncDelhi = new SyncEngine('delhi', storeDelhi, peersConfig, linkCtrl);
    await syncMumbai.init();
    await syncDelhi.init();

    const appMumbai = buildServer({
      regionId: 'mumbai',
      port: 4881,
      store: storeMumbai,
      syncEngine: syncMumbai,
      linkController: linkCtrl,
      peers: peersConfig,
      territories: []
    });

    // Partition the link
    linkCtrl.cutLink('mumbai', 'delhi', true);

    // Make local write in Mumbai
    await syncMumbai.submitLocalOp('REPORT', 'road-part-test', { status: 'OPEN' }, 'author-m');

    // Query convergence on Mumbai
    const res = await appMumbai.inject({
      method: 'GET',
      url: '/api/v1/convergence'
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);

    expect(data.peers.delhi.status).toBe('UNAVAILABLE');
    expect(data.overallStatus).toBe('UNAVAILABLE');

    await appMumbai.close();
    await storeMumbai.close();
    await storeDelhi.close();
  });

  // 6. After reconnection and complete synchronization, matching states can be verified as converged
  it('Scenario 6: After reconnection and complete synchronization, matching states can be verified as converged', async () => {
    const storeMumbai = new FileStore('mumbai', testDir);
    const storeDelhi = new FileStore('delhi', testDir);
    await storeMumbai.init();
    await storeDelhi.init();

    const linkCtrl = new LinkController();
    const peersConfig = [
      { id: 'mumbai', name: 'Mumbai', port: 4883, authority: true },
      { id: 'delhi', name: 'Delhi', port: 4884, authority: false }
    ];

    const syncMumbai = new SyncEngine('mumbai', storeMumbai, peersConfig, linkCtrl);
    const syncDelhi = new SyncEngine('delhi', storeDelhi, peersConfig, linkCtrl);
    await syncMumbai.init();
    await syncDelhi.init();

    // Create an operation and replicate to both
    const op = await syncMumbai.submitLocalOp('REPORT', 'road-sync-ok', { status: 'OPEN' }, 'author-1');
    await syncDelhi.applyIncomingOp(op);

    // Clear outbox to simulate finished sync
    const outboxItems = await storeMumbai.getOutbox('delhi');
    for (const item of outboxItems) {
      await storeMumbai.removeFromOutbox(item.id);
    }

    const appMumbai = buildServer({
      regionId: 'mumbai',
      port: 4883,
      store: storeMumbai,
      syncEngine: syncMumbai,
      linkController: linkCtrl,
      peers: peersConfig,
      territories: []
    });

    // Query local convergence endpoint on both
    const mumLocal = await appMumbai.inject({ method: 'GET', url: '/api/v1/convergence/local' });
    const mumData = JSON.parse(mumLocal.body);

    const delLocalRes = computeCanonicalStateHash(
      await storeDelhi.getAllEntities(),
      await storeDelhi.getAllEscrow()
    );

    // Hashes match exactly
    expect(mumData.canonicalStateHash).toBe(delLocalRes.hash);

    const pairEval = evaluateConvergencePair(
      {
        region: 'mumbai',
        stateHash: mumData.canonicalStateHash,
        outboxPending: 0,
        unresolvedConflicts: 0,
        versionVector: syncMumbai.getLocalVector()
      },
      {
        region: 'delhi',
        reachable: true,
        stateHash: delLocalRes.hash,
        outboxPending: 0,
        unresolvedConflicts: 0,
        versionVector: syncDelhi.getLocalVector()
      }
    );

    expect(pairEval.status).toBe('CONVERGED');
    expect(pairEval.hashMatch).toBe(true);

    await appMumbai.close();
    await storeMumbai.close();
    await storeDelhi.close();
  });

  // 7. Unresolved conflicts prevent an unconditional convergence claim
  it('Scenario 7: Unresolved conflicts prevent an unconditional convergence claim', () => {
    const pairEval = evaluateConvergencePair(
      {
        region: 'mumbai',
        stateHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        outboxPending: 0,
        unresolvedConflicts: 1, // Conflict pending review!
        versionVector: { mumbai: 1 }
      },
      {
        region: 'delhi',
        reachable: true,
        stateHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        outboxPending: 0,
        unresolvedConflicts: 1,
        versionVector: { mumbai: 1 }
      }
    );

    expect(pairEval.status).toBe('CONFLICT_PENDING');
    expect(pairEval.reason).toContain('Unresolved concurrent conflicts');
  });

  // 8. An unavailable replica produces an unavailable or incomplete-verification result
  it('Scenario 8: An unavailable replica produces an unavailable or incomplete-verification result', () => {
    const pairEval = evaluateConvergencePair(
      {
        region: 'mumbai',
        stateHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        outboxPending: 0,
        unresolvedConflicts: 0
      },
      {
        region: 'bengaluru',
        reachable: false // Partitioned or dead node
      }
    );

    expect(pairEval.status).toBe('UNAVAILABLE');
    expect(pairEval.reason).toContain('unreachable');
  });

  // 9. Existing signatures, hash-chain checks, and operation deduplication continue working
  it('Scenario 9: Existing signatures, hash-chain checks, and operation deduplication continue working', async () => {
    const privKey = SEED_PRIVATE_KEYS.mumbai;
    const pubKey = await getPublicKey(privKey);

    const signedOp = await createSignedOp(
      {
        opId: 'mumbai:99',
        region: 'mumbai',
        seq: 99,
        type: 'REPORT',
        entityId: 'road-test-sig',
        payload: { status: 'OPEN' },
        deps: { mumbai: 98 },
        authorId: 'officer-99',
        authorRole: 'FIELD_OFFICER',
        createdAt: 12345678,
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
      },
      privKey
    );

    // Hash integrity
    const recomputedHash = calculateOpHash(signedOp);
    expect(recomputedHash).toBe(signedOp.hash);

    // Cryptographic signature validity
    const valid = await verifySignature(signedOp.hash, signedOp.sig, pubKey);
    expect(valid).toBe(true);

    // Store append & duplicate protection
    const store = new FileStore('mumbai', testDir);
    await store.init();
    await store.appendOp(signedOp);
    await store.appendOp(signedOp); // Duplicate call
    const ops = await store.getOps();
    expect(ops.filter(o => o.opId === 'mumbai:99').length).toBe(1);

    await store.close();
  });

  // 10. Operation history digest captures chronological operation identity
  it('Scenario 10: Operation history digest captures chronological operation identity', () => {
    const op1: Operation = {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'REPORT',
      entityId: 'road-1',
      payload: {},
      deps: {},
      authorId: 'a1',
      authorRole: 'FIELD_OFFICER',
      createdAt: 100,
      prevHash: '0000',
      hash: 'hash1',
      sig: 'sig1'
    };

    const op2: Operation = {
      opId: 'delhi:1',
      region: 'delhi',
      seq: 1,
      type: 'REPORT',
      entityId: 'road-1',
      payload: {},
      deps: {},
      authorId: 'a2',
      authorRole: 'FIELD_OFFICER',
      createdAt: 200,
      prevHash: '0000',
      hash: 'hash2',
      sig: 'sig2'
    };

    const logHash1 = computeOperationLogHash([op1, op2]);
    const logHash2 = computeOperationLogHash([op2, op1]); // Order swapped

    expect(logHash1.hash).toBe(logHash2.hash);
    expect(logHash1.opCount).toBe(2);
  });
});
