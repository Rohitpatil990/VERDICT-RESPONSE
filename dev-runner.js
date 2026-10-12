import { spawn } from 'node:child_process';
import { createRegionServer } from './packages/region-service/dist/server.js';

async function startVerdictSystem() {
  console.log('================================================================');
  console.log('  VERDICT RESPONSE — GEO-DISTRIBUTED DISASTER DATA PLATFORM    ');
  console.log('  PS #2: Geo-Distributed Disaster Data Replication              ');
  console.log('================================================================');

  // 1. Boot 3 independent regional backend nodes
  const mumbai = createRegionServer('mumbai', 4001);
  const delhi = createRegionServer('delhi', 4002);
  const bengaluru = createRegionServer('bengaluru', 4003);

  await mumbai.start();
  await delhi.start();
  await bengaluru.start();

  console.log('✔ Region MUMBAI:    http://localhost:4001 (DB: data/mumbai.db)');
  console.log('✔ Region DELHI:     http://localhost:4002 (DB: data/delhi.db)');
  console.log('✔ Region BENGALURU: http://localhost:4003 (DB: data/bengaluru.db)');

  // 2. Launch Vite dashboard dev server
  console.log('\nStarting Vite Dashboard...');
  const viteProcess = spawn('npx', ['vite', 'packages/dashboard', '--port', '3000', '--host'], {
    stdio: 'inherit',
    shell: true
  });

  const cleanup = async () => {
    console.log('\nShutting down VERDICT Response...');
    viteProcess.kill();
    await mumbai.stop();
    await delhi.stop();
    await bengaluru.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startVerdictSystem().catch(err => {
  console.error('Failed to launch system:', err);
  process.exit(1);
});
