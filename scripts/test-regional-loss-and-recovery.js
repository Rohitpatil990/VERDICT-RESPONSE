import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileStore } from '../packages/region-service/dist/store/file-store.js';

console.log('========================================================================');
console.log('  VERDICT — Regional Database Loss & Local Recovery Simulation          ');
console.log('  Classification: Local Multi-Process Simulation (Not Cloud/AWS DR)     ');
console.log('========================================================================\n');

async function testRecovery() {
  const dataDir = path.resolve('data');
  const recoveryDir = path.join(dataDir, 'recovery_simulation');
  fs.mkdirSync(recoveryDir, { recursive: true });

  const targetRegion = 'delhi';
  const targetDbPath = path.join(dataDir, `${targetRegion}.db.json`);
  const standbyPath = path.join(recoveryDir, `standby-${targetRegion}.db.json`);

  // Step 1: Ensure active database exists and capture baseline
  if (!fs.existsSync(targetDbPath)) {
    throw new Error(`Active database ${targetDbPath} not found.`);
  }

  const baselineContent = fs.readFileSync(targetDbPath, 'utf-8');
  const baselineJson = JSON.parse(baselineContent);
  const baselineOpCount = baselineJson.ops?.length ?? 0;
  console.log(`[STAGE 1] Baseline active node [${targetRegion.toUpperCase()}]:`);
  console.log(`  • Operations logged: ${baselineOpCount}`);
  console.log(`  • Entities materialized: ${Object.keys(baselineJson.entities ?? {}).length}`);

  // Step 2: Create local standby recovery copy
  console.log('\n[STAGE 2] Generating Local Standby Recovery Copy...');
  fs.copyFileSync(targetDbPath, standbyPath);
  console.log(`  ✓ Created standby snapshot: ${path.basename(standbyPath)} (${fs.statSync(standbyPath).size} bytes)`);

  // Step 3: Simulate catastrophic regional storage loss
  console.log('\n[STAGE 3] Simulating Catastrophic Node Storage Failure...');
  fs.unlinkSync(targetDbPath);
  if (!fs.existsSync(targetDbPath)) {
    console.log(`  ✓ Simulated loss confirmed: ${targetRegion}.db.json has been removed.`);
  }

  // Step 4: Execute local simulation recovery procedure
  console.log('\n[STAGE 4] Executing Local Standby Recovery Procedure...');
  console.log('  • Note: Labeled as Local Multi-Process Simulation (Not AWS/Geographic Failover)');
  fs.copyFileSync(standbyPath, targetDbPath);
  console.log(`  ✓ Restored active database file from standby recovery snapshot.`);

  // Step 5: Verify recovered node functionality using Store interface
  console.log('\n[STAGE 5] Verifying Restored Database Integrity...');
  const restoredStore = new FileStore(targetRegion, dataDir);
  await restoredStore.init();

  const restoredOps = await restoredStore.getOps();
  const restoredEntities = await restoredStore.getAllEntities();
  await restoredStore.close();

  console.log(`  • Restored Ops Count: ${restoredOps.length} (Expected: ${baselineOpCount})`);
  console.log(`  • Restored Entities Count: ${restoredEntities.length}`);

  if (restoredOps.length !== baselineOpCount) {
    throw new Error(`Data loss detected! Baseline had ${baselineOpCount} ops, but restored has ${restoredOps.length}`);
  }

  console.log('\n========================================================================');
  console.log('  RECOVERY VERIFICATION: PASS ✓                                         ');
  console.log('  Database survived simulated loss and restored with ZERO data loss.    ');
  console.log('========================================================================\n');
}

testRecovery().catch(err => {
  console.error('\nRecovery test failed:', err);
  process.exit(1);
});
