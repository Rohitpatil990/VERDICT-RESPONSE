import { runIsolatedRecoveryVerification } from '../packages/region-service/dist/recovery/recovery-harness.js';

console.log('========================================================================');
console.log('  VERDICT — RECOVERY-PROOF: Measured Recovery Verification Harness      ');
console.log('  Classification: Local Multi-Process Simulation (Not AWS/Cloud DR)     ');
console.log('========================================================================\n');

async function main() {
  console.log('[1/4] Initializing isolated test harness in OS temp workspace...');
  console.log('      (Guaranteed: Live demo databases are NOT touched)\n');

  const scorecard = await runIsolatedRecoveryVerification();

  console.log('[2/4] Scenario Execution Timeline:');
  console.log(`      • Scenario: ${scorecard.scenarioName}`);
  console.log(`      • Start Time: ${new Date(scorecard.startTime).toISOString()}`);
  console.log(`      • Service Restoration Time: ${scorecard.restorationTimeMs} ms`);
  console.log(`      • Cross-Region Sync Time:   ${scorecard.syncTimeMs} ms`);
  console.log(`      • Time to Convergence:      ${scorecard.timeToConvergenceMs} ms\n`);

  console.log('[3/4] Availability During Scenario:');
  console.log(`      • Baseline:     ${scorecard.availability.baseline}`);
  console.log(`      • During Outage: ${scorecard.availability.duringOutage}`);
  console.log(`      • Post-Recovery: ${scorecard.availability.postRecovery}\n`);

  console.log('[4/4] Measured Continuity & Invariant Metrics:');
  console.log(`      • Acknowledged Writes Tested:    ${scorecard.metrics.acknowledgedWritesTested}`);
  console.log(`      • Acknowledged Writes Preserved:  ${scorecard.metrics.acknowledgedWritesPreserved} (${scorecard.metrics.preservationRatePct}%)`);
  console.log(`      • Missing / Lost Writes:         ${scorecard.metrics.missingWrites}`);
  console.log(`      • Duplicates Prevented:          ${scorecard.metrics.duplicatesPrevented}`);
  console.log(`      • Pending Outbox Operations:     ${scorecard.metrics.pendingOperationsRemaining}`);
  console.log(`      • Conflicts Detected:            ${scorecard.metrics.conflictsDetected}`);
  console.log(`      • Conflicts Awaiting Review:     ${scorecard.metrics.conflictsAwaitingReview}`);
  console.log(`      • Canonical State Hash Match:    ${scorecard.metrics.stateHashMatch ? 'YES (Verified)' : 'NO'}\n`);

  console.log('========================================================================');
  console.log(`  FINAL VERDICT: ${scorecard.verdict === 'PASS' ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  ${scorecard.details}`);
  console.log('========================================================================\n');

  if (scorecard.verdict !== 'PASS') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Recovery proof test failed:', err);
  process.exit(1);
});
