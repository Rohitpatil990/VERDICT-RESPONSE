import type { VersionVector } from './types.js';

export function compareVectors(a: VersionVector, b: VersionVector): 'EQUAL' | 'A_DOMINATES' | 'B_DOMINATES' | 'CONCURRENT' {
  const allRegions = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  let aGreater = false;
  let bGreater = false;

  for (const r of allRegions) {
    const valA = a[r] || 0;
    const valB = b[r] || 0;
    if (valA > valB) aGreater = true;
    if (valB > valA) bGreater = true;
  }

  if (!aGreater && !bGreater) return 'EQUAL';
  if (aGreater && !bGreater) return 'A_DOMINATES';
  if (bGreater && !aGreater) return 'B_DOMINATES';
  return 'CONCURRENT';
}

export function mergeVectors(a: VersionVector, b: VersionVector): VersionVector {
  const merged: VersionVector = { ...a };
  for (const [r, seq] of Object.entries(b)) {
    merged[r] = Math.max(merged[r] || 0, seq);
  }
  return merged;
}

/**
 * Returns missing sequence ranges per region between local and remote vector.
 * e.g., if local has mumbai: 5 and remote has mumbai: 2, remote needs (2, 5].
 */
export function calculateMissingRanges(local: VersionVector, remote: VersionVector): Record<string, { fromSeq: number; toSeq: number }> {
  const missing: Record<string, { fromSeq: number; toSeq: number }> = {};
  for (const [region, localSeq] of Object.entries(local)) {
    const remoteSeq = remote[region] || 0;
    if (localSeq > remoteSeq) {
      missing[region] = { fromSeq: remoteSeq + 1, toSeq: localSeq };
    }
  }
  return missing;
}
