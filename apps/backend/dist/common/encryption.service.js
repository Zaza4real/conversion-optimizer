"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
class EncryptionService {
    constructor(secret) {
        if (!secret || secret.length < 32) {
            throw new Error('ENCRYPTION_KEY must be at least 32 characters');
        }
        this.key = secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)
            ? Buffer.from(secret, 'hex')
            : (0, crypto_1.scryptSync)(secret, 'conversion_optimizer_salt', 32);
    }
    encrypt(plaintext) {
        const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
        const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, encrypted]);
    }
    decrypt(ciphertext) {
        const iv = ciphertext.subarray(0, IV_LENGTH);
        const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);
        const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
        decipher.setAuthTag(tag);
        return decipher.update(encrypted) + decipher.final('utf8');
    }
}
exports.EncryptionService = EncryptionService;
