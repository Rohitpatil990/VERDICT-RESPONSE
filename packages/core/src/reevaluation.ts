import {
  DecisionReceipt,
  Entity,
  ReevaluationOutcome,
  ReevaluationStatus
} from './types.js';

/**
 * Re-evaluates a past decision receipt against the current merged local view.
 * Deterministic and pure.
 */
export function reevaluateDecision(
  receipt: DecisionReceipt,
  currentEntities: Map<string, Entity>,
  now: number
): ReevaluationOutcome {
  const diffs: ReevaluationOutcome['diffs'] = [];
  let status: ReevaluationStatus = 'STILL_VALID';

  for (const dep of receipt.dependencies) {
    const current = currentEntities.get(dep.entityId);

    if (!current) {
      diffs.push({
        entityId: dep.entityId,
        assumedValue: dep.valueSeen,
        assumedStatus: dep.statusSeen,
        currentValue: 'UNKNOWN',
        currentStatus: 'ACTIVE',
        statusChanged: true,
        hasConflictNow: false,
        causingOpIds: []
      });
      status = 'NEEDS_RECHECK';
      continue;
    }

    const currentStatus = current.status;
    const statusChanged = currentStatus !== dep.statusSeen;
    const hasConflictNow = current.conflict?.status === 'AWAITING_REVIEW';

    // Find operations applied since the decision was made
    const prevOpSet = new Set(dep.versionOpIds);
    const causingOpIds = current.participatingOpIds.filter(opId => !prevOpSet.has(opId));

    diffs.push({
      entityId: dep.entityId,
      assumedValue: dep.valueSeen,
      assumedStatus: dep.statusSeen,
      currentValue: currentStatus,
      currentStatus,
      statusChanged,
      hasConflictNow,
      causingOpIds
    });

    if (hasConflictNow) {
      status = 'NEEDS_RECHECK';
    } else if (statusChanged) {
      // If road was OPEN when dispatched, but is now BLOCKED -> INVALIDATED!
      if (receipt.type === 'DISPATCH' && dep.statusSeen === 'OPEN' && currentStatus === 'BLOCKED') {
        status = 'INVALIDATED';
      } else if (status !== 'INVALIDATED') {
        status = 'NEEDS_RECHECK';
      }
    } else if (causingOpIds.length > 0 && status === 'STILL_VALID') {
      status = 'NEEDS_RECHECK';
    }
  }

  let summary = 'Operational basis remains unchanged.';
  if (status === 'INVALIDATED') {
    summary = 'Underlying facts have changed; previous operational assumptions are invalidated.';
  } else if (status === 'NEEDS_RECHECK') {
    summary = 'Newer updates or concurrent claims have arrived; operational re-check recommended.';
  }

  return {
    decisionId: receipt.decisionId,
    status,
    summary,
    diffs,
    evaluatedAt: now
  };
}
