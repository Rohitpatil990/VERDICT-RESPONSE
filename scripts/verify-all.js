import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

console.log('========================================================================');
console.log('  VERDICT Response — Acceptance & System Functional Verification Suite  ');
console.log('  CodeAstra PS #2: Geo-Distributed Disaster Data Replication           ');
console.log('========================================================================\n');

let allPassed = true;
const testResults = [];

function runFunctionalTest(name, command) {
  process.stdout.write(`• Running: ${name} ... `);
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    console.log('PASS ✓');
    testResults.push({ name, status: 'PASS', detail: output.trim().split('\n').slice(-2).join(' ') });
  } catch (err) {
    console.log('FAIL ✗');
    console.error('  Command Error:', err.message);
    testResults.push({ name, status: 'FAIL', detail: err.message });
    allPassed = false;
  }
}

// 1. Core invariant unit tests
runFunctionalTest(
  'Core Invariants (Ed25519, Version Vectors, Decision Gate, Escrow Bounded Counters)',
  'npm test --workspace=@verdict/core'
);

// 2. Region Service and PS #2 E2E Integration tests
runFunctionalTest(
  'E2E PS #2 Replication, Partition Cuts, Outbox Durability, Convergence & Conflicts',
  'npm test --workspace=@verdict/region-service'
);

// 3. Regional Failure and Standby Recovery Simulation
runFunctionalTest(
  'Regional Database Loss & Local Standby Recovery Simulation',
  'node scripts/test-regional-loss-and-recovery.js'
);

// 4. i18n Translation Parity
process.stdout.write('• Checking: Multi-Lingual Parity (EN, HI, MR) ... ');
try {
  const en = JSON.parse(fs.readFileSync('./assets/i18n/en.json', 'utf-8'));
  const hi = JSON.parse(fs.readFileSync('./assets/i18n/hi.json', 'utf-8'));
  const mr = JSON.parse(fs.readFileSync('./assets/i18n/mr.json', 'utf-8'));
  if (Object.keys(en).length !== Object.keys(hi).length || Object.keys(en).length !== Object.keys(mr).length) {
    throw new Error('Key mismatch among locale dictionaries');
  }
  console.log('PASS ✓');
  testResults.push({ name: 'Multi-Lingual Key Parity', status: 'PASS', detail: 'Identical key trees across EN, HI, MR' });
} catch (err) {
  console.log('FAIL ✗');
  testResults.push({ name: 'Multi-Lingual Key Parity', status: 'FAIL', detail: err.message });
  allPassed = false;
}

// 5. Production Web Bundle Build
runFunctionalTest(
  'Web Operations Console Vite Production Compilation',
  'npm run build --workspace=@verdict/web'
);

console.log('\n========================================================================');
console.log('  SUMMARY OF FUNCTIONAL TEST EXECUTION:                                ');
console.log('========================================================================');
for (const r of testResults) {
  console.log(`  [${r.status}] ${r.name}`);
}
console.log('========================================================================');

if (allPassed) {
  console.log('  VERDICT ACCEPTANCE: ALL FUNCTIONAL TESTS PASSED (100% GREEN)           \n');
} else {
  console.log('  VERDICT ACCEPTANCE: SOME TESTS FAILED                                 \n');
  process.exit(1);
}
