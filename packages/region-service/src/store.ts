import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { 
  Operation, 
  RegionId, 
  VersionVector, 
  OpReceipt, 
  RoundCertificate 
} from '@verdict/core';
import { 
  computeOpHash, 
  computeMerkleRoot, 
  verifyHashSignature, 
  getRegionKeyPair, 
  canonicalJson,
  sha256 
} from '@verdict/core';

export interface OutboxItem {
  id: number;
  opId: string;
  destRegion: RegionId;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  createdAt: string;
}

export class SqliteStore {
  private db: DatabaseSync;
  public region: RegionId;

  constructor(region: RegionId, dbPath?: string) {
    this.region = region;
    const resolvedPath = dbPath || path.resolve(process.cwd(), 'data', `${region}.db`);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(resolvedPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        opId TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        entityId TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        deps_json TEXT NOT NULL,
        authorId TEXT NOT NULL,
        authorRole TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        prevHash TEXT NOT NULL,
        hash TEXT NOT NULL,
        sig TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_ops_region_seq ON operations(region, seq);
      CREATE INDEX IF NOT EXISTS idx_ops_entity ON operations(entityId);
      CREATE INDEX IF NOT EXISTS idx_ops_type ON operations(type);

      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opId TEXT NOT NULL,
        destRegion TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempts INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_dest_status ON outbox(destRegion, status);

      CREATE TABLE IF NOT EXISTS receipts (
        opId TEXT NOT NULL,
        receivedByRegion TEXT NOT NULL,
        receivedAt TEXT NOT NULL,
        via TEXT NOT NULL,
        chainVerified INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (opId, receivedByRegion)
      );

      CREATE TABLE IF NOT EXISTS settled_rounds (
        round INTEGER PRIMARY KEY,
        certificate_json TEXT NOT NULL,
        stateRoot TEXT NOT NULL,
        closedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blobs (
        hash TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tampers (
        opId TEXT PRIMARY KEY,
        originalHash TEXT NOT NULL,
        originalPayload TEXT NOT NULL,
        tamperedHash TEXT NOT NULL,
        tamperedAt TEXT NOT NULL
      );
    `);
  }

  public close(): void {
    try { this.db.close(); } catch {}
  }

  public getNextSeq(): number {
    const row = this.db.prepare('SELECT MAX(seq) as maxSeq FROM operations WHERE region = ?').get(this.region) as { maxSeq: number | null };
    return (row?.maxSeq || 0) + 1;
  }

  public getLatestHash(): string {
    const row = this.db.prepare('SELECT hash FROM operations WHERE region = ? ORDER BY seq DESC LIMIT 1').get(this.region) as { hash?: string };
    return row?.hash || '0'.repeat(64);
  }

  public appendLocalOperation(op: Operation): void {
    const insertOp = this.db.prepare(`
      INSERT INTO operations (
        opId, region, seq, type, entityId, payload_json, deps_json, 
        authorId, authorRole, createdAt, prevHash, hash, sig, verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const insertOutbox = this.db.prepare(`
      INSERT INTO outbox (opId, destRegion, status, createdAt)
      VALUES (?, ?, 'PENDING', ?)
    `);

    const insertReceipt = this.db.prepare(`
      INSERT OR REPLACE INTO receipts (opId, receivedByRegion, receivedAt, via, chainVerified)
      VALUES (?, ?, ?, 'LOCAL', 1)
    `);

    const otherRegions: RegionId[] = (['mumbai', 'delhi', 'bengaluru'] as RegionId[]).filter(r => r !== this.region);
    const nowIso = new Date().toISOString();

    // Atomic transaction for op + local receipt + transactional outbox
    this.db.exec('BEGIN');
    try {
      insertOp.run(
        op.opId,
        op.region,
        op.seq,
        op.type,
        op.entityId,
        canonicalJson(op.payload),
        canonicalJson(op.deps),
        op.authorId,
        op.authorRole,
        op.createdAt,
        op.prevHash,
        op.hash,
        op.sig
      );

      insertReceipt.run(op.opId, this.region, nowIso);

      for (const dest of otherRegions) {
        insertOutbox.run(op.opId, dest, nowIso);
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public applyRemoteOperation(op: Operation, via: 'DIRECT' | 'RELAY'): { applied: boolean; verified: boolean } {
    // 1. Verify integrity before storing
    const kp = getRegionKeyPair(op.region);
    const expectedHash = computeOpHash(op);
    const hashValid = expectedHash === op.hash;
    const sigValid = verifyHashSignature(op.hash, op.sig, kp.publicKeyPem);
    const verified = hashValid && sigValid;

    const checkExisting = this.db.prepare('SELECT opId FROM operations WHERE opId = ?').get(op.opId);
    const nowIso = new Date().toISOString();

    this.db.exec('BEGIN');
    try {
      let applied = false;
      if (!checkExisting) {
        this.db.prepare(`
          INSERT INTO operations (
            opId, region, seq, type, entityId, payload_json, deps_json, 
            authorId, authorRole, createdAt, prevHash, hash, sig, verified
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          op.opId,
          op.region,
          op.seq,
          op.type,
          op.entityId,
          canonicalJson(op.payload),
          canonicalJson(op.deps),
          op.authorId,
          op.authorRole,
          op.createdAt,
          op.prevHash,
          op.hash,
          op.sig,
          verified ? 1 : 0
        );
        applied = true;
      }

      // Record receipt for this region
      this.db.prepare(`
        INSERT OR REPLACE INTO receipts (opId, receivedByRegion, receivedAt, via, chainVerified)
        VALUES (?, ?, ?, ?, ?)
      `).run(op.opId, this.region, nowIso, via, verified ? 1 : 0);

      this.db.exec('COMMIT');
      return { applied, verified };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getOp(opId: string): Operation | null {
    const row = this.db.prepare('SELECT * FROM operations WHERE opId = ?').get(opId) as any;
    if (!row) return null;
    return this.hydrateOp(row);
  }

  public getAllOps(): Operation[] {
    const rows = this.db.prepare('SELECT * FROM operations ORDER BY seq ASC').all() as any[];
    return rows.map(r => this.hydrateOp(r));
  }

  public getOpsByEntity(entityId: string): Operation[] {
    const rows = this.db.prepare('SELECT * FROM operations WHERE entityId = ? ORDER BY seq ASC').all(entityId) as any[];
    return rows.map(r => this.hydrateOp(r));
  }

  public getReceiptsForOp(opId: string): OpReceipt[] {
    const rows = this.db.prepare('SELECT * FROM receipts WHERE opId = ?').all(opId) as any[];
    return rows.map(r => ({
      opId: r.opId,
      region: r.receivedByRegion,
      receivedByRegion: r.receivedByRegion,
      receivedAt: r.receivedAt,
      via: r.via,
      chainVerified: r.chainVerified === 1
    }));
  }

  public getAllReceipts(): OpReceipt[] {
    const rows = this.db.prepare('SELECT * FROM receipts').all() as any[];
    return rows.map(r => ({
      opId: r.opId,
      region: r.receivedByRegion,
      receivedByRegion: r.receivedByRegion,
      receivedAt: r.receivedAt,
      via: r.via,
      chainVerified: r.chainVerified === 1
    }));
  }

  public getVersionVector(): VersionVector {
    const vector: VersionVector = { mumbai: 0, delhi: 0, bengaluru: 0 };
    const rows = this.db.prepare('SELECT region, MAX(seq) as maxSeq FROM operations GROUP BY region').all() as any[];
    for (const r of rows) {
      vector[r.region] = r.maxSeq || 0;
    }
    return vector;
  }

  public getPendingOutbox(destRegion: RegionId, limit = 100): Array<{ id: number; op: Operation }> {
    const rows = this.db.prepare(`
      SELECT o.id, ops.* 
      FROM outbox o
      JOIN operations ops ON o.opId = ops.opId
      WHERE o.destRegion = ? AND o.status = 'PENDING'
      ORDER BY ops.type = 'RESOURCE_CLAIM' DESC, ops.seq ASC
      LIMIT ?
    `).all(destRegion, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      op: this.hydrateOp(r)
    }));
  }

  public markOutboxSent(outboxIds: number[]): void {
    if (outboxIds.length === 0) return;
    const placeholders = outboxIds.map(() => '?').join(',');
    this.db.prepare(`UPDATE outbox SET status = 'SENT' WHERE id IN (${placeholders})`).run(...outboxIds);
  }

  public saveRoundCertificate(cert: RoundCertificate): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO settled_rounds (round, certificate_json, stateRoot, closedAt)
      VALUES (?, ?, ?, ?)
    `).run(cert.round, canonicalJson(cert), cert.stateRoot, cert.createdAt);
  }

  public getLatestRoundCertificate(): RoundCertificate | null {
    const row = this.db.prepare('SELECT certificate_json FROM settled_rounds ORDER BY round DESC LIMIT 1').get() as any;
    if (!row) return null;
    return JSON.parse(row.certificate_json);
  }

  public getAllRoundCertificates(): RoundCertificate[] {
    const rows = this.db.prepare('SELECT certificate_json FROM settled_rounds ORDER BY round ASC').all() as any[];
    return rows.map(r => JSON.parse(r.certificate_json));
  }

  public getStateRoot(): string {
    const rows = this.db.prepare('SELECT opId, hash FROM operations ORDER BY opId ASC').all() as any[];
    if (rows.length === 0) return sha256('EMPTY_STATE');
    const leafHashes = rows.map(r => sha256(r.opId + ':' + r.hash));
    return computeMerkleRoot(leafHashes);
  }

  public tamperOp(opId: string): { success: boolean; tamperedHash: string } {
    const op = this.getOp(opId);
    if (!op) return { success: false, tamperedHash: '' };

    // Deliberately flip the last byte of the hash and corrupt one character in payload
    const originalHash = op.hash;
    const flippedHash = originalHash.slice(0, -2) + (originalHash.endsWith('00') ? 'ff' : '00');
    const originalPayload = canonicalJson(op.payload);
    
    // Record tamper backup for heal demonstration
    this.db.prepare(`
      INSERT OR REPLACE INTO tampers (opId, originalHash, originalPayload, tamperedHash, tamperedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(opId, originalHash, originalPayload, flippedHash, new Date().toISOString());

    // Update in database with corrupted hash & marked unverified
    this.db.prepare(`
      UPDATE operations 
      SET hash = ?, verified = 0 
      WHERE opId = ?
    `).run(flippedHash, opId);

    return { success: true, tamperedHash: flippedHash };
  }

  public healOp(opId: string): { healed: boolean; originalHash: string } {
    const tamperRecord = this.db.prepare('SELECT * FROM tampers WHERE opId = ?').get(opId) as any;
    if (!tamperRecord) return { healed: false, originalHash: '' };

    this.db.prepare(`
      UPDATE operations 
      SET hash = ?, verified = 1 
      WHERE opId = ?
    `).run(tamperRecord.originalHash, opId);

    this.db.prepare('DELETE FROM tampers WHERE opId = ?').run(opId);
    return { healed: true, originalHash: tamperRecord.originalHash };
  }

  private hydrateOp(row: any): Operation {
    return {
      opId: row.opId,
      region: row.region,
      seq: row.seq,
      type: row.type,
      entityId: row.entityId,
      payload: JSON.parse(row.payload_json),
      deps: JSON.parse(row.deps_json),
      authorId: row.authorId,
      authorRole: row.authorRole,
      createdAt: row.createdAt,
      prevHash: row.prevHash,
      hash: row.hash,
      sig: row.sig
    };
  }
}
