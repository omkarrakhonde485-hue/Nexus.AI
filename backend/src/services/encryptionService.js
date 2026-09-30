import crypto from 'crypto';
import { env } from '../config/env.js';

let cachedKeyBuffer = null;

function getKeyBuffer() {
  if (cachedKeyBuffer) return cachedKeyBuffer;

  const rawKey = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY environment variable is missing.');
  }

  let keyBuffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'hex');
  } else {
    keyBuffer = Buffer.from(rawKey, 'utf8');
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). Current length is ${keyBuffer.length} bytes.`
    );
  }

  cachedKeyBuffer = keyBuffer;
  return cachedKeyBuffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} text - Plaintext to encrypt
 * @returns {string} - Serialized payload format: v1:iv:authTag:ciphertext
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Encryption payload must be a non-empty string.');
  }

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM serialized payload
 * @param {string} payload - Serialized payload format: v1:iv:authTag:ciphertext
 * @returns {string} - Decrypted plaintext string
 */
export function decrypt(payload) {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Decryption payload must be a non-empty string.');
  }

  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid or unsupported encrypted payload format.');
  }

  const [, ivHex, tagHex, ciphertextHex] = parts;
  const key = getKeyBuffer();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export const encryptionService = {
  encrypt,
  decrypt,
};
