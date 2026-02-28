import { createHash, randomBytes } from 'crypto';
import { createReadStream } from 'fs';

/**
 * Compute SHA-256 hash of a buffer.
 */
export function sha256(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute SHA-256 hash of a file stream (for large files).
 */
export function sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * Generate a cryptographically secure random token.
 */
export function generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
}

/**
 * Generate a URL-safe random token.
 */
export function generateUrlSafeToken(length: number = 32): string {
    return randomBytes(length).toString('base64url');
}
