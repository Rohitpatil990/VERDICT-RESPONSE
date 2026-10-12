import { VersionVector } from './types.js';

export type VectorRelation = 'equal' | 'v1_dominates' | 'v2_dominates' | 'concurrent';

/**
 * Compares two version vectors causally.
 */
export function compareVectors(v1: VersionVector, v2: VersionVector): VectorRelation {
  const allKeys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  let v1HasGreater = false;
  let v2HasGreater = false;

  for (const k of allKeys) {
    const s1 = v1[k] ?? 0;
    const s2 = v2[k] ?? 0;
    if (s1 > s2) v1HasGreater = true;
    if (s2 > s1) v2HasGreater = true;
  }

  if (v1HasGreater && v2HasGreater) return 'concurrent';
  if (v1HasGreater && !v2HasGreater) return 'v1_dominates';
  if (v2HasGreater && !v1HasGreater) return 'v2_dominates';
  return 'equal';
}

/**
 * Returns component-wise supremum (per-region maximum).
 */
export function mergeVectors(v1: VersionVector, v2: VersionVector): VersionVector {
  const result: VersionVector = { ...v1 };
  for (const [k, v] of Object.entries(v2)) {
    result[k] = Math.max(result[k] ?? 0, v);
  }
  return result;
}

/**
 * Computes difference ranges. For each region in local, if local seq > remote seq,
 * returns missing range [remoteSeq + 1, localSeq].
 */
export function diffVectors(
  local: VersionVector,
  remote: VersionVector
): Record<string, [number, number]> {
  const missing: Record<string, [number, number]> = {};
  for (const [reg, localSeq] of Object.entries(local)) {
    const remoteSeq = remote[reg] ?? 0;
    if (localSeq > remoteSeq) {
      missing[reg] = [remoteSeq + 1, localSeq];
    }
  }
  return missing;
}
