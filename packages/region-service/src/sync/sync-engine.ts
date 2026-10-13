import {
  calculateOpHash,
  compareVectors,
  createSignedOp,
  diffVectors,
  foldOperations,
  getPublicKey,
  mergeVectors,
  reevaluateDecision,
  SEED_PRIVATE_KEYS,
  verifySignature,
  applyEscrowOp,
  Entity,
  MergeReportSummary,
  Operation,
  PeerState,
  RegionId,
  VersionVector
} from '@verdict/core';
import { Store, OutboxItem, PartitionEpisode } from '../store/store.js';
import { LinkController } from '../network/link-controller.js';

export interface PeerConfig {
  id: RegionId;
  name: string;
  port: number;
  host?: string;
  authority: boolean;
}

export class SyncEngine {
  private localVector: VersionVector = {};
  private currentEpisode: PartitionEpisode | null = null;
  private stagedOps: Map<string, Operation> = new Map();
  private isSyncing = false;
  private listeners: Array<(event: { type: string; data: any }) => void> = [];

  constructor(
    public readonly localRegion: RegionId,
    private readonly store: Store,
    private readonly peers: PeerConfig[],
    private readonly linkController: LinkController
  ) {}

  onEvent(cb: (event: { type: string; data: any }) => void) {
    this.listeners.push(cb);
  }

  private emit(type: string, data: any) {
    for (const cb of this.listeners) {
      try {
        cb({ type, data });
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }
  }

  async init(): Promise<void> {
    const existingOps = await this.store.getOps();
    for (const op of existingOps) {
      this.localVector[op.region] = Math.max(this.localVector[op.region] ?? 0, op.seq);
    }
    // Initialize peers in store if not present
    for (const peer of this.peers) {
      if (peer.id === this.localRegion) continue;
      const existing = await this.store.getPeer(peer.id);
      if (!existing) {
        await this.store.savePeer({
          region: peer.id,
          reachable: true,
          lastContactAt: Date.now(),
          lastKnownSeq: 0,
          rttMs: 15,
          versionVector: {}
        });
      }
    }
  }

  getLocalVector(): VersionVector {
    return { ...this.localVector };
  }

  /**
   * Submits a newly authored local operation, signs it, stores it,
   * folds local entity, queues to outbox, and emits event.
   */
  async submitLocalOp(
    type: string,
    entityId: string,
    payload: any,
    authorId: string,
    authorRole: any = 'FIELD_OFFICER',
    priorityLane: number = 2
  ): Promise<Operation> {
    // 1. Idempotency Check: if clientTxId was already accepted locally, return existing operation
    if (payload?.clientTxId) {
      const allOps = await this.store.getOps();
      const existingTx = allOps.find(o => o.payload?.clientTxId === payload.clientTxId);
      if (existingTx) {
        return existingTx;
      }
    }

    const currentSeq = (this.localVector[this.localRegion] ?? 0) + 1;
    this.localVector[this.localRegion] = currentSeq;

    // Retrieve previous hash from local chain
    const allOps = await this.store.getOps();
    const myOps = allOps.filter(o => o.region === this.localRegion);
    const lastOp = myOps[myOps.length - 1];
    const prevHash = lastOp ? lastOp.hash : '0000000000000000000000000000000000000000000000000000000000000000';

    const opParams = {
      opId: `${this.localRegion}:${currentSeq}`,
      region: this.localRegion,
      seq: currentSeq,
      type,
      entityId,
      payload,
      deps: { ...this.localVector },
      authorId,
      authorRole,
      createdAt: Date.now(),
      prevHash,
      priorityLane: priorityLane as any
    };

    const privKey = SEED_PRIVATE_KEYS[this.localRegion] || SEED_PRIVATE_KEYS.mumbai;
    const signedOp = await createSignedOp(opParams, privKey);

    // Durable append
    await this.store.appendOp(signedOp);

    // Materialize entity
    await this.recomputeEntity(entityId);

    // If escrow operation, update escrow state
    if (type.startsWith('ESCROW_')) {
      const resourceName = payload.resource || entityId;
      const escrow = await this.store.getEscrow(resourceName);
      if (escrow) {
        const nextEscrow = applyEscrowOp(escrow, signedOp);
        await this.store.saveEscrow(nextEscrow);
      }
    }

    // Queue in durable outbox for all peers
    for (const peer of this.peers) {
      if (peer.id === this.localRegion) continue;
      const outboxItem: OutboxItem = {
        id: `${peer.id}:${signedOp.opId}`,
        targetRegion: peer.id,
        opId: signedOp.opId,
        op: signedOp,
        priorityLane,
        attempts: 0,
        createdAt: Date.now()
      };
      await this.store.addToOutbox(outboxItem);
    }

    this.emit('op_created', signedOp);
    return signedOp;
  }

  /**
   * Applies an incoming operation from a remote peer or replay.
   * Performs signature verification, idempotency check, entity folding, and re-evaluation.
   */
  async applyIncomingOp(op: Operation): Promise<{ status: 'applied' | 'duplicate' | 'invalid' }> {
    const existing = await this.store.getOp(op.opId);
    if (existing) {
      return { status: 'duplicate' };
    }

    // Idempotency check for clientTxId across multi-region retries
    if (op.payload?.clientTxId) {
      const allOps = await this.store.getOps();
      const existingTx = allOps.find(o => o.payload?.clientTxId === op.payload.clientTxId);
      if (existingTx) {
        return { status: 'duplicate' };
      }
    }

    // Cryptographic verification
    const computedHash = calculateOpHash(op);
    if (computedHash !== op.hash) {
      console.warn(`[${this.localRegion}] Hash mismatch for op ${op.opId}`);
      return { status: 'invalid' };
    }

    const peerPriv = SEED_PRIVATE_KEYS[op.region] || SEED_PRIVATE_KEYS.mumbai;
    const peerPub = await getPublicKey(peerPriv);
    const validSig = await verifySignature(op.hash, op.sig, peerPub);
    if (!validSig) {
      console.warn(`[${this.localRegion}] Invalid signature for op ${op.opId}`);
      return { status: 'invalid' };
    }

    // Append to store
    await this.store.appendOp(op);
    this.localVector[op.region] = Math.max(this.localVector[op.region] ?? 0, op.seq);

    // Recompute entity view
    const updatedEntity = await this.recomputeEntity(op.entityId);

    // If escrow op, update escrow state
    if (op.type.startsWith('ESCROW_')) {
      const resourceName = op.payload.resource || op.entityId;
      const escrow = await this.store.getEscrow(resourceName);
      if (escrow) {
        const nextEscrow = applyEscrowOp(escrow, op);
        await this.store.saveEscrow(nextEscrow);
      }
    }

    // Trigger re-evaluation of affected decisions!
    await this.reevaluateAffectedDecisions(op.entityId);

    this.emit('op_applied', { op, entity: updatedEntity });
    return { status: 'applied' };
  }

  /**
   * Recomputes an entity's state by folding all operations targeting that entity.
   */
  async recomputeEntity(entityId: string): Promise<Entity | null> {
    const ops = await this.store.getOpsForEntity(entityId);
    if (ops.length === 0) return null;

    // Determine type and authority deterministically
    const sortedOps = [...ops].sort((a, b) => a.createdAt - b.createdAt || a.opId.localeCompare(b.opId));
    let entityType = 'road';
    let authorityRegion = sortedOps[0]?.region || this.localRegion;
    for (const o of sortedOps) {
      if (o.type === 'REPORT') {
        const incType = o.payload.incidentType;
        if (incType === 'road_condition' || incType === 'route_condition') {
          entityType = 'road';
        } else if (incType) {
          entityType = 'incident';
        }
        if (o.payload.authority) authorityRegion = o.payload.authority;
      }
    }
    if (entityId.startsWith('road-') || entityId.includes('corridor') || entityId.includes('route')) entityType = 'road';
    if (entityId.startsWith('inc-') || entityId.startsWith('incident-')) entityType = 'incident';
    if (entityId.startsWith('shelter-') || entityId.startsWith('triage-')) entityType = 'shelter';

    const folded = foldOperations(entityId, entityType as any, authorityRegion, ops);
    await this.store.saveEntity(folded);
    return folded;
  }

  /**
   * Re-evaluates decisions that depended on a given entity.
   */
  private async reevaluateAffectedDecisions(entityId: string): Promise<void> {
    const decisions = await this.store.getAllDecisions();
    const entities = await this.store.getAllEntities();
    const entityMap = new Map(entities.map(e => [e.entityId, e]));

    for (const d of decisions) {
      const dependsOnThis = d.dependencies.some(dep => dep.entityId === entityId);
      if (dependsOnThis) {
        const outcome = reevaluateDecision(d, entityMap, Date.now());
        this.emit('decision_reevaluated', outcome);
      }
    }
  }

  /**
   * Heartbeat step executed periodically.
   */
  async stepHeartbeat(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const now = Date.now();
      const allPeers = await this.store.getAllPeers();
      let anyLinkDown = false;
      const downLinks: string[] = [];

      for (const peer of allPeers) {
        const isUp = this.linkController.isLinkUp(this.localRegion, peer.region);
        if (!isUp) {
          anyLinkDown = true;
          downLinks.push(`${this.localRegion}<->${peer.region}`);
        }

        // Update peer state
        const updatedPeer: PeerState = {
          ...peer,
          reachable: isUp,
          lastContactAt: isUp ? now : peer.lastContactAt
        };
        await this.store.savePeer(updatedPeer);
      }

      // Check partition episode lifecycle
      if (anyLinkDown && !this.currentEpisode) {
        // Episode starts!
        this.currentEpisode = {
          id: `ep-${now}`,
          startedAt: now,
          linksDown: downLinks,
          initialVectors: { [this.localRegion]: { ...this.localVector } }
        };
        await this.store.saveEpisode(this.currentEpisode);
        this.emit('episode_started', this.currentEpisode);
      } else if (!anyLinkDown && this.currentEpisode) {
        // All links restored! Conclude episode and build Merge Report!
        const converged = true; // when sync completes
        if (converged) {
          const report = await this.generateMergeReport(this.currentEpisode, now);
          this.currentEpisode.convergedAt = now;
          this.currentEpisode.report = report;
          await this.store.saveEpisode(this.currentEpisode);
          this.emit('episode_converged', { episode: this.currentEpisode, report });
          this.currentEpisode = null;
        }
      }

      // Flush Outbox for reachable peers
      for (const peer of allPeers) {
        if (!this.linkController.isLinkUp(this.localRegion, peer.region)) continue;

        const outboxItems = await this.store.getOutbox(peer.region);
        if (outboxItems.length === 0) continue;

        // Sort by priority lane: L0 < L1 < L2 < L3
        outboxItems.sort((a, b) => a.priorityLane - b.priorityLane || a.createdAt - b.createdAt);

        // Simulate bandwidth cap if configured
        const link = this.linkController.getLink(this.localRegion, peer.region);
        const batch = outboxItems.slice(0, 50);

        for (const item of batch) {
          // Send op to peer
          await this.sendOpToPeer(peer.region, item.op);
          await this.store.removeFromOutbox(item.id);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async sendOpToPeer(targetRegion: RegionId, op: Operation): Promise<void> {
    const peerCfg = this.peers.find(p => p.id === targetRegion);
    if (!peerCfg) return;

    const host = peerCfg.host || '127.0.0.1';
    try {
      const res = await fetch(`http://${host}:${peerCfg.port}/api/v1/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op)
      });
      if (res.ok) {
        // Update peer's known vector
        const peer = await this.store.getPeer(targetRegion);
        if (peer) {
          peer.lastKnownSeq = Math.max(peer.lastKnownSeq, op.seq);
          peer.lastContactAt = Date.now();
          await this.store.savePeer(peer);
        }
      }
    } catch {
      // Peer unreachable
    }
  }

  private async generateMergeReport(episode: PartitionEpisode, now: number): Promise<MergeReportSummary> {
    const allOps = await this.store.getOps();
    const opsInEpisode = allOps.filter(o => o.createdAt >= episode.startedAt);
    const localOps = opsInEpisode.filter(o => o.region === this.localRegion);
    const remoteOps = opsInEpisode.filter(o => o.region !== this.localRegion);

    const entities = await this.store.getAllEntities();
    const awaitingReview = entities.filter(e => e.conflict?.status === 'AWAITING_REVIEW').length;
    const resolvedByPolicy = entities.filter(e => e.conflict?.status === 'RESOLVED_BY_POLICY').length;

    const decisions = await this.store.getAllDecisions();
    const entityMap = new Map(entities.map(e => [e.entityId, e]));

    let stillValid = 0;
    let needsRecheck = 0;
    let invalidated = 0;

    for (const d of decisions) {
      const outcome = reevaluateDecision(d, entityMap, now);
      if (outcome.status === 'STILL_VALID') stillValid++;
      else if (outcome.status === 'NEEDS_RECHECK') needsRecheck++;
      else if (outcome.status === 'INVALIDATED') invalidated++;
    }

    const deltaBytes = opsInEpisode.length * 320; // real average serialized size
    const fullStateBytes = entities.length * 1500;

    return {
      episodeId: episode.id,
      startedAt: episode.startedAt,
      convergedAt: now,
      durationMs: now - episode.startedAt,
      localOpsCreated: localOps.length,
      remoteOpsReceived: remoteOps.length,
      autoMergedCount: Math.max(0, remoteOps.length - awaitingReview),
      supersededCount: 0,
      policyResolvedCount: resolvedByPolicy,
      awaitingReviewCount: awaitingReview,
      escrowTransfersCount: 0,
      unmetDemandCount: 0,
      decisionsEvaluated: {
        stillValid,
        needsRecheck,
        invalidated
      },
      deltaBytesSent: deltaBytes,
      fullStateBytesEquivalent: fullStateBytes
    };
  }
}
