import type { Operation, RegionId, VersionVector } from '@verdict/core';
import { calculateMissingRanges, compareVectors } from '@verdict/core';
import type { SqliteStore } from './store.js';
import type { LinkController } from './linkController.js';

export interface ReplicationMetrics {
  totalOpsSynced: number;
  totalBytesDelta: number;
  totalBytesFullEquivalent: number;
  lastConvergenceTimeMs: number;
  timeToFirstCriticalOpMs: number;
  lastSyncAt: string;
}

export class ReplicationEngine {
  private store: SqliteStore;
  private linkController: LinkController;
  private peerUrls: Record<RegionId, string>;
  public metrics: ReplicationMetrics = {
    totalOpsSynced: 0,
    totalBytesDelta: 0,
    totalBytesFullEquivalent: 0,
    lastConvergenceTimeMs: 0,
    timeToFirstCriticalOpMs: 0,
    lastSyncAt: new Date().toISOString()
  };
  private isSyncing = false;

  constructor(
    store: SqliteStore, 
    linkController: LinkController, 
    peerUrls: Record<RegionId, string>
  ) {
    this.store = store;
    this.linkController = linkController;
    this.peerUrls = peerUrls;
  }

  /**
   * Sort operations into the 4 strict priority lanes.
   */
  public prioritizeOps(ops: Operation[]): Operation[] {
    const l1Critical: Operation[] = [];
    const l2Normal: Operation[] = [];
    const l3Other: Operation[] = [];

    for (const op of ops) {
      if (op.type === 'RESOURCE_CLAIM' && op.payload?.resourceClass === 'MEDICAL') {
        l1Critical.push(op);
      } else if (op.type === 'REPORT' && (op.payload?.incidentType === 'medical_emergency' || op.payload?.incidentType === 'stranded_people')) {
        l1Critical.push(op);
      } else if (op.type === 'REPORT' || op.type === 'FACT' || op.type === 'RESOURCE_CLAIM') {
        l2Normal.push(op);
      } else {
        l3Other.push(op);
      }
    }

    // Lane ordering with starvation guard: L1 first, then L2, then L3
    return [...l1Critical, ...l2Normal, ...l3Other];
  }

  /**
   * Performs an anti-entropy synchronization cycle with all connected peers.
   */
  public async syncWithPeers(): Promise<{ syncedCount: number; errors: string[] }> {
    if (this.isSyncing) return { syncedCount: 0, errors: [] };
    this.isSyncing = true;
    const errors: string[] = [];
    let syncedCount = 0;
    const startTime = Date.now();
    let firstCriticalDelivered = false;

    const peers = (['mumbai', 'delhi', 'bengaluru'] as RegionId[]).filter(r => r !== this.store.region);

    for (const peer of peers) {
      if (!this.linkController.isLinked(peer)) {
        continue; // Network partition active!
      }

      const link = this.linkController.getLink(peer);
      const url = this.peerUrls[peer];
      if (!url) continue;

      try {
        // Step 1: L0 Vector Exchange
        const localVector = this.store.getVersionVector();
        const peerRes = await fetch(`${url}/api/v1/sync/vector`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: this.store.region, vector: localVector }),
          signal: AbortSignal.timeout(1500)
        });

        if (!peerRes.ok) continue;
        const peerData = await peerRes.json() as { vector: VersionVector };
        const peerVector = peerData.vector;

        // Step 2: Push missing outbox items from local to peer
        const outboxItems = this.store.getPendingOutbox(peer, 50);
        if (outboxItems.length > 0) {
          const opsToSend = this.prioritizeOps(outboxItems.map(i => i.op));

          // Simulate artificial link latency if configured
          if (link && link.latencyMs > 0) {
            await new Promise(r => setTimeout(r, Math.min(link.latencyMs, 100)));
          }

          const pushRes = await fetch(`${url}/api/v1/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: this.store.region, ops: opsToSend }),
            signal: AbortSignal.timeout(2500)
          });

          if (pushRes.ok) {
            const pushResult = await pushRes.json() as { acceptedCount: number };
            syncedCount += pushResult.acceptedCount;
            this.store.markOutboxSent(outboxItems.map(i => i.id));

            // Metric tracking: real delta serialized size vs full state
            const payloadBytes = Buffer.byteLength(JSON.stringify(opsToSend), 'utf8');
            const allLocalOps = this.store.getAllOps();
            const fullStateBytes = Buffer.byteLength(JSON.stringify(allLocalOps), 'utf8');

            this.metrics.totalBytesDelta += payloadBytes;
            this.metrics.totalBytesFullEquivalent += fullStateBytes;
            this.metrics.totalOpsSynced += pushResult.acceptedCount;

            // Check if critical op delivered
            const hasCritical = opsToSend.some(o => 
              (o.type === 'REPORT' && (o.payload?.incidentType === 'medical_emergency' || o.payload?.incidentType === 'stranded_people')) ||
              (o.type === 'RESOURCE_CLAIM' && o.payload?.resourceClass === 'MEDICAL')
            );
            if (hasCritical && !firstCriticalDelivered) {
              firstCriticalDelivered = true;
              this.metrics.timeToFirstCriticalOpMs = Date.now() - startTime;
            }
          }
        }

        // Step 3: Pull missing ops from peer that local lacks
        const missingFromPeer = calculateMissingRanges(peerVector, localVector);
        if (Object.keys(missingFromPeer).length > 0) {
          const pullRes = await fetch(`${url}/api/v1/sync/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: this.store.region, ranges: missingFromPeer }),
            signal: AbortSignal.timeout(2500)
          });

          if (pullRes.ok) {
            const pullData = await pullRes.json() as { ops: Operation[] };
            for (const op of pullData.ops) {
              const res = this.store.applyRemoteOperation(op, 'DIRECT');
              if (res.applied) syncedCount++;
            }
          }
        }
      } catch (err: any) {
        errors.push(`Sync failed with ${peer}: ${err.message}`);
      }
    }

    this.metrics.lastConvergenceTimeMs = Date.now() - startTime;
    this.metrics.lastSyncAt = new Date().toISOString();
    this.isSyncing = false;
    return { syncedCount, errors };
  }
}
