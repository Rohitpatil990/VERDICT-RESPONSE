import { describe, it, expect } from 'vitest';
import {
  canonicalJson,
  calculateOpHash,
  signHash,
  verifySignature,
  createSignedOp,
  SEED_PRIVATE_KEYS,
  getPublicKey,
  compareVectors,
  mergeVectors,
  diffVectors,
  foldOperations,
  createEscrowResource,
  applyEscrowOp,
  canSpend,
  verifyEscrowInvariant,
  evaluateDecisionGate,
  reevaluateDecision,
  computeFog,
  haversineDistanceKm,
  Operation,
  Entity
} from '../src/index.js';

describe('VERDICT Pure Core', () => {
  it('canonicalJson sorts keys and serializes consistently', () => {
    const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
    const obj2 = { a: 2, m: { a: 4, b: 3 }, z: 1 };
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    expect(canonicalJson(obj1)).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
  });

  it('Ed25519 signing and verification works deterministically', async () => {
    const privKey = SEED_PRIVATE_KEYS.mumbai;
    const pubKey = await getPublicKey(privKey);
    const testOp = {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'REPORT',
      entityId: 'road-r7',
      payload: { status: 'OPEN' },
      deps: {},
      authorId: 'officer-1',
      authorRole: 'FIELD_OFFICER' as const,
      createdAt: 1000,
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const signed = await createSignedOp(testOp, privKey);
    expect(signed.hash).toHaveLength(64);
    expect(signed.sig).toHaveLength(128);

    const valid = await verifySignature(signed.hash, signed.sig, pubKey);
    expect(valid).toBe(true);

    // Tampered payload produces invalid hash verification
    const tamperedHash = calculateOpHash({ ...signed, payload: { status: 'BLOCKED' } });
    const tamperedValid = await verifySignature(tamperedHash, signed.sig, pubKey);
    expect(tamperedValid).toBe(false);
  });


  it('Version vectors identify dominance and concurrency correctly', () => {
    expect(compareVectors({ mumbai: 1 }, { mumbai: 1 })).toBe('equal');
    expect(compareVectors({ mumbai: 2 }, { mumbai: 1 })).toBe('v1_dominates');
    expect(compareVectors({ mumbai: 1 }, { mumbai: 2 })).toBe('v2_dominates');
    expect(compareVectors({ mumbai: 2, delhi: 1 }, { mumbai: 1, delhi: 2 })).toBe('concurrent');

    expect(mergeVectors({ mumbai: 3, delhi: 1 }, { mumbai: 2, delhi: 4, blr: 1 })).toEqual({
      mumbai: 3,
      delhi: 4,
      blr: 1
    });

    const diff = diffVectors({ mumbai: 5, delhi: 3 }, { mumbai: 2, delhi: 3 });
    expect(diff).toEqual({ mumbai: [3, 5] });
  });

  it('Incident #101: non-reviewer cannot silently declare Resolved', () => {
    const op1: Operation = {
      opId: 'mumbai:10',
      region: 'mumbai',
      seq: 10,
      type: 'REPORT',
      entityId: 'inc-101',
      payload: { status: 'Investigating', observedAt: 1000 },
      deps: {},
      authorId: 'worker-mumbai',
      authorRole: 'FIELD_OFFICER',
      createdAt: 1000,
      prevHash: '00',
      hash: 'h1',
      sig: 's1'
    };

    const op2: Operation = {
      opId: 'delhi:5',
      region: 'delhi',
      seq: 5,
      type: 'STATUS_CHANGE',
      entityId: 'inc-101',
      payload: { status: 'Resolved' },
      deps: {},
      authorId: 'volunteer-delhi',
      authorRole: 'VOLUNTEER', // non-reviewer!
      createdAt: 1050,
      prevHash: '00',
      hash: 'h2',
      sig: 's2'
    };

    const entity = foldOperations('inc-101', 'incident', 'mumbai', [op1, op2]);
    expect(entity.status).toBe('Investigating');
    expect(entity.conflict?.status).toBe('AWAITING_REVIEW');
    expect(entity.conflict?.claims.length).toBeGreaterThan(0);
  });

  it('Road R7 concurrent OPEN vs BLOCKED flags conflict and conservative BLOCKED', () => {
    const opOpen: Operation = {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'STATUS_CHANGE',
      entityId: 'road-r7',
      payload: { status: 'OPEN' },
      deps: { mumbai: 0 },
      authorId: 'bmc-officer',
      authorRole: 'FIELD_OFFICER',
      createdAt: 1000,
      prevHash: '00',
      hash: 'h1',
      sig: 's1'
    };

    const opBlocked: Operation = {
      opId: 'delhi:1',
      region: 'delhi',
      seq: 1,
      type: 'STATUS_CHANGE',
      entityId: 'road-r7',
      payload: { status: 'BLOCKED' },
      deps: { delhi: 0 },
      authorId: 'ndrf-team',
      authorRole: 'OFFICIAL',
      createdAt: 1020,
      prevHash: '00',
      hash: 'h2',
      sig: 's2'
    };

    const entity = foldOperations('road-r7', 'road', 'mumbai', [opOpen, opBlocked]);
    expect(entity.conflict?.status).toBe('AWAITING_REVIEW');
    expect(entity.status).toBe('BLOCKED'); // conservative fail-safe for roads
  });

  it('Escrow ensures Σ spent ≤ T and safely handles partition allocations', () => {
    // Total 5: Mumbai 3, Delhi 2
    let state = createEscrowResource('medical_kits', 5, { mumbai: 3, delhi: 2 });
    expect(canSpend(state, 'mumbai', 3)).toBe(true);
    expect(canSpend(state, 'mumbai', 4)).toBe(false);

    // Mumbai spends 3
    state = applyEscrowOp(state, {
      opId: 'mumbai:1',
      region: 'mumbai',
      seq: 1,
      type: 'ESCROW_SPEND',
      entityId: 'medical_kits',
      payload: { qty: 3 },
      deps: {},
      authorId: 'a1',
      authorRole: 'OFFICIAL',
      createdAt: 100,
      prevHash: '0',
      hash: 'h',
      sig: 's'
    });

    expect(state.spent.mumbai).toBe(3);
    expect(canSpend(state, 'mumbai', 1)).toBe(false);

    // Delhi allocates against its local rights (2)
    state = applyEscrowOp(state, {
      opId: 'delhi:1',
      region: 'delhi',
      seq: 1,
      type: 'ESCROW_SPEND',
      entityId: 'medical_kits',
      payload: { qty: 2 },
      deps: {},
      authorId: 'a2',
      authorRole: 'OFFICIAL',
      createdAt: 110,
      prevHash: '0',
      hash: 'h',
      sig: 's'
    });

    const verify = verifyEscrowInvariant(state);
    expect(verify.valid).toBe(true);
    expect(verify.totalSpent).toBe(5);
  });

  it('Decision Gate yields GO in authority region and CAUTION in non-authority region', () => {
    const now = 200000;
    const roadR7: Entity = {
      entityId: 'road-r7',
      type: 'road',
      authorityRegion: 'mumbai',
      status: 'OPEN',
      attributes: {},
      versionVector: { mumbai: 1 },
      participatingOpIds: ['mumbai:1'],
      integrity: 'VERIFIED',
      lastObservedAt: now - 5000,
      lastUpdatedAt: now - 5000
    };

    const inc1: Entity = {
      entityId: 'inc-1',
      type: 'incident',
      authorityRegion: 'mumbai',
      status: 'Investigating',
      attributes: {},
      versionVector: { mumbai: 1 },
      participatingOpIds: ['mumbai:2'],
      integrity: 'VERIFIED',
      lastObservedAt: now - 5000,
      lastUpdatedAt: now - 5000
    };

    const entityMap = new Map([
      ['road-r7', roadR7],
      ['inc-1', inc1]
    ]);
    const peers = new Map(); // All remote peers disconnected


    // 1. Mumbai evaluating dispatch on R7 (Mumbai is authority) -> GO
    const mumbaiEval = evaluateDecisionGate(
      {
        type: 'DISPATCH',
        entityId: 'inc-1',
        params: { routeEntityIds: ['road-r7'] },
        actorId: 'operator',
        actorRole: 'OFFICIAL'
      },
      'mumbai',
      entityMap,
      peers,
      new Map(),
      now
    );
    expect(mumbaiEval.verdict).toBe('GO');

    // 2. Delhi evaluating dispatch on R7 during partition (Mumbai is unreachable authority) -> CAUTION
    const delhiEval = evaluateDecisionGate(
      {
        type: 'DISPATCH',
        entityId: 'inc-1',
        params: { routeEntityIds: ['road-r7'] },
        actorId: 'operator',
        actorRole: 'OFFICIAL'
      },
      'delhi',
      entityMap,
      peers,
      new Map(),
      now
    );
    expect(delhiEval.verdict).toBe('CAUTION');
    expect(delhiEval.checks.some(c => c.checkId.includes('authority') && c.severity === 'warn')).toBe(true);
  });

  it('Decision Re-evaluation flags INVALIDATED when a route road is blocked after merge', () => {
    const receipt = {
      decisionId: 'dec-1',
      type: 'DISPATCH',
      params: { routeEntityIds: ['road-r7'] },
      verdictAtTime: 'GO' as const,
      dependencies: [
        {
          entityId: 'road-r7',
          valueSeen: 'OPEN',
          statusSeen: 'OPEN' as const,
          versionOpIds: ['mumbai:1'],
          ageAtEvaluationMs: 100,
          authorityReachable: true
        }
      ],
      acknowledgedRisks: [],
      actor: 'operator-1',
      region: 'mumbai',
      timestamp: 1000,
      opId: 'mumbai:dec1'
    };

    const currentMap = new Map<string, Entity>([
      [
        'road-r7',
        {
          entityId: 'road-r7',
          type: 'road',
          authorityRegion: 'mumbai',
          status: 'BLOCKED',
          attributes: {},
          versionVector: { mumbai: 1, delhi: 1 },
          participatingOpIds: ['mumbai:1', 'delhi:1'],
          integrity: 'VERIFIED',
          lastObservedAt: 1200,
          lastUpdatedAt: 1200
        }
      ]
    ]);

    const outcome = reevaluateDecision(receipt, currentMap, 1300);
    expect(outcome.status).toBe('INVALIDATED');
    expect(outcome.diffs[0].statusChanged).toBe(true);
  });

  it('Haversine distance calculates accurate geographic distance', () => {
    // Mumbai (19.0760, 72.8777) to Delhi (28.6139, 77.2090) ~ 1148 km
    const dist = haversineDistanceKm(19.076, 72.8777, 28.6139, 77.209);
    expect(dist).toBeGreaterThan(1140);
    expect(dist).toBeLessThan(1160);
  });

  it('Fog of information calculation computes ramped intensity on unreachable peers', () => {
    const now = 100000;
    const fog = computeFog(
      'mumbai',
      [{ region: 'delhi', reachable: false, lastContactAt: 80000, lastKnownSeq: 10, rttMs: 0, versionVector: {} }],
      [{ region: 'delhi', center: { lat: 28.6, lng: 77.2 }, radiusKm: 50 }],
      now,
      5000,
      30000
    );

    expect(fog.length).toBe(1);
    expect(fog[0].region).toBe('delhi');
    expect(fog[0].unreachable).toBe(true);
    expect(fog[0].fogIntensity).toBeGreaterThan(0.3);
  });
});
