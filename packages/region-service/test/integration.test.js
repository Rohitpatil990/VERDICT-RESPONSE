import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRegionServer } from '../dist/server.js';
import { evaluateConflict } from '@verdict/core';

test('Integration: Multi-Region Partition, Local Writes, Sync, and Conflict Settlement', async (t) => {
  const dbDir = path.resolve(process.cwd(), 'data');
  const testId = Date.now();
  const mumbaiDb = path.join(dbDir, `test_mumbai_${testId}.db`);
  const delhiDb = path.join(dbDir, `test_delhi_${testId}.db`);

  const mumbaiServer = createRegionServer('mumbai', 4101, { mumbai: 4101, delhi: 4102, bengaluru: 4103 }, mumbaiDb);
  const delhiServer = createRegionServer('delhi', 4102, { mumbai: 4101, delhi: 4102, bengaluru: 4103 }, delhiDb);

  await mumbaiServer.start();
  await delhiServer.start();

  try {
    // 1. Verify independent databases
    assert.equal(mumbaiServer.store.region, 'mumbai');
    assert.equal(delhiServer.store.region, 'delhi');

    // 2. Sever link: Simulate Network Partition
    mumbaiServer.linkController.cut('mumbai', 'delhi');
    delhiServer.linkController.cut('delhi', 'mumbai');
    assert.equal(mumbaiServer.linkController.isLinked('delhi'), false);
    assert.equal(delhiServer.linkController.isLinked('mumbai'), false);

    // 3. Local writes during partition in Mumbai
    const mumbaiRes = await fetch('http://localhost:4101/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: 'inc-kurla-partition-1',
        incidentType: 'flood',
        description: { original: { lang: 'en', text: 'Kurla submerged by 2ft water during partition' } },
        location: { lat: 19.0688, lng: 72.8795, source: 'GPS_DEVICE' }
      })
    });
    assert.equal(mumbaiRes.status, 201);
    const mumbaiData = await mumbaiRes.json();
    assert.equal(mumbaiData.ackState.stage, 'region'); // Saved locally, NOT in Delhi!

    // Delhi DOES NOT have it during partition
    assert.equal(delhiServer.store.getOp(mumbaiData.opId), null);

    // 4. Concurrent contradictory writes during partition:
    // Delhi writes road OPEN
    const delhiOpRes = await fetch('http://localhost:4102/api/v1/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FACT',
        entityId: 'road-lbs-marg',
        payload: { factType: 'ROAD_STATUS', roadId: 'road-lbs-marg', status: 'OPEN', reason: 'Delhi drone survey' }
      })
    });
    assert.equal(delhiOpRes.status, 201);

    // Mumbai writes road BLOCKED
    const mumbaiOpRes = await fetch('http://localhost:4101/api/v1/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FACT',
        entityId: 'road-lbs-marg',
        payload: { factType: 'ROAD_STATUS', roadId: 'road-lbs-marg', status: 'BLOCKED', reason: 'Waterlogged subway' }
      })
    });
    assert.equal(mumbaiOpRes.status, 201);

    // 5. Restore Link and trigger Anti-Entropy synchronization
    mumbaiServer.linkController.restore('mumbai', 'delhi');
    delhiServer.linkController.restore('delhi', 'mumbai');
    assert.equal(mumbaiServer.linkController.isLinked('delhi'), true);

    const syncResult = await mumbaiServer.replication.syncWithPeers();
    assert.ok(syncResult.syncedCount >= 1);

    // Delhi now holds the Mumbai op!
    const syncedToDelhi = delhiServer.store.getOp(mumbaiData.opId);
    assert.ok(syncedToDelhi != null);
    assert.equal(syncedToDelhi.entityId, 'inc-kurla-partition-1');

    // 6. Sync Delhi's ops to Mumbai
    await delhiServer.replication.syncWithPeers();
    const updatedRoadOps = mumbaiServer.store.getOpsByEntity('road-lbs-marg');
    assert.equal(updatedRoadOps.length, 2);

    const conflictEval = evaluateConflict(updatedRoadOps[0], updatedRoadOps[1]);
    assert.equal(conflictEval.isConflict, true);
    assert.equal(conflictEval.status, 'Awaiting human review');

    // 7. Signed Reviewer Resolution
    const resolveRes = await fetch('http://localhost:4101/api/v1/conflicts/road-lbs-marg/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chosenOpId: updatedRoadOps[0].opId,
        chosenState: { status: 'BLOCKED' },
        justification: 'Field officer on ground verified heavy waterlogging'
      })
    });
    assert.equal(resolveRes.status, 200);

    // 8. One-byte Tamper Detection & Heal
    const tamperRes = await fetch('http://localhost:4101/admin/tamper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId: mumbaiData.opId })
    });
    const tamperData = await tamperRes.json();
    assert.equal(tamperData.success, true);

    // Verify integrity endpoint detects FAILED
    const verifyRes = await fetch(`http://localhost:4101/api/v1/ops/${mumbaiData.opId}/verify`, { method: 'POST' });
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.integrity.status, 'FAILED');

    // Heal the op
    const healRes = await fetch('http://localhost:4101/admin/heal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId: mumbaiData.opId })
    });
    const healData = await healRes.json();
    assert.equal(healData.healed, true);

    // Re-verify now returns Verified
    const reVerifyRes = await fetch(`http://localhost:4101/api/v1/ops/${mumbaiData.opId}/verify`, { method: 'POST' });
    const reVerifyData = await reVerifyRes.json();
    assert.equal(reVerifyData.integrity.status, 'Verified');

  } finally {
    await mumbaiServer.stop();
    await delhiServer.stop();
  }
});
