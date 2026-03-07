import { Client } from 'minio';
import { loadConfig } from '@openvault/config';
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

    // Set a basic policy to allow public read on the avatars prefix
    // This ensures avatars show up even if the presigned URL expires or has issues
    try {
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${config.minio.bucket}/avatars/*`],
                },
            ],
        };
        await minioClient.setBucketPolicy(config.minio.bucket, JSON.stringify(policy));
        console.log('✅ MinIO bucket policy updated for public avatars');
    } catch (err) {
        console.warn('⚠️ Could not set MinIO bucket policy:', err);
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
 * Get an object stream from MinIO.
 */
export async function getObject(bucket: string, key: string) {
    return getMinioClient().getObject(bucket, key);
}

/**
 * Download an object from MinIO as a Buffer.
 */
export async function downloadObject(bucket: string, key: string): Promise<Buffer> {
    const stream = await getObject(bucket, key);
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

/**
 * Rewrite an internal MinIO presigned URL to a browser-accessible path
 * through the nginx /storage/ proxy.
 *
 * Input:  http://minio:9000/openvault-files/key?X-Amz-...
 * Output: /storage/openvault-files/key?X-Amz-...
 *
 * In development (when MINIO_PUBLIC_URL points to localhost), URLs are
 * returned unchanged for direct access.
 */
export function rewriteMinioUrl(presignedUrl: string): string {
    const config = loadConfig();
    const isProduction = config.nodeEnv === 'production';

    if (!isProduction) {
        // In dev mode, MinIO is directly accessible on localhost
        return presignedUrl;
    }

    try {
        const url = new URL(presignedUrl);
        // Strip scheme + host, keep path + query → /storage/bucket/key?...
        return `/storage${url.pathname}${url.search}`;
    } catch {
        return presignedUrl;
    }
}

