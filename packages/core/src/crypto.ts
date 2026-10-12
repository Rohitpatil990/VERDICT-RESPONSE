import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as ed from '@noble/ed25519';
import { canonicalJson } from './canonical.js';
import { Operation } from './types.js';

export async function getPublicKey(privateKeyHex: string): Promise<string> {
  const privBytes = hexToBytes(privateKeyHex);
  const pubBytes = await ed.getPublicKeyAsync(privBytes);
  return bytesToHex(pubBytes);
}

// Pre-shared deterministic private keys
export const SEED_PRIVATE_KEYS: Record<string, string> = {
  mumbai: '1111111111111111111111111111111111111111111111111111111111111111',
  delhi: '2222222222222222222222222222222222222222222222222222222222222222',
  bengaluru: '3333333333333333333333333333333333333333333333333333333333333333',
  reviewer_alice: '4444444444444444444444444444444444444444444444444444444444444444'
};


/**
 * Calculates SHA-256 hash of an operation (excluding hash and sig)
 */
export function calculateOpHash(op: Omit<Operation, 'hash' | 'sig'>): string {
  const content = {
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
  const cjson = canonicalJson(content);
  const hashBytes = sha256(new TextEncoder().encode(cjson));
  return bytesToHex(hashBytes);
}

/**
 * Signs a hex hash with Ed25519 private key
 */
export async function signHash(hashHex: string, privateKeyHex: string): Promise<string> {
  const privBytes = hexToBytes(privateKeyHex);
  const hashBytes = hexToBytes(hashHex);
  const sigBytes = await ed.signAsync(hashBytes, privBytes);
  return bytesToHex(sigBytes);
}

/**
 * Verifies Ed25519 signature of a hash
 */
export async function verifySignature(hashHex: string, sigHex: string, publicKeyHex: string): Promise<boolean> {
  try {
    const pubBytes = hexToBytes(publicKeyHex);
    const hashBytes = hexToBytes(hashHex);
    const sigBytes = hexToBytes(sigHex);
    return await ed.verifyAsync(sigBytes, hashBytes, pubBytes);
  } catch {
    return false;
  }
}

/**
 * Helper to build and sign an operation
 */
export async function createSignedOp(
  params: Omit<Operation, 'hash' | 'sig'>,
  privateKeyHex: string
): Promise<Operation> {
  const hash = calculateOpHash(params);
  const sig = await signHash(hash, privateKeyHex);
  return {
    ...params,
    hash,
    sig
  };
}
