import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { canonicalJson } from './canonical.js';
import {
  Entity,
  EscrowResourceState,
  Operation,
  RegionId,
  VersionVector
} from './types.js';

export type ConvergenceStatus =
  | 'CONVERGED'
  | 'DIVERGED'
  | 'SYNCING'
  | 'CONFLICT_PENDING'
  | 'UNAVAILABLE';

export interface CanonicalStateHashResult {
  hash: string;
  scope: string; // "entities,escrow"
  entityCount: number;
  escrowCount: number;
  entitiesHash: string;
  escrowHash: string;
}

export interface PeerConvergenceComparison {
  region: RegionId;
  reachable: boolean;
  status: ConvergenceStatus;
  stateHash?: string;
  opLogHash?: string;
  scope?: string;
  outboxPending?: number;
  unresolvedConflicts?: number;
  versionVector?: VersionVector;
  reason: string;
  hashMatch?: boolean;
}

export interface RegionConvergenceReport {
  region: RegionId;
  canonicalStateHash: string;
  operationLogHash: string;
  scope: string;
  versionVector: VersionVector;
  opCount: number;
  entityCount: number;
  escrowCount: number;
  outboxPending: number;
  unresolvedConflicts: number;
  peers: Record<RegionId, PeerConvergenceComparison>;
  overallStatus: ConvergenceStatus;
  summary: string;
  timestamp: number;
}

/**
 * Normalizes an Entity for canonical hashing by:
 * 1. Keeping only logical distributed state.
 * 2. Sorting participatingOpIds and conflict claims deterministically.
 * 3. Excluding nondeterministic fields such as local machine wall-clock observation drift.
 */
export function normalizeEntityForCanonicalHash(entity: Entity): any {
  return {
    entityId: entity.entityId,
    type: entity.type,
    authorityRegion: entity.authorityRegion,
    status: entity.status,
    attributes: entity.attributes || {},
    versionVector: entity.versionVector || {},
    participatingOpIds: Array.isArray(entity.participatingOpIds)
      ? [...entity.participatingOpIds].sort()
      : [],
    integrity: entity.integrity || 'UNVERIFIED',
    conflict: entity.conflict
      ? {
          field: entity.conflict.field,
          status: entity.conflict.status,
          claims: Array.isArray(entity.conflict.claims)
            ? [...entity.conflict.claims]
                .map(c => ({
                  opId: c.opId,
                  region: c.region,
                  authorId: c.authorId,
                  authorRole: c.authorRole,
                  tier: c.tier,
                  value: c.value
                }))
                .sort((a, b) => a.opId.localeCompare(b.opId))
            : [],
          resolution: entity.conflict.resolution
            ? {
                effectiveValue: entity.conflict.resolution.effectiveValue,
                reason: entity.conflict.resolution.reason,
                resolvedByOpId: entity.conflict.resolution.resolvedByOpId
              }
            : undefined
        }
      : undefined
  };
}

/**
 * Normalizes an EscrowResourceState for deterministic canonical hashing.
 */
export function normalizeEscrowForCanonicalHash(escrow: EscrowResourceState): any {
  return {
    resource: escrow.resource,
    total: escrow.total,
    rights: escrow.rights || {},
    spent: escrow.spent || {},
    unmetQueue: Array.isArray(escrow.unmetQueue)
      ? escrow.unmetQueue.map(q => ({
          id: q.id,
          region: q.region,
          qty: q.qty,
          priorityClass: q.priorityClass
        }))
      : []
  };
}

/**
 * Calculates a deterministic SHA-256 hash over the canonical representation of
 * materialized entities and escrow states (Option A).
 */
export function computeCanonicalStateHash(
  entities: Entity[],
  escrow: EscrowResourceState[] = []
): CanonicalStateHashResult {
  // 1. Sort entities lexicographically by entityId
  const sortedEntities = [...entities]
    .sort((a, b) => a.entityId.localeCompare(b.entityId))
    .map(normalizeEntityForCanonicalHash);

  // 2. Sort escrow states lexicographically by resource
  const sortedEscrow = [...escrow]
    .sort((a, b) => a.resource.localeCompare(b.resource))
    .map(normalizeEscrowForCanonicalHash);

  // 3. Serialize sub-scopes with canonical JSON
  const entitiesCjson = canonicalJson(sortedEntities);
  const entitiesHash = bytesToHex(sha256(new TextEncoder().encode(entitiesCjson)));

  const escrowCjson = canonicalJson(sortedEscrow);
  const escrowHash = bytesToHex(sha256(new TextEncoder().encode(escrowCjson)));

  // 4. Combined canonical state payload
  const combinedPayload = {
    entities: sortedEntities,
    escrow: sortedEscrow
  };
  const combinedCjson = canonicalJson(combinedPayload);
  const hash = bytesToHex(sha256(new TextEncoder().encode(combinedCjson)));

  return {
    hash,
    scope: 'entities,escrow',
    entityCount: entities.length,
    escrowCount: escrow.length,
    entitiesHash,
    escrowHash
  };
}

/**
 * Calculates a deterministic SHA-256 digest over the sorted set of applied operations (Option B).
 */
export function computeOperationLogHash(ops: Operation[]): { hash: string; opCount: number } {
  const sortedOps = [...ops]
    .sort((a, b) => (a.seq !== b.seq ? a.seq - b.seq : a.opId.localeCompare(b.opId)))
    .map(op => ({
      opId: op.opId,
      region: op.region,
      seq: op.seq,
      hash: op.hash,
      type: op.type
    }));

  const cjson = canonicalJson(sortedOps);
  const hash = bytesToHex(sha256(new TextEncoder().encode(cjson)));

  return {
    hash,
    opCount: ops.length
  };
}

/**
 * Evaluates convergence status between local state and a peer replica based on:
 * - Reachability
 * - Unresolved conflicts (AWAITING_REVIEW)
 * - In-flight outbox operations
 * - Version vector causal completeness
 * - Canonical state hash comparison
 */
export function evaluateConvergencePair(
  local: {
    region: RegionId;
    stateHash: string;
    outboxPending: number;
    unresolvedConflicts: number;
    versionVector?: VersionVector;
  },
  peer: {
    region: RegionId;
    reachable: boolean;
    stateHash?: string;
    outboxPending?: number;
    unresolvedConflicts?: number;
    versionVector?: VersionVector;
  }
): { status: ConvergenceStatus; reason: string; hashMatch?: boolean } {
  if (!peer.reachable) {
    return {
      status: 'UNAVAILABLE',
      reason: `Peer replica ${peer.region.toUpperCase()} is unreachable (network partition or node offline)`
    };
  }

  // 1. Conflict check: if either side has unresolved conflicts, cannot declare converged
  const peerConflicts = peer.unresolvedConflicts ?? 0;
  if (local.unresolvedConflicts > 0 || peerConflicts > 0) {
    return {
      status: 'CONFLICT_PENDING',
      reason: `Unresolved concurrent conflicts require human/policy review (Local: ${local.unresolvedConflicts}, ${peer.region.toUpperCase()}: ${peerConflicts})`
    };
  }

  // 2. Outbox check: if either side has pending outbox items, replication is still in progress
  const peerOutbox = peer.outboxPending ?? 0;
  if (local.outboxPending > 0 || peerOutbox > 0) {
    return {
      status: 'SYNCING',
      reason: `Operations currently in transit in outbox (Local outbox: ${local.outboxPending}, ${peer.region.toUpperCase()} outbox: ${peerOutbox})`
    };
  }

  // 3. Version vector check if available: check if vectors match
  if (local.versionVector && peer.versionVector) {
    const allRegions = new Set([
      ...Object.keys(local.versionVector),
      ...Object.keys(peer.versionVector)
    ]);
    let vectorMismatch = false;
    for (const r of allRegions) {
      if ((local.versionVector[r] ?? 0) !== (peer.versionVector[r] ?? 0)) {
        vectorMismatch = true;
        break;
      }
    }
    if (vectorMismatch) {
      return {
        status: 'SYNCING',
        reason: `Version vectors differ between ${local.region.toUpperCase()} and ${peer.region.toUpperCase()} (operations being reconciled)`
      };
    }
  }

  // 4. Canonical state hash comparison
  if (!peer.stateHash) {
    return {
      status: 'UNAVAILABLE',
      reason: `Peer replica ${peer.region.toUpperCase()} did not provide a canonical state hash`
    };
  }

  const hashMatch = local.stateHash === peer.stateHash;
  if (hashMatch) {
    return {
      status: 'CONVERGED',
      reason: `Canonical state hashes match exactly across all replicated entities and escrow balances`,
      hashMatch: true
    };
  }

  return {
    status: 'DIVERGED',
    reason: `Canonical state hashes differ (Local: ${local.stateHash.slice(0, 8)}..., Peer: ${peer.stateHash.slice(0, 8)}...)`,
    hashMatch: false
  };
}
