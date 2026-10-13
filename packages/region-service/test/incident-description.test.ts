import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileStore } from '../src/store/file-store.js';
import { SyncEngine } from '../src/sync/sync-engine.js';
import { LinkController } from '../src/network/link-controller.js';
import { buildServer } from '../src/server.js';
import { FastifyInstance } from 'fastify';

describe('Incident Description Preservation & Validation Suite', () => {
  const testDir = path.resolve('./data/test-incident-desc-' + Date.now());
  let app: FastifyInstance | null = null;
  let store: FileStore | null = null;
  let syncEngine: SyncEngine | null = null;
  let linkController: LinkController | null = null;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    store = new FileStore('mumbai', testDir);
    await store.init();
    linkController = new LinkController();
    syncEngine = new SyncEngine('mumbai', store, [], linkController);
    await syncEngine.init();
    app = buildServer({
      regionId: 'mumbai',
      port: 4998,
      store,
      syncEngine,
      linkController,
      peers: [],
      territories: []
    });
  });

  afterEach(async () => {
    if (app) await app.close();
    if (store) await store.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects incident submission when title or description is missing', async () => {
    // Missing title
    const resNoTitle = await app!.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityType: 'incident',
        title: '',
        description: 'Some description text'
      }
    });
    expect(resNoTitle.statusCode).toBe(400);
    const jsonNoTitle = JSON.parse(resNoTitle.payload);
    expect(jsonNoTitle.error).toContain('Validation Error');

    // Missing description
    const resNoDesc = await app!.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityType: 'incident',
        title: 'Bridge Closure',
        description: ''
      }
    });
    expect(resNoDesc.statusCode).toBe(400);
    const jsonNoDesc = JSON.parse(resNoDesc.payload);
    expect(jsonNoDesc.error).toContain('Validation Error');
  });

  it('creates incident and preserves exact description in API response and persistent store', async () => {
    const distinctiveText = 'Bridge access blocked after severe flooding; emergency vehicles need an alternate route.';
    const incidentTitle = 'Access Corridor North Flooding';

    const res = await app!.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        entityType: 'incident',
        title: incidentTitle,
        description: distinctiveText,
        status: 'Investigating'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.title).toBe(incidentTitle);
    expect(body.description).toBe(distinctiveText);
    expect(body.entityId).toBeDefined();

    // Verify entity in store
    const entity = await store!.getEntity(body.entityId);
    expect(entity).not.toBeNull();
    expect(entity?.attributes?.title).toBe(incidentTitle);
    expect(entity?.attributes?.description).toBe(distinctiveText);
    expect(entity?.attributes?.note).toBe(distinctiveText);

    // Verify GET /api/v1/records/:id returns full description
    const getRes = await app!.inject({
      method: 'GET',
      url: `/api/v1/records/${body.entityId}`
    });
    expect(getRes.statusCode).toBe(200);
    const fetchedEntity = JSON.parse(getRes.payload);
    expect(fetchedEntity.attributes?.description).toBe(distinctiveText);
    expect(fetchedEntity.attributes?.title).toBe(incidentTitle);

    // Verify entity in GET /api/v1/map
    const mapRes = await app!.inject({
      method: 'GET',
      url: '/api/v1/map'
    });
    expect(mapRes.statusCode).toBe(200);
    const mapBody = JSON.parse(mapRes.payload);
    const foundInMap = mapBody.entities.find((e: any) => e.entityId === body.entityId);
    expect(foundInMap).toBeDefined();
    expect(foundInMap.attributes?.description).toBe(distinctiveText);
  });

  it('re-folding operations from disk preserves the incident description after restart', async () => {
    const distinctiveText = 'Bridge access blocked after severe flooding; emergency vehicles need an alternate route.';
    const entityId = 'inc-restart-test-' + Date.now();

    await syncEngine!.submitLocalOp(
      'REPORT',
      entityId,
      {
        incidentId: entityId,
        title: 'Bridge Flooding Hazard',
        name: 'Bridge Flooding Hazard',
        description: { original: { lang: 'en', text: distinctiveText } },
        note: distinctiveText,
        status: 'BLOCKED'
      },
      'officer-mumbai'
    );

    // Close and re-open store to simulate process restart
    await store!.close();
    const restartedStore = new FileStore('mumbai', testDir);
    await restartedStore.init();

    const entity = await restartedStore.getEntity(entityId);
    expect(entity).not.toBeNull();
    expect(entity?.attributes?.description).toBe(distinctiveText);
    expect(entity?.attributes?.title).toBe('Bridge Flooding Hazard');
    await restartedStore.close();
  });
});
