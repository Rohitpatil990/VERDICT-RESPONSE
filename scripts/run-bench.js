import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  canonicalJson,
  calculateOpHash,
  signHash,
  verifySignature,
  getPublicKey,
  SEED_PRIVATE_KEYS,
  compareVectors,
  foldOperations,
  createEscrowResource,
  applyEscrowOp,
  evaluateDecisionGate,
  haversineDistanceKm
} from '@verdict/core';

async function runBenchmark() {
  console.log('========================================================================');
  console.log('  VERDICT Response — System Micro-Benchmark Suite                       ');
  console.log('========================================================================\n');

  const privKey = SEED_PRIVATE_KEYS.mumbai;
  const pubKey = await getPublicKey(privKey);

  // 1. Canonical JSON serialization throughput
  const testObj = {
    incidentId: 'inc-101',
    description: { text: 'Flooding near Kurla station' },
    location: { lat: 19.0688, lng: 72.88 },
    tags: ['water', 'urgent', 'medical'],
    metadata: { seq: 42, region: 'mumbai' }
  };
  const cjsonStart = performance.now();
  const cjsonIters = 25000;
  for (let i = 0; i < cjsonIters; i++) {
    canonicalJson(testObj);
  }
  const cjsonElapsed = performance.now() - cjsonStart;
  const cjsonOpsPerSec = Math.round((cjsonIters / cjsonElapsed) * 1000);
  console.log(`  1. Canonical JSON:        ${cjsonOpsPerSec.toLocaleString()} ops/sec (${(cjsonElapsed / cjsonIters).toFixed(4)} ms/op)`);

  // 2. SHA-256 Op Hashing
  const testOp = {
    opId: 'mumbai:1',
    region: 'mumbai',
    seq: 1,
    type: 'REPORT',
    entityId: 'road-r7',
    payload: testObj,
    deps: { mumbai: 0 },
    authorId: 'test-user',
    authorRole: 'FIELD_OFFICER',
    createdAt: Date.now(),
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
  };
  const hashStart = performance.now();
  const hashIters = 15000;
  for (let i = 0; i < hashIters; i++) {
    calculateOpHash(testOp);
  }
  const hashElapsed = performance.now() - hashStart;
  const hashOpsPerSec = Math.round((hashIters / hashElapsed) * 1000);
  console.log(`  2. SHA-256 Op Hashing:    ${hashOpsPerSec.toLocaleString()} ops/sec (${(hashElapsed / hashIters).toFixed(4)} ms/op)`);

  // 3. Ed25519 Signature & Verification
  const hash = calculateOpHash(testOp);
  const sig = await signHash(hash, privKey);

  const signStart = performance.now();
  const signIters = 200;
  for (let i = 0; i < signIters; i++) {
    await signHash(hash, privKey);
  }
  const signElapsed = performance.now() - signStart;
  const signOpsPerSec = Math.round((signIters / signElapsed) * 1000);
  console.log(`  3. Ed25519 Signing:       ${signOpsPerSec.toLocaleString()} ops/sec (${(signElapsed / signIters).toFixed(2)} ms/op)`);

  const verifyStart = performance.now();
  const verifyIters = 200;
  for (let i = 0; i < verifyIters; i++) {
    await verifySignature(hash, sig, pubKey);
  }
  const verifyElapsed = performance.now() - verifyStart;
  const verifyOpsPerSec = Math.round((verifyIters / verifyElapsed) * 1000);
  console.log(`  4. Ed25519 Verification:  ${verifyOpsPerSec.toLocaleString()} ops/sec (${(verifyElapsed / verifyIters).toFixed(2)} ms/op)`);

  // 5. Version Vector Comparison
  const v1 = { mumbai: 104, delhi: 55, bengaluru: 12 };
  const v2 = { mumbai: 104, delhi: 58, bengaluru: 11 };
  const vecStart = performance.now();
  const vecIters = 50000;
  for (let i = 0; i < vecIters; i++) {
    compareVectors(v1, v2);
  }
  const vecElapsed = performance.now() - vecStart;
  const vecOpsPerSec = Math.round((vecIters / vecElapsed) * 1000);
  console.log(`  5. Version Vector Compare: ${vecOpsPerSec.toLocaleString()} ops/sec (${(vecElapsed / vecIters).toFixed(5)} ms/op)`);

  // 6. Policy Fold (Road OPEN vs BLOCKED conflict resolution)
  const foldOps = [
    {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'STATUS_CHANGE',
      entityId: 'road-r7',
      payload: { status: 'OPEN' },
      deps: {},
      authorId: 'a',
      authorRole: 'FIELD_OFFICER',
      createdAt: 100,
      prevHash: '0',
      hash: 'h',
      sig: 's'
    },
    {
      opId: 'delhi:1',
      region: 'delhi',
      seq: 1,
      type: 'STATUS_CHANGE',
      entityId: 'road-r7',
      payload: { status: 'BLOCKED' },
      deps: {},
      authorId: 'b',
      authorRole: 'OFFICIAL',
      createdAt: 105,
      prevHash: '0',
      hash: 'h2',
      sig: 's2'
    }
  ];
  const foldStart = performance.now();
  const foldIters = 10000;
  for (let i = 0; i < foldIters; i++) {
    foldOperations('road-r7', 'road', 'mumbai', foldOps);
  }
  const foldElapsed = performance.now() - foldStart;
  const foldOpsPerSec = Math.round((foldIters / foldElapsed) * 1000);
  console.log(`  6. Conflict Policy Fold:  ${foldOpsPerSec.toLocaleString()} ops/sec (${(foldElapsed / foldIters).toFixed(4)} ms/op)`);

  // 7. Decision Gate Evaluation
  const roadEntity = {
    entityId: 'road-r7',
    type: 'road',
    authorityRegion: 'mumbai',
    status: 'OPEN',
    attributes: {},
    versionVector: { mumbai: 1 },
    participatingOpIds: ['mumbai:1'],
    integrity: 'VERIFIED',
    lastObservedAt: Date.now() - 5000,
    lastUpdatedAt: Date.now() - 5000
  };
  const entityMap = new Map([['road-r7', roadEntity]]);
  const peers = new Map();
  const escrows = new Map();

  const gateStart = performance.now();
  const gateIters = 10000;
  for (let i = 0; i < gateIters; i++) {
    evaluateDecisionGate(
      {
        type: 'DISPATCH',
        entityId: 'road-r7',
        params: { routeEntityIds: ['road-r7'] },
        actorId: 'operator',
        actorRole: 'OFFICIAL'
      },
      'mumbai',
      entityMap,
      peers,
      escrows,
      Date.now()
    );
  }
  const gateElapsed = performance.now() - gateStart;
  const gateOpsPerSec = Math.round((gateIters / gateElapsed) * 1000);
  console.log(`  7. Decision Gate Eval:    ${gateOpsPerSec.toLocaleString()} ops/sec (${(gateElapsed / gateIters).toFixed(4)} ms/op)`);

  // 8. Escrow Allocation Invariant Checks
  const escStart = performance.now();
  const escIters = 20000;
  let esc = createEscrowResource('medical_kits', 10, { mumbai: 6, delhi: 4 });
  for (let i = 0; i < escIters; i++) {
    esc = applyEscrowOp(esc, {
      opId: `m:${i}`,
      region: 'mumbai',
      seq: i,
      type: 'ESCROW_SPEND',
      entityId: 'medical_kits',
      payload: { qty: 1 },
      deps: {},
      authorId: 'a',
      authorRole: 'OFFICIAL',
      createdAt: 100,
      prevHash: '0',
      hash: 'h',
      sig: 's'
    });
  }
  const escElapsed = performance.now() - escStart;
  const escOpsPerSec = Math.round((escIters / escElapsed) * 1000);
  console.log(`  8. Escrow Bounded Spend:  ${escOpsPerSec.toLocaleString()} ops/sec (${(escElapsed / escIters).toFixed(4)} ms/op)`);

  // 9. True Haversine Geolocation
  const havStart = performance.now();
  const havIters = 50000;
  for (let i = 0; i < havIters; i++) {
    haversineDistanceKm(19.076, 72.8777, 28.6139, 77.209);
  }
  const havElapsed = performance.now() - havStart;
  const havOpsPerSec = Math.round((havIters / havElapsed) * 1000);
  console.log(`  9. Haversine Distance:    ${havOpsPerSec.toLocaleString()} ops/sec (${(havElapsed / havIters).toFixed(5)} ms/op)`);

  // Write docs/BENCH.md
  const markdown = `# VERDICT Benchmark Report
*Generated on ${new Date().toISOString()}*

### Host Environment
- **Platform:** ${os.platform()} (${os.arch()})
- **CPUs:** ${os.cpus()[0]?.model} (${os.cpus().length} cores)
- **Node.js:** ${process.version}
- **Machine Memory:** ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB

### Measured Performance
| Component | Metric | Latency |
|---|---|---|
| Canonical JSON Serialization | ${cjsonOpsPerSec.toLocaleString()} ops/sec | ${(cjsonElapsed / cjsonIters).toFixed(4)} ms |
| SHA-256 Operation Hashing | ${hashOpsPerSec.toLocaleString()} ops/sec | ${(hashElapsed / hashIters).toFixed(4)} ms |
| Ed25519 Digital Signing | ${signOpsPerSec.toLocaleString()} ops/sec | ${(signElapsed / signIters).toFixed(2)} ms |
| Ed25519 Signature Verification | ${verifyOpsPerSec.toLocaleString()} ops/sec | ${(verifyElapsed / verifyIters).toFixed(2)} ms |
| Version Vector Causal Compare | ${vecOpsPerSec.toLocaleString()} ops/sec | ${(vecElapsed / vecIters).toFixed(5)} ms |
| Conflict Policy Folding | ${foldOpsPerSec.toLocaleString()} ops/sec | ${(foldElapsed / foldIters).toFixed(4)} ms |
| Decision Gate Evaluation | ${gateOpsPerSec.toLocaleString()} ops/sec | ${(gateElapsed / gateIters).toFixed(4)} ms |
| Escrow Bounded Counter Spend | ${escOpsPerSec.toLocaleString()} ops/sec | ${(escElapsed / escIters).toFixed(4)} ms |
| Haversine Geodetic Distance | ${havOpsPerSec.toLocaleString()} ops/sec | ${(havElapsed / havIters).toFixed(5)} ms |

*Rule of Honesty: All numbers measured directly on this local machine via \`npm run bench\`. No extrapolation to theoretical global scale.*
`;

  await fs.mkdir('./docs', { recursive: true });
  await fs.writeFile('./docs/BENCH.md', markdown, 'utf-8');
  console.log('\n[BENCH] Written benchmark report to docs/BENCH.md.\n');
}

runBenchmark().catch(console.error);
