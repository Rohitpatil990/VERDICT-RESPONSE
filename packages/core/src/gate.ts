import {
  CheckResult,
  DecisionRequest,
  DependencySnapshot,
  Entity,
  GateEvaluation,
  PeerState,
  RegionId,
  VerdictType,
  EscrowResourceState
} from './types.js';
import { getAvailableRights } from './escrow.js';

export interface GatePolicyConfig {
  freshnessWindowRoadMs: number;
  freshnessWindowIncidentMs: number;
}

export const DEFAULT_GATE_POLICY: GatePolicyConfig = {
  freshnessWindowRoadMs: 30 * 60 * 1000, // 30 minutes
  freshnessWindowIncidentMs: 60 * 60 * 1000 // 60 minutes
};

export const GATE_DISCLAIMER =
  'GO means the information this decision relies on satisfies the configured consistency rules. It does not mean the action is safe in the real world.';

/**
 * Pure and deterministic Decision Gate evaluator.
 */
export function evaluateDecisionGate(
  request: DecisionRequest,
  viewingRegion: RegionId,
  entities: Map<string, Entity>,
  peers: Map<string, PeerState>,
  escrowMap: Map<string, EscrowResourceState>,
  now: number,
  policy: GatePolicyConfig = DEFAULT_GATE_POLICY
): GateEvaluation {
  const checks: CheckResult[] = [];
  const dependencies: DependencySnapshot[] = [];
  const whatWouldChange: string[] = [];

  // Determine which entities this decision depends upon
  const depEntityIds: string[] = [];
  if (request.type === 'DISPATCH') {
    if (request.params.routeEntityIds) {
      depEntityIds.push(...request.params.routeEntityIds);
    }
    if (request.entityId) {
      depEntityIds.push(request.entityId);
    }
    if (request.params.teamId) {
      depEntityIds.push(request.params.teamId);
    }
  } else if (request.type === 'CLOSE_INCIDENT') {
    depEntityIds.push(request.entityId);
  } else if (request.type === 'ALLOCATE_SUPPLY') {
    if (request.entityId) {
      depEntityIds.push(request.entityId);
    }
  }

  // Evaluate dependencies
  for (const entId of depEntityIds) {
    const ent = entities.get(entId);
    if (!ent) {
      checks.push({
        checkId: `not_found_${entId}`,
        name: `Entity ${entId} exists`,
        passed: false,
        severity: 'fail',
        reason: `Entity ${entId} is unknown in local replica`,
        i18nKey: 'checks.entity_unknown'
      });
      whatWouldChange.push(`Replicate or record entity ${entId}`);
      continue;
    }

    const authRegion = ent.authorityRegion;
    const isAuthReachable =
      authRegion === viewingRegion || (peers.get(authRegion)?.reachable ?? false);
    const ageMs = Math.max(0, now - ent.lastObservedAt);

    dependencies.push({
      entityId: ent.entityId,
      valueSeen: ent.status,
      statusSeen: ent.status,
      versionOpIds: [...ent.participatingOpIds],
      ageAtEvaluationMs: ageMs,
      authorityReachable: isAuthReachable
    });

    // 1. Conflict Check
    if (ent.conflict && ent.conflict.status === 'AWAITING_REVIEW') {
      checks.push({
        checkId: `conflict_${entId}`,
        name: `Conflict status on ${entId}`,
        passed: false,
        severity: 'fail',
        reason: `Entity ${entId} is contested and awaiting human review`,
        i18nKey: 'checks.conflict_awaiting_review'
      });
      whatWouldChange.push(`Reviewer must resolve conflict on ${entId}`);
    } else {
      checks.push({
        checkId: `conflict_${entId}`,
        name: `No unresolved conflicts on ${entId}`,
        passed: true,
        severity: 'pass',
        reason: `Clean status (${ent.status}) with no open disputes`,
        i18nKey: 'checks.conflict_clean'
      });
    }

    // 2. Integrity Check
    if (ent.integrity === 'FAILED') {
      checks.push({
        checkId: `integrity_${entId}`,
        name: `Cryptographic integrity on ${entId}`,
        passed: false,
        severity: 'fail',
        reason: `Cryptographic hash chain / signature verification failed for ${entId}`,
        i18nKey: 'checks.integrity_failed'
      });
      whatWouldChange.push(`Heal corrupted records for ${entId} from remote peer`);
    } else if (ent.integrity === 'UNVERIFIED') {
      checks.push({
        checkId: `integrity_${entId}`,
        name: `Integrity verified on ${entId}`,
        passed: false,
        severity: 'warn',
        reason: `Records for ${entId} are staged and awaiting chain verification`,
        i18nKey: 'checks.integrity_unverified'
      });
      whatWouldChange.push(`Verify staged hash chain for ${entId}`);
    } else {
      checks.push({
        checkId: `integrity_${entId}`,
        name: `Integrity verified on ${entId}`,
        passed: true,
        severity: 'pass',
        reason: `All contributing operations cryptographically verified`,
        i18nKey: 'checks.integrity_pass'
      });
    }

    // 3. Authority Reachability (Blind-spot rule)
    if (!isAuthReachable) {
      checks.push({
        checkId: `authority_${entId}`,
        name: `Authority reachability (${authRegion})`,
        passed: false,
        severity: 'warn',
        reason: `${authRegion} (territory authority) is unreachable; newer status updates may exist remotely`,
        i18nKey: 'checks.authority_unreachable'
      });
      whatWouldChange.push(`Reconnect to authority region ${authRegion}`);
    } else {
      checks.push({
        checkId: `authority_${entId}`,
        name: `Authority reachability (${authRegion})`,
        passed: true,
        severity: 'pass',
        reason: `Connected to territory authority ${authRegion}`,
        i18nKey: 'checks.authority_pass'
      });
    }

    // 4. Freshness Check
    const allowedWindow =
      ent.type === 'road' ? policy.freshnessWindowRoadMs : policy.freshnessWindowIncidentMs;
    if (ageMs > allowedWindow) {
      const minutesAgo = Math.round(ageMs / 60000);
      checks.push({
        checkId: `freshness_${entId}`,
        name: `Observation freshness (${entId})`,
        passed: false,
        severity: 'warn',
        reason: `Observation is ${minutesAgo}m old (exceeds ${Math.round(allowedWindow / 60000)}m window)`,
        i18nKey: 'checks.freshness_stale'
      });
      whatWouldChange.push(`Request updated field report for ${entId}`);
    } else {
      checks.push({
        checkId: `freshness_${entId}`,
        name: `Observation freshness (${entId})`,
        passed: true,
        severity: 'pass',
        reason: `Fresh observation (reported within window)`,
        i18nKey: 'checks.freshness_pass'
      });
    }

    // 5. Replication Check
    const knownReplicas = Object.keys(ent.versionVector).length;
    if (knownReplicas < 2 && authRegion !== viewingRegion) {
      checks.push({
        checkId: `replication_${entId}`,
        name: `Cross-region replication (${entId})`,
        passed: false,
        severity: 'warn',
        reason: `Single-source report; not yet replicated across multiple regions`,
        i18nKey: 'checks.replication_single_source'
      });
      whatWouldChange.push(`Await sync across at least 2 regions`);
    } else {
      checks.push({
        checkId: `replication_${entId}`,
        name: `Cross-region replication (${entId})`,
        passed: true,
        severity: 'pass',
        reason: `Validated across multiple peer nodes or authority origin`,
        i18nKey: 'checks.replication_pass'
      });
    }

    // Extra check: If road is BLOCKED, dispatch cannot pass!
    if (request.type === 'DISPATCH' && ent.type === 'road' && ent.status === 'BLOCKED') {
      checks.push({
        checkId: `road_status_${entId}`,
        name: `Road ${entId} status`,
        passed: false,
        severity: 'fail',
        reason: `Route segment ${entId} is reported BLOCKED`,
        i18nKey: 'checks.road_blocked'
      });
      whatWouldChange.push(`Choose alternate route avoiding blocked segment ${entId}`);
    }
  }

  // 6. Escrow Check for ALLOCATE_SUPPLY
  if (request.type === 'ALLOCATE_SUPPLY') {
    const resourceName = request.params.resource || request.entityId;
    const requestedQty = request.params.qty || 1;
    const escrow = escrowMap.get(resourceName);
    if (!escrow) {
      checks.push({
        checkId: 'escrow_resource_unknown',
        name: 'Escrow Resource Exists',
        passed: false,
        severity: 'fail',
        reason: `Escrow resource "${resourceName}" not registered`,
        i18nKey: 'checks.escrow_missing'
      });
      whatWouldChange.push(`Initialize escrow ledger for ${resourceName}`);
    } else {
      const available = getAvailableRights(escrow, viewingRegion);
      if (requestedQty <= available) {
        checks.push({
          checkId: 'escrow_quota',
          name: `Escrow Quota (${resourceName})`,
          passed: true,
          severity: 'pass',
          reason: `Requested ${requestedQty} within local quota (available: ${available}/${escrow.rights[viewingRegion] || 0})`,
          i18nKey: 'checks.escrow_pass'
        });
      } else {
        checks.push({
          checkId: 'escrow_quota',
          name: `Escrow Quota (${resourceName})`,
          passed: false,
          severity: 'fail',
          reason: `Requested ${requestedQty} exceeds local rights (${available} available). Shortage: ${requestedQty - available}`,
          i18nKey: 'checks.escrow_exceeded'
        });
        whatWouldChange.push(
          `Request escrow transfer of ${requestedQty - available} ${resourceName} from connected peers`
        );
      }
    }
  }

  // 7. Confirmation Check for CLOSE_INCIDENT
  if (request.type === 'CLOSE_INCIDENT') {
    if (request.actorRole !== 'REVIEWER' && request.actorRole !== 'ADMIN') {
      checks.push({
        checkId: 'reviewer_confirmation',
        name: 'Reviewer Confirmation Role',
        passed: false,
        severity: 'fail',
        reason: `Incident closure requires confirmed signature from a REVIEWER or ADMIN (current role: ${request.actorRole})`,
        i18nKey: 'checks.confirmation_required'
      });
      whatWouldChange.push(`Obtain digital signature from a certified Incident Reviewer`);
    } else {
      checks.push({
        checkId: 'reviewer_confirmation',
        name: 'Reviewer Confirmation Role',
        passed: true,
        severity: 'pass',
        reason: `Actor possesses certified REVIEWER credentials`,
        i18nKey: 'checks.confirmation_pass'
      });
    }
  }

  // Aggregate Verdict
  let verdict: VerdictType = 'GO';
  const hasFail = checks.some(c => c.severity === 'fail');
  const hasWarn = checks.some(c => c.severity === 'warn');

  if (hasFail) {
    verdict = 'HOLD';
  } else if (hasWarn) {
    verdict = 'CAUTION';
  } else {
    verdict = 'GO';
  }

  return {
    verdict,
    checks,
    dependencies,
    whatWouldChange: Array.from(new Set(whatWouldChange)),
    evaluatedAt: now,
    viewRegion: viewingRegion,
    disclaimer: GATE_DISCLAIMER
  };
}
