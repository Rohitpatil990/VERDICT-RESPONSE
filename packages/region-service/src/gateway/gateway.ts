import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';

export type Region = 'mumbai' | 'delhi' | 'bengaluru';

export const ALL_REGIONS: Region[] = ['mumbai', 'delhi', 'bengaluru'];

export const FALLBACK_RINGS: Record<Region, Region[]> = {
  mumbai: ['mumbai', 'delhi', 'bengaluru'],
  delhi: ['delhi', 'mumbai', 'bengaluru'],
  bengaluru: ['bengaluru', 'mumbai', 'delhi']
};

export interface BackendConfig {
  id: Region;
  port: number;
  authority: boolean;
}

export interface BackendHealth {
  id: Region;
  port: number;
  healthy: boolean;
  lastProbeAt?: number;
  latencyMs?: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastError?: string;
  activeRequests: number;
}

export interface GatewayMetrics {
  totalRequests: number;
  requestsByRegion: Record<Region, number>;
  requestsByMode: {
    roundRobin: number;
    stickyPreferred: number;
    failover: number;
    authoritativeFenced: number;
    direct: number;
  };
  failedRequests: number;
}

export interface GatewayOptions {
  port?: number;
  backends?: Record<Region, BackendConfig>;
  healthCheckIntervalMs?: number;
  probeTimeoutMs?: number;
  autoStartHealthCheck?: boolean;
}

export class VerdictGateway {
  public readonly app: FastifyInstance;
  public readonly port: number;
  public readonly backends: Record<Region, BackendConfig>;
  public readonly health: Record<Region, BackendHealth>;
  public readonly metrics: GatewayMetrics;
  private healthTimer?: NodeJS.Timeout;
  private rrIndex: number = 0;
  private readonly probeTimeoutMs: number;
  private readonly healthCheckIntervalMs: number;

  constructor(options: GatewayOptions = {}) {
    this.port = options.port ?? 4000;
    this.probeTimeoutMs = options.probeTimeoutMs ?? 1000;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 2000;

    this.backends = options.backends ?? {
      mumbai: { id: 'mumbai', port: 4001, authority: true },
      delhi: { id: 'delhi', port: 4002, authority: false },
      bengaluru: { id: 'bengaluru', port: 4003, authority: false }
    };

    this.health = {
      mumbai: { id: 'mumbai', port: this.backends.mumbai.port, healthy: true, consecutiveSuccesses: 1, consecutiveFailures: 0, activeRequests: 0 },
      delhi: { id: 'delhi', port: this.backends.delhi.port, healthy: true, consecutiveSuccesses: 1, consecutiveFailures: 0, activeRequests: 0 },
      bengaluru: { id: 'bengaluru', port: this.backends.bengaluru.port, healthy: true, consecutiveSuccesses: 1, consecutiveFailures: 0, activeRequests: 0 }
    };

    this.metrics = {
      totalRequests: 0,
      requestsByRegion: { mumbai: 0, delhi: 0, bengaluru: 0 },
      requestsByMode: {
        roundRobin: 0,
        stickyPreferred: 0,
        failover: 0,
        authoritativeFenced: 0,
        direct: 0
      },
      failedRequests: 0
    };

    this.app = Fastify({ logger: false });
    this.setupRoutes();

    if (options.autoStartHealthCheck !== false) {
      this.startHealthChecks();
    }
  }

  public getHealthyRegions(): Region[] {
    return ALL_REGIONS.filter(r => this.health[r].healthy);
  }

  public setBackendHealth(region: Region, healthy: boolean, err?: string) {
    if (this.health[region]) {
      this.health[region].healthy = healthy;
      if (healthy) {
        this.health[region].consecutiveSuccesses++;
        this.health[region].consecutiveFailures = 0;
        this.health[region].lastError = undefined;
      } else {
        this.health[region].consecutiveFailures++;
        this.health[region].consecutiveSuccesses = 0;
        this.health[region].lastError = err || 'Manual override';
      }
    }
  }

  public async probeBackend(region: Region): Promise<boolean> {
    const backend = this.backends[region];
    const url = `http://127.0.0.1:${backend.port}/api/v1/status`;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.probeTimeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const latency = Date.now() - start;
      const ok = res.ok;

      this.health[region].lastProbeAt = Date.now();
      this.health[region].latencyMs = latency;
      this.health[region].healthy = ok;

      if (ok) {
        this.health[region].consecutiveSuccesses++;
        this.health[region].consecutiveFailures = 0;
        this.health[region].lastError = undefined;
      } else {
        this.health[region].consecutiveFailures++;
        this.health[region].consecutiveSuccesses = 0;
        this.health[region].lastError = `HTTP ${res.status}`;
      }
      return ok;
    } catch (err: any) {
      this.health[region].lastProbeAt = Date.now();
      this.health[region].healthy = false;
      this.health[region].consecutiveFailures++;
      this.health[region].consecutiveSuccesses = 0;
      this.health[region].lastError = err.message || 'Connection refused';
      return false;
    }
  }

  public async runHealthCheckCycle(): Promise<void> {
    await Promise.all(ALL_REGIONS.map(r => this.probeBackend(r)));
  }

  public startHealthChecks(): void {
    if (this.healthTimer) return;
    this.runHealthCheckCycle().catch(() => {});
    this.healthTimer = setInterval(() => {
      this.runHealthCheckCycle().catch(() => {});
    }, this.healthCheckIntervalMs);
  }

  public stopHealthChecks(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
  }

  public resetMetrics(): void {
    this.metrics.totalRequests = 0;
    this.metrics.requestsByRegion = { mumbai: 0, delhi: 0, bengaluru: 0 };
    this.metrics.requestsByMode = {
      roundRobin: 0,
      stickyPreferred: 0,
      failover: 0,
      authoritativeFenced: 0,
      direct: 0
    };
    this.metrics.failedRequests = 0;
    this.rrIndex = 0;
  }

  public selectRoute(
    method: string,
    url: string,
    headers: Record<string, any>,
    body?: any
  ): { targetRegion: Region; routingMode: 'ROUND_ROBIN' | 'STICKY_PREFERRED' | 'FAILOVER' | 'AUTHORITATIVE_FENCED'; error?: string } {
    const preferredHeader = (headers['x-preferred-region'] || headers['x-target-region'] || '') as Region;
    const isPreferredValid = ALL_REGIONS.includes(preferredHeader);
    const healthy = this.getHealthyRegions();

    if (healthy.length === 0) {
      return {
        targetRegion: 'mumbai',
        routingMode: 'FAILOVER',
        error: 'All regional service instances are currently unavailable.'
      };
    }

    // 1. Check Authority-Sensitive Operations (e.g., Escrow Quota Spends)
    const isEscrowSpend = url.includes('/api/v1/escrow/spend');
    if (isEscrowSpend) {
      const targetRegion: Region = isPreferredValid ? preferredHeader : (body?.targetRegion || 'mumbai');
      if (!this.health[targetRegion]?.healthy) {
        return {
          targetRegion,
          routingMode: 'AUTHORITATIVE_FENCED',
          error: `Escrow quota fence: Cannot load-balance spendEscrow to alternative region. Quotas are strictly fenced to [${targetRegion.toUpperCase()}].`
        };
      }
      return { targetRegion, routingMode: 'AUTHORITATIVE_FENCED' };
    }

    // 2. Stateless / Eligible Read Operations
    const isEligibleRead = method === 'GET' && (
      url.startsWith('/api/v1/records') ||
      url.startsWith('/api/v1/map') ||
      url.startsWith('/api/v1/fog') ||
      url.startsWith('/api/v1/status') ||
      url.startsWith('/api/v1/convergence/local') ||
      url.startsWith('/api/v1/dcr/ops')
    );

    if (isEligibleRead && (!isPreferredValid || headers['x-load-balance'] === 'true')) {
      const idx = this.rrIndex % healthy.length;
      this.rrIndex++;
      const selected = healthy[idx];
      return { targetRegion: selected, routingMode: 'ROUND_ROBIN' };
    }

    // 3. Explicit Preferred Region with Deterministic Failover Ring
    if (isPreferredValid) {
      if (this.health[preferredHeader]?.healthy) {
        return { targetRegion: preferredHeader, routingMode: 'STICKY_PREFERRED' };
      }

      const ring = FALLBACK_RINGS[preferredHeader] || [preferredHeader];
      for (const candidate of ring) {
        if (this.health[candidate]?.healthy) {
          return { targetRegion: candidate, routingMode: 'FAILOVER' };
        }
      }
    }

    // 4. Fallback: Round-robin across healthy
    const selected = healthy[this.rrIndex++ % healthy.length];
    return { targetRegion: selected, routingMode: 'ROUND_ROBIN' };
  }

  private setupRoutes() {
    this.app.register(cors, { origin: '*' });

    // 1. Gateway Status & Diagnostic Dashboard API
    this.app.get('/api/v1/lb/status', async () => {
      const healthyRegions = this.getHealthyRegions();
      return {
        service: 'VERDICT Consistency-Aware Gateway & Load Balancer',
        version: '1.0.0',
        activePort: this.port,
        healthyCount: healthyRegions.length,
        totalBackends: ALL_REGIONS.length,
        healthyRegions,
        backends: this.health,
        policy: {
          statelessReads: 'ROUND_ROBIN_ACROSS_HEALTHY',
          stickyReads: 'STICKY_WITH_DETERMINISTIC_FAILOVER_RING',
          authoritativeWrites: 'ESCROW_QUOTA_FENCED_NO_FAILOVER',
          idempotentWrites: 'CLIENT_TX_ID_FORWARDING'
        },
        metrics: this.metrics,
        timestamp: Date.now()
      };
    });

    // 2. Metrics Reset
    this.app.post('/api/v1/lb/reset-metrics', async () => {
      this.resetMetrics();
      return { ok: true, message: 'Gateway metrics reset successfully' };
    });

    // 3. Manual Health Override for Test Scenarios
    this.app.post('/api/v1/lb/override-health', async (req: FastifyRequest) => {
      const body = (req.body || {}) as { region: Region; healthy: boolean; reason?: string };
      if (!body.region || !ALL_REGIONS.includes(body.region)) {
        throw new Error('Valid region required');
      }
      this.setBackendHealth(body.region, !!body.healthy, body.reason);
      return { ok: true, region: body.region, healthy: this.health[body.region].healthy };
    });

    // 4. Reverse Proxy for Application Routes (Avoid registering OPTIONS which conflicts with cors)
    const proxyMethods: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    for (const method of proxyMethods) {
      this.app.route({
        method,
        url: '/*',
        handler: async (req: FastifyRequest, reply: FastifyReply) => {
          // Exclude internal LB endpoints
          if (req.url.startsWith('/api/v1/lb/')) {
            return;
          }

          const decision = this.selectRoute(req.method, req.url, req.headers as Record<string, any>, req.body);

          if (decision.error) {
            this.metrics.totalRequests++;
            this.metrics.failedRequests++;
            const statusCode = decision.routingMode === 'AUTHORITATIVE_FENCED' ? 409 : 503;
            reply.status(statusCode).send({
              error: decision.error,
              routingMode: decision.routingMode,
              targetRegion: decision.targetRegion,
              healthyBackends: this.getHealthyRegions()
            });
            return;
          }

          const targetRegion = decision.targetRegion;
          const backend = this.backends[targetRegion];
          const targetUrl = `http://127.0.0.1:${backend.port}${req.url}`;

          this.metrics.totalRequests++;
          this.metrics.requestsByRegion[targetRegion]++;
          if (decision.routingMode === 'ROUND_ROBIN') this.metrics.requestsByMode.roundRobin++;
          else if (decision.routingMode === 'STICKY_PREFERRED') this.metrics.requestsByMode.stickyPreferred++;
          else if (decision.routingMode === 'FAILOVER') this.metrics.requestsByMode.failover++;
          else if (decision.routingMode === 'AUTHORITATIVE_FENCED') this.metrics.requestsByMode.authoritativeFenced++;
          else this.metrics.requestsByMode.direct++;

          this.health[targetRegion].activeRequests++;

          try {
            const fetchHeaders: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            if (req.headers['x-client-tx-id']) {
              fetchHeaders['x-client-tx-id'] = req.headers['x-client-tx-id'] as string;
            }

            const fetchOpts: RequestInit = {
              method: req.method,
              headers: fetchHeaders
            };

            if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
              fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            fetchOpts.signal = controller.signal;

            const backendRes = await fetch(targetUrl, fetchOpts);
            clearTimeout(timeoutId);

            reply.header('X-VERDICT-Serving-Region', targetRegion);
            reply.header('X-VERDICT-Routing-Mode', decision.routingMode);
            reply.header('X-VERDICT-Backend-Port', backend.port.toString());

            const contentType = backendRes.headers.get('content-type') || 'application/json';
            reply.header('Content-Type', contentType);

            const resData = await backendRes.text();
            reply.status(backendRes.status);
            try {
              reply.send(JSON.parse(resData));
            } catch {
              reply.send(resData);
            }
          } catch (err: any) {
            this.metrics.failedRequests++;
            this.health[targetRegion].healthy = false;
            this.health[targetRegion].consecutiveFailures++;
            reply.status(502).send({
              error: `Bad Gateway: Target region [${targetRegion.toUpperCase()}] failed during proxy execution.`,
              cause: err.message || 'Connection failed'
            });
          } finally {
            this.health[targetRegion].activeRequests = Math.max(0, this.health[targetRegion].activeRequests - 1);
          }
        }
      });
    }
  }

  public async listen(): Promise<void> {
    await this.app.listen({ port: this.port, host: '127.0.0.1' });
  }

  public async close(): Promise<void> {
    this.stopHealthChecks();
    await this.app.close();
  }
}

export function buildGateway(options?: GatewayOptions): VerdictGateway {
  return new VerdictGateway(options);
}
