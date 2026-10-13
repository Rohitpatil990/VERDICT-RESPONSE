import { buildGateway } from './gateway.js';

async function main() {
  const port = parseInt(process.env.GATEWAY_PORT || '4000', 10);
  const gateway = buildGateway({ port });

  await gateway.listen();

  process.on('SIGINT', async () => {
    console.log('\nShutting down VERDICT Gateway...');
    await gateway.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error starting gateway:', err);
  process.exit(1);
});
