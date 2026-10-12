import type { RegionId, DegradationLevel } from '@verdict/core';

export interface LinkState {
  source: RegionId;
  target: RegionId;
  status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  latencyMs: number;
  bandwidthCapBytesPerSec?: number; // e.g. 1024 for low-bandwidth reconnect demo
  lastUpdated: string;
}

export class LinkController {
  private links: Map<string, LinkState> = new Map();
  private region: RegionId;

  constructor(region: RegionId) {
    this.region = region;
    this.initDefaultLinks();
  }

  private getKey(r1: RegionId, r2: RegionId): string {
    return [r1, r2].sort().join('<->');
  }

  private initDefaultLinks(): void {
    const peers: RegionId[] = ['mumbai', 'delhi', 'bengaluru'];
    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const key = this.getKey(peers[i], peers[j]);
        this.links.set(key, {
          source: peers[i],
          target: peers[j],
          status: 'CONNECTED',
          latencyMs: 35,
          lastUpdated: new Date().toISOString()
        });
      }
    }
  }

  public cut(r1: RegionId, r2: RegionId): void {
    const key = this.getKey(r1, r2);
    const existing = this.links.get(key);
    this.links.set(key, {
      source: r1,
      target: r2,
      status: 'DISCONNECTED',
      latencyMs: 999999,
      lastUpdated: new Date().toISOString()
    });
  }

  public restore(r1: RegionId, r2: RegionId, latencyMs = 45, bandwidthCapBytesPerSec?: number): void {
    const key = this.getKey(r1, r2);
    this.links.set(key, {
      source: r1,
      target: r2,
      status: bandwidthCapBytesPerSec ? 'DEGRADED' : 'CONNECTED',
      latencyMs,
      bandwidthCapBytesPerSec,
      lastUpdated: new Date().toISOString()
    });
  }

  public isLinked(target: RegionId): boolean {
    if (target === this.region) return true;
    const key = this.getKey(this.region, target);
    const link = this.links.get(key);
    return link ? link.status !== 'DISCONNECTED' : false;
  }

  public getLink(target: RegionId): LinkState | undefined {
    const key = this.getKey(this.region, target);
    return this.links.get(key);
  }

  public getAllLinks(): Record<string, LinkState> {
    const res: Record<string, LinkState> = {};
    for (const [k, v] of this.links.entries()) {
      res[k] = v;
    }
    return res;
  }

  public getDegradationLevel(): DegradationLevel {
    const peers: RegionId[] = (['mumbai', 'delhi', 'bengaluru'] as RegionId[]).filter(r => r !== this.region);
    const peerLinks = peers.map(p => this.getLink(p));
    const connectedCount = peerLinks.filter(l => l?.status === 'CONNECTED').length;
    const degradedCount = peerLinks.filter(l => l?.status === 'DEGRADED').length;
    const disconnectedCount = peerLinks.filter(l => l?.status === 'DISCONNECTED').length;

    if (disconnectedCount === peers.length) {
      return 'L2_ISOLATED';
    }
    if (degradedCount > 0 || disconnectedCount > 0) {
      return 'L1_DEGRADED';
    }
    return 'L0_FULL';
  }
}
