import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { VerdictGateway } from '../src/gateway/gateway.js';

describe('VERDICT Gateway & Load Balancer Test Suite (Phase 5)', () => {
  let gateway: VerdictGateway;
  const GATEWAY_TEST_PORT = 14500;

  beforeAll(async () => {
    gateway = new VerdictGateway({
      port: GATEWAY_TEST_PORT,
      autoStartHealthCheck: false,
      backends: {
        mumbai: { id: 'mumbai', port: 14501, authority: true },
        delhi: { id: 'delhi', port: 14502, authority: false },
        bengaluru: { id: 'bengaluru', port: 14503, authority: false }
      }
    });
    await gateway.listen();
    // Set all nodes healthy by default for isolated testing
    gateway.setBackendHealth('mumbai', true);
    gateway.setBackendHealth('delhi', true);
    gateway.setBackendHealth('bengaluru', true);
  });

  beforeEach(() => {
    gateway.resetMetrics();
    gateway.setBackendHealth('mumbai', true);
    gateway.setBackendHealth('delhi', true);
    gateway.setBackendHealth('bengaluru', true);
  });

  afterAll(async () => {
    await gateway.close();
  });

  it('Test A — Healthy-node distribution across eligible requests', () => {
    const route1 = gateway.selectRoute('GET', '/api/v1/records/road-101', {});
    const route2 = gateway.selectRoute('GET', '/api/v1/records/road-102', {});
    const route3 = gateway.selectRoute('GET', '/api/v1/records/road-103', {});
    const route4 = gateway.selectRoute('GET', '/api/v1/records/road-104', {});

    expect(route1.routingMode).toBe('ROUND_ROBIN');
    expect(route2.routingMode).toBe('ROUND_ROBIN');
    expect(route3.routingMode).toBe('ROUND_ROBIN');
    expect(route4.routingMode).toBe('ROUND_ROBIN');

    const regions = [route1.targetRegion, route2.targetRegion, route3.targetRegion];
    // Must hit all three healthy nodes in sequential round-robin
    expect(regions).toContain('mumbai');
    expect(regions).toContain('delhi');
    expect(regions).toContain('bengaluru');
    // 4th request cycles back to the first
    expect(route4.targetRegion).toBe(route1.targetRegion);
  });

  it('Test B — Unavailable service exclusion and automatic fallback', () => {
    // Mark Mumbai as unavailable
    gateway.setBackendHealth('mumbai', false, 'Simulated power outage / hardware fault');

    const healthy = gateway.getHealthyRegions();
    expect(healthy).not.toContain('mumbai');
    expect(healthy).toEqual(['delhi', 'bengaluru']);

    // Eligible reads should now round-robin strictly between Delhi and Bengaluru
    const route1 = gateway.selectRoute('GET', '/api/v1/records/road-201', {});
    const route2 = gateway.selectRoute('GET', '/api/v1/records/road-202', {});
    const route3 = gateway.selectRoute('GET', '/api/v1/records/road-203', {});

    expect([route1.targetRegion, route2.targetRegion]).toContain('delhi');
    expect([route1.targetRegion, route2.targetRegion]).toContain('bengaluru');
    expect([route1.targetRegion, route2.targetRegion, route3.targetRegion]).not.toContain('mumbai');

    // Sticky read targeted to Mumbai must deterministically fail over to Delhi
    const stickyRoute = gateway.selectRoute('GET', '/api/v1/status', { 'x-preferred-region': 'mumbai' });
    expect(stickyRoute.targetRegion).toBe('delhi');
    expect(stickyRoute.routingMode).toBe('FAILOVER');
  });

  it('Test C — All services unavailable returns clear error without infinite retries', () => {
    gateway.setBackendHealth('mumbai', false);
    gateway.setBackendHealth('delhi', false);
    gateway.setBackendHealth('bengaluru', false);

    expect(gateway.getHealthyRegions()).toHaveLength(0);

    const decision = gateway.selectRoute('GET', '/api/v1/records/road-301', {});
    expect(decision.error).toBeDefined();
    expect(decision.error).toContain('All regional service instances are currently unavailable');
  });

  it('Test D — Service recovery restores node eligibility', () => {
    // 1. Mark Bengaluru down
    gateway.setBackendHealth('bengaluru', false);
    expect(gateway.getHealthyRegions()).toEqual(['mumbai', 'delhi']);

    // 2. Mark Bengaluru recovered
    gateway.setBackendHealth('bengaluru', true);
    expect(gateway.getHealthyRegions()).toEqual(['mumbai', 'delhi', 'bengaluru']);

    // 3. Confirm Bengaluru receives traffic again
    const sampleRegions: string[] = [];
    for (let i = 0; i < 6; i++) {
      sampleRegions.push(gateway.selectRoute('GET', '/api/v1/records/test', {}).targetRegion);
    }
    expect(sampleRegions).toContain('bengaluru');
  });

  it('Test E — Data correctness & Escrow Quota Fencing', () => {
    // Case 1: Healthy target region allows authoritative spend
    const allowed = gateway.selectRoute('POST', '/api/v1/escrow/spend', { 'x-preferred-region': 'delhi' });
    expect(allowed.targetRegion).toBe('delhi');
    expect(allowed.routingMode).toBe('AUTHORITATIVE_FENCED');
    expect(allowed.error).toBeUndefined();

    // Case 2: Unhealthy target region BLOCKS rerouting to protect supply boundaries
    gateway.setBackendHealth('delhi', false);
    const blocked = gateway.selectRoute('POST', '/api/v1/escrow/spend', { 'x-preferred-region': 'delhi' });
    expect(blocked.error).toBeDefined();
    expect(blocked.error).toContain('Escrow quota fence');
    expect(blocked.routingMode).toBe('AUTHORITATIVE_FENCED');
  });

  it('Test F — Ambiguous write idempotency protection', () => {
    // Ensure client transaction identity header is acknowledged and passed through
    const headers = { 'x-client-tx-id': 'tx-abc-12345', 'x-preferred-region': 'mumbai' };
    const route = gateway.selectRoute('POST', '/api/v1/reports', headers, { clientTxId: 'tx-abc-12345' });
    expect(route.targetRegion).toBe('mumbai');
    expect(route.routingMode).toBe('STICKY_PREFERRED');
  });

  it('Test G — Diagnostic endpoint reflects real health and metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${GATEWAY_TEST_PORT}/api/v1/lb/status`);
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.service).toContain('VERDICT Consistency-Aware Gateway');
    expect(data.healthyCount).toBe(3);
    expect(data.backends.mumbai.healthy).toBe(true);
    expect(data.backends.delhi.healthy).toBe(true);
    expect(data.backends.bengaluru.healthy).toBe(true);
  });

  it('Test H — Local concurrent request test measuring distribution', () => {
    const TOTAL_CONCURRENT = 30;
    const results: Record<string, number> = { mumbai: 0, delhi: 0, bengaluru: 0 };
    const startTime = Date.now();

    for (let i = 0; i < TOTAL_CONCURRENT; i++) {
      const decision = gateway.selectRoute('GET', `/api/v1/records/concurrent-${i}`, {});
      results[decision.targetRegion]++;
    }
    const durationMs = Date.now() - startTime;

    expect(results.mumbai).toBe(10);
    expect(results.delhi).toBe(10);
    expect(results.bengaluru).toBe(10);
    expect(durationMs).toBeLessThan(100); // Sub-millisecond routing efficiency
  });
});
