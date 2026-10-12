import * as fs from 'node:fs';
import * as path from 'node:path';

const dataDir = path.resolve('data');
const backupsDir = path.join(dataDir, 'backups');
const recoverySimDir = path.join(dataDir, 'recovery_simulation');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const currentBackupDir = path.join(backupsDir, `backup-${timestamp}`);

fs.mkdirSync(currentBackupDir, { recursive: true });
fs.mkdirSync(recoverySimDir, { recursive: true });

console.log(`[BACKUP] Backing up existing database files to ${currentBackupDir}...`);

const files = ['mumbai.db.json', 'delhi.db.json', 'bengaluru.db.json'];
let backedUpCount = 0;

for (const f of files) {
  const src = path.join(dataDir, f);
  if (fs.existsSync(src)) {
    const dest = path.join(currentBackupDir, f);
    fs.copyFileSync(src, dest);
    // Also save a recovery replica in recovery_simulation
    const recDest = path.join(recoverySimDir, `recovery-${f}`);
    fs.copyFileSync(src, recDest);
    console.log(`  ✓ Backed up ${f} (${fs.statSync(src).size} bytes)`);
    backedUpCount++;
  }
}

console.log(`[BACKUP] Completed backup of ${backedUpCount} regional database(s).`);

// Reset current active databases to clean slate
for (const f of files) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`  ✓ Cleared active file: ${f}`);
  }
}

// Write initial clean snapshot for each region
const initialSnapshot = {
  ops: [],
  entities: {},
  escrow: {
    medical_kits: {
      resource: "medical_kits",
      total: 5,
      rights: { mumbai: 3, delhi: 2, bengaluru: 0 },
      spent: {},
      unmetQueue: []
    },
    emergency_rations: {
      resource: "emergency_rations",
      total: 10,
      rights: { mumbai: 5, delhi: 3, bengaluru: 2 },
      spent: {},
      unmetQueue: []
    }
  },
  decisions: {},
  peers: {},
  outbox: [],
  episodes: []
};

for (const region of ['mumbai', 'delhi', 'bengaluru']) {
  const filePath = path.join(dataDir, `${region}.db.json`);
  fs.writeFileSync(filePath, JSON.stringify(initialSnapshot, null, 2), 'utf-8');
  console.log(`  ✓ Initialized fresh clean database for [${region.toUpperCase()}]`);
}

console.log('\n[RESET] Demo state safely reset to fresh initial baseline.');
console.log('Old incidents, conflicts, pending outbox, and simulation state cleared.\n');
