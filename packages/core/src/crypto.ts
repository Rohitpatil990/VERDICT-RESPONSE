import crypto from 'node:crypto';
import type { Operation, RegionId } from './types.js';

/**
 * Deterministically serialize any JSON object by recursively sorting keys.
 */
export function canonicalJson(obj: any): string {
  if (obj === undefined) {
    return 'null';
  }
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',') + ']';
  }
  const definedKeys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  const pairs = definedKeys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute SHA-256 hash formatted as hex.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash an operation payload and metadata, strictly omitting 'hash' and 'sig'.
 */
export function computeOpHash(op: Omit<Operation, 'hash' | 'sig'>): string {
  const opToHash = {
    opId: op.opId,
    region: op.region,
    seq: op.seq,
    type: op.type,
    entityId: op.entityId,
    payload: op.payload,
    deps: op.deps,
    authorId: op.authorId,
    authorRole: op.authorRole,
    createdAt: op.createdAt,
    prevHash: op.prevHash
  };
  return sha256(canonicalJson(opToHash));
}

export interface RegionKeyPair {
  region: RegionId;
  publicKeyPem: string;
  privateKeyPem: string;
  rawPublicKeyHex: string;
}

/**
 * Pre-shared deterministic Ed25519 keys for the three regions so services can start up with known trusted keys.
 */
const REGION_SEEDS: Record<RegionId, string> = {
  mumbai: 'verdict-mumbai-master-ed25519-seed-001-mumbai-zone',
  delhi: 'verdict-delhi-master-ed25519-seed-002-delhi-command',
  bengaluru: 'verdict-bengaluru-master-ed25519-seed-003-blr-hub'
};

const KEYPAIR_CACHE: Partial<Record<RegionId, RegionKeyPair>> = {};

export function getRegionKeyPair(region: RegionId): RegionKeyPair {
  if (KEYPAIR_CACHE[region]) {
    return KEYPAIR_CACHE[region]!;
  }
  // Generate deterministic key from seed using SHA-256 as entropy input
  const seedHash = crypto.createHash('sha256').update(REGION_SEEDS[region]).digest();
  
  // PKCS#8 private key DER prefix for Ed25519
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privateKeyDer = Buffer.concat([pkcs8Prefix, seedHash]);
  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8'
  });
  
  const publicKey = crypto.createPublicKey(privateKey);
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const rawPublicKeyHex = sha256(publicKeyPem).slice(0, 32);

  const keyPair: RegionKeyPair = {
    region,
    publicKeyPem,
    privateKeyPem,
    rawPublicKeyHex
  };
  KEYPAIR_CACHE[region] = keyPair;
  return keyPair;
}

export function signHash(hashHex: string, privateKeyPem: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(hashHex, 'hex'), privateKey);
  return sig.toString('hex');
}

export function verifyHashSignature(hashHex: string, signatureHex: string, publicKeyPem: string): boolean {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(hashHex, 'hex'), publicKey, Buffer.from(signatureHex, 'hex'));
  } catch (err) {
    return false;
  }
}

/**
 * Calculates a Merkle root over an array of leaf hashes (or key-value state entries).
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return sha256('EMPTY_STATE');
  }
  let currentLevel = [...hashes].sort();
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(sha256(currentLevel[i] + currentLevel[i + 1]));
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}
