import { randomBytes, scryptSync } from 'crypto';
import { encrypt, decrypt, serializePayload, deserializePayload, generateKey } from './aes';

/**
 * Distributed Encryption Key Model:
 * Each file is encrypted with a unique File Encryption Key (FEK).
 * The FEK is then split into two parts:
 *   1. User Key Fragment — encrypted with the user's passphrase
 *   2. Server Key Fragment — stored on the server
 * Both fragments are needed to reconstruct the FEK.
 * This prevents centralized compromise.
 */

export interface KeyPair {
    userKeyFragment: Buffer;
    serverKeyFragment: Buffer;
}

export interface StoredKeyPair {
    encryptedUserKey: Buffer;
    serverKeyFragment: Buffer;
}

/**
 * Generate a new file encryption key and split it into two fragments.
 */
export function generateKeyPair(): { fileKey: Buffer; keyPair: KeyPair } {
    const fileKey = generateKey(); // 32 bytes
    const splitPoint = 16;

    return {
        fileKey,
        keyPair: {
            userKeyFragment: fileKey.subarray(0, splitPoint),
            serverKeyFragment: fileKey.subarray(splitPoint),
        },
    };
}

/**
 * Reconstruct a file encryption key from its two fragments.
 */
export function reconstructKey(keyPair: KeyPair): Buffer {
    return Buffer.concat([keyPair.userKeyFragment, keyPair.serverKeyFragment]);
}

/**
 * Derive an encryption key from a user's passphrase using scrypt.
 */
export function deriveKeyFromPassphrase(passphrase: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
    const keySalt = salt || randomBytes(16);
    const key = scryptSync(passphrase, keySalt, 32);
    return { key, salt: keySalt };
}

/**
 * Encrypt the user's key fragment with their passphrase-derived key.
 */
export function encryptUserFragment(fragment: Buffer, passphrase: string): { encrypted: Buffer; salt: Buffer } {
    const { key, salt } = deriveKeyFromPassphrase(passphrase);
    const payload = encrypt(fragment, key);
    return { encrypted: serializePayload(payload), salt };
}

/**
 * Decrypt the user's key fragment with their passphrase-derived key.
 */
export function decryptUserFragment(encrypted: Buffer, passphrase: string, salt: Buffer): Buffer {
    const { key } = deriveKeyFromPassphrase(passphrase, salt);
    const payload = deserializePayload(encrypted);
    return decrypt(payload, key);
}
