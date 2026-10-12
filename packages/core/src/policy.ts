import { Entity, EntityStatus, Operation, SourceTier, UserRole, VersionVector } from './types.js';
import { compareVectors } from './vector.js';

export const SOURCE_TIER_PRIORITY: Record<SourceTier, number> = {
  OFFICIAL_SENSOR: 4,
  FIELD_OFFICER: 3,
  VOLUNTEER: 2,
  CITIZEN: 1
};

export const INCIDENT_STATUS_RANK: Record<string, number> = {
  Reported: 1,
  Investigating: 2,
  Resolved: 3
};

export const PERSON_STATUS_RANK: Record<string, number> = {
  Missing: 1,
  Found: 2,
  Safe: 3
};

/**
 * Deterministic reducer that materializes an entity's view from its log of operations.
 */
export function foldOperations(
  entityId: string,
  entityType: any,
  authorityRegion: string,
  ops: Operation[]
): Entity {
  const sortedOps = [...ops].sort((a, b) => a.createdAt - b.createdAt || a.opId.localeCompare(b.opId));

  let status: EntityStatus = entityType === 'road' ? 'OPEN' : entityType === 'incident' ? 'Reported' : 'ACTIVE';
  const attributes: Record<string, any> = {
    notes: [],
    reports: []
  };
  const participatingOpIds: string[] = [];
  const versionVector: VersionVector = {};
  let integrity: 'VERIFIED' | 'FAILED' | 'UNVERIFIED' = 'VERIFIED';
  let lastObservedAt = 0;
  let lastUpdatedAt = 0;

  // Track candidate status claims for conflict detection
  const statusClaims: Array<{
    op: Operation;
    proposedStatus: EntityStatus;
    tier: SourceTier;
    vector: VersionVector;
  }> = [];

  let humanResolvedStatus: EntityStatus | null = null;
  let humanResolvedOpId: string | null = null;

  for (const op of sortedOps) {
    participatingOpIds.push(op.opId);
    versionVector[op.region] = Math.max(versionVector[op.region] ?? 0, op.seq);
    lastUpdatedAt = Math.max(lastUpdatedAt, op.createdAt);

    if (op.payload?.observedAt) {
      lastObservedAt = Math.max(lastObservedAt, op.payload.observedAt);
    } else {
      lastObservedAt = Math.max(lastObservedAt, op.createdAt);
    }

    if (op.type === 'ADD_NOTE' && op.payload?.text) {
      attributes.notes.push({
        text: op.payload.text,
        author: op.authorId,
        time: op.createdAt
      });
    } else if (op.type === 'REPORT') {
      attributes.reports.push(op.payload);
      if (op.payload?.status) {
        statusClaims.push({
          op,
          proposedStatus: op.payload.status,
          tier: op.payload?.source?.tier || 'VOLUNTEER',
          vector: { ...op.deps, [op.region]: op.seq }
        });
      }
    } else if (op.type === 'STATUS_CHANGE') {
      statusClaims.push({
        op,
        proposedStatus: op.payload.status,
        tier: op.payload?.tier || (op.authorRole === 'OFFICIAL' ? 'OFFICIAL_SENSOR' : 'FIELD_OFFICER'),
        vector: { ...op.deps, [op.region]: op.seq }
      });
    } else if (op.type === 'PERSON_STATUS') {
      const pStatus = op.payload.status;
      const currentRank = PERSON_STATUS_RANK[status] || 0;
      const newRank = PERSON_STATUS_RANK[pStatus] || 0;
      if (newRank >= currentRank) {
        status = pStatus;
      }
    } else if (op.type === 'RESOLVE' || op.type === 'CONFIRM_RESOLVED') {
      humanResolvedStatus = op.payload.status;
      humanResolvedOpId = op.opId;
    }
  }

  // If human reviewer has resolved, honor resolution
  if (humanResolvedStatus) {
    status = humanResolvedStatus;
    return {
      entityId,
      type: entityType,
      authorityRegion,
      status,
      attributes,
      versionVector,
      participatingOpIds,
      integrity,
      lastObservedAt,
      lastUpdatedAt,
      conflict: {
        field: 'status',
        status: 'RESOLVED_BY_HUMAN',
        claims: statusClaims.map(c => ({
          opId: c.op.opId,
          region: c.op.region,
          authorId: c.op.authorId,
          authorRole: c.op.authorRole,
          tier: c.tier,
          value: c.proposedStatus,
          timestamp: c.op.createdAt
        })),
        resolution: {
          effectiveValue: humanResolvedStatus,
          reason: 'Resolved by human reviewer with signed confirmation',
          resolvedByOpId: humanResolvedOpId || undefined
        }
      }
    };
  }

  // Conflict evaluation for roads and incidents
  if (statusClaims.length > 0) {
    // Find maximal elements under causal order (version vector)
    let maximalClaims: typeof statusClaims = [];
    for (const claim of statusClaims) {
      let isDominated = false;
      for (const other of statusClaims) {
        if (claim === other) continue;
        const rel = compareVectors(claim.vector, other.vector);
        if (rel === 'v2_dominates') {
          isDominated = true;
          break;
        }
      }
      if (!isDominated) {
        // avoid duplicate claims for same op
        if (!maximalClaims.some(m => m.op.opId === claim.op.opId)) {
          maximalClaims.push(claim);
        }
      }
    }

    if (maximalClaims.length === 1) {
      const best = maximalClaims[0];
      // Special Incident #101 rule: non-reviewer cannot declare 'Resolved' as effective status
      if (entityType === 'incident' && best.proposedStatus === 'Resolved' && best.op.authorRole !== 'REVIEWER' && best.op.authorRole !== 'ADMIN') {
        status = 'Investigating';
        return {
          entityId,
          type: entityType,
          authorityRegion,
          status,
          attributes,
          versionVector,
          participatingOpIds,
          integrity,
          lastObservedAt,
          lastUpdatedAt,
          conflict: {
            field: 'status',
            status: 'AWAITING_REVIEW',
            claims: [{
              opId: best.op.opId,
              region: best.op.region,
              authorId: best.op.authorId,
              authorRole: best.op.authorRole,
              tier: best.tier,
              value: 'Resolved (claimed)',
              timestamp: best.op.createdAt
            }],
            resolution: {
              effectiveValue: 'Investigating',
              reason: 'Non-reviewer claimed Resolution; holds at Investigating awaiting confirmation'
            }
          }
        };
      } else {
        status = best.proposedStatus;
      }
    } else {
      // Concurrent maximal claims exist!
      const distinctStatuses = new Set(maximalClaims.map(m => m.proposedStatus));
      if (distinctStatuses.size > 1) {
        // True semantic conflict!
        // Safety-critical entities (roads) or incidents: MUST surface conflict and await review
        if (entityType === 'road') {
          // Both OPEN and BLOCKED claimed concurrently
          // Keep highest tier or default conservative, but MUST flag AWAITING_REVIEW
          status = 'BLOCKED'; // conservative safety default on conflict
          return {
            entityId,
            type: entityType,
            authorityRegion,
            status,
            attributes,
            versionVector,
            participatingOpIds,
            integrity,
            lastObservedAt,
            lastUpdatedAt,
            conflict: {
              field: 'status',
              status: 'AWAITING_REVIEW',
              claims: maximalClaims.map(c => ({
                opId: c.op.opId,
                region: c.op.region,
                authorId: c.op.authorId,
                authorRole: c.op.authorRole,
                tier: c.tier,
                value: c.proposedStatus,
                timestamp: c.op.createdAt
              })),
              resolution: {
                effectiveValue: 'BLOCKED',
                reason: 'Concurrent conflicting status claims on safety-critical road; awaiting human review'
              }
            }
          };
        } else if (entityType === 'incident') {
          // Incident #101 concurrent claims (e.g. Mumbai Investigating vs Delhi Resolved)
          status = 'Investigating';
          return {
            entityId,
            type: entityType,
            authorityRegion,
            status,
            attributes,
            versionVector,
            participatingOpIds,
            integrity,
            lastObservedAt,
            lastUpdatedAt,
            conflict: {
              field: 'status',
              status: 'AWAITING_REVIEW',
              claims: maximalClaims.map(c => ({
                opId: c.op.opId,
                region: c.op.region,
                authorId: c.op.authorId,
                authorRole: c.op.authorRole,
                tier: c.tier,
                value: c.proposedStatus,
                timestamp: c.op.createdAt
              })),
              resolution: {
                effectiveValue: 'Investigating',
                reason: 'Concurrent claims (Investigating vs Resolved); awaiting human review confirmation'
              }
            }
          };
        }
      } else {
        status = [...distinctStatuses][0];
      }
    }
  }

  return {
    entityId,
    type: entityType,
    authorityRegion,
    status,
    attributes,
    versionVector,
    participatingOpIds,
    integrity,
    lastObservedAt,
    lastUpdatedAt
  };
}
