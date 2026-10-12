import { EscrowResourceState, Operation, RegionId } from './types.js';

export const PRIORITY_CLASS_ORDER = ['MEDICAL', 'WATER', 'FOOD', 'SHELTER', 'OTHER'] as const;

/**
 * Initializes a new escrow resource state
 */
export function createEscrowResource(
  resource: string,
  total: number,
  initialRights: Record<RegionId, number>
): EscrowResourceState {
  const sum = Object.values(initialRights).reduce((a, b) => a + b, 0);
  if (sum > total) {
    throw new Error(`Sum of initial rights (${sum}) exceeds total capacity (${total})`);
  }
  return {
    resource,
    total,
    rights: { ...initialRights },
    spent: {},
    unmetQueue: []
  };
}

/**
 * Calculates local available unspent rights for a given region
 */
export function getAvailableRights(state: EscrowResourceState, region: RegionId): number {
  const rights = state.rights[region] ?? 0;
  const spent = state.spent[region] ?? 0;
  return Math.max(0, rights - spent);
}

/**
 * Checks if a spend request is permitted locally without over-allocation
 */
export function canSpend(state: EscrowResourceState, region: RegionId, qty: number): boolean {
  if (qty <= 0) return true;
  return getAvailableRights(state, region) >= qty;
}

/**
 * Applies an operation to the escrow state deterministically
 */
export function applyEscrowOp(state: EscrowResourceState, op: Operation): EscrowResourceState {
  const next: EscrowResourceState = {
    resource: state.resource,
    total: state.total,
    rights: { ...state.rights },
    spent: { ...state.spent },
    unmetQueue: [...state.unmetQueue]
  };

  if (op.type === 'ESCROW_INIT') {
    next.total = op.payload.total;
    next.rights = { ...op.payload.rights };
  } else if (op.type === 'ESCROW_SPEND') {
    const { qty } = op.payload;
    const currentSpent = next.spent[op.region] ?? 0;
    const currentRights = next.rights[op.region] ?? 0;
    // Bounded counter invariant enforcement
    const spendable = Math.min(qty, Math.max(0, currentRights - currentSpent));
    next.spent[op.region] = currentSpent + spendable;
  } else if (op.type === 'ESCROW_TRANSFER') {
    const { from, to, qty } = op.payload;
    // Deduct from donor
    const donorRights = next.rights[from] ?? 0;
    const donorSpent = next.spent[from] ?? 0;
    const donorSurplus = Math.max(0, donorRights - donorSpent);
    const actualQty = Math.min(qty, donorSurplus);

    next.rights[from] = Math.max(0, donorRights - actualQty);
    // Add to recipient
    next.rights[to] = (next.rights[to] ?? 0) + actualQty;

    // Attempt to satisfy queued unmet requests in recipient
    processUnmetQueue(next, to);
  } else if (op.type === 'ESCROW_REQUEST') {
    next.unmetQueue.push({
      id: op.payload.id || op.opId,
      region: op.payload.requester,
      qty: op.payload.qty,
      requesterId: op.authorId,
      priorityClass: op.payload.priorityClass || 'OTHER',
      requestedAt: op.createdAt
    });
  }

  return next;
}

/**
 * Satisfies pending requests if surplus rights exist
 */
function processUnmetQueue(state: EscrowResourceState, region: RegionId) {
  let available = getAvailableRights(state, region);
  if (available <= 0) return;

  const remaining: typeof state.unmetQueue = [];
  for (const item of state.unmetQueue) {
    if (item.region === region && available > 0) {
      if (item.qty <= available) {
        state.spent[region] = (state.spent[region] ?? 0) + item.qty;
        available -= item.qty;
        // fully satisfied, don't re-queue
      } else {
        // partial satisfaction
        state.spent[region] = (state.spent[region] ?? 0) + available;
        remaining.push({
          ...item,
          qty: item.qty - available
        });
        available = 0;
      }
    } else {
      remaining.push(item);
    }
  }
  state.unmetQueue = remaining;
}

/**
 * Invariant verification: In every replica's view, Σ spent ≤ Total
 */
export function verifyEscrowInvariant(state: EscrowResourceState): { valid: boolean; totalSpent: number; totalCap: number } {
  const totalSpent = Object.values(state.spent).reduce((sum, v) => sum + v, 0);
  return {
    valid: totalSpent <= state.total,
    totalSpent,
    totalCap: state.total
  };
}
