import { spawn } from 'node:child_process';

console.log('[SEED] Running database seed for all regional nodes...');
const p = spawn('node', ['packages/region-service/dist/seed.js'], {
  stdio: 'inherit',
  shell: true
});

p.on('exit', (code) => {
  if (code === 0) {
    console.log('[SEED] Successfully seeded Mumbai, Delhi, and Bengaluru databases.');
  } else {
    console.error(`[SEED] Seeding exited with code ${code}`);
    process.exit(code || 1);
  }
});
