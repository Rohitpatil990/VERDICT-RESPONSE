import { Operation, RegionId } from './types.js';
import { calculateOpHash, verifySignature, getPublicKey, SEED_PRIVATE_KEYS } from './crypto.js';

export type DcrStatus =
  | 'PLANNING'
  | 'RECOVERING_DEPENDENCIES'
  | 'READY_TO_RESUME'
  | 'BLOCKED_MISSING_DEPENDENCY'
  | 'BLOCKED_CONFLICT'
  | 'BLOCKED_INTEGRITY'
  | 'FAILED';

export interface DependencyNode {
  opId: string;
  region: RegionId;
  seq: number;
  type: string;
  entityId: string;
  presentLocally: boolean;
  directPrerequisites: string[];
  verified: boolean;
  hasConflict: boolean;
  integrityError?: string;
}

export interface DependencyConePlan {
  targetOpId: string;
  targetRegion: RegionId;
  status: DcrStatus;
  coneSize: number;
  presentCount: number;
  missingCount: number;
  missingOpIds: string[];
  recoveryOrder: string[];
  blockedReasons: string[];
  unrelatedPendingCount: number;
  coneNodes: Record<string, DependencyNode>;
  summary: string;
  plannedAt: number;
}

/**
 * Extracts verified direct prerequisites of an operation using trustworthy
 * causal metadata, hash chains, and entity lifecycle dependencies.
 *
 * Rules:
 * - Does NOT invent edges from arrival time or wall clock timestamps.
 * - Extracts explicit prerequisites (payload.dependsOnOps, payload.parentOpId).
 * - Extracts cryptographic hash-chain predecessor within the same region.
 * - Extracts same-entity causal predecessors bounded by op.deps version vector.
 * - Extracts escrow funding prerequisites (ESCROW_INIT / TRANSFER for ESCROW_SPEND).
 */
export function extractDirectDependencies(op: Operation, allKnownOps: Operation[] = []): string[] {
  const deps = new Set<string>();

  // 1. Explicit application dependencies
  if (Array.isArray(op.payload?.dependsOnOps)) {
    for (const depId of op.payload.dependsOnOps) {
      if (depId && typeof depId === 'string' && depId !== op.opId) {
        deps.add(depId);
      }
    }
  }

  if (op.payload?.parentOpId && typeof op.payload.parentOpId === 'string' && op.payload.parentOpId !== op.opId) {
    deps.add(op.payload.parentOpId);
  }

  // 2. Same-region hash chain predecessor
  if (
    op.seq > 1 &&
    op.prevHash &&
    op.prevHash !== '0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    const chainPredecessorId = `${op.region}:${op.seq - 1}`;
    deps.add(chainPredecessorId);
  }

  // 3. Same-entity causal predecessors bounded by causal version vector
  if (op.deps && Object.keys(op.deps).length > 0) {
    for (const other of allKnownOps) {
      if (other.opId === op.opId) continue;
      if (other.entityId === op.entityId) {
        const bound = op.deps[other.region];
        if (bound !== undefined && other.seq <= bound) {
          deps.add(other.opId);
        }
      }
    }
  }

  // 4. Escrow invariant dependencies
  if (op.type === 'ESCROW_SPEND') {
    const resource = op.payload?.resource || op.entityId;
    for (const other of allKnownOps) {
      if (other.opId === op.opId) continue;
      const otherResource = other.payload?.resource || other.entityId;
      if (
        otherResource === resource &&
        (other.type === 'ESCROW_INIT' || other.type === 'ESCROW_TRANSFER')
      ) {
        deps.add(other.opId);
      }
    }
  }

  return Array.from(deps).sort();
}

/**
 * Traverses the graph to calculate the transitive dependency cone:
 * C(a) = {a} U {u | u is a transitive prerequisite of a}
 * Detects cycles safely using depth-first search cycle detection.
 */
export function buildDependencyCone(
  targetOpId: string,
  opsMap: Map<string, Operation>
): {
  cone: Set<string>;
  adjacency: Map<string, string[]>; // opId -> list of opIds it depends on
  hasCycle: boolean;
  missing: Set<string>;
} {
  const cone = new Set<string>();
  const adjacency = new Map<string, string[]>();
  const missing = new Set<string>();

  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycle = false;

  const allOpsArray = Array.from(opsMap.values());

  function dfs(currId: string): void {
    if (recStack.has(currId)) {
      hasCycle = true;
      return;
    }
    if (visited.has(currId)) return;

    visited.add(currId);
    recStack.add(currId);
    cone.add(currId);

    const op = opsMap.get(currId);
    if (!op) {
      missing.add(currId);
      adjacency.set(currId, []);
      recStack.delete(currId);
      return;
    }

    const prereqs = extractDirectDependencies(op, allOpsArray);
    adjacency.set(currId, prereqs);

    for (const prereqId of prereqs) {
      dfs(prereqId);
    }

    recStack.delete(currId);
  }

  dfs(targetOpId);

  return { cone, adjacency, hasCycle, missing };
}

/**
 * Computes a deterministic topological sort of the dependency cone
 * so prerequisites are processed before dependent operations (u -> v implies u before v).
 *
 * Deterministic tie-breaking: when multiple operations have in-degree 0,
 * sorts by seq ascending, then opId ascending.
 */
export function topologicalSortCone(
  coneOpIds: string[],
  adjacency: Map<string, string[]>
): { order: string[]; hasCycle: boolean } {
  // In adjacency, curr depends on prereqs (i.e. prereqs -> curr).
  // Graph edges for ordering: prereq -> curr
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const id of coneOpIds) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const curr of coneOpIds) {
    const prereqs = adjacency.get(curr) || [];
    for (const prereq of prereqs) {
      if (coneOpIds.includes(prereq)) {
        inDegree.set(curr, (inDegree.get(curr) ?? 0) + 1);
        dependents.get(prereq)?.push(curr);
      }
    }
  }

  // Queue of nodes with in-degree 0
  const available: string[] = [];
  for (const id of coneOpIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      available.push(id);
    }
  }

  // Deterministic sort function for queue
  const sortFn = (a: string, b: string) => a.localeCompare(b);
  available.sort(sortFn);

  const order: string[] = [];

  while (available.length > 0) {
    const next = available.shift()!;
    order.push(next);

    const depsOfNext = dependents.get(next) || [];
    for (const dep of depsOfNext) {
      const remainingInDegree = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, remainingInDegree);
      if (remainingInDegree === 0) {
        available.push(dep);
        available.sort(sortFn);
      }
    }
  }

  const hasCycle = order.length !== coneOpIds.length;
  return { order, hasCycle };
}

/**
 * Validates cryptographic hash and Ed25519 signature of an operation.
 */
export async function validateOperationIntegrity(op: Operation): Promise<{ valid: boolean; error?: string }> {
  try {
    const computedHash = calculateOpHash(op);
    if (computedHash !== op.hash) {
      return {
        valid: false,
        error: `SHA-256 hash mismatch (stored: ${op.hash.slice(0, 8)}..., computed: ${computedHash.slice(0, 8)}...)`
      };
    }

    const privKey = SEED_PRIVATE_KEYS[op.region] || SEED_PRIVATE_KEYS.mumbai;
    const pubKey = await getPublicKey(privKey);
    const validSig = await verifySignature(op.hash, op.sig, pubKey);
    if (!validSig) {
      return {
        valid: false,
        error: `Ed25519 signature verification failed for region ${op.region}`
      };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Cryptographic check error: ${err.message}` };
  }
}

/**
 * Plans Dependency-Cone Recovery (DCR) for a selected target operation:
 * 1. Computes verified dependency cone C(a).
 * 2. Compares local presence vs missing prerequisites.
 * 3. Orders operations topologically.
 * 4. Checks integrity and unresolved conflicts.
 * 5. Returns structured explainable plan.
 */
export async function planDependencyConeRecovery(
  targetOpId: string,
  localOps: Operation[],
  allAvailableOps: Operation[] = [],
  conflictedEntities: Set<string> = new Set(),
  unrelatedOutboxCount = 0
): Promise<DependencyConePlan> {
  const localMap = new Map(localOps.map(o => [o.opId, o]));
  const allOpsMap = new Map(allAvailableOps.map(o => [o.opId, o]));

  // Merge so all available ops are known to the cone builder
  for (const [id, op] of localMap.entries()) {
    if (!allOpsMap.has(id)) {
      allOpsMap.set(id, op);
    }
  }

  const targetOp = allOpsMap.get(targetOpId);
  const targetRegion = targetOp?.region || (targetOpId.split(':')[0] as RegionId) || 'mumbai';

  if (!targetOp) {
    return {
      targetOpId,
      targetRegion,
      status: 'BLOCKED_MISSING_DEPENDENCY',
      coneSize: 1,
      presentCount: 0,
      missingCount: 1,
      missingOpIds: [targetOpId],
      recoveryOrder: [],
      blockedReasons: [`Target operation ${targetOpId} is not present in local store or available peer sources`],
      unrelatedPendingCount: unrelatedOutboxCount,
      coneNodes: {},
      summary: `Recovery blocked: target operation ${targetOpId} cannot be located.`,
      plannedAt: Date.now()
    };
  }

  // 1. Build cone
  const { cone, adjacency, hasCycle, missing } = buildDependencyCone(targetOpId, allOpsMap);

  if (hasCycle) {
    return {
      targetOpId,
      targetRegion,
      status: 'FAILED',
      coneSize: cone.size,
      presentCount: Array.from(cone).filter(id => localMap.has(id)).length,
      missingCount: missing.size,
      missingOpIds: Array.from(missing),
      recoveryOrder: [],
      blockedReasons: ['Cycle detected in operation dependency graph; recovery aborted for safety'],
      unrelatedPendingCount: unrelatedOutboxCount,
      coneNodes: {},
      summary: 'Recovery failed: cyclic dependency detected.',
      plannedAt: Date.now()
    };
  }

  const coneList = Array.from(cone);

  // 2. Topological sort of cone
  const { order, hasCycle: sortCycle } = topologicalSortCone(coneList, adjacency);
  if (sortCycle) {
    return {
      targetOpId,
      targetRegion,
      status: 'FAILED',
      coneSize: coneList.length,
      presentCount: coneList.filter(id => localMap.has(id)).length,
      missingCount: missing.size,
      missingOpIds: Array.from(missing),
      recoveryOrder: [],
      blockedReasons: ['Unable to establish valid topological order due to dependency cycle'],
      unrelatedPendingCount: unrelatedOutboxCount,
      coneNodes: {},
      summary: 'Recovery failed: invalid topological ordering.',
      plannedAt: Date.now()
    };
  }

  // 3. Evaluate each node in the cone
  const coneNodes: Record<string, DependencyNode> = {};
  const missingOpIds: string[] = [];
  const blockedReasons: string[] = [];

  let integrityFailure = false;
  let conflictFailure = false;

  for (const opId of order) {
    const op = allOpsMap.get(opId);
    const isPresentLocally = localMap.has(opId);
    const directPrereqs = adjacency.get(opId) || [];

    if (!op || !isPresentLocally) {
      missingOpIds.push(opId);
    }

    if (!op) {
      blockedReasons.push(`Prerequisite operation ${opId} is missing from all known replicas`);
      coneNodes[opId] = {
        opId,
        region: (opId.split(':')[0] as RegionId) || targetRegion,
        seq: parseInt(opId.split(':')[1] || '0', 10),
        type: 'UNKNOWN',
        entityId: 'UNKNOWN',
        presentLocally: false,
        directPrerequisites: directPrereqs,
        verified: false,
        hasConflict: false,
        integrityError: 'Operation not found'
      };
      continue;
    }

    // Cryptographic validation
    const integrity = await validateOperationIntegrity(op);
    if (!integrity.valid) {
      integrityFailure = true;
      blockedReasons.push(`Integrity check failed for ${opId}: ${integrity.error}`);
    }

    // Conflict check
    const hasConflict = conflictedEntities.has(op.entityId);
    if (hasConflict) {
      conflictFailure = true;
      blockedReasons.push(`Prerequisite operation ${opId} modifies entity ${op.entityId} with unresolved conflict awaiting review`);
    }

    coneNodes[opId] = {
      opId,
      region: op.region,
      seq: op.seq,
      type: op.type,
      entityId: op.entityId,
      presentLocally: isPresentLocally,
      directPrerequisites: directPrereqs,
      verified: integrity.valid,
      hasConflict,
      integrityError: integrity.error
    };
  }

  // 4. Determine DCR status
  let status: DcrStatus = 'READY_TO_RESUME';
  let summary = `Target operation ${targetOpId} and all ${coneList.length} prerequisites are verified and present locally. Safe to resume.`;

  if (integrityFailure) {
    status = 'BLOCKED_INTEGRITY';
    summary = `Target operation ${targetOpId} blocked by cryptographic integrity/signature failure in prerequisite cone.`;
  } else if (conflictFailure) {
    status = 'BLOCKED_CONFLICT';
    summary = `Target operation ${targetOpId} blocked: prerequisites involve unresolved concurrent conflicts requiring reviewer adjudication.`;
  } else if (missingOpIds.length > 0) {
    status = 'BLOCKED_MISSING_DEPENDENCY';
    summary = `Target operation ${targetOpId} has ${missingOpIds.length} missing prerequisites requiring recovery from remote replicas.`;
  }

  return {
    targetOpId,
    targetRegion,
    status,
    coneSize: coneList.length,
    presentCount: coneList.length - missingOpIds.length,
    missingCount: missingOpIds.length,
    missingOpIds,
    recoveryOrder: order,
    blockedReasons,
    unrelatedPendingCount: unrelatedOutboxCount,
    coneNodes,
    summary,
    plannedAt: Date.now()
  };
}
