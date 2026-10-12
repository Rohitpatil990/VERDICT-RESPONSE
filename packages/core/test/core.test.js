import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  canonicalJson, 
  sha256, 
  computeOpHash, 
  getRegionKeyPair, 
  signHash, 
  verifyHashSignature,
  compareVectors,
  settleResourceClaims,
  computeSixIndicators
} from '../dist/index.js';

test('1. Canonical JSON handles nested keys and arrays deterministically', () => {
  const obj1 = { z: 1, a: { y: 2, b: 3 }, arr: [3, 2, 1] };
  const obj2 = { a: { b: 3, y: 2 }, z: 1, arr: [3, 2, 1] };
  assert.equal(canonicalJson(obj1), canonicalJson(obj2));
});

test('2. Ed25519 keypairs sign and verify successfully', () => {
  const kp = getRegionKeyPair('mumbai');
  const hash = sha256('TEST_PAYLOAD');
  const sig = signHash(hash, kp.privateKeyPem);
  const isValid = verifyHashSignature(hash, sig, kp.publicKeyPem);
  assert.equal(isValid, true);

  // Tampered payload fails verification
  const badHash = sha256('TAMPERED_PAYLOAD');
  const badValid = verifyHashSignature(badHash, sig, kp.publicKeyPem);
  assert.equal(badValid, false);
});

test('3. Version vectors identify causality and concurrency', () => {
  const v1 = { mumbai: 2, delhi: 1 };
  const v2 = { mumbai: 3, delhi: 1 };
  const v3 = { mumbai: 2, delhi: 2 };

  assert.equal(compareVectors(v2, v1), 'A_DOMINATES');
  assert.equal(compareVectors(v1, v2), 'B_DOMINATES');
  assert.equal(compareVectors(v2, v3), 'CONCURRENT');
});

test('4. Resource claim invariant: stock 5, Mumbai 3 vs Delhi 4 gives 3 granted, 2 granted + 2 backordered', () => {
  const claims = [
    {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'RESOURCE_CLAIM',
      entityId: 'stock-med-kits',
      deps: {},
      authorId: 'dr-patil',
      authorRole: 'OFFICIAL',
      createdAt: '2026-10-12T12:00:00Z',
      prevHash: '0000',
      hash: 'h1',
      sig: 's1',
      payload: {
        stockId: 'stock-med-kits',
        resourceClass: 'MEDICAL',
        quantityRequested: 3,
        requestingRegion: 'mumbai',
        purpose: 'Kurla triage unit'
      }
    },
    {
      opId: 'delhi:1',
      region: 'delhi',
      seq: 1,
      type: 'RESOURCE_CLAIM',
      entityId: 'stock-med-kits',
      deps: {},
      authorId: 'officer-sharma',
      authorRole: 'OFFICIAL',
      createdAt: '2026-10-12T12:01:00Z',
      prevHash: '0000',
      hash: 'h2',
      sig: 's2',
      payload: {
        stockId: 'stock-med-kits',
        resourceClass: 'MEDICAL',
        quantityRequested: 4,
        requestingRegion: 'delhi',
        purpose: 'North relief squad'
      }
    }
  ];

  const decisions = settleResourceClaims(5, claims);
  assert.equal(decisions.length, 2);
  
  // Op ordering: delhi:1 comes before mumbai:1 alphabetically
  const delhiDecision = decisions.find(d => d.opId === 'delhi:1');
  const mumbaiDecision = decisions.find(d => d.opId === 'mumbai:1');

  // Total allocated must not exceed 5
  const totalAllocated = (delhiDecision?.allocated || 0) + (mumbaiDecision?.allocated || 0);
  assert.equal(totalAllocated, 5);
  
  // Total backordered must equal 2 (7 requested - 5 available)
  const totalBackordered = (delhiDecision?.backordered || 0) + (mumbaiDecision?.backordered || 0);
  assert.equal(totalBackordered, 2);
});

test('5. Six indicators computes all dimensions with integrity and freshness checks', () => {
  const kp = getRegionKeyPair('mumbai');
  const partialOp = {
    opId: 'mumbai:10',
    region: 'mumbai',
    seq: 10,
    type: 'REPORT',
    entityId: 'inc-kurla-1',
    deps: { mumbai: 9 },
    authorId: 'worker-1',
    authorRole: 'FIELD_OFFICER',
    createdAt: new Date().toISOString(),
    prevHash: 'prev-hash-9',
    payload: {
      incidentId: 'inc-kurla-1',
      incidentType: 'flood',
      description: { original: { lang: 'mr', text: 'कुर्ला स्टेशनजवळ पाणी भरले आहे' } },
      location: { lat: 19.0688, lng: 72.8795, source: 'GPS_DEVICE', accuracyM: 5 },
      observedAt: new Date().toISOString(),
      severity: { value: 'CRITICAL', source: 'CONFIRMED' },
      source: { kind: 'person', id: 'worker-1', displayName: 'Ramesh Pawar', tier: 'FIELD_OFFICER' },
      channel: 'FORM'
    }
  };
  const hash = computeOpHash(partialOp);
  const sig = signHash(hash, kp.privateKeyPem);
  const op = { ...partialOp, hash, sig };

  const indicators = computeSixIndicators({
    op,
    currentRegion: 'mumbai',
    receipts: [{ region: 'mumbai', receivedAt: new Date().toISOString(), via: 'LOCAL', chainVerified: true }],
    onlineRegions: ['mumbai', 'delhi']
  });

  assert.equal(indicators.source.displayName, 'Ramesh Pawar');
  assert.equal(indicators.source.tier, 'FIELD_OFFICER');
  assert.equal(indicators.integrity.status, 'Verified');
  assert.equal(indicators.replication.status, 'Saved locally');
  assert.equal(indicators.replication.perRegion.mumbai.status, 'RECEIVED');
  assert.equal(indicators.replication.perRegion.delhi.status, 'PENDING');
  assert.equal(indicators.replication.perRegion.bengaluru.status, 'UNKNOWN');
});
