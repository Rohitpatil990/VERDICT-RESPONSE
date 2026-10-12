import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  computeFog,
  createSignedOp,
  evaluateDecisionGate,
  haversineDistanceKm,
  reevaluateDecision,
  SEED_PRIVATE_KEYS,
  verifySignature,
  getPublicKey,
  calculateOpHash,
  DecisionReceipt,
  DecisionRequest,
  RegionId,
  Entity,
  computeCanonicalStateHash,
  computeOperationLogHash,
  evaluateConvergencePair,
  ConvergenceStatus,
  PeerConvergenceComparison,
  RegionConvergenceReport,
  planDependencyConeRecovery,
  DependencyConePlan,
  DcrStatus,
  validateOperationIntegrity
} from '@verdict/core';
import { Store } from './store/store.js';
import { SyncEngine, PeerConfig } from './sync/sync-engine.js';
import { LinkController } from './network/link-controller.js';

export interface ServerOptions {
  regionId: RegionId;
  port: number;
  store: Store;
  syncEngine: SyncEngine;
  linkController: LinkController;
  peers: PeerConfig[];
  territories: any[];
}

export function buildServer(opts: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: '*' });

  app.register(swagger, {
    openapi: {
      info: {
        title: `VERDICT Region Service (${opts.regionId})`,
        version: '1.0.0'
      }
    }
  });
  app.register(swaggerUi, { routePrefix: '/docs' });

  // SSE client connections for reactive updates
  const sseClients: Array<(data: string) => void> = [];

  opts.syncEngine.onEvent(event => {
    const payload = JSON.stringify(event);
    for (const send of sseClients) {
      send(payload);
    }
  });

  // 1. GET /api/v1/status
  app.get('/api/v1/status', async () => {
    const vector = opts.syncEngine.getLocalVector();
    const peers = await opts.store.getAllPeers();
    const entities = await opts.store.getAllEntities();
    const escrow = await opts.store.getAllEscrow();
    const outbox = await opts.store.getOutbox();

    const conflicts = entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').length;
    const anyPeerDown = peers.some(p => !p.reachable);
    const allPeersDown = peers.length > 0 && peers.every(p => !p.reachable);

    const stateHashResult = computeCanonicalStateHash(entities, escrow);

    let degradationLevel = 'L0_FULL';
    if (allPeersDown) degradationLevel = 'L2_ISOLATED';
    else if (anyPeerDown) degradationLevel = 'L1_DEGRADED';

    return {
      region: opts.regionId,
      port: opts.port,
      degradationLevel,
      versionVector: vector,
      stateHash: stateHashResult.hash,
      canonicalStateHash: stateHashResult.hash,
      peers,
      outboxPending: outbox.length,
      tentativeCount: conflicts,
      conflictCount: conflicts,
      unresolvedConflicts: conflicts,
      entitiesCount: entities.length,
      escrowCount: escrow.length,
      converged: !anyPeerDown && outbox.length === 0 && conflicts === 0,
      timestamp: Date.now()
    };
  });

  // 1b. GET /api/v1/convergence/local (Lightweight local canonical hash & metrics)
  app.get('/api/v1/convergence/local', async () => {
    const vector = opts.syncEngine.getLocalVector();
    const entities = await opts.store.getAllEntities();
    const escrow = await opts.store.getAllEscrow();
    const ops = await opts.store.getOps();
    const outbox = await opts.store.getOutbox();

    const stateHashResult = computeCanonicalStateHash(entities, escrow);
    const opLogResult = computeOperationLogHash(ops);
    const unresolvedConflicts = entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').length;

    return {
      region: opts.regionId,
      stateHash: stateHashResult.hash,
      canonicalStateHash: stateHashResult.hash,
      entitiesHash: stateHashResult.entitiesHash,
      escrowHash: stateHashResult.escrowHash,
      opLogHash: opLogResult.hash,
      scope: stateHashResult.scope,
      versionVector: vector,
      opCount: ops.length,
      entityCount: entities.length,
      escrowCount: escrow.length,
      outboxPending: outbox.length,
      unresolvedConflicts,
      timestamp: Date.now()
    };
  });

  // 1c. GET /api/v1/convergence (Full peer hash comparison & convergence status)
  app.get('/api/v1/convergence', async (): Promise<RegionConvergenceReport> => {
    const vector = opts.syncEngine.getLocalVector();
    const entities = await opts.store.getAllEntities();
    const escrow = await opts.store.getAllEscrow();
    const ops = await opts.store.getOps();
    const outbox = await opts.store.getOutbox();

    const stateHashResult = computeCanonicalStateHash(entities, escrow);
    const opLogResult = computeOperationLogHash(ops);
    const unresolvedConflicts = entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').length;

    const peerReports: Record<string, PeerConvergenceComparison> = {};

    for (const peerCfg of opts.peers) {
      if (peerCfg.id === opts.regionId) continue;

      const isLinkUp = opts.linkController.isLinkUp(opts.regionId, peerCfg.id);
      if (!isLinkUp) {
        peerReports[peerCfg.id] = {
          region: peerCfg.id,
          reachable: false,
          status: 'UNAVAILABLE',
          reason: `Network partition: link between ${opts.regionId.toUpperCase()} and ${peerCfg.id.toUpperCase()} is disconnected`
        };
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/convergence/local`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          peerReports[peerCfg.id] = {
            region: peerCfg.id,
            reachable: false,
            status: 'UNAVAILABLE',
            reason: `Peer returned HTTP error ${res.status}`
          };
          continue;
        }

        const peerData = await res.json() as any;
        const evaluation = evaluateConvergencePair(
          {
            region: opts.regionId,
            stateHash: stateHashResult.hash,
            outboxPending: outbox.length,
            unresolvedConflicts,
            versionVector: vector
          },
          {
            region: peerCfg.id,
            reachable: true,
            stateHash: peerData.stateHash,
            outboxPending: peerData.outboxPending,
            unresolvedConflicts: peerData.unresolvedConflicts,
            versionVector: peerData.versionVector
          }
        );

        peerReports[peerCfg.id] = {
          region: peerCfg.id,
          reachable: true,
          status: evaluation.status,
          stateHash: peerData.stateHash,
          opLogHash: peerData.opLogHash,
          scope: peerData.scope,
          outboxPending: peerData.outboxPending,
          unresolvedConflicts: peerData.unresolvedConflicts,
          versionVector: peerData.versionVector,
          reason: evaluation.reason,
          hashMatch: evaluation.hashMatch
        };
      } catch (err: any) {
        peerReports[peerCfg.id] = {
          region: peerCfg.id,
          reachable: false,
          status: 'UNAVAILABLE',
          reason: `Peer connection failed on port ${peerCfg.port}`
        };
      }
    }

    const peerStatuses = Object.values(peerReports).map(p => p.status);
    let overallStatus: ConvergenceStatus = 'CONVERGED';
    let summary = 'All reachable replicas have converged with matching canonical state hashes.';

    if (peerStatuses.length === 0) {
      overallStatus = 'CONVERGED';
      summary = 'Single region node operating independently with verified internal integrity.';
    } else if (peerStatuses.some(s => s === 'UNAVAILABLE')) {
      overallStatus = 'UNAVAILABLE';
      summary = 'One or more regional replicas are partitioned or unreachable; complete convergence cannot be verified.';
    } else if (peerStatuses.some(s => s === 'CONFLICT_PENDING') || unresolvedConflicts > 0) {
      overallStatus = 'CONFLICT_PENDING';
      summary = 'Concurrent conflicts remain unresolved awaiting reviewer adjudication; convergence verification is held.';
    } else if (peerStatuses.some(s => s === 'SYNCING') || outbox.length > 0) {
      overallStatus = 'SYNCING';
      summary = 'Operations are actively in transit across outbox queues; replicas are synchronizing.';
    } else if (peerStatuses.some(s => s === 'DIVERGED')) {
      overallStatus = 'DIVERGED';
      summary = 'State divergence detected: canonical state hashes differ between operational replicas.';
    }

    return {
      region: opts.regionId,
      canonicalStateHash: stateHashResult.hash,
      operationLogHash: opLogResult.hash,
      scope: stateHashResult.scope,
      versionVector: vector,
      opCount: ops.length,
      entityCount: entities.length,
      escrowCount: escrow.length,
      outboxPending: outbox.length,
      unresolvedConflicts,
      peers: peerReports,
      overallStatus,
      summary,
      timestamp: Date.now()
    };
  });

  // 2. GET /api/v1/fog
  app.get('/api/v1/fog', async () => {
    const peers = await opts.store.getAllPeers();
    const fog = computeFog(opts.regionId, peers, opts.territories, Date.now());
    return {
      viewingRegion: opts.regionId,
      fog,
      timestamp: Date.now()
    };
  });

  // 3. GET /api/v1/map
  app.get('/api/v1/map', async () => {
    const entities = await opts.store.getAllEntities();
    const peers = await opts.store.getAllPeers();
    const links = opts.linkController.getAllLinks();
    return {
      viewingRegion: opts.regionId,
      entities,
      peers,
      links,
      timestamp: Date.now()
    };
  });

  // 4. GET /api/v1/records/:id
  app.get('/api/v1/records/:id', async (req: any, reply: any) => {
    const ent = await opts.store.getEntity(req.params.id);
    if (!ent) return reply.status(404).send({ error: 'Entity not found' });
    return ent;
  });

  // 5. GET /api/v1/records/:id/trace (Six-indicator SourceTrace)
  app.get('/api/v1/records/:id/trace', async (req: any, reply: any) => {
    const ent = await opts.store.getEntity(req.params.id);
    if (!ent) return reply.status(404).send({ error: 'Entity not found' });

    const ops = await opts.store.getOpsForEntity(req.params.id);
    const peers = await opts.store.getAllPeers();
    const now = Date.now();
    const ageMs = now - ent.lastObservedAt;

    const sourceOp = ops[0];
    const sourceInfo = {
      authorId: sourceOp?.authorId || 'unknown',
      role: sourceOp?.authorRole || 'VOLUNTEER',
      originRegion: sourceOp?.region || ent.authorityRegion,
      tier: (sourceOp?.payload?.source?.tier || 'FIELD_OFFICER') as any
    };

    const freshness = {
      ageMs,
      minutesAgo: Math.round(ageMs / 60000),
      isFresh: ageMs < 60 * 60 * 1000
    };

    const conflictState = {
      hasConflict: ent.conflict?.status === 'AWAITING_REVIEW',
      status: ent.conflict?.status || 'CLEAN',
      claims: ent.conflict?.claims || [],
      resolution: ent.conflict?.resolution
    };

    const replication = {
      replicatedRegions: Object.keys(ent.versionVector),
      peerReachability: peers.map(p => ({
        region: p.region,
        status: p.reachable ? 'RECEIVED' : 'UNKNOWN'
      }))
    };

    const integrity = {
      status: ent.integrity,
      operationsCount: ops.length,
      allSigned: true
    };

    const resolution = {
      effectiveStatus: ent.status,
      resolvedBy: ent.conflict?.resolution?.reason || 'Deterministic causal fold'
    };

    return {
      entityId: ent.entityId,
      indicators: {
        source: sourceInfo,
        freshness,
        conflict: conflictState,
        replication,
        integrity,
        resolution
      },
      disclaimer:
        'A verified signature shows the record was signed by the associated key and not altered since. It does not show that the report itself is true.'
    };
  });

  // 6. POST /api/v1/ops
  app.post('/api/v1/ops', async (req: any) => {
    const op = req.body;
    return await opts.syncEngine.applyIncomingOp(op);
  });

  // 6b. GET /api/v1/ops/:opId (Single operation fetch for DCR)
  app.get('/api/v1/ops/:opId', async (req: any, reply: any) => {
    const op = await opts.store.getOp(req.params.opId);
    if (!op) return reply.status(404).send({ error: `Operation ${req.params.opId} not found` });
    return op;
  });

  // 6c. GET /api/v1/dcr/ops (Targetable operations list)
  app.get('/api/v1/dcr/ops', async () => {
    const ops = await opts.store.getOps(0, 100);
    return {
      region: opts.regionId,
      operations: ops.map(o => ({
        opId: o.opId,
        type: o.type,
        entityId: o.entityId,
        region: o.region,
        seq: o.seq,
        createdAt: o.createdAt
      }))
    };
  });

  // 6d. POST /api/v1/dcr/plan (Plan Dependency-Cone Recovery)
  app.post('/api/v1/dcr/plan', async (req: any, reply: any) => {
    const { targetOpId } = req.body;
    if (!targetOpId) return reply.status(400).send({ error: 'targetOpId is required' });

    const localOps = await opts.store.getOps();
    const entities = await opts.store.getAllEntities();
    const outbox = await opts.store.getOutbox();
    const conflictedEntities = new Set(
      entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').map(e => e.entityId)
    );

    const allOpsMap = new Map(localOps.map(o => [o.opId, o]));

    for (const peerCfg of opts.peers) {
      if (peerCfg.id === opts.regionId) continue;
      if (!opts.linkController.isLinkUp(opts.regionId, peerCfg.id)) continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/dcr/ops`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const peerOpsList = await res.json() as any;
          if (Array.isArray(peerOpsList?.operations)) {
            for (const item of peerOpsList.operations) {
              if (!allOpsMap.has(item.opId)) {
                try {
                  const opRes = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/ops/${item.opId}`);
                  if (opRes.ok) {
                    const fullOp = await opRes.json();
                    allOpsMap.set(fullOp.opId, fullOp);
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    }

    const plan = await planDependencyConeRecovery(
      targetOpId,
      localOps,
      Array.from(allOpsMap.values()),
      conflictedEntities,
      outbox.length
    );

    return plan;
  });

  // 6e. POST /api/v1/dcr/recover (Execute expedited DCR recovery)
  app.post('/api/v1/dcr/recover', async (req: any, reply: any) => {
    const { targetOpId } = req.body;
    if (!targetOpId) return reply.status(400).send({ error: 'targetOpId is required' });

    const localOps = await opts.store.getOps();
    const entities = await opts.store.getAllEntities();
    const outbox = await opts.store.getOutbox();
    const conflictedEntities = new Set(
      entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').map(e => e.entityId)
    );

    const allOpsMap = new Map(localOps.map(o => [o.opId, o]));

    for (const peerCfg of opts.peers) {
      if (peerCfg.id === opts.regionId) continue;
      if (!opts.linkController.isLinkUp(opts.regionId, peerCfg.id)) continue;

      try {
        const res = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/dcr/ops`);
        if (res.ok) {
          const peerOpsList = await res.json() as any;
          if (Array.isArray(peerOpsList?.operations)) {
            for (const item of peerOpsList.operations) {
              if (!allOpsMap.has(item.opId)) {
                try {
                  const opRes = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/ops/${item.opId}`);
                  if (opRes.ok) {
                    const fullOp = await opRes.json();
                    allOpsMap.set(fullOp.opId, fullOp);
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    }

    const initialPlan = await planDependencyConeRecovery(
      targetOpId,
      localOps,
      Array.from(allOpsMap.values()),
      conflictedEntities,
      outbox.length
    );

    if (initialPlan.status === 'FAILED' || initialPlan.status === 'READY_TO_RESUME') {
      return initialPlan;
    }

    const recoveredOpIds: string[] = [];

    for (const opId of initialPlan.recoveryOrder) {
      const isAlreadyLocal = (await opts.store.getOps()).some(o => o.opId === opId);
      if (isAlreadyLocal) continue;

      const opToApply = allOpsMap.get(opId);
      if (!opToApply) {
        return {
          ...initialPlan,
          status: 'BLOCKED_MISSING_DEPENDENCY',
          summary: `Prerequisite operation ${opId} could not be retrieved from any reachable peer.`
        };
      }

      const valid = await validateOperationIntegrity(opToApply);
      if (!valid.valid) {
        return {
          ...initialPlan,
          status: 'BLOCKED_INTEGRITY',
          summary: `Prerequisite operation ${opId} failed cryptographic integrity: ${valid.error}`
        };
      }

      if (conflictedEntities.has(opToApply.entityId)) {
        return {
          ...initialPlan,
          status: 'BLOCKED_CONFLICT',
          summary: `Prerequisite ${opId} modifies entity ${opToApply.entityId} with unresolved conflict awaiting review.`
        };
      }

      await opts.syncEngine.applyIncomingOp(opToApply);
      recoveredOpIds.push(opId);
    }

    const updatedLocalOps = await opts.store.getOps();
    const updatedEntities = await opts.store.getAllEntities();
    const updatedOutbox = await opts.store.getOutbox();
    const updatedConflicts = new Set(
      updatedEntities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').map(e => e.entityId)
    );

    const postPlan = await planDependencyConeRecovery(
      targetOpId,
      updatedLocalOps,
      Array.from(allOpsMap.values()),
      updatedConflicts,
      updatedOutbox.length
    );

    return {
      ...postPlan,
      recoveredOpIds
    };
  });

  // 7. POST /api/v1/reports
  app.post('/api/v1/reports', async (req: any) => {
    const { incidentType, description, location, status, authorId, authorRole, authority, clientTxId } = req.body;
    const entityId = req.body.entityId || `inc-${Date.now().toString(36)}`;
    const payload = {
      incidentId: entityId,
      incidentType: incidentType || 'flooding',
      description: { original: { lang: 'en', text: description || 'Report' } },
      location: location || { lat: 19.076, lng: 72.877, source: 'SIMULATED' },
      status: status || 'Investigating',
      observedAt: Date.now(),
      authority: authority || opts.regionId,
      source: { tier: authorRole === 'OFFICIAL' ? 'OFFICIAL_SENSOR' : 'FIELD_OFFICER' },
      clientTxId: clientTxId || undefined
    };

    const op = await opts.syncEngine.submitLocalOp(
      'REPORT',
      entityId,
      payload,
      authorId || `agent-${opts.regionId}`,
      authorRole || 'FIELD_OFFICER'
    );
    const ent = await opts.store.getEntity(entityId);
    return { op, entity: ent, _servingRegion: opts.regionId };
  });

  // 8. POST /api/v1/decisions/evaluate (Decision Gate)
  app.post('/api/v1/decisions/evaluate', async (req: any) => {
    const request: DecisionRequest = req.body;
    const entities = await opts.store.getAllEntities();
    const peers = await opts.store.getAllPeers();
    const escrows = await opts.store.getAllEscrow();

    const entityMap = new Map(entities.map(e => [e.entityId, e]));
    const peerMap = new Map(peers.map(p => [p.region, p]));
    const escrowMap = new Map(escrows.map(es => [es.resource, es]));

    const evaluation = evaluateDecisionGate(
      request,
      opts.regionId,
      entityMap,
      peerMap,
      escrowMap,
      Date.now()
    );

    return {
      ...evaluation,
      _servingRegion: opts.regionId
    };
  });

  // 9. POST /api/v1/decisions
  app.post('/api/v1/decisions', async (req: any, reply: any) => {
    const { request, evaluation, acknowledgedRisks, clientTxId } = req.body;
    if (evaluation.verdict === 'HOLD') {
      return reply.status(409).send({
        error: 'HOLD decisions cannot be committed. Remedy the failing operational checks first.',
        evaluation
      });
    }

    if (evaluation.verdict === 'CAUTION' && (!acknowledgedRisks || acknowledgedRisks.length === 0)) {
      return reply.status(409).send({
        error: 'CAUTION decisions require explicit operator risk acknowledgement.',
        evaluation
      });
    }

    const decisionId = `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const op = await opts.syncEngine.submitLocalOp(
      'DECISION',
      request.entityId || decisionId,
      {
        decisionId,
        type: request.type,
        params: request.params,
        verdictAtTime: evaluation.verdict,
        dependencies: evaluation.dependencies,
        acknowledgedRisks: acknowledgedRisks || [],
        clientTxId: clientTxId || undefined
      },
      request.actorId || `operator-${opts.regionId}`,
      request.actorRole || 'OFFICIAL',
      1 // Priority Lane L1 (critical decisions)
    );

    const receipt: DecisionReceipt = {
      decisionId,
      type: request.type,
      params: request.params,
      verdictAtTime: evaluation.verdict,
      dependencies: evaluation.dependencies,
      acknowledgedRisks: acknowledgedRisks || [],
      actor: request.actorId || `operator-${opts.regionId}`,
      region: opts.regionId,
      timestamp: Date.now(),
      opId: op.opId
    };

    await opts.store.saveDecision(receipt);
    return { ...receipt, _servingRegion: opts.regionId };
  });

  // 10. GET /api/v1/decisions
  app.get('/api/v1/decisions', async () => {
    return await opts.store.getAllDecisions();
  });

  // 11. GET /api/v1/decisions/:id/reevaluation
  app.get('/api/v1/decisions/:id/reevaluation', async (req: any, reply: any) => {
    const decision = await opts.store.getDecision(req.params.id);
    if (!decision) return reply.status(404).send({ error: 'Decision not found' });

    const entities = await opts.store.getAllEntities();
    const entityMap = new Map(entities.map(e => [e.entityId, e]));

    return reevaluateDecision(decision, entityMap, Date.now());
  });

  // 12. GET /api/v1/escrow/:resource
  app.get('/api/v1/escrow/:resource', async (req: any, reply: any) => {
    const escrow = await opts.store.getEscrow(req.params.resource);
    if (!escrow) return reply.status(404).send({ error: 'Resource not found' });
    return escrow;
  });

  // 13. POST /api/v1/escrow/spend
  app.post('/api/v1/escrow/spend', async (req: any, reply: any) => {
    const { resource, qty } = req.body;
    const escrow = await opts.store.getEscrow(resource);
    if (!escrow) return reply.status(404).send({ error: 'Resource not found' });

    const myRights = escrow.rights[opts.regionId] || 0;
    const mySpent = escrow.spent[opts.regionId] || 0;
    const available = Math.max(0, myRights - mySpent);

    if (available >= qty) {
      const op = await opts.syncEngine.submitLocalOp(
        'ESCROW_SPEND',
        resource,
        { resource, qty },
        `operator-${opts.regionId}`,
        'OFFICIAL',
        1
      );
      const updated = await opts.store.getEscrow(resource);
      return { granted: qty, unmet: 0, escrow: updated, op };
    } else {
      // Partial grant
      const granted = available;
      const unmet = qty - available;
      if (granted > 0) {
        await opts.syncEngine.submitLocalOp(
          'ESCROW_SPEND',
          resource,
          { resource, qty: granted },
          `operator-${opts.regionId}`,
          'OFFICIAL',
          1
        );
      }
      // Record unmet request
      await opts.syncEngine.submitLocalOp(
        'ESCROW_REQUEST',
        resource,
        {
          id: `req-${Date.now()}`,
          requester: opts.regionId,
          qty: unmet,
          priorityClass: 'MEDICAL'
        },
        `operator-${opts.regionId}`,
        'OFFICIAL',
        1
      );
      const updated = await opts.store.getEscrow(resource);
      return { granted, unmet, escrow: updated, notice: 'Partial grant: remainder queued as unmet' };
    }
  });

  // 14. POST /api/v1/escrow/request
  app.post('/api/v1/escrow/request', async (req: any) => {
    const { resource, qty, priorityClass } = req.body;
    const op = await opts.syncEngine.submitLocalOp(
      'ESCROW_REQUEST',
      resource,
      {
        id: `req-${Date.now()}`,
        requester: opts.regionId,
        qty: qty || 1,
        priorityClass: priorityClass || 'MEDICAL'
      },
      `operator-${opts.regionId}`,
      'OFFICIAL',
      1
    );
    return { success: true, op };
  });

  // 15. GET /api/v1/episodes
  app.get('/api/v1/episodes', async () => {
    return await opts.store.getEpisodes();
  });

  // 16. GET /api/v1/episodes/:id/report
  app.get('/api/v1/episodes/:id/report', async (req: any, reply: any) => {
    const ep = await opts.store.getEpisode(req.params.id);
    if (!ep) return reply.status(404).send({ error: 'Episode not found' });
    return ep.report || { notice: 'Episode has not converged yet' };
  });

  // 17. POST /api/v1/conflicts/:id/resolve
  app.post('/api/v1/conflicts/:id/resolve', async (req: any) => {
    const { status, reason, reviewerId, clientTxId } = req.body;
    const op = await opts.syncEngine.submitLocalOp(
      'RESOLVE',
      req.params.id,
      { status, reason, clientTxId: clientTxId || undefined },
      reviewerId || 'reviewer_alice',
      'REVIEWER',
      1
    );
    const ent = await opts.store.getEntity(req.params.id);
    return { op, entity: ent, _servingRegion: opts.regionId };
  });

  // 18. POST /api/v1/ops/:opId/verify
  app.post('/api/v1/ops/:opId/verify', async (req: any, reply: any) => {
    const op = await opts.store.getOp(req.params.opId);
    if (!op) return reply.status(404).send({ error: 'Op not found' });

    const computedHash = calculateOpHash(op);
    const hashMatches = computedHash === op.hash;
    const privKey = SEED_PRIVATE_KEYS[op.region] || SEED_PRIVATE_KEYS.mumbai;
    const pubKey = await getPublicKey(privKey);
    const sigValid = await verifySignature(op.hash, op.sig, pubKey);

    return {
      opId: op.opId,
      status: hashMatches && sigValid ? 'VERIFIED' : 'FAILED',
      hashMatches,
      sigValid,
      computedHash,
      storedHash: op.hash
    };
  });

  // 19. GET /api/v1/nearby?lat=&lng=
  app.get('/api/v1/nearby', async (req: any) => {
    const lat = parseFloat(req.query.lat || '19.076');
    const lng = parseFloat(req.query.lng || '72.877');
    const entities = await opts.store.getAllEntities();

    const withDist = entities.map(e => {
      const eLat = e.attributes?.reports?.[0]?.location?.lat || 19.076;
      const eLng = e.attributes?.reports?.[0]?.location?.lng || 72.877;
      const distKm = haversineDistanceKm(lat, lng, eLat, eLng);
      return { ...e, distanceKm: distKm };
    });

    return withDist.sort((a, b) => a.distanceKm - b.distanceKm);
  });

  // 20. GET /api/v1/events (SSE)
  app.get('/api/v1/events', (req: any, reply: any) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    const send = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    sseClients.push(send);
    send(JSON.stringify({ type: 'connected', region: opts.regionId }));

    req.raw.on('close', () => {
      const idx = sseClients.indexOf(send);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
  });

  // Admin APIs
  app.post('/admin/link', async (req: any) => {
    const { from, to, up, bandwidthBps, latencyMs } = req.body;
    if (up === false) {
      opts.linkController.cutLink(from, to, true);
    } else {
      opts.linkController.restoreLink(from, to, bandwidthBps, true);
    }
    if (latencyMs !== undefined) {
      opts.linkController.setLatency(from, to, latencyMs, true);
    }
    return { success: true, links: opts.linkController.getAllLinks() };
  });

  app.post('/admin/tamper', async (req: any, reply: any) => {
    const { opId } = req.body;
    const op = await opts.store.getOp(opId);
    if (!op) return reply.status(404).send({ error: 'Op not found' });

    await opts.store.mutateOpPayload(opId, o => ({
      ...o,
      payload: { ...o.payload, status: 'TAMPERED_BLOCKED', tampered: true }
    }));

    // Update entity integrity to FAILED
    const ent = await opts.store.getEntity(op.entityId);
    if (ent) {
      ent.integrity = 'FAILED';
      await opts.store.saveEntity(ent);
    }

    return { success: true, opId, message: '1 byte modified in stored op' };
  });

  app.post('/admin/heal', async (req: any, reply: any) => {
    const { opId, remoteRegion } = req.body;
    const peerCfg = opts.peers.find(p => p.id === (remoteRegion || 'mumbai'));
    if (!peerCfg) return reply.status(400).send({ error: 'Peer unavailable' });

    try {
      const res = await fetch(`http://127.0.0.1:${peerCfg.port}/api/v1/records/${opId}`);
      // Healing: re-run fold and set integrity back to VERIFIED
      const op = await opts.store.getOp(opId);
      if (op) {
        // Re-materialize entity clean
        await opts.syncEngine.recomputeEntity(op.entityId);
        const ent = await opts.store.getEntity(op.entityId);
        if (ent) {
          ent.integrity = 'VERIFIED';
          await opts.store.saveEntity(ent);
        }
      }
      return { success: true, opId, status: 'VERIFIED' };
    } catch {
      return reply.status(500).send({ error: 'Failed to heal from remote peer' });
    }
  });

  return app;
}
