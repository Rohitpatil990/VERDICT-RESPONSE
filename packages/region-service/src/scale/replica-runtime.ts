import {
  calculateOpHash,
  computeCanonicalStateHash,
  createSignedOp,
  diffVectors,
  foldOperations,
  getPublicKey,
  Operation,
  RegionId,
  VersionVector,
  Entity,
  EscrowResourceState,
  applyEscrowOp
} from '@verdict/core';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as ed from '@noble/ed25519';

export interface ReplicaConfig {
  regionId: string;
  name: string;
  authority: boolean;
  peers: string[]; // Bounded neighbor IDs
}

export interface ReplicaMetrics {
  opsAuthored: number;
  opsApplied: number;
  opsReplicated: number;
  opsDeduplicated: number;
  outboxPending: number;
  conflictCount: number;
  isHealthy: boolean;
  participating: boolean;
  canonicalStateHash: string;
}

/**
 * Deterministically generates an Ed25519 private key from a regionId
 */
export function getDeterministicKey(regionId: string): string {
  const seed = new TextEncoder().encode(`verdict-scale-region-key:${regionId}`);
  return bytesToHex(sha256(seed));
}

/**
 * Isolated Logical Replica State
 * Maintains independent operation log, version vector clock,
 * materialized entities, outbox queue, and cryptographic keypair.
 */
export class LogicalReplica {
  public readonly regionId: string;
  public readonly name: string;
  public readonly privateKeyHex: string;
  public publicKeyHex: string = '';

  // Independent Replica State
  public localVector: VersionVector = {};
  public ops: Operation[] = [];
  public opsMap: Map<string, Operation> = new Map();
  public clientTxMap: Map<string, string> = new Map(); // clientTxId -> opId
  public entities: Map<string, Entity> = new Map();
  public escrow: Map<string, EscrowResourceState> = new Map();
  public outbox: Array<{ id: string; targetRegion: string; op: Operation; priorityLane: number; createdAt: number }> = [];

  // Bounded Topology Neighbors
  public neighbors: Set<string> = new Set();
  public isOnline: boolean = true;

  // Performance & accounting counters
  public opsAuthoredCount = 0;
  public opsAppliedCount = 0;
  public opsReplicatedCount = 0;
  public opsDeduplicatedCount = 0;

  constructor(config: ReplicaConfig) {
    this.regionId = config.regionId;
    this.name = config.name;
    this.neighbors = new Set(config.peers);
    this.privateKeyHex = getDeterministicKey(this.regionId);
    this.localVector[this.regionId] = 0;
  }

  async init(): Promise<void> {
    const privBytes = hexToBytes(this.privateKeyHex);
    const pubBytes = await ed.getPublicKeyAsync(privBytes);
    this.publicKeyHex = bytesToHex(pubBytes);

    // Initial escrow capacity
    this.escrow.set('medical-kits', {
      resource: 'medical-kits',
      total: 500,
      rights: { [this.regionId]: 500 },
      spent: { [this.regionId]: 0 },
      unmetQueue: []
    });
  }

  /**
   * Submit local operation with idempotency and Ed25519 signing
   */
  async submitLocalOp(
    type: string,
    entityId: string,
    payload: any,
    authorId: string = 'FIELD_OFFICER',
    priorityLane: number = 2
  ): Promise<{ op: Operation; deduplicated: boolean }> {
    if (!this.isOnline) {
      throw new Error(`Replica ${this.regionId} is currently offline.`);
    }

    // Idempotency check via clientTxId
    if (payload?.clientTxId && this.clientTxMap.has(payload.clientTxId)) {
      const existingOpId = this.clientTxMap.get(payload.clientTxId)!;
      this.opsDeduplicatedCount++;
      return { op: this.opsMap.get(existingOpId)!, deduplicated: true };
    }

    const currentSeq = (this.localVector[this.regionId] ?? 0) + 1;
    this.localVector[this.regionId] = currentSeq;

    const lastOp = this.ops[this.ops.length - 1];
    const prevHash = lastOp ? lastOp.hash : '0000000000000000000000000000000000000000000000000000000000000000';

    const opParams = {
      opId: `${this.regionId}:${currentSeq}`,
      region: this.regionId,
      seq: currentSeq,
      type,
      entityId,
      payload,
      deps: { ...this.localVector },
      authorId,
      authorRole: 'FIELD_OFFICER' as any,
      createdAt: Date.now(),
      prevHash,
      priorityLane: priorityLane as any
    };

    const signedOp = await createSignedOp(opParams, this.privateKeyHex);

    this.ops.push(signedOp);
    this.opsMap.set(signedOp.opId, signedOp);
    if (payload?.clientTxId) {
      this.clientTxMap.set(payload.clientTxId, signedOp.opId);
    }
    this.opsAuthoredCount++;

    // Recompute entity
    this.recomputeEntity(entityId);

    // Queue to outbox for bounded neighbor links
    for (const neighborId of this.neighbors) {
      this.outbox.push({
        id: `${signedOp.opId}->${neighborId}`,
        targetRegion: neighborId,
        op: signedOp,
        priorityLane,
        createdAt: Date.now()
      });
    }

    return { op: signedOp, deduplicated: false };
  }

  /**
   * Apply an incoming replicated operation from a peer
   */
  async applyIncomingOp(op: Operation): Promise<{ status: 'applied' | 'duplicate' | 'rejected'; error?: string }> {
    if (!this.isOnline) {
      return { status: 'rejected', error: 'Replica is offline' };
    }

    // Deduplication check
    if (this.opsMap.has(op.opId)) {
      this.opsDeduplicatedCount++;
      return { status: 'duplicate' };
    }

    // Idempotency check
    if (op.payload?.clientTxId && this.clientTxMap.has(op.payload.clientTxId)) {
      this.opsDeduplicatedCount++;
      return { status: 'duplicate' };
    }

    // Verify cryptographic integrity
    const calculatedHash = calculateOpHash(op);
    if (calculatedHash !== op.hash) {
      return { status: 'rejected', error: 'Invalid op hash' };
    }

    this.ops.push(op);
    this.opsMap.set(op.opId, op);
    if (op.payload?.clientTxId) {
      this.clientTxMap.set(op.payload.clientTxId, op.opId);
    }

    this.localVector[op.region] = Math.max(this.localVector[op.region] ?? 0, op.seq);
    this.opsAppliedCount++;

    // Recompute entity state (with causal conflict detection)
    this.recomputeEntity(op.entityId);

    // Handle escrow op
    if (op.type.startsWith('ESCROW_')) {
      const resource = op.payload?.resource || 'medical-kits';
      const existingEscrow = this.escrow.get(resource);
      if (existingEscrow) {
        this.escrow.set(resource, applyEscrowOp(existingEscrow, op));
      }
    }

    // Gossip / Forward to other bounded neighbors (multi-hop propagation)
    for (const neighborId of this.neighbors) {
      if (neighborId !== op.region) {
        this.outbox.push({
          id: `${op.opId}->${neighborId}`,
          targetRegion: neighborId,
          op,
          priorityLane: op.priorityLane ?? 2,
          createdAt: Date.now()
        });
      }
    }

    return { status: 'applied' };
  }

  /**
   * Folds operations into materialized entity with causal conflict detection
   */
  recomputeEntity(entityId: string): Entity | null {
    const relevantOps = this.ops.filter(o => o.entityId === entityId);
    if (relevantOps.length === 0) return null;

    let entityType: any = 'road';
    if (entityId.startsWith('inc-') || entityId.startsWith('incident')) entityType = 'incident';
    if (entityId.startsWith('shelter')) entityType = 'shelter';

    const folded = foldOperations(entityId, entityType, relevantOps[0].region, relevantOps);
    this.entities.set(entityId, folded);
    return folded;
  }

  /**
   * Flushes outbox items to neighbors through the mesh
   */
  async flushOutbox(mesh: ReplicaMesh): Promise<number> {
    if (!this.isOnline || this.outbox.length === 0) return 0;

    const pending = [...this.outbox];
    this.outbox = [];
    let flushedCount = 0;

    for (const item of pending) {
      const linkUp = mesh.isLinkUp(this.regionId, item.targetRegion);
      if (!linkUp) {
        // Retain in outbox if link is partitioned
        this.outbox.push(item);
        continue;
      }

      const success = await mesh.deliverOp(this.regionId, item.targetRegion, item.op);
      if (success) {
        flushedCount++;
        this.opsReplicatedCount++;
      } else {
        this.outbox.push(item);
      }
    }

    return flushedCount;
  }

  /**
   * Computes the canonical state digest across entities and escrow
   */
  getCanonicalStateHash(): string {
    const entityList = Array.from(this.entities.values());
    const escrowList = Array.from(this.escrow.values());
    return computeCanonicalStateHash(entityList, escrowList).hash;
  }

  /**
   * Health metrics snapshot
   */
  getMetrics(): ReplicaMetrics {
    let conflicts = 0;
    for (const ent of this.entities.values()) {
      if (ent.conflict && ent.conflict.status === 'AWAITING_REVIEW') {
        conflicts++;
      }
    }

    return {
      opsAuthored: this.opsAuthoredCount,
      opsApplied: this.opsAppliedCount,
      opsReplicated: this.opsReplicatedCount,
      opsDeduplicated: this.opsDeduplicatedCount,
      outboxPending: this.outbox.length,
      conflictCount: conflicts,
      isHealthy: this.isOnline,
      participating: (this.opsAuthoredCount + this.opsAppliedCount) > 0,
      canonicalStateHash: this.getCanonicalStateHash()
    };
  }
}

/**
 * Scalable Replica Mesh (supports 100, 250, 500 replicas)
 * Implements bounded-degree graph topology (k=4 to k=6) to prevent socket exhaustion
 * and models controlled partitions, latency, and multi-hop causal replication.
 */
export class ReplicaMesh {
  public replicas: Map<string, LogicalReplica> = new Map();
  public links: Map<string, boolean> = new Map(); // "A<->B" -> isUp
  public linkLatencyMs: number = 0;
  public totalDeliveredOps: number = 0;
  public totalFailedDeliveries: number = 0;

  constructor(public readonly replicaCount: number, private readonly kDegree: number = 4) {}

  /**
   * Initializes the mesh with N logical replicas and bounded-degree topology
   */
  async init(): Promise<void> {
    this.replicas.clear();
    this.links.clear();

    const pad = (num: number, size: number = 4) => String(num).padStart(size, '0');

    // 1. Instantiate 500 isolated replicas
    for (let i = 1; i <= this.replicaCount; i++) {
      const regionId = `region-${pad(i)}`;
      const replica = new LogicalReplica({
        regionId,
        name: `Regional Replica ${pad(i)}`,
        authority: i === 1,
        peers: []
      });
      this.replicas.set(regionId, replica);
    }

    // 2. Build Bounded-Degree Connected Topology (k-regular chordal ring)
    // Every node i connects to (i+1), (i-1), and chordal steps (i + sqrt(N)), (i - sqrt(N))
    const chordStep = Math.max(2, Math.floor(Math.sqrt(this.replicaCount)));
    const ids = Array.from(this.replicas.keys());

    for (let idx = 0; idx < ids.length; idx++) {
      const curId = ids[idx];
      const curReplica = this.replicas.get(curId)!;

      const neighborIndices = [
        (idx + 1) % ids.length,
        (idx - 1 + ids.length) % ids.length,
        (idx + chordStep) % ids.length,
        (idx - chordStep + ids.length) % ids.length
      ];

      for (const nIdx of neighborIndices) {
        if (nIdx !== idx) {
          const neighborId = ids[nIdx];
          curReplica.neighbors.add(neighborId);
          this.setLinkStatus(curId, neighborId, true);
        }
      }
    }

    // 3. Initialize all replicas
    for (const replica of this.replicas.values()) {
      await replica.init();
    }
  }

  private linkKey(r1: string, r2: string): string {
    return r1 < r2 ? `${r1}<->${r2}` : `${r2}<->${r1}`;
  }

  setLinkStatus(r1: string, r2: string, isUp: boolean) {
    this.links.set(this.linkKey(r1, r2), isUp);
  }

  isLinkUp(r1: string, r2: string): boolean {
    const key = this.linkKey(r1, r2);
    return this.links.get(key) ?? false;
  }

  /**
   * Partitions the cluster into two disconnected groups (cuts cross-group links)
   */
  partitionCluster(groupA: Set<string>, groupB: Set<string>) {
    for (const key of this.links.keys()) {
      const [r1, r2] = key.split('<->');
      if ((groupA.has(r1) && groupB.has(r2)) || (groupB.has(r1) && groupA.has(r2))) {
        this.links.set(key, false);
      }
    }
  }

  /**
   * Restores all links in the mesh
   */
  healAllPartitions() {
    for (const key of this.links.keys()) {
      this.links.set(key, true);
    }
  }

  /**
   * Delivers an operation across the in-memory transport
   */
  async deliverOp(fromRegion: string, toRegion: string, op: Operation): Promise<boolean> {
    if (!this.isLinkUp(fromRegion, toRegion)) {
      this.totalFailedDeliveries++;
      return false;
    }

    const target = this.replicas.get(toRegion);
    if (!target || !target.isOnline) {
      this.totalFailedDeliveries++;
      return false;
    }

    if (this.linkLatencyMs > 0) {
      await new Promise(r => setTimeout(r, this.linkLatencyMs));
    }

    const res = await target.applyIncomingOp(op);
    if (res.status === 'applied' || res.status === 'duplicate') {
      this.totalDeliveredOps++;
      return true;
    }

    this.totalFailedDeliveries++;
    return false;
  }

  /**
   * Flushes outbox queues cluster-wide until drained or bounded rounds
   */
  async flushCluster(maxRounds: number = 25): Promise<number> {
    let totalFlushed = 0;
    for (let round = 0; round < maxRounds; round++) {
      let roundFlushed = 0;
      for (const replica of this.replicas.values()) {
        const flushed = await replica.flushOutbox(this);
        roundFlushed += flushed;
      }
      totalFlushed += roundFlushed;
      if (roundFlushed === 0) break; // Replicas fully drained
    }
    return totalFlushed;
  }

  /**
   * Aggregates cluster-wide metrics
   */
  getClusterMetrics(): {
    configured: number;
    active: number;
    healthy: number;
    participating: number;
    totalOpsAuthored: number;
    totalOpsApplied: number;
    totalOpsDeduplicated: number;
    totalOutboxPending: number;
    totalConflicts: number;
    stateHashConsensusPercentage: number;
    converged: boolean;
  } {
    let active = 0;
    let healthy = 0;
    let participating = 0;
    let totalOpsAuthored = 0;
    let totalOpsApplied = 0;
    let totalOpsDeduplicated = 0;
    let totalOutboxPending = 0;
    let totalConflicts = 0;

    const hashCounts = new Map<string, number>();

    for (const rep of this.replicas.values()) {
      const m = rep.getMetrics();
      if (rep.isOnline) active++;
      if (m.isHealthy) healthy++;
      if (m.participating) participating++;

      totalOpsAuthored += m.opsAuthored;
      totalOpsApplied += m.opsApplied;
      totalOpsDeduplicated += m.opsDeduplicated;
      totalOutboxPending += m.outboxPending;
      totalConflicts += m.conflictCount;

      hashCounts.set(m.canonicalStateHash, (hashCounts.get(m.canonicalStateHash) || 0) + 1);
    }

    let dominantHashCount = 0;
    for (const count of hashCounts.values()) {
      if (count > dominantHashCount) dominantHashCount = count;
    }

    const consensusPct = active > 0 ? (dominantHashCount / active) * 100 : 0;
    const converged = consensusPct === 100 && totalOutboxPending === 0;

    return {
      configured: this.replicaCount,
      active,
      healthy,
      participating,
      totalOpsAuthored,
      totalOpsApplied,
      totalOpsDeduplicated,
      totalOutboxPending,
      totalConflicts,
      stateHashConsensusPercentage: Math.round(consensusPct * 10) / 10,
      converged
    };
  }
}
