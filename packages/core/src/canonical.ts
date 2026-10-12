/**
 * Canonical JSON serialization.
 * Ensures deterministic string representation:
 * - Object keys are sorted lexicographically
 * - Primitive arrays preserve order
 * - Undefined values in objects are omitted
 * - Numbers and booleans formatted consistently
 */
export function canonicalJson(val: any): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'boolean' || typeof val === 'number') {
    return JSON.stringify(val);
  }
  if (typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(item => canonicalJson(item)).join(',') + ']';
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).sort();
    const entries: string[] = [];
    for (const k of keys) {
      if (val[k] !== undefined) {
        entries.push(JSON.stringify(k) + ':' + canonicalJson(val[k]));
      }
    }
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(val);
}
