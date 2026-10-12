import fs from 'node:fs';
import path from 'node:path';
import { SqliteStore } from './store.js';
import type { RegionId, Operation, ReportPayload, FactPayload, ResourceClaimPayload, PersonStatusPayload } from '@verdict/core';
import { computeOpHash, signHash, getRegionKeyPair, canonicalJson } from '@verdict/core';

async function seedData() {
  console.log('--- SEEDING SYNTHETIC DISASTER DATA VIA SIGNED OP PIPELINE ---');

  const gazetteerPath = path.resolve(process.cwd(), 'assets', 'seed_gazetteer.json');
  const gazetteer = JSON.parse(fs.readFileSync(gazetteerPath, 'utf8'));

  const mumbaiStore = new SqliteStore('mumbai');
  const delhiStore = new SqliteStore('delhi');
  const blrStore = new SqliteStore('bengaluru');

  const mumbaiKp = getRegionKeyPair('mumbai');
  const delhiKp = getRegionKeyPair('delhi');
  const blrKp = getRegionKeyPair('bengaluru');

  // 1. Initial Flood Reports in Mumbai
  const reports: Array<{ store: SqliteStore; kp: any; payload: ReportPayload }> = [
    {
      store: mumbaiStore,
      kp: mumbaiKp,
      payload: {
        incidentId: 'inc-mumbai-kurla-flood',
        incidentType: 'flood',
        description: {
          original: {
            lang: 'mr',
            text: 'कुर्ला पश्चिम रेल्वे स्थानक भागात ३ फूट पाणी साचले आहे. वाहतूक पूर्णपणे थांबली आहे.'
          }
        },
        location: {
          lat: 19.0688,
          lng: 72.8795,
          source: 'GPS_DEVICE',
          accuracyM: 4,
          placeText: 'Kurla West Station Junction'
        },
        observedAt: new Date(Date.now() - 12 * 60000).toISOString(),
        severity: { value: 'CRITICAL', source: 'CONFIRMED' },
        source: {
          kind: 'person',
          id: 'officer-pawar',
          displayName: 'Inspector Ramesh Pawar',
          tier: 'FIELD_OFFICER'
        },
        channel: 'FORM'
      }
    },
    {
      store: mumbaiStore,
      kp: mumbaiKp,
      payload: {
        incidentId: 'inc-mumbai-dharavi-stranded',
        incidentType: 'stranded_people',
        description: {
          original: {
            lang: 'hi',
            text: 'धारावी ट्रांजिट कैंप के पास 15 परिवार पानी में घिरे हैं। तत्काल नाव की आवश्यकता है।'
          }
        },
        location: {
          lat: 19.0434,
          lng: 72.8567,
          source: 'GPS_DEVICE',
          accuracyM: 6,
          placeText: 'Dharavi Transit Camp'
        },
        observedAt: new Date(Date.now() - 25 * 60000).toISOString(),
        severity: { value: 'CRITICAL', source: 'CONFIRMED' },
        source: {
          kind: 'team',
          id: 'mumbai-rescue-team-4',
          displayName: 'Mumbai Fire & Rescue Team 4',
          tier: 'FIELD_OFFICER'
        },
        channel: 'FORM'
      }
    },
    {
      store: mumbaiStore,
      kp: mumbaiKp,
      payload: {
        incidentId: 'inc-mumbai-powai-overflow',
        incidentType: 'flood',
        description: {
          original: {
            lang: 'en',
            text: 'Powai Lake spillway overflowing onto JVLR arterial road. Water level rising 5cm/hr.'
          }
        },
        location: {
          lat: 19.1246,
          lng: 72.9051,
          source: 'MANUAL_PIN',
          accuracyM: 10,
          placeText: 'Powai Lake Promenade'
        },
        observedAt: new Date(Date.now() - 40 * 60000).toISOString(),
        severity: { value: 'HIGH', source: 'CONFIRMED' },
        source: {
          kind: 'sensor',
          id: 'sensor-powai-hydro-01',
          displayName: 'Powai Automated Hydro Gauge',
          tier: 'OFFICIAL_SENSOR'
        },
        channel: 'SENSOR'
      }
    }
  ];

  for (const item of reports) {
    const seq = item.store.getNextSeq();
    const prevHash = item.store.getLatestHash();
    const opId = `${item.store.region}:${seq}`;

    const partialOp = {
      opId,
      region: item.store.region,
      seq,
      type: 'REPORT' as const,
      entityId: item.payload.incidentId,
      payload: item.payload,
      deps: item.store.getVersionVector(),
      authorId: item.payload.source.id,
      authorRole: 'FIELD_OFFICER' as const,
      createdAt: new Date().toISOString(),
      prevHash
    };

    const hash = computeOpHash(partialOp);
    const sig = signHash(hash, item.kp.privateKeyPem);
    const op: Operation = { ...partialOp, hash, sig };
    item.store.appendLocalOperation(op);
  }

  // 2. Initial Road Facts
  const roads = gazetteer.roads || [];
  for (const road of roads) {
    const seq = mumbaiStore.getNextSeq();
    const prevHash = mumbaiStore.getLatestHash();
    const opId = `mumbai:${seq}`;

    const factPayload: FactPayload = {
      factType: 'ROAD_STATUS',
      roadId: road.id,
      status: road.defaultStatus,
      reportedReason: 'Monsoon high water surge assessment'
    };

    const partialOp = {
      opId,
      region: 'mumbai' as RegionId,
      seq,
      type: 'FACT' as const,
      entityId: road.id,
      payload: factPayload,
      deps: mumbaiStore.getVersionVector(),
      authorId: 'traffic-police-mumbai',
      authorRole: 'OFFICIAL' as const,
      createdAt: new Date().toISOString(),
      prevHash
    };

    const hash = computeOpHash(partialOp);
    const sig = signHash(hash, mumbaiKp.privateKeyPem);
    mumbaiStore.appendLocalOperation({ ...partialOp, hash, sig });
  }

  // 3. Person Status (Monotone)
  const personOp1 = {
    opId: `mumbai:${mumbaiStore.getNextSeq()}`,
    region: 'mumbai' as RegionId,
    seq: mumbaiStore.getNextSeq(),
    type: 'PERSON_STATUS' as const,
    entityId: 'person-sunil-kamble',
    payload: {
      personId: 'person-sunil-kamble',
      fullName: 'Sunil Kamble',
      status: 'MISSING',
      lastSeenLocation: 'Kurla Station'
    } as PersonStatusPayload,
    deps: mumbaiStore.getVersionVector(),
    authorId: 'kamble-family',
    authorRole: 'VOLUNTEER' as const,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    prevHash: mumbaiStore.getLatestHash()
  };
  const hP1 = computeOpHash(personOp1);
  mumbaiStore.appendLocalOperation({ ...personOp1, hash: hP1, sig: signHash(hP1, mumbaiKp.privateKeyPem) });

  console.log('Seeded synthetic data:');
  console.log(` - Mumbai store ops: ${mumbaiStore.getAllOps().length}`);
  console.log(` - Delhi store ops: ${delhiStore.getAllOps().length}`);
  console.log(` - Bengaluru store ops: ${blrStore.getAllOps().length}`);
  console.log('Seed completed successfully.');
}

seedData().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
