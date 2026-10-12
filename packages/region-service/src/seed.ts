import * as path from 'node:path';
import { createEscrowResource } from '@verdict/core';
import { FileStore } from './store/file-store.js';
import { SyncEngine } from './sync/sync-engine.js';
import { LinkController } from './network/link-controller.js';

export async function seedRegion(regionId: string, port: number, dataDir: string) {
  console.log(`[SEED] Initializing clean PS #2 disaster dataset for [${regionId.toUpperCase()}]...`);
  const store = new FileStore(regionId, dataDir);
  await store.init();

  const peers = [
    { id: 'mumbai', name: 'Mumbai', port: 4001, authority: true },
    { id: 'delhi', name: 'Delhi', port: 4002, authority: false },
    { id: 'bengaluru', name: 'Bengaluru', port: 4003, authority: false }
  ];

  const sync = new SyncEngine(regionId, store, peers, new LinkController());
  await sync.init();

  // 1. Escrow Resources (Bounded counters for scarce resources)
  const medicalKits = createEscrowResource('medical_kits', 5, { mumbai: 3, delhi: 2, bengaluru: 0 });
  await store.saveEscrow(medicalKits);

  const rations = createEscrowResource('emergency_rations', 10, { mumbai: 5, delhi: 3, bengaluru: 2 });
  await store.saveEscrow(rations);

  // 2. Disrupted Transport Arteries / Access Routes
  const routes = [
    { id: 'access-corridor-north', name: 'Access Corridor North (Primary Supply Route)', lat: 19.0688, lng: 72.8800, status: 'OPEN' },
    { id: 'transit-artery-east', name: 'Transit Artery East', lat: 19.0558, lng: 72.8682, status: 'BLOCKED' },
    { id: 'evacuation-route-1', name: 'Evacuation Route Alpha', lat: 19.0620, lng: 72.8620, status: 'OPEN' },
    { id: 'coastal-access-corridor', name: 'Coastal Access Corridor', lat: 19.0710, lng: 72.8900, status: 'OPEN' },
    { id: 'inter-hub-highway-4', name: 'Inter-Hub Connector 4', lat: 19.0390, lng: 72.8619, status: 'OPEN' },
    { id: 'logistics-link-west', name: 'Logistics Link West', lat: 19.0580, lng: 72.8940, status: 'OPEN' }
  ];

  for (const r of routes) {
    await sync.submitLocalOp(
      'REPORT',
      r.id,
      {
        incidentId: r.id,
        incidentType: 'route_condition',
        name: r.name,
        location: { lat: r.lat, lng: r.lng, source: 'GPS_DEVICE' },
        status: r.status,
        observedAt: Date.now() - 1000 * 60 * 5,
        authority: 'mumbai',
        source: { tier: 'FIELD_OFFICER' }
      },
      'officer-1',
      'FIELD_OFFICER'
    );
  }

  // 3. Triage & Distribution Hubs
  const hubs = [
    { id: 'triage-hub-alpha', name: 'Regional Triage Hub Alpha', lat: 19.0657, lng: 72.8687, capacity: 500 },
    { id: 'distribution-center-1', name: 'Emergency Distribution Center 1', lat: 19.0645, lng: 72.8885, capacity: 350 },
    { id: 'medical-staging-base', name: 'Medical Staging Base South', lat: 19.0410, lng: 72.8640, capacity: 250 }
  ];

  for (const h of hubs) {
    await sync.submitLocalOp(
      'REPORT',
      h.id,
      {
        incidentId: h.id,
        incidentType: 'shelter',
        name: h.name,
        location: { lat: h.lat, lng: h.lng, source: 'MANUAL_PIN' },
        status: 'ACTIVE',
        capacity: h.capacity,
        observedAt: Date.now() - 1000 * 60 * 10,
        authority: 'mumbai',
        source: { tier: 'OFFICIAL_SENSOR' }
      },
      'admin-ops',
      'OFFICIAL'
    );
  }

  // 4. Incident #101: Core PS #2 Concurrent Adjudication Incident
  await sync.submitLocalOp(
    'REPORT',
    'incident-101',
    {
      incidentId: 'incident-101',
      incidentType: 'infrastructure_failure',
      name: 'Incident #101: Disrupted Transit Artery at Access Corridor North',
      description: { original: { lang: 'en', text: 'Bridge structural displacement detected. Structural assessment underway.' } },
      location: { lat: 19.0650, lng: 72.8790, source: 'GPS_DEVICE' },
      status: 'Investigating',
      observedAt: Date.now() - 1000 * 60 * 15,
      authority: 'mumbai',
      source: { tier: 'FIELD_OFFICER' }
    },
    'field-unit-mumbai',
    'FIELD_OFFICER'
  );

  // 5. Deployed Response Teams
  await sync.submitLocalOp(
    'REPORT',
    'team-alpha',
    {
      incidentId: 'team-alpha',
      incidentType: 'rescue_team',
      name: 'Regional Response Team Alpha',
      homeRegion: 'mumbai',
      location: { lat: 19.0600, lng: 72.8700, source: 'GPS_DEVICE' },
      status: 'ACTIVE',
      observedAt: Date.now(),
      authority: 'mumbai',
      source: { tier: 'FIELD_OFFICER' }
    },
    'dispatch-hq',
    'OFFICIAL'
  );

  // 6. Monotone Person Statuses
  for (let i = 1; i <= 10; i++) {
    const pId = `person-${i}`;
    const pStatus = i <= 8 ? 'Safe' : 'Missing';
    await sync.submitLocalOp(
      'PERSON_STATUS',
      pId,
      {
        personId: pId,
        name: `Civilian Personnel Record #${500 + i}`,
        status: pStatus,
        observedAt: Date.now() - 1000 * 60 * (i * 2)
      },
      'census-unit',
      'VOLUNTEER'
    );
  }

  await store.close();
  console.log(`[SEED] Finished seeding clean dataset for [${regionId.toUpperCase()}].`);
}

async function main() {
  const dataDir = path.resolve(process.cwd(), 'data');
  await seedRegion('mumbai', 4001, dataDir);
  await seedRegion('delhi', 4002, dataDir);
  await seedRegion('bengaluru', 4003, dataDir);
}

if (process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed.ts'))) {
  main().catch(console.error);
}
