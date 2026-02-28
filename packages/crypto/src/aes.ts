import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedPayload {
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
}

/**
 * Encrypt data using AES-256-GCM.
 * @param data - The plaintext data to encrypt
 * @param key - 32-byte encryption key
 * @returns Encrypted payload with IV and auth tag
 */
export function encrypt(data: Buffer, key: Buffer): EncryptedPayload {
    if (key.length !== 32) {
        throw new Error('Encryption key must be 32 bytes for AES-256');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
}

/**
 * Decrypt data using AES-256-GCM.
 * @param payload - The encrypted payload
 * @param key - 32-byte encryption key
 * @returns Decrypted plaintext buffer
 */
export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
    if (key.length !== 32) {
        throw new Error('Encryption key must be 32 bytes for AES-256');
    }

    const decipher = createDecipheriv(ALGORITHM, key, payload.iv);
    decipher.setAuthTag(payload.authTag);

    return Buffer.concat([decipher.update(payload.encrypted), decipher.final()]);
}

/**
 * Serialize an encrypted payload to a single buffer for storage.
 * Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 */
export function serializePayload(payload: EncryptedPayload): Buffer {
    return Buffer.concat([payload.iv, payload.authTag, payload.encrypted]);
}

/**
 * Deserialize a stored buffer back into an encrypted payload.
 */
export function deserializePayload(buffer: Buffer): EncryptedPayload {
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    return { iv, authTag, encrypted };
}

/**
 * Generate a random AES-256 key.
 */
export function generateKey(): Buffer {
    return randomBytes(32);
}
