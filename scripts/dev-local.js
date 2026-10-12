import { spawn } from 'node:child_process';
import * as path from 'node:path';

console.log('================================================================');
console.log('  VERDICT Response — Geo-Distributed Multi-Region Deployment   ');
console.log('================================================================');

const procs = [];

function startProcess(name, cmd, args, env = {}) {
  const p = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env }
  });
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[${name}] Exited with code ${code}`);
    }
  });
  procs.push(p);
  return p;
}

// 1. Mumbai (Authority) Port 4001
console.log('[SPAWN] Starting Regional Node MUMBAI on port 4001...');
startProcess('MUMBAI', 'node', ['packages/region-service/dist/index.js'], {
  REGION: 'mumbai',
  PORT: '4001'
});

// 2. Delhi Port 4002
console.log('[SPAWN] Starting Regional Node DELHI on port 4002...');
startProcess('DELHI', 'node', ['packages/region-service/dist/index.js'], {
  REGION: 'delhi',
  PORT: '4002'
});

// 3. Bengaluru Port 4003
console.log('[SPAWN] Starting Regional Node BENGALURU on port 4003...');
startProcess('BENGALURU', 'node', ['packages/region-service/dist/index.js'], {
  REGION: 'bengaluru',
  PORT: '4003'
});

// 4. Web Console Port 3000
console.log('[SPAWN] Starting Web Operations Console on port 3000...');
startProcess('WEB', 'npm', ['run', 'dev', '--workspace=@verdict/web', '--', '--host', '127.0.0.1'], {
  NODE_ENV: 'development'
});

console.log('\n[ONLINE] All services active:');
console.log('  • Web Console:   http://localhost:3000');
console.log('  • Mumbai API:    http://localhost:4001/api/v1/status');
console.log('  • Delhi API:     http://localhost:4002/api/v1/status');
console.log('  • Bengaluru API: http://localhost:4003/api/v1/status');
console.log('\nPress Ctrl+C to terminate all services.\n');

process.on('SIGINT', () => {
  console.log('\nStopping all VERDICT regional nodes...');
  for (const p of procs) {
    try { p.kill(); } catch {}
  }
  process.exit(0);
});
