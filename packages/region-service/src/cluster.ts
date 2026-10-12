import { createRegionServer } from './server.js';
import type { RegionId } from '@verdict/core';

async function startCluster() {
  console.log('--- STARTING VERDICT RESPONSE MULTI-REGION CLUSTER ---');
  console.log('Deploying 3 independent regional services with genuine separate SQLite persistence stores:');
  console.log(' - Mumbai:    http://localhost:4001 (Store: data/mumbai.db)');
  console.log(' - Delhi:     http://localhost:4002 (Store: data/delhi.db)');
  console.log(' - Bengaluru: http://localhost:4003 (Store: data/bengaluru.db)');

  const mumbai = createRegionServer('mumbai', 4001);
  const delhi = createRegionServer('delhi', 4002);
  const bengaluru = createRegionServer('bengaluru', 4003);

  await mumbai.start();
  await delhi.start();
  await bengaluru.start();

  console.log('--- ALL 3 REGIONAL SERVICES ACTIVE AND INTER-LINKED ---');

  const cleanup = async () => {
    console.log('\nShutting down cluster...');
    await mumbai.stop();
    await delhi.stop();
    await bengaluru.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

if (process.argv[1]?.endsWith('cluster.js') || process.argv[1]?.endsWith('cluster.ts')) {
  startCluster().catch(err => {
    console.error('Failed to start cluster:', err);
    process.exit(1);
  });
}
