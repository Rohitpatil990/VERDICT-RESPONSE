import type { 
  Operation, 
  AuthorTier, 
  ConflictStatus, 
  ResolutionStatus, 
  FactPayload, 
  ResourceClaimPayload, 
  PersonStatusPayload, 
  ResolvePayload 
} from './types.js';
import { compareVectors } from './vectors.js';

export const TIER_PRIORITY: Record<AuthorTier, number> = {
  OFFICIAL_SENSOR: 4,
  FIELD_OFFICER: 3,
  VOLUNTEER: 2,
  CITIZEN: 1
};

export const RESOURCE_CLASS_PRIORITY: Record<string, number> = {
  MEDICAL: 5,
  WATER: 4,
  FOOD: 3,
  SHELTER: 2,
  OTHER: 1
};

export interface SettlementDecision {
  entityId: string;
  opId: string;
  resolutionStatus: ResolutionStatus;
  conflictStatus: ConflictStatus;
  reason: string;
  allocated?: number;
  backordered?: number;
}

/**
 * Evaluates conflict status between two operations on the same entity.
 */
export function evaluateConflict(opA: Operation, opB: Operation): {
  isConflict: boolean;
  status: ConflictStatus;
  winnerOpId?: string;
  loserOpId?: string;
  reason: string;
} {
  if (opA.opId === opB.opId) {
    return { isConflict: false, status: 'None', reason: 'Identical operation' };
  }

  // Section 3 rule: B supersedes A only if B's deps shows its author had seen A; otherwise concurrent
  const aSawB = (opA.deps[opB.region] || 0) >= opB.seq;
  const bSawA = (opB.deps[opA.region] || 0) >= opA.seq;

  if (aSawB && !bSawA) {
    return {
      isConflict: false,
      status: 'Resolved by policy',
      winnerOpId: opA.opId,
      loserOpId: opB.opId,
      reason: `Causally later operation ${opA.opId} supersedes ${opB.opId} (author had seen ${opB.opId})`
    };
  }
  if (bSawA && !aSawB) {
    return {
      isConflict: false,
      status: 'Resolved by policy',
      winnerOpId: opB.opId,
      loserOpId: opA.opId,
      reason: `Causally later operation ${opB.opId} supersedes ${opA.opId} (author had seen ${opA.opId})`
    };
  }

  // Concurrent operations: Apply type-specific policy
  if (opA.type === 'FACT' && opB.type === 'FACT') {
    const factA = opA.payload as FactPayload;
    const factB = opB.payload as FactPayload;
    if (factA.status !== factB.status) {
      // Safety critical contradiction: road BLOCKED vs OPEN
      const tierA = TIER_PRIORITY[opA.payload?.source?.tier as AuthorTier] || 1;
      const tierB = TIER_PRIORITY[opB.payload?.source?.tier as AuthorTier] || 1;
      
      // If safety critical contradictory reports from equal or contentious sources, require human review
      return {
        isConflict: true,
        status: 'Awaiting human review',
        reason: `Safety-critical contradiction: ${opA.opId} claims ${factA.status} while ${opB.opId} claims ${factB.status}. Awaiting signed review.`
      };
    }
  }

  if (opA.type === 'PERSON_STATUS' && opB.type === 'PERSON_STATUS') {
    const pA = opA.payload as PersonStatusPayload;
    const pB = opB.payload as PersonStatusPayload;
    const isSafeA = pA.status === 'SAFE' || pA.status === 'FOUND';
    const isSafeB = pB.status === 'SAFE' || pB.status === 'FOUND';
    if (isSafeA && !isSafeB) {
      return {
        isConflict: false,
        status: 'Resolved by policy',
        winnerOpId: opA.opId,
        loserOpId: opB.opId,
        reason: 'Monotone policy: SAFE/FOUND strictly supersedes MISSING'
      };
    }
    if (isSafeB && !isSafeA) {
      return {
        isConflict: false,
        status: 'Resolved by policy',
        winnerOpId: opB.opId,
        loserOpId: opA.opId,
        reason: 'Monotone policy: SAFE/FOUND strictly supersedes MISSING'
      };
    }
  }

  if (opA.type === 'RESOURCE_CLAIM' && opB.type === 'RESOURCE_CLAIM') {
    return {
      isConflict: true,
      status: 'Conflicting',
      reason: 'Concurrent resource claims compete for bounded quota in closed round'
    };
  }

  return {
    isConflict: false,
    status: 'None',
    reason: 'Independent or additive updates'
  };
}

/**
 * Settles resource claims against available capacity (e.g. stock 5, Mumbai claims 3, Delhi claims 4).
 */
export function settleResourceClaims(
  availableStock: number,
  claims: Operation<ResourceClaimPayload>[]
): SettlementDecision[] {
  // Deterministic ordering: class priority (descending) -> opId (lexicographic)
  const sortedClaims = [...claims].sort((a, b) => {
    const classA = RESOURCE_CLASS_PRIORITY[a.payload.resourceClass] || 0;
    const classB = RESOURCE_CLASS_PRIORITY[b.payload.resourceClass] || 0;
    if (classA !== classB) return classB - classA;
    return a.opId.localeCompare(b.opId);
  });

  let remaining = availableStock;
  const decisions: SettlementDecision[] = [];

  for (const op of sortedClaims) {
    const requested = op.payload.quantityRequested;
    if (remaining >= requested) {
      remaining -= requested;
      decisions.push({
        entityId: op.entityId,
        opId: op.opId,
        resolutionStatus: 'Settled under policy',
        conflictStatus: 'Resolved by policy',
        allocated: requested,
        backordered: 0,
        reason: `Full allocation of ${requested} granted under round quota. ${remaining} remaining.`
      });
    } else if (remaining > 0) {
      const partial = remaining;
      const backordered = requested - partial;
      remaining = 0;
      decisions.push({
        entityId: op.entityId,
        opId: op.opId,
        resolutionStatus: 'Backordered',
        conflictStatus: 'Resolved by policy',
        allocated: partial,
        backordered: backordered,
        reason: `Partial allocation: ${partial} granted, ${backordered} backordered due to depleted stock quota.`
      });
    } else {
      decisions.push({
        entityId: op.entityId,
        opId: op.opId,
        resolutionStatus: 'Backordered',
        conflictStatus: 'Resolved by policy',
        allocated: 0,
        backordered: requested,
        reason: `Stock exhausted (available: ${availableStock}). Entire claim of ${requested} placed on backorder.`
      });
    }
  }

  return decisions;
}
