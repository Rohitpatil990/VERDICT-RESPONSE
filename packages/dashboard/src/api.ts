export type RegionId = 'mumbai' | 'delhi' | 'bengaluru';

export const REGION_PORTS: Record<RegionId, number> = {
  mumbai: 4001,
  delhi: 4002,
  bengaluru: 4003
};

export function getRegionUrl(region: RegionId): string {
  return `http://localhost:${REGION_PORTS[region]}`;
}

export class ApiClient {
  public static async getStatus(region: RegionId) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async getMap(region: RegionId) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/map`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async getTrace(region: RegionId, id: string) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/records/${encodeURIComponent(id)}/trace`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async submitReport(region: RegionId, payload: any) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async submitOp(region: RegionId, payload: any) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async resolveConflict(region: RegionId, id: string, chosenOpId: string, chosenState: any, justification: string) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/conflicts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chosenOpId, chosenState, justification })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async verifyOp(region: RegionId, opId: string) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/ops/${encodeURIComponent(opId)}/verify`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async adminLink(region: RegionId, action: 'cut' | 'restore', target: RegionId, latencyMs?: number, bandwidthCap?: number) {
    const res = await fetch(`${getRegionUrl(region)}/admin/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, source: region, target, latencyMs, bandwidthCap })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async adminSync(region: RegionId) {
    const res = await fetch(`${getRegionUrl(region)}/admin/sync`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async adminTamper(region: RegionId, opId: string) {
    const res = await fetch(`${getRegionUrl(region)}/admin/tamper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async adminHeal(region: RegionId, opId: string) {
    const res = await fetch(`${getRegionUrl(region)}/admin/heal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async adminSettleRound(region: RegionId) {
    const res = await fetch(`${getRegionUrl(region)}/admin/round/settle`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async getMetrics(region: RegionId) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  public static async getNearby(region: RegionId, lat: number, lng: number) {
    const res = await fetch(`${getRegionUrl(region)}/api/v1/nearby?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
