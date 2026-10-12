import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

console.log('[PACKAGE] Packaging VERDICT_Response_Project.zip...');

const zipPath = path.resolve('VERDICT_Response_Project.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Windows native tar creates zip files using -a (auto-compression by extension)
const cmd = 'tar.exe -a -c -f VERDICT_Response_Project.zip --exclude=node_modules --exclude=.git --exclude=*.zip --exclude=zip_verify packages assets config contracts data docs screenshots scripts README.md SETUP.md package.json package-lock.json docker-compose.yml .env.example';

try {
  execSync(cmd, { stdio: 'inherit' });
  const stat = fs.statSync(zipPath);
  console.log(`[PACKAGE] Successfully created ${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
} catch (err) {
  console.error('[PACKAGE] Failed to create ZIP archive:', err.message);
  process.exit(1);
}
