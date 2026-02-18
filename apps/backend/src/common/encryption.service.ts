import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Encrypts access tokens at rest. Uses AES-256-GCM with a key derived from ENCRYPTION_KEY.
 * ENCRYPTION_KEY should be a 32+ character secret or a hex string (32 bytes = 64 hex chars).
 */
export class EncryptionService {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    this.key = secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)
      ? Buffer.from(secret, 'hex')
      : scryptSync(secret, 'conversion_optimizer_salt', 32);
  }

  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  decrypt(ciphertext: Buffer): string {
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
