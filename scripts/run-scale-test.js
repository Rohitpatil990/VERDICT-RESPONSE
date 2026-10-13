import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('>>> VERDICT 500-Region Scale Test CLI Initiated');

  // Dynamically import runner from built region-service
  const { ScaleWorkloadRunner } = await import('../packages/region-service/dist/scale/workload-harness.js');

  const runner = new ScaleWorkloadRunner({
    stages: [100, 250, 500],
    opsPerReplica: 2,
    duplicateRate: 0.10,
    concurrency: 20,
    randomSeed: 42,
    artifactsDir: path.join(rootDir, 'artifacts', 'scale-test')
  });

  const report = await runner.run();
  console.log('\n=======================================================');
  console.log('TEST SUMMARY:');
  console.log(`Run ID: ${report.runId}`);
  console.log(`Overall Passed: ${report.overallPassed}`);
  console.log(`Max Active Replicas: ${report.maxHealthyReplicas}`);
  console.log(`Total Operations: ${report.totalOpsProcessed}`);
  console.log('Artifacts saved to: artifacts/scale-test/');
  console.log('=======================================================\n');

  if (!report.overallPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running scale test:', err);
  process.exit(1);
});
