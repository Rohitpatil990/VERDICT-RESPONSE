export type Region = 'mumbai' | 'delhi' | 'bengaluru';

export const FALLBACK_RINGS: Record<Region, Region[]> = {
  mumbai: ['mumbai', 'delhi', 'bengaluru'],
  delhi: ['delhi', 'mumbai', 'bengaluru'],
  bengaluru: ['bengaluru', 'mumbai', 'delhi']
};

export interface FailoverState {
  preferredRegion: Region;
  activeRegion: Region;
  isFailover: boolean;
  lastError?: string;
  lastFailoverAt?: number;
}

export class AllRegionsUnavailableError extends Error {
  constructor(public readonly ring: Region[], message?: string) {
    super(message || `All regional nodes in fallback ring [${ring.join(' -> ')}] are unreachable.`);
    this.name = 'AllRegionsUnavailableError';
  }
}

export class WriteOutcomeUnknownError extends Error {
  constructor(
    public readonly clientTxId: string,
    public readonly targetRegion: Region,
    public readonly causeError: string
  ) {
    super(
      `Write outcome UNKNOWN: Request with txId "${clientTxId}" to [${targetRegion.toUpperCase()}] timed out in-flight or connection dropped. Automatic blind retry blocked to prevent duplicate commitment. Cause: ${causeError}`
    );
    this.name = 'WriteOutcomeUnknownError';
  }
}

export class EscrowQuotaFenceError extends Error {
  constructor(public readonly targetRegion: Region) {
    super(
      `Escrow quota fence: Cannot failover spendEscrow to another region. Quota is strictly bounded to authorized rights of [${targetRegion.toUpperCase()}].`
    );
    this.name = 'EscrowQuotaFenceError';
  }
}

export function generateClientTxId(): string {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ApiClient {
  private _failoverState: FailoverState;
  private listeners: Array<(state: FailoverState) => void> = [];

  constructor(public currentRegion: Region = 'mumbai') {
    this._failoverState = {
      preferredRegion: currentRegion,
      activeRegion: currentRegion,
      isFailover: false
    };
  }

  public get failoverState(): FailoverState {
    return { ...this._failoverState };
  }

  public onFailoverStateChange(cb: (state: FailoverState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private updateFailoverState(preferred: Region, active: Region, err?: string) {
    const isFailover = preferred !== active;
    const changed =
      this._failoverState.preferredRegion !== preferred ||
      this._failoverState.activeRegion !== active ||
      this._failoverState.isFailover !== isFailover;

    this._failoverState = {
      preferredRegion: preferred,
      activeRegion: active,
      isFailover,
      lastError: err,
      lastFailoverAt: isFailover ? Date.now() : undefined
    };

    if (changed) {
      for (const cb of this.listeners) {
        try {
          cb(this._failoverState);
        } catch (e) {
          console.error('Error in failover state listener:', e);
        }
      }
    }
  }

  public getBaseUrl(region: Region = this.currentRegion): string {
    const ports: Record<Region, number> = {
      mumbai: 4001,
      delhi: 4002,
      bengaluru: 4003
    };
    return `http://127.0.0.1:${ports[region]}`;
  }

  /**
   * Safe read with deterministic fallback ring.
   * If preferred region is unreachable, deterministically tries peers in ring.
   */
  async readWithFailover<T = any>(
    path: string,
    preferredRegion: Region = this.currentRegion,
    options: RequestInit = {}
  ): Promise<T & { _servingRegion: Region; _isFailover: boolean }> {
    const ring = FALLBACK_RINGS[preferredRegion] || [preferredRegion];
    let lastErrorMsg = '';

    for (const region of ring) {
      const url = `${this.getBaseUrl(region)}${path}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          this.updateFailoverState(preferredRegion, region);
          if (Array.isArray(data)) {
            Object.defineProperty(data, '_servingRegion', { value: region, enumerable: false, writable: true, configurable: true });
            Object.defineProperty(data, '_isFailover', { value: region !== preferredRegion, enumerable: false, writable: true, configurable: true });
            return data as any;
          }
          return {
            ...data,
            _servingRegion: region,
            _isFailover: region !== preferredRegion
          };
        } else if (res.status >= 500) {
          lastErrorMsg = `Server error ${res.status} from ${region}`;
          // Try next fallback on server internal error
          continue;
        } else {
          // Client error (404, 400) - return directly without failover
          const data = await res.json();
          this.updateFailoverState(preferredRegion, region);
          if (Array.isArray(data)) {
            Object.defineProperty(data, '_servingRegion', { value: region, enumerable: false, writable: true, configurable: true });
            Object.defineProperty(data, '_isFailover', { value: region !== preferredRegion, enumerable: false, writable: true, configurable: true });
            return data as any;
          }
          return {
            ...data,
            _servingRegion: region,
            _isFailover: region !== preferredRegion
          };
        }
      } catch (err: any) {
        lastErrorMsg = err.message || 'Connection failed';
        // Node is unreachable; continue to next replica in ring
      }
    }

    this.updateFailoverState(preferredRegion, preferredRegion, lastErrorMsg);
    throw new AllRegionsUnavailableError(ring, `All regional nodes in fallback ring [${ring.join(' -> ')}] are unreachable. Last error: ${lastErrorMsg}`);
  }

  /**
   * Safe write with client transaction idempotency.
   * - Injects clientTxId.
   * - Immediate connection error allows fallback with SAME clientTxId.
   * - In-flight timeout throws WriteOutcomeUnknownError and blocks blind retry.
   */
  async writeWithIdempotency<T = any>(
    path: string,
    payload: any,
    preferredRegion: Region = this.currentRegion,
    options: RequestInit = {}
  ): Promise<T & { _servingRegion: Region; _clientTxId: string }> {
    const clientTxId = payload?.clientTxId || generateClientTxId();
    const enrichedPayload = { ...payload, clientTxId };
    const ring = FALLBACK_RINGS[preferredRegion] || [preferredRegion];

    for (let i = 0; i < ring.length; i++) {
      const region = ring[i];
      const url = `${this.getBaseUrl(region)}${path}`;
      let requestSent = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        requestSent = true;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...options,
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          this.updateFailoverState(preferredRegion, region);
          return {
            ...data,
            _servingRegion: region,
            _clientTxId: clientTxId
          };
        }

        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      } catch (err: any) {
        // Distinguish immediate connection failure vs in-flight timeout
        const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout');
        if (isTimeout) {
          // In-flight timeout: Outcome is UNKNOWN. Halt and do not blindly retry!
          throw new WriteOutcomeUnknownError(clientTxId, region, err.message);
        }

        // Connection refused before transmission: try next region in ring with SAME clientTxId
        const isLastInRing = i === ring.length - 1;
        if (isLastInRing) {
          throw new AllRegionsUnavailableError(ring, `Failed to submit write to all regions in ring: ${err.message}`);
        }
      }
    }

    throw new AllRegionsUnavailableError(ring);
  }

  // --- API Methods ---

  async getStatus(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/status', region);
  }

  async getConvergence(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/convergence', region);
  }

  async getLocalConvergence(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/convergence/local', region);
  }

  async getDcrOps(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/dcr/ops', region);
  }

  async planDcr(targetOpId: string, region: Region = this.currentRegion) {
    return await this.writeWithIdempotency('/api/v1/dcr/plan', { targetOpId }, region);
  }

  async recoverDcr(targetOpId: string, region: Region = this.currentRegion) {
    return await this.writeWithIdempotency('/api/v1/dcr/recover', { targetOpId }, region);
  }

  async getFog(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/fog', region);
  }

  async getMap(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/map', region);
  }

  async getRecord(id: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/records/${id}`, region);
  }

  async getTrace(id: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/records/${id}/trace`, region);
  }

  async submitReport(payload: any, region: Region = this.currentRegion) {
    return await this.writeWithIdempotency('/api/v1/reports', payload, region);
  }

  /**
   * Evaluates Decision Gate with failover, but labels the actual evaluation perspective.
   */
  async evaluateDecision(request: any, region: Region = this.currentRegion) {
    const ring = FALLBACK_RINGS[region] || [region];
    for (const r of ring) {
      try {
        const res = await fetch(`${this.getBaseUrl(r)}/api/v1/decisions/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
        if (res.ok) {
          const data = await res.json();
          this.updateFailoverState(region, r);
          return {
            ...data,
            _evaluatingRegion: r,
            _requestedRegion: region,
            _isFailover: r !== region
          };
        }
      } catch {
        // Try next fallback in ring
      }
    }
    throw new AllRegionsUnavailableError(ring);
  }

  async commitDecision(payload: any, region: Region = this.currentRegion) {
    return await this.writeWithIdempotency('/api/v1/decisions', payload, region);
  }

  async getDecisions(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/decisions', region);
  }

  async getReevaluation(decisionId: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/decisions/${decisionId}/reevaluation`, region);
  }

  async getEscrow(resource: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/escrow/${resource}`, region);
  }

  /**
   * Escrow spending is STRICTLY quota-fenced to the target region.
   * Automatic cross-region failover is blocked by construction to protect spatial supply quotas.
   */
  async spendEscrow(resource: string, qty: number, targetRegion: Region = this.currentRegion) {
    const url = `${this.getBaseUrl(targetRegion)}/api/v1/escrow/spend`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, qty })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch failed')) {
        throw new EscrowQuotaFenceError(targetRegion);
      }
      throw err;
    }
  }

  async requestEscrowTransfer(resource: string, qty: number, region: Region = this.currentRegion) {
    return await this.writeWithIdempotency('/api/v1/escrow/request', { resource, qty }, region);
  }

  async getEpisodes(region: Region = this.currentRegion) {
    return await this.readWithFailover('/api/v1/episodes', region);
  }

  async getMergeReport(episodeId: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/episodes/${episodeId}/report`, region);
  }

  async resolveConflict(
    id: string,
    status: string,
    reason: string,
    reviewerId = 'reviewer_alice',
    region: Region = this.currentRegion
  ) {
    return await this.writeWithIdempotency(`/api/v1/conflicts/${id}/resolve`, { status, reason, reviewerId }, region);
  }

  async verifyOp(opId: string, region: Region = this.currentRegion) {
    return await this.readWithFailover(`/api/v1/ops/${opId}/verify`, region, { method: 'POST' });
  }

  async alterLink(from: Region, to: Region, up: boolean, bandwidthBps: number | null = null, latencyMs?: number, region: Region = this.currentRegion) {
    const res = await fetch(`${this.getBaseUrl(region)}/admin/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, up, bandwidthBps, latencyMs })
    });
    return await res.json();
  }

  async tamperOp(opId: string, region: Region = this.currentRegion) {
    const res = await fetch(`${this.getBaseUrl(region)}/admin/tamper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId })
    });
    return await res.json();
  }

  async healOp(opId: string, remoteRegion: Region = 'mumbai', region: Region = this.currentRegion) {
    const res = await fetch(`${this.getBaseUrl(region)}/admin/heal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opId, remoteRegion })
    });
    return await res.json();
  }
}

export const api = new ApiClient();
