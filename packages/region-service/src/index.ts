import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildServer } from './server.js';
import { FileStore } from './store/file-store.js';
import { SyncEngine } from './sync/sync-engine.js';
import { LinkController } from './network/link-controller.js';

async function main() {
  const regionId = process.env.REGION || 'mumbai';
  const port = parseInt(process.env.PORT || '4001', 10);
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

  // Load config
  const configPath = path.resolve(process.cwd(), 'config/regions.json');
  let config: any = {};
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  } catch {
    config = {
      regions: [
        { id: 'mumbai', name: 'Mumbai', port: 4001, authority: true, coordinates: { lat: 19.076, lng: 72.8777 }, radiusKm: 45 },
        { id: 'delhi', name: 'Delhi', port: 4002, authority: false, coordinates: { lat: 28.6139, lng: 77.209 }, radiusKm: 50 },
        { id: 'bengaluru', name: 'Bengaluru', port: 4003, authority: false, coordinates: { lat: 12.9716, lng: 77.5946 }, radiusKm: 40 }
      ]
    };
  }

  const territories = config.regions.map((r: any) => ({
    region: r.id,
    center: r.coordinates,
    radiusKm: r.radiusKm
  }));

  const linkController = new LinkController();
  const store = new FileStore(regionId, dataDir);
  await store.init();

  const syncEngine = new SyncEngine(regionId, store, config.regions, linkController);
  await syncEngine.init();

  // Periodic heartbeat replication loop
  setInterval(async () => {
    try {
      await syncEngine.stepHeartbeat();
    } catch (err) {
      // transient heartbeat error
    }
  }, 1500);

  const server = buildServer({
    regionId,
    port,
    store,
    syncEngine,
    linkController,
    peers: config.regions,
    territories
  });

  await server.listen({ port, host: '0.0.0.0' });
  console.log(`[VERDICT] Regional Node [${regionId.toUpperCase()}] running on http://127.0.0.1:${port}`);
}

main().catch(err => {
  console.error('Fatal error starting regional service:', err);
  process.exit(1);
});
