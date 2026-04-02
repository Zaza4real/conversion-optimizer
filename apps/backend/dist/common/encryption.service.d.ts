export declare class EncryptionService {
    private readonly key;
    constructor(secret: string);
    encrypt(plaintext: string): Buffer;
    decrypt(ciphertext: Buffer): string;
}
