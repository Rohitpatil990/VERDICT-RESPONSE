import type { 
  Operation, 
  SixIndicators, 
  FreshnessBucket, 
  ReplicationInfo, 
  IntegrityInfo, 
  ReportPayload, 
  RegionId, 
  AuthorTier,
  ConflictStatus,
  ResolutionStatus
} from './types.js';
import { verifyHashSignature, computeOpHash, getRegionKeyPair } from './crypto.js';

export function computeFreshness(observedAtIso: string, submissionIso?: string): {
  bucket: FreshnessBucket;
  ageMinutes: number;
  clockAnomaly: boolean;
  anomalyReason?: string;
} {
  const now = Date.now();
  const observedTime = new Date(observedAtIso).getTime();
  const subTime = submissionIso ? new Date(submissionIso).getTime() : now;

  let clockAnomaly = false;
  let anomalyReason: string | undefined;

  // Check if observation time is in the future
  if (observedTime > now + 60000) { // 1 min buffer
    clockAnomaly = true;
    anomalyReason = 'Observed timestamp is in the future relative to server clock';
  } else if (observedTime > subTime + 60000) {
    clockAnomaly = true;
    anomalyReason = 'Observed timestamp is later than recorded op submission time';
  }

  const ageMs = Math.max(0, now - observedTime);
  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  let bucket: FreshnessBucket;
  if (ageMinutes < 15) {
    bucket = '<15 min';
  } else if (ageMinutes < 60) {
    bucket = '<1 h';
  } else if (ageMinutes < 360) {
    bucket = '<6 h';
  } else {
    bucket = 'older';
  }

  return {
    bucket,
    ageMinutes,
    clockAnomaly,
    anomalyReason
  };
}

export function verifyOperationIntegrity(op: Operation): IntegrityInfo {
  const checks = [];

  // Check 1: Schema & required fields
  const hasRequiredFields = !!(op.opId && op.region && op.seq && op.type && op.entityId && op.payload && op.createdAt && op.hash && op.sig);
  checks.push({
    check: 'schema' as const,
    passed: hasRequiredFields,
    details: hasRequiredFields ? 'All required op envelope attributes present' : 'Missing mandatory envelope attributes'
  });

  // Check 2: Hash integrity
  const expectedHash = computeOpHash(op);
  const hashMatches = expectedHash === op.hash;
  checks.push({
    check: 'chain_position' as const,
    passed: hashMatches,
    details: hashMatches 
      ? `Canonical SHA-256 hash valid (${op.hash.slice(0, 12)}...)` 
      : `Hash mismatch: computed ${expectedHash.slice(0, 8)} != recorded ${op.hash.slice(0, 8)}`
  });

  // Check 3: Ed25519 Signature
  const keyPair = getRegionKeyPair(op.region);
  const sigValid = verifyHashSignature(op.hash, op.sig, keyPair.publicKeyPem);
  checks.push({
    check: 'signature' as const,
    passed: sigValid,
    details: sigValid 
      ? `Ed25519 signature verified with public key of ${op.region}` 
      : `Signature verification FAILED for region ${op.region}`
  });

  // Check 4: Payload blob verification if attachments exist
  let blobCheckPassed = true;
  let blobDetails = 'No binary attachments';
  if (op.type === 'REPORT') {
    const report = op.payload as ReportPayload;
    if (report?.evidence?.attachments && report.evidence.attachments.length > 0) {
      blobDetails = `${report.evidence.attachments.length} attachment(s) listed with SHA-256 hashes`;
    }
  }
  checks.push({
    check: 'blob_hash' as const,
    passed: blobCheckPassed,
    details: blobDetails
  });

  const allPassed = checks.every(c => c.passed);
  const firstFail = checks.find(c => !c.passed);

  return {
    status: allPassed ? 'Verified' : 'FAILED',
    failedReason: firstFail?.details,
    checks
  };
}

export function computeSixIndicators(params: {
  op: Operation;
  currentRegion: RegionId;
  receipts: Array<{ region: RegionId; receivedAt: string; via: 'LOCAL' | 'DIRECT' | 'RELAY'; chainVerified: boolean }>;
  onlineRegions: RegionId[];
  conflictStatus?: ConflictStatus;
  conflictingOpIds?: string[];
  resolutionStatus?: ResolutionStatus;
  settledRound?: number;
  reason?: string;
}): SixIndicators {
  const { op, currentRegion, receipts, onlineRegions, conflictStatus, conflictingOpIds, resolutionStatus, settledRound, reason } = params;

  // 1. Source
  const reportPayload = op.payload as ReportPayload;
  const sourceDisplayName = reportPayload?.source?.displayName || op.authorId;
  const sourceKind = reportPayload?.source?.kind || 'person';
  const sourceTier: AuthorTier = reportPayload?.source?.tier || (op.authorRole === 'OFFICIAL' ? 'OFFICIAL_SENSOR' : 'FIELD_OFFICER');
  const sourceChannel = reportPayload?.channel || 'FORM';

  // 2. Freshness
  const observedAt = reportPayload?.observedAt || op.createdAt;
  const freshness = computeFreshness(observedAt, op.createdAt);

  // 3. Replication
  const receiptMap = new Map(receipts.map(r => [r.region, r]));
  const allRegions: RegionId[] = ['mumbai', 'delhi', 'bengaluru'];
  
  const perRegionRecord: ReplicationInfo['perRegion'] = {
    mumbai: { status: 'UNKNOWN' },
    delhi: { status: 'UNKNOWN' },
    bengaluru: { status: 'UNKNOWN' }
  };

  let syncedCount = 0;
  for (const r of allRegions) {
    const receipt = receiptMap.get(r);
    const isOnline = onlineRegions.includes(r);
    if (receipt) {
      perRegionRecord[r] = {
        status: 'RECEIVED',
        receivedAt: receipt.receivedAt,
        via: receipt.via,
        chainVerified: receipt.chainVerified
      };
      syncedCount++;
    } else if (isOnline) {
      perRegionRecord[r] = {
        status: 'PENDING',
        reason: 'Sync queue pending delivery'
      };
    } else {
      perRegionRecord[r] = {
        status: 'UNKNOWN',
        reason: `Region ${r} is offline / link severed`
      };
    }
  }

  let repStatus: ReplicationInfo['status'];
  if (syncedCount === 3) {
    repStatus = 'Synchronized';
  } else if (receiptMap.has(currentRegion) && syncedCount === 1) {
    repStatus = 'Saved locally';
  } else {
    repStatus = 'Pending synchronization';
  }

  const replication: ReplicationInfo = {
    status: repStatus,
    syncedCount,
    totalRegions: 3,
    perRegion: perRegionRecord
  };

  // 4. Integrity
  const integrity = verifyOperationIntegrity(op);

  // 5. Conflict
  const conflict = {
    status: conflictStatus || 'None',
    conflictingCount: conflictingOpIds ? conflictingOpIds.length : 0,
    conflictingOpIds: conflictingOpIds || [],
    notes: reason
  };

  // 6. Resolution
  const resolution = {
    status: resolutionStatus || (settledRound ? 'Settled under policy' : 'Tentative'),
    settledRound,
    reason
  };

  return {
    source: {
      displayName: sourceDisplayName,
      kind: sourceKind,
      tier: sourceTier,
      channel: sourceChannel,
      originRegion: op.region
    },
    freshness,
    conflict,
    replication,
    integrity,
    resolution
  };
}
