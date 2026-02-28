import { Client } from 'minio';
import type { AppConfig } from '@openvault/config';

let minioClient: Client;

/**
 * Initialize the MinIO client and ensure the bucket exists.
 */
export async function initStorage(config: AppConfig): Promise<void> {
    minioClient = new Client({
        endPoint: config.minio.endpoint,
        port: config.minio.port,
        useSSL: config.minio.useSSL,
        accessKey: config.minio.accessKey,
        secretKey: config.minio.secretKey,
    });

    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(config.minio.bucket);
    if (!bucketExists) {
        await minioClient.makeBucket(config.minio.bucket);
        console.log(`✅ Created MinIO bucket: ${config.minio.bucket}`);
    }
}

/**
 * Get the MinIO client instance.
 */
export function getMinioClient(): Client {
    if (!minioClient) {
        throw new Error('MinIO client not initialized. Call initStorage() first.');
    }
    return minioClient;
}

/**
 * Upload an object to MinIO.
 */
export async function uploadObject(
    bucket: string,
    key: string,
    data: Buffer,
    metadata?: Record<string, string>
): Promise<void> {
    await getMinioClient().putObject(bucket, key, data, data.length, metadata);
}

/**
 * Download an object from MinIO as a Buffer.
 */
export async function downloadObject(bucket: string, key: string): Promise<Buffer> {
    const stream = await getMinioClient().getObject(bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

/**
 * Generate a presigned URL for direct download.
 */
export async function getPresignedDownloadUrl(
    bucket: string,
    key: string,
    expirySeconds: number = 3600
): Promise<string> {
    return getMinioClient().presignedGetObject(bucket, key, expirySeconds);
}

/**
 * Generate a presigned URL for direct upload.
 */
export async function getPresignedUploadUrl(
    bucket: string,
    key: string,
    expirySeconds: number = 3600
): Promise<string> {
    return getMinioClient().presignedPutObject(bucket, key, expirySeconds);
}

/**
 * Delete an object from MinIO.
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
    await getMinioClient().removeObject(bucket, key);
}

/**
 * Check if an object exists in MinIO.
 */
export async function objectExists(bucket: string, key: string): Promise<boolean> {
    try {
        await getMinioClient().statObject(bucket, key);
        return true;
    } catch {
        return false;
    }
}

/**
 * Build the storage key for a file.
 * Format: user_id/folder_id/file_hash
 */
export function buildStorageKey(userId: string, folderId: string | null, fileHash: string): string {
    const folderPart = folderId ?? 'root';
    return `${userId}/${folderPart}/${fileHash}`;
}
