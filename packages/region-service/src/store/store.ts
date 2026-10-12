import {
  DecisionReceipt,
  Entity,
  EscrowResourceState,
  Operation,
  PeerState,
  RegionId
} from '@verdict/core';

export interface OutboxItem {
  id: string;
  targetRegion: RegionId;
  opId: string;
  op: Operation;
  priorityLane: number;
  attempts: number;
  createdAt: number;
}

export interface PartitionEpisode {
  id: string;
  startedAt: number;
  convergedAt?: number;
  linksDown: string[];
  initialVectors: Record<string, any>;
  finalVectors?: Record<string, any>;
  report?: any;
}

export interface Store {
  init(): Promise<void>;
  close(): Promise<void>;

  // Operations
  appendOp(op: Operation): Promise<void>;
  getOps(fromSeq?: number, limit?: number): Promise<Operation[]>;
  getOp(opId: string): Promise<Operation | null>;
  getOpsForEntity(entityId: string): Promise<Operation[]>;
  mutateOpPayload(opId: string, mutator: (op: Operation) => Operation): Promise<boolean>;

  // Materialized Entities
  saveEntity(entity: Entity): Promise<void>;
  getEntity(entityId: string): Promise<Entity | null>;
  getAllEntities(): Promise<Entity[]>;

  // Escrow
  saveEscrow(escrow: EscrowResourceState): Promise<void>;
  getEscrow(resource: string): Promise<EscrowResourceState | null>;
  getAllEscrow(): Promise<EscrowResourceState[]>;

  // Decisions
  saveDecision(receipt: DecisionReceipt): Promise<void>;
  getDecision(decisionId: string): Promise<DecisionReceipt | null>;
  getAllDecisions(): Promise<DecisionReceipt[]>;

  // Peers
  savePeer(peer: PeerState): Promise<void>;
  getPeer(region: RegionId): Promise<PeerState | null>;
  getAllPeers(): Promise<PeerState[]>;

  // Transactional Outbox
  addToOutbox(item: OutboxItem): Promise<void>;
  getOutbox(targetRegion?: RegionId): Promise<OutboxItem[]>;
  removeFromOutbox(id: string): Promise<void>;

  // Partition Episodes
  saveEpisode(episode: PartitionEpisode): Promise<void>;
  getEpisodes(): Promise<PartitionEpisode[]>;
  getEpisode(id: string): Promise<PartitionEpisode | null>;
}
