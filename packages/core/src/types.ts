export type RegionId = 'mumbai' | 'delhi' | 'bengaluru';

export type DegradationLevel = 'L0_FULL' | 'L1_DEGRADED' | 'L2_ISOLATED' | 'L3_RECOVERING';

export type AuthorRole = 'VOLUNTEER' | 'FIELD_OFFICER' | 'OFFICIAL' | 'REVIEWER' | 'ADMIN';

export type AuthorTier = 'OFFICIAL_SENSOR' | 'FIELD_OFFICER' | 'VOLUNTEER' | 'CITIZEN';

export type OpType = 
  | 'REPORT'
  | 'NOTE'
  | 'PERSON_STATUS'
  | 'FACT'
  | 'RESOURCE_CLAIM'
  | 'TRANSLATION'
  | 'TRANSCRIPT'
  | 'RESOLVE';

export type VersionVector = Record<string, number>;

export interface Operation<T = any> {
  opId: string; // e.g. "mumbai:1" or UI alias "MUM-1"
  region: RegionId;
  seq: number;
  type: OpType;
  entityId: string;
  payload: T;
  deps: VersionVector;
  authorId: string;
  authorRole: AuthorRole;
  createdAt: string; // ISO 8601, display-only
  prevHash: string;
  hash: string; // SHA-256(canonical JSON w/o hash, sig)
  sig: string;  // Ed25519 signature
}

export type IncidentType = 
  | 'flood'
  | 'blocked_road'
  | 'stranded_people'
  | 'damaged_infrastructure'
  | 'shelter_issue'
  | 'medical_emergency'
  | 'other';

export type LocationSource = 'GPS_DEVICE' | 'MANUAL_PIN' | 'SIMULATED' | 'SPOKEN_PLACE_APPROX' | 'UNKNOWN';

export interface LocationData {
  lat?: number;
  lng?: number;
  accuracyM?: number;
  source: LocationSource;
  placeText?: string;
}

export interface ReportPayload {
  incidentId: string;
  incidentType: IncidentType;
  description: {
    original: {
      lang: 'en' | 'hi' | 'mr';
      text: string;
    };
  };
  location: LocationData;
  observedAt: string; // ISO 8601, device-reported
  severity: {
    value: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source: 'SUGGESTED' | 'CONFIRMED' | 'UNSET';
  };
  source: {
    kind: 'person' | 'team' | 'sensor' | 'org';
    id: string;
    displayName: string;
    tier: AuthorTier;
  };
  evidence?: {
    originalText?: string;
    attachments?: Array<{
      hash: string;
      filename: string;
      mimeType: string;
    }>;
  };
  channel: 'VOICE' | 'FORM' | 'SENSOR';
  voice?: {
    audioHash: string;
    mime: string;
    durationMs: number;
    asrEngine: string;
    asrLang: string;
    asrConfidence?: number;
    rawTranscript: string;
    transcriptEdited: boolean;
    transcribedOffline: boolean;
  };
}

export interface FactPayload {
  factType: 'ROAD_STATUS';
  roadId: string;
  status: 'OPEN' | 'BLOCKED' | 'CAUTION';
  reportedReason?: string;
}

export interface ResourceClaimPayload {
  stockId: string;
  resourceClass: 'MEDICAL' | 'WATER' | 'FOOD' | 'SHELTER' | 'OTHER';
  quantityRequested: number;
  requestingRegion: RegionId;
  purpose: string;
}

export interface PersonStatusPayload {
  personId: string;
  fullName: string;
  status: 'MISSING' | 'FOUND' | 'SAFE' | 'INJURED';
  lastSeenLocation?: string;
}

export interface ResolvePayload {
  targetOpId: string;
  conflictingOpId: string;
  chosenEntityState: any;
  justification: string;
  policyUsed: string;
}

export interface TranslationPayload {
  targetOpId: string;
  targetLang: 'en' | 'hi' | 'mr';
  translatedText: string;
  engine: 'StaticLexiconTranslator' | 'RemoteTranslator';
}

export type FreshnessBucket = '<15 min' | '<1 h' | '<6 h' | 'older';

export interface FreshnessInfo {
  bucket: FreshnessBucket;
  ageMinutes: number;
  clockAnomaly: boolean;
  anomalyReason?: string;
}

export type ConflictStatus = 
  | 'None'
  | 'Conflicting'
  | 'Awaiting human review'
  | 'Resolved by policy'
  | 'Resolved by reviewer';

export type ReplicationStatus = 
  | 'Saved locally'
  | 'Pending synchronization'
  | 'Synchronized';

export type RegionReceiptStatus = 'RECEIVED' | 'PENDING' | 'UNKNOWN';

export interface ReplicationInfo {
  status: ReplicationStatus;
  syncedCount: number;
  totalRegions: number;
  perRegion: Record<RegionId, {
    status: RegionReceiptStatus;
    receivedAt?: string;
    via?: 'LOCAL' | 'DIRECT' | 'RELAY';
    chainVerified?: boolean;
    reason?: string;
  }>;
}

export type IntegrityStatus = 'Verified' | 'FAILED' | 'Unverified';

export interface IntegrityCheckDetail {
  check: 'signature' | 'chain_position' | 'blob_hash' | 'schema';
  passed: boolean;
  details: string;
}

export interface IntegrityInfo {
  status: IntegrityStatus;
  failedReason?: string;
  checks: IntegrityCheckDetail[];
}

export type ResolutionStatus = 
  | 'Tentative'
  | 'Settled under policy'
  | 'Awaiting human review'
  | 'Superseded'
  | 'Backordered';

export interface SixIndicators {
  source: {
    displayName: string;
    kind: string;
    tier: AuthorTier;
    channel: string;
    originRegion: RegionId;
  };
  freshness: FreshnessInfo;
  conflict: {
    status: ConflictStatus;
    conflictingCount: number;
    conflictingOpIds: string[];
    notes?: string;
  };
  replication: ReplicationInfo;
  integrity: IntegrityInfo;
  resolution: {
    status: ResolutionStatus;
    settledRound?: number;
    reason?: string;
    grantedQuantity?: number;
    backorderedQuantity?: number;
  };
}

export interface OpReceipt {
  opId: string;
  region: RegionId;
  receivedByRegion: RegionId;
  receivedAt: string;
  via: 'LOCAL' | 'DIRECT' | 'RELAY';
  chainVerified: boolean;
}

export interface RoundCertificate {
  round: number;
  prevCertHash: string;
  opSetRoot: string;
  policyVersion: string;
  stateRoot: string;
  signers: RegionId[];
  signatures: Record<RegionId, string>;
  createdAt: string;
}

export interface RegionStatusSummary {
  region: RegionId;
  linkState: Record<RegionId, 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED'>;
  degradationLevel: DegradationLevel;
  versionVector: VersionVector;
  lagOps: number;
  outboxPending: number;
  latestSettledRound: number;
  tentativeCount: number;
  conflictCount: number;
  stateRoot: string;
  converged: boolean;
}
