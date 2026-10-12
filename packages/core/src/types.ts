export type RegionId = 'mumbai' | 'delhi' | 'bengaluru' | string;

export type PriorityLane = 0 | 1 | 2 | 3; // 0=control, 1=critical, 2=normal, 3=blobs

export type SourceTier = 'OFFICIAL_SENSOR' | 'FIELD_OFFICER' | 'VOLUNTEER' | 'CITIZEN';

export type UserRole = 'VOLUNTEER' | 'FIELD_OFFICER' | 'OFFICIAL' | 'REVIEWER' | 'ADMIN';

export type EntityType = 'road' | 'incident' | 'shelter' | 'supply' | 'person' | 'team';

export type VersionVector = Record<string, number>;

export interface Operation {
  opId: string; // e.g. "mumbai:1042"
  region: RegionId;
  seq: number;
  type: string; // 'REPORT' | 'STATUS_CHANGE' | 'ADD_NOTE' | 'PERSON_STATUS' | 'DECISION' | 'ESCROW_INIT' | 'ESCROW_SPEND' | 'ESCROW_TRANSFER' | 'ESCROW_REQUEST' | 'RESOLVE' | 'CONFIRM_RESOLVED'
  entityId: string;
  payload: any;
  deps: VersionVector;
  authorId: string;
  authorRole: UserRole;
  createdAt: number;
  prevHash: string;
  hash: string;
  sig: string;
  priorityLane?: PriorityLane;
}

export type EntityStatus = 
  | 'OPEN' | 'BLOCKED' 
  | 'Reported' | 'Investigating' | 'Resolved' 
  | 'Missing' | 'Found' | 'Safe'
  | 'ACTIVE' | 'INACTIVE';

export interface EntityConflict {
  field: string;
  status: 'AWAITING_REVIEW' | 'RESOLVED_BY_POLICY' | 'RESOLVED_BY_HUMAN';
  claims: Array<{
    opId: string;
    region: RegionId;
    authorId: string;
    authorRole: UserRole;
    tier: SourceTier;
    value: any;
    timestamp: number;
  }>;
  resolution?: {
    effectiveValue: any;
    reason: string;
    resolvedByOpId?: string;
  };
}

export interface Entity {
  entityId: string;
  type: EntityType;
  authorityRegion: RegionId;
  status: EntityStatus;
  attributes: Record<string, any>;
  versionVector: VersionVector;
  participatingOpIds: string[];
  conflict?: EntityConflict;
  integrity: 'VERIFIED' | 'FAILED' | 'UNVERIFIED';
  lastObservedAt: number;
  lastUpdatedAt: number;
}

export type VerdictType = 'GO' | 'CAUTION' | 'HOLD';

export interface CheckResult {
  checkId: string; // 'conflict' | 'integrity' | 'authority_reachability' | 'freshness' | 'replication' | 'escrow' | 'confirmation'
  name: string;
  passed: boolean;
  severity: 'pass' | 'warn' | 'fail';
  reason: string;
  i18nKey: string;
}

export interface DependencySnapshot {
  entityId: string;
  valueSeen: any;
  statusSeen: EntityStatus;
  versionOpIds: string[];
  ageAtEvaluationMs: number;
  authorityReachable: boolean;
}

export interface GateEvaluation {
  verdict: VerdictType;
  checks: CheckResult[];
  dependencies: DependencySnapshot[];
  whatWouldChange: string[];
  evaluatedAt: number;
  viewRegion: RegionId;
  disclaimer: string;
}

export interface DecisionRequest {
  type: 'DISPATCH' | 'ALLOCATE_SUPPLY' | 'CLOSE_INCIDENT';
  entityId: string;
  params: {
    routeEntityIds?: string[];
    qty?: number;
    resource?: string;
    teamId?: string;
    closureReason?: string;
  };
  actorId: string;
  actorRole: UserRole;
}

export interface DecisionReceipt {
  decisionId: string;
  type: string;
  params: any;
  verdictAtTime: VerdictType;
  dependencies: DependencySnapshot[];
  acknowledgedRisks: string[];
  actor: string;
  region: RegionId;
  timestamp: number;
  opId: string;
}

export type ReevaluationStatus = 'STILL_VALID' | 'NEEDS_RECHECK' | 'INVALIDATED';

export interface ReevaluationOutcome {
  decisionId: string;
  status: ReevaluationStatus;
  summary: string;
  diffs: Array<{
    entityId: string;
    assumedValue: any;
    assumedStatus: EntityStatus;
    currentValue: any;
    currentStatus: EntityStatus;
    statusChanged: boolean;
    hasConflictNow: boolean;
    causingOpIds: string[];
  }>;
  evaluatedAt: number;
}

export interface EscrowResourceState {
  resource: string;
  total: number;
  rights: Record<RegionId, number>;
  spent: Record<RegionId, number>;
  unmetQueue: Array<{
    id: string;
    region: RegionId;
    qty: number;
    requesterId: string;
    priorityClass: 'MEDICAL' | 'WATER' | 'FOOD' | 'SHELTER' | 'OTHER';
    requestedAt: number;
  }>;
}

export interface PeerState {
  region: RegionId;
  reachable: boolean;
  lastContactAt: number;
  lastKnownSeq: number;
  rttMs: number;
  versionVector: VersionVector;
}

export interface TerritoryConfig {
  region: RegionId;
  center: { lat: number; lng: number };
  radiusKm: number;
}

export interface FogEntry {
  region: RegionId;
  unreachable: boolean;
  lastContactAt: number;
  lastKnownSeq: number;
  fogIntensity: number; // 0 to 1
  hatchPattern: boolean;
  legendText: string;
}

export interface MergeReportSummary {
  episodeId: string;
  startedAt: number;
  convergedAt: number;
  durationMs: number;
  localOpsCreated: number;
  remoteOpsReceived: number;
  autoMergedCount: number;
  supersededCount: number;
  policyResolvedCount: number;
  awaitingReviewCount: number;
  escrowTransfersCount: number;
  unmetDemandCount: number;
  decisionsEvaluated: {
    stillValid: number;
    needsRecheck: number;
    invalidated: number;
  };
  deltaBytesSent: number;
  fullStateBytesEquivalent: number;
}
