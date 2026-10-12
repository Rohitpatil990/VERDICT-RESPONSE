import { RegionId } from '@verdict/core';

export interface LinkState {
  from: RegionId;
  to: RegionId;
  up: boolean;
  latencyMs: number;
  bandwidthBps: number | null; // bytes per second, null = unlimited
}

export class LinkController {
  private links: Map<string, LinkState> = new Map();

  private key(from: RegionId, to: RegionId): string {
    return `${from}->${to}`;
  }

  ensureLink(from: RegionId, to: RegionId): LinkState {
    const k = this.key(from, to);
    if (!this.links.has(k)) {
      this.links.set(k, {
        from,
        to,
        up: true,
        latencyMs: 15, // realistic regional ping
        bandwidthBps: null
      });
    }
    return this.links.get(k)!;
  }

  cutLink(from: RegionId, to: RegionId, bidirectional = true): void {
    this.ensureLink(from, to).up = false;
    if (bidirectional) {
      this.ensureLink(to, from).up = false;
    }
  }

  restoreLink(from: RegionId, to: RegionId, bandwidthBps: number | null = null, bidirectional = true): void {
    const l1 = this.ensureLink(from, to);
    l1.up = true;
    l1.bandwidthBps = bandwidthBps;
    if (bidirectional) {
      const l2 = this.ensureLink(to, from);
      l2.up = true;
      l2.bandwidthBps = bandwidthBps;
    }
  }

  setLatency(from: RegionId, to: RegionId, latencyMs: number, bidirectional = true): void {
    this.ensureLink(from, to).latencyMs = latencyMs;
    if (bidirectional) {
      this.ensureLink(to, from).latencyMs = latencyMs;
    }
  }

  isLinkUp(from: RegionId, to: RegionId): boolean {
    return this.ensureLink(from, to).up;
  }

  getLink(from: RegionId, to: RegionId): LinkState {
    return this.ensureLink(from, to);
  }

  getAllLinks(): LinkState[] {
    return Array.from(this.links.values());
  }
}
