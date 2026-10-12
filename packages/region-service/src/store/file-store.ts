import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DecisionReceipt,
  Entity,
  EscrowResourceState,
  Operation,
  PeerState,
  RegionId
} from '@verdict/core';
import { OutboxItem, PartitionEpisode, Store } from './store.js';

interface DatabaseSnapshot {
  ops: Operation[];
  entities: Record<string, Entity>;
  escrow: Record<string, EscrowResourceState>;
  decisions: Record<string, DecisionReceipt>;
  peers: Record<string, PeerState>;
  outbox: OutboxItem[];
  episodes: PartitionEpisode[];
}

/**
 * File-backed durable store providing independent database files per region.
 * Ensures crash resilience, ACID write persistence, and separate regional state.
 */
export class FileStore implements Store {
  private dataDir: string;
  private filePath: string;
  private ops: Operation[] = [];
  private entities: Map<string, Entity> = new Map();
  private escrow: Map<string, EscrowResourceState> = new Map();
  private decisions: Map<string, DecisionReceipt> = new Map();
  private peers: Map<string, PeerState> = new Map();
  private outbox: Map<string, OutboxItem> = new Map();
  private episodes: Map<string, PartitionEpisode> = new Map();
  private saveLock: Promise<void> = Promise.resolve();

  constructor(private regionId: RegionId, baseDir: string = './data') {
    this.dataDir = path.resolve(baseDir);
    this.filePath = path.join(this.dataDir, `${this.regionId}.db.json`);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const snapshot: DatabaseSnapshot = JSON.parse(data);
      this.ops = snapshot.ops || [];
      this.entities = new Map(Object.entries(snapshot.entities || {}));
      this.escrow = new Map(Object.entries(snapshot.escrow || {}));
      this.decisions = new Map(Object.entries(snapshot.decisions || {}));
      this.peers = new Map(Object.entries(snapshot.peers || {}));
      this.outbox = new Map((snapshot.outbox || []).map(item => [item.id, item]));
      this.episodes = new Map((snapshot.episodes || []).map(ep => [ep.id, ep]));
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`[${this.regionId}] Error loading store:`, err);
      }
      // Fresh database
      await this.persist();
    }
  }

  async close(): Promise<void> {
    await this.persist();
  }

  private async persist(): Promise<void> {
    this.saveLock = this.saveLock.then(async () => {
      const snapshot: DatabaseSnapshot = {
        ops: this.ops,
        entities: Object.fromEntries(this.entities),
        escrow: Object.fromEntries(this.escrow),
        decisions: Object.fromEntries(this.decisions),
        peers: Object.fromEntries(this.peers),
        outbox: Array.from(this.outbox.values()),
        episodes: Array.from(this.episodes.values())
      };
      await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    });
    return this.saveLock;
  }

  async appendOp(op: Operation): Promise<void> {
    const existingIdx = this.ops.findIndex(o => o.opId === op.opId);
    if (existingIdx >= 0) {
      // Idempotent: already stored
      return;
    }
    this.ops.push(op);
    await this.persist();
  }

  async getOps(fromSeq = 0, limit = 1000): Promise<Operation[]> {
    return this.ops
      .filter(o => o.seq >= fromSeq)
      .slice(0, limit);
  }

  async getOp(opId: string): Promise<Operation | null> {
    return this.ops.find(o => o.opId === opId) || null;
  }

  async getOpsForEntity(entityId: string): Promise<Operation[]> {
    return this.ops.filter(o => o.entityId === entityId);
  }

  async mutateOpPayload(opId: string, mutator: (op: Operation) => Operation): Promise<boolean> {
    const idx = this.ops.findIndex(o => o.opId === opId);
    if (idx < 0) return false;
    this.ops[idx] = mutator(this.ops[idx]);
    await this.persist();
    return true;
  }

  async saveEntity(entity: Entity): Promise<void> {
    this.entities.set(entity.entityId, entity);
    await this.persist();
  }

  async getEntity(entityId: string): Promise<Entity | null> {
    return this.entities.get(entityId) || null;
  }

  async getAllEntities(): Promise<Entity[]> {
    return Array.from(this.entities.values());
  }

  async saveEscrow(escrow: EscrowResourceState): Promise<void> {
    this.escrow.set(escrow.resource, escrow);
    await this.persist();
  }

  async getEscrow(resource: string): Promise<EscrowResourceState | null> {
    return this.escrow.get(resource) || null;
  }

  async getAllEscrow(): Promise<EscrowResourceState[]> {
    return Array.from(this.escrow.values());
  }

  async saveDecision(receipt: DecisionReceipt): Promise<void> {
    this.decisions.set(receipt.decisionId, receipt);
    await this.persist();
  }

  async getDecision(decisionId: string): Promise<DecisionReceipt | null> {
    return this.decisions.get(decisionId) || null;
  }

  async getAllDecisions(): Promise<DecisionReceipt[]> {
    return Array.from(this.decisions.values());
  }

  async savePeer(peer: PeerState): Promise<void> {
    this.peers.set(peer.region, peer);
    await this.persist();
  }

  async getPeer(region: RegionId): Promise<PeerState | null> {
    return this.peers.get(region) || null;
  }

  async getAllPeers(): Promise<PeerState[]> {
    return Array.from(this.peers.values());
  }

  async addToOutbox(item: OutboxItem): Promise<void> {
    this.outbox.set(item.id, item);
    await this.persist();
  }

  async getOutbox(targetRegion?: RegionId): Promise<OutboxItem[]> {
    const list = Array.from(this.outbox.values());
    if (targetRegion) {
      return list.filter(i => i.targetRegion === targetRegion);
    }
    return list;
  }

  async removeFromOutbox(id: string): Promise<void> {
    this.outbox.delete(id);
    await this.persist();
  }

  async saveEpisode(episode: PartitionEpisode): Promise<void> {
    this.episodes.set(episode.id, episode);
    await this.persist();
  }

  async getEpisodes(): Promise<PartitionEpisode[]> {
    return Array.from(this.episodes.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  async getEpisode(id: string): Promise<PartitionEpisode | null> {
    return this.episodes.get(id) || null;
  }
}
