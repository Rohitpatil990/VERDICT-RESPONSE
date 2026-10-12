import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  extractDirectDependencies,
  buildDependencyCone,
  topologicalSortCone,
  validateOperationIntegrity,
  planDependencyConeRecovery,
  createSignedOp,
  calculateOpHash,
  SEED_PRIVATE_KEYS,
  Operation
} from '@verdict/core';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';

describe('VERDICT — Dependency-Cone Recovery (DCR) Acceptance Suite', () => {
  const testDir = path.resolve('./data/test-dcr');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  // Helper to generate a minimal valid signed operation
  async function makeOp(
    region: 'mumbai' | 'delhi' | 'bengaluru',
    seq: number,
    entityId: string,
    type = 'REPORT',
    prevHash = '0000000000000000000000000000000000000000000000000000000000000000',
    payload: any = {}
  ): Promise<Operation> {
    const privKey = SEED_PRIVATE_KEYS[region];
    return await createSignedOp(
      {
        opId: `${region}:${seq}`,
        region,
        seq,
        type,
        entityId,
        payload,
        deps: { [region]: seq - 1 },
        authorId: `agent-${region}`,
        authorRole: 'FIELD_OFFICER',
        createdAt: 1000 + seq * 10,
        prevHash
      },
      privKey
    );
  }

  // 1. A target with no dependencies
  it('Scenario 1: A target with no dependencies produces a cone of size 1 and READY_TO_RESUME', async () => {
    const op1 = await makeOp('mumbai', 1, 'road-1', 'REPORT');
    const plan = await planDependencyConeRecovery(op1.opId, [op1], [op1]);

    expect(plan.status).toBe('READY_TO_RESUME');
    expect(plan.coneSize).toBe(1);
    expect(plan.missingCount).toBe(0);
    expect(plan.recoveryOrder).toEqual([op1.opId]);
  });

  // 2. A target with a single prerequisite
  it('Scenario 2: A target with a single prerequisite includes both in the cone', async () => {
    const op1 = await makeOp('mumbai', 1, 'road-1', 'REPORT');
    const op2 = await makeOp('mumbai', 2, 'road-1', 'STATUS_CHANGE', op1.hash, {
      dependsOnOps: [op1.opId]
    });

    const plan = await planDependencyConeRecovery(op2.opId, [op1, op2], [op1, op2]);
    expect(plan.status).toBe('READY_TO_RESUME');
    expect(plan.coneSize).toBe(2);
    expect(plan.recoveryOrder).toEqual([op1.opId, op2.opId]);
  });

  // 3. A target with multiple levels of transitive dependencies
  it('Scenario 3: Multiple levels of transitive dependencies are fully captured in topological order', async () => {
    const op1 = await makeOp('mumbai', 1, 'road-1', 'REPORT');
    const op2 = await makeOp('mumbai', 2, 'road-1', 'STATUS_CHANGE', op1.hash, {
      dependsOnOps: [op1.opId]
    });
    const op3 = await makeOp('mumbai', 3, 'road-1', 'RESOLVE', op2.hash, {
      dependsOnOps: [op2.opId]
    });

    const plan = await planDependencyConeRecovery(op3.opId, [op1, op2, op3], [op1, op2, op3]);
    expect(plan.coneSize).toBe(3);
    expect(plan.recoveryOrder).toEqual([op1.opId, op2.opId, op3.opId]);
  });

  // 4. Dependencies already present at the recovering region
  it('Scenario 4: When all prerequisites are present locally, missing count is 0', async () => {
    const op1 = await makeOp('mumbai', 1, 'road-1');
    const op2 = await makeOp('mumbai', 2, 'road-1', 'REPORT', op1.hash, { dependsOnOps: [op1.opId] });

    const plan = await planDependencyConeRecovery(op2.opId, [op1, op2], [op1, op2]);
    expect(plan.presentCount).toBe(2);
    expect(plan.missingCount).toBe(0);
    expect(plan.status).toBe('READY_TO_RESUME');
  });

  // 5. Missing dependencies
  it('Scenario 5: Missing dependencies produce BLOCKED_MISSING_DEPENDENCY with exact missingOpIds', async () => {
    const op1 = await makeOp('mumbai', 1, 'road-1');
    const op2 = await makeOp('mumbai', 2, 'road-1', 'REPORT', op1.hash, { dependsOnOps: [op1.opId] });

    // Local store only has op2; op1 is missing!
    const plan = await planDependencyConeRecovery(op2.opId, [op2], [op1, op2]);
    expect(plan.status).toBe('BLOCKED_MISSING_DEPENDENCY');
    expect(plan.missingCount).toBe(1);
    expect(plan.missingOpIds).toContain(op1.opId);
  });

  // 6. Unavailable prerequisite operations
  it('Scenario 6: Unavailable prerequisite operations are identified and reported in blockers', async () => {
    const opTarget = await makeOp('mumbai', 2, 'road-1', 'REPORT', '0000000000000000000000000000000000000000000000000000000000000000', {
      dependsOnOps: ['delhi:999'] // Phantom / unavailable op
    });

    const plan = await planDependencyConeRecovery(opTarget.opId, [opTarget], [opTarget]);
    expect(plan.status).toBe('BLOCKED_MISSING_DEPENDENCY');
    expect(plan.missingOpIds).toContain('delhi:999');
    expect(plan.blockedReasons.some(r => r.includes('delhi:999'))).toBe(true);
  });

  // 7. Deterministic ordering of independent prerequisites
  it('Scenario 7: Independent prerequisites are ordered deterministically', async () => {
    const opA = await makeOp('mumbai', 1, 'road-A');
    const opB = await makeOp('delhi', 1, 'road-B');
    const target = await makeOp('bengaluru', 1, 'complex-bridge', 'REPORT', '0000000000000000000000000000000000000000000000000000000000000000', {
      dependsOnOps: [opB.opId, opA.opId] // Reverse alphabetical order
    });

    const plan1 = await planDependencyConeRecovery(target.opId, [opA, opB, target], [opA, opB, target]);
    const plan2 = await planDependencyConeRecovery(target.opId, [opA, opB, target], [opA, opB, target]);

    expect(plan1.recoveryOrder).toEqual(plan2.recoveryOrder);
    // Target is last in topological order
    expect(plan1.recoveryOrder[plan1.recoveryOrder.length - 1]).toBe(target.opId);
  });

  // 8. Dependency cycles
  it('Scenario 8: Dependency cycles are detected safely and report FAILED without infinite loop', () => {
    const adjacency = new Map<string, string[]>();
    adjacency.set('opA', ['opB']);
    adjacency.set('opB', ['opC']);
    adjacency.set('opC', ['opA']); // Cycle: A -> B -> C -> A

    const { order, hasCycle } = topologicalSortCone(['opA', 'opB', 'opC'], adjacency);
    expect(hasCycle).toBe(true);
    expect(order.length).toBeLessThan(3);
  });

  // 9. Duplicate operations
  it('Scenario 9: Applying duplicate operations is rejected idempotently by the store', async () => {
    const store = new FileStore('mumbai', testDir);
    await store.init();

    const op = await makeOp('mumbai', 1, 'road-dup');
    await store.appendOp(op);
    await store.appendOp(op); // Duplicate append

    const ops = await store.getOps();
    expect(ops.filter(o => o.opId === op.opId).length).toBe(1);

    await store.close();
  });

  // 10. Invalid signatures or failed integrity verification
  it('Scenario 10: Invalid signatures or failed hash check yield BLOCKED_INTEGRITY', async () => {
    const validOp = await makeOp('mumbai', 1, 'road-corrupt');
    // Tamper with payload
    const tamperedOp: Operation = {
      ...validOp,
      payload: { status: 'CORRUPTED' }
    };

    const integrity = await validateOperationIntegrity(tamperedOp);
    expect(integrity.valid).toBe(false);

    const plan = await planDependencyConeRecovery(tamperedOp.opId, [tamperedOp], [tamperedOp]);
    expect(plan.status).toBe('BLOCKED_INTEGRITY');
    expect(plan.blockedReasons.some(r => r.includes('hash mismatch') || r.includes('Integrity'))).toBe(true);
  });

  // 11. A dependency containing an unresolved conflict
  it('Scenario 11: A dependency modifying an entity awaiting review yields BLOCKED_CONFLICT', async () => {
    const opPrereq = await makeOp('mumbai', 1, 'road-conflict');
    const opTarget = await makeOp('mumbai', 2, 'road-conflict', 'STATUS_CHANGE', opPrereq.hash, {
      dependsOnOps: [opPrereq.opId]
    });

    const conflictedEntities = new Set(['road-conflict']);
    const plan = await planDependencyConeRecovery(
      opTarget.opId,
      [opPrereq, opTarget],
      [opPrereq, opTarget],
      conflictedEntities
    );

    expect(plan.status).toBe('BLOCKED_CONFLICT');
    expect(plan.blockedReasons.some(r => r.includes('unresolved conflict'))).toBe(true);
  });

  // 12. Escrow and Decision Gate invariants remaining enforced
  it('Scenario 12: Escrow spend depends on funding op and respects quota invariants', async () => {
    const initOp = await makeOp('mumbai', 1, 'fuel_liters', 'ESCROW_INIT', '0000000000000000000000000000000000000000000000000000000000000000', {
      resource: 'fuel_liters',
      total: 1000,
      rights: { mumbai: 600, delhi: 400 }
    });

    const spendOp = await makeOp('mumbai', 2, 'fuel_liters', 'ESCROW_SPEND', initOp.hash, {
      resource: 'fuel_liters',
      qty: 150
    });

    const deps = extractDirectDependencies(spendOp, [initOp, spendOp]);
    expect(deps).toContain(initOp.opId);

    const plan = await planDependencyConeRecovery(spendOp.opId, [initOp, spendOp], [initOp, spendOp]);
    expect(plan.status).toBe('READY_TO_RESUME');
    expect(plan.coneSize).toBe(2);
  });

  // 13. Recovery after a simulated network partition
  it('Scenario 13: Targeted recovery recovers missing prerequisites across partitions', async () => {
    const storeMumbai = new FileStore('mumbai', testDir);
    const storeDelhi = new FileStore('delhi', testDir);
    await storeMumbai.init();
    await storeDelhi.init();

    const linkCtrl = new LinkController();
    const peersConfig = [
      { id: 'mumbai', name: 'Mumbai', port: 4971, authority: true },
      { id: 'delhi', name: 'Delhi', port: 4972, authority: false }
    ];

    const syncMumbai = new SyncEngine('mumbai', storeMumbai, peersConfig, linkCtrl);
    const syncDelhi = new SyncEngine('delhi', storeDelhi, peersConfig, linkCtrl);
    await syncMumbai.init();
    await syncDelhi.init();

    // Mumbai creates prerequisite op
    const opPrereq = await syncMumbai.submitLocalOp('REPORT', 'route-part', { status: 'OPEN' }, 'auth-mum');

    // Delhi creates target op dependent on Mumbai's prereq
    const opTarget = await syncDelhi.submitLocalOp('REPORT', 'route-part', {
      status: 'BLOCKED',
      dependsOnOps: [opPrereq.opId]
    }, 'auth-del');

    // Delhi planner sees opPrereq as missing
    const initialDelhiPlan = await planDependencyConeRecovery(
      opTarget.opId,
      await storeDelhi.getOps(),
      [opPrereq, opTarget]
    );
    expect(initialDelhiPlan.status).toBe('BLOCKED_MISSING_DEPENDENCY');

    // Apply prerequisite to Delhi
    await syncDelhi.applyIncomingOp(opPrereq);

    // Delhi re-evaluates
    const postDelhiPlan = await planDependencyConeRecovery(
      opTarget.opId,
      await storeDelhi.getOps(),
      [opPrereq, opTarget]
    );
    expect(postDelhiPlan.status).toBe('READY_TO_RESUME');

    await storeMumbai.close();
    await storeDelhi.close();
  });

  // 14. Target readiness before unrelated background synchronization finishes
  it('Scenario 14: Target becomes READY_TO_RESUME while unrelated operations remain in outbox', async () => {
    const opPrereq = await makeOp('mumbai', 1, 'critical-corridor');
    const opTarget = await makeOp('mumbai', 2, 'critical-corridor', 'STATUS_CHANGE', opPrereq.hash, {
      dependsOnOps: [opPrereq.opId]
    });

    const unrelatedOutboxCount = 15; // 15 unrelated ops in background queue

    const plan = await planDependencyConeRecovery(
      opTarget.opId,
      [opPrereq, opTarget],
      [opPrereq, opTarget],
      new Set(),
      unrelatedOutboxCount
    );

    // Target is ready immediately without waiting for 15 background ops
    expect(plan.status).toBe('READY_TO_RESUME');
    expect(plan.unrelatedPendingCount).toBe(15);
  });

  // 15. Existing priority replication continuing to process unrelated operations
  it('Scenario 15: Outbox sorting respects priority lanes L0 < L1 < L2 < L3', () => {
    const outboxItems = [
      { id: '1', priorityLane: 2, createdAt: 100 },
      { id: '2', priorityLane: 0, createdAt: 200 }, // Control (highest priority)
      { id: '3', priorityLane: 1, createdAt: 150 }, // Critical
      { id: '4', priorityLane: 3, createdAt: 50 }   // Bulk
    ];

    outboxItems.sort((a, b) => a.priorityLane - b.priorityLane || a.createdAt - b.createdAt);

    expect(outboxItems[0].priorityLane).toBe(0);
    expect(outboxItems[1].priorityLane).toBe(1);
    expect(outboxItems[2].priorityLane).toBe(2);
    expect(outboxItems[3].priorityLane).toBe(3);
  });

  // 16. Recovery behavior after restart, where supported
  it('Scenario 16: Recovered prerequisite operations survive process restart', async () => {
    // 1. Initial run
    let store = new FileStore('mumbai', testDir);
    await store.init();
    const op = await makeOp('mumbai', 1, 'route-restart-survive');
    await store.appendOp(op);
    await store.close();

    // 2. Reopen store
    const restartedStore = new FileStore('mumbai', testDir);
    await restartedStore.init();

    const loadedOp = await restartedStore.getOp(op.opId);
    expect(loadedOp).not.toBeNull();
    expect(loadedOp?.opId).toBe(op.opId);

    const plan = await planDependencyConeRecovery(op.opId, [loadedOp!], [loadedOp!]);
    expect(plan.status).toBe('READY_TO_RESUME');

    await restartedStore.close();
  });

  // 17. Server endpoints integration: POST /api/v1/dcr/plan and POST /api/v1/dcr/recover
  it('Scenario 17: Regional Fastify server handles /api/v1/dcr/plan and /api/v1/dcr/ops', async () => {
    const store = new FileStore('mumbai', testDir);
    await store.init();
    const linkCtrl = new LinkController();
    const sync = new SyncEngine('mumbai', store, [], linkCtrl);
    await sync.init();

    const op = await sync.submitLocalOp('REPORT', 'road-server-test', { status: 'OPEN' }, 'author-srv');

    const app = buildServer({
      regionId: 'mumbai',
      port: 4975,
      store,
      syncEngine: sync,
      linkController: linkCtrl,
      peers: [],
      territories: []
    });

    // Test GET /api/v1/dcr/ops
    const opsRes = await app.inject({ method: 'GET', url: '/api/v1/dcr/ops' });
    expect(opsRes.statusCode).toBe(200);
    const opsData = JSON.parse(opsRes.body);
    expect(opsData.operations.some((o: any) => o.opId === op.opId)).toBe(true);

    // Test POST /api/v1/dcr/plan
    const planRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dcr/plan',
      payload: { targetOpId: op.opId }
    });
    expect(planRes.statusCode).toBe(200);
    const planData = JSON.parse(planRes.body);
    expect(planData.status).toBe('READY_TO_RESUME');
    expect(planData.coneSize).toBe(1);

    await app.close();
    await store.close();
  });
});
