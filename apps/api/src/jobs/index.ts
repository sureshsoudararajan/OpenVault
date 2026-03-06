import { Queue, Worker, type Job } from 'bullmq';
import { loadConfig, type AppConfig } from '@openvault/config';
import IORedis from 'ioredis';
import sharp from 'sharp';
import prisma from '../db/index';
import { getObject, uploadObject } from '../storage/minio';

// ---- Queue Definitions ----
export const QUEUE_NAMES = {
    FILE_PROCESSING: 'file-processing',
    THUMBNAIL: 'thumbnail',
    DEDUP_SCAN: 'dedup-scan',
    TRASH_CLEANUP: 'trash-cleanup',
} as const;

let connection: IORedis;
let fileProcessingQueue: Queue;
let thumbnailQueue: Queue;
let dedupScanQueue: Queue;
let trashCleanupQueue: Queue;

/**
 * Initialize all BullMQ workers and queues.
 */
export async function initWorkers(config: AppConfig): Promise<void> {
    const appConfig = loadConfig();
    connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });

    // Create queues
    fileProcessingQueue = new Queue(QUEUE_NAMES.FILE_PROCESSING, { connection });
    thumbnailQueue = new Queue(QUEUE_NAMES.THUMBNAIL, { connection });
    dedupScanQueue = new Queue(QUEUE_NAMES.DEDUP_SCAN, { connection });
    trashCleanupQueue = new Queue(QUEUE_NAMES.TRASH_CLEANUP, { connection });

    // ---- File Processing Worker ----
    new Worker(
        QUEUE_NAMES.FILE_PROCESSING,
        async (job: Job) => {
            const { fileId, action } = job.data;
            console.log(`📦 Processing file ${fileId}: ${action}`);

            switch (action) {
                case 'compress':
                    // TODO: Implement file compression
                    break;
                case 'extract_metadata':
                    // TODO: Extract file metadata (EXIF, document properties, etc.)
                    break;
                default:
                    console.warn(`Unknown file processing action: ${action}`);
            }
        },
        { connection, concurrency: 3 }
    );

    // ---- Thumbnail Worker ----
    new Worker(
        QUEUE_NAMES.THUMBNAIL,
        async (job: Job) => {
            const { fileId, mimeType, storageKey } = job.data;
            console.log(`🖼️  Generating thumbnail for ${fileId} (${mimeType})`);

            if (!mimeType.startsWith('image/')) {
                console.log(`⏭️  Skipping thumbnail for non-image ${fileId}`);
                return;
            }

            try {
                // 1. Download original file from MinIO
                const fileStream = await getObject(appConfig.minio.bucket, storageKey);
                const chunks: Buffer[] = [];
                for await (const chunk of fileStream as any) {
                    chunks.push(chunk);
                }
                const originalBuffer = Buffer.concat(chunks);

                // 2. Generate thumbnail with sharp
                const thumbnailBuffer = await sharp(originalBuffer)
                    .resize(256, 256, { fit: 'cover' })
                    .webp({ quality: 80 })
                    .toBuffer();

                // 3. Upload thumbnail to MinIO
                const thumbnailKey = `thumbnails/${fileId}.webp`;
                await uploadObject(appConfig.minio.bucket, thumbnailKey, thumbnailBuffer, {
                    'Content-Type': 'image/webp',
                });

                // 4. Update database
                await prisma.file.update({
                    where: { id: fileId },
                    data: { thumbnailKey },
                });

                console.log(`✅ Thumbnail generated for ${fileId}`);
            } catch (error) {
                console.error(`❌ Failed to generate thumbnail for ${fileId}:`, error);
                throw error;
            }
        },
        { connection, concurrency: 2 }
    );

    // ---- Dedup Scan Worker ----
    new Worker(
        QUEUE_NAMES.DEDUP_SCAN,
        async (job: Job) => {
            const { fileId, sha256Hash, userId } = job.data;
            console.log(`🔍 Running dedup scan for file ${fileId}`);

            // TODO: Check for duplicate files by hash
            // Mark duplicates in the database
        },
        { connection, concurrency: 1 }
    );

    // ---- Trash Cleanup Worker (30-day auto-delete) ----
    new Worker(
        QUEUE_NAMES.TRASH_CLEANUP,
        async (_job: Job) => {
            console.log('🗑️  Running trash cleanup — deleting items trashed > 30 days ago…');

            // Dynamic imports to avoid circular dependencies
            const { default: prisma } = await import('../db/index');
            const { deleteObject } = await import('../storage/minio');

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);

            // Find expired trashed files
            const expiredFiles = await prisma.file.findMany({
                where: { isTrashed: true, trashedAt: { lte: cutoff } },
                select: { id: true, storageKey: true, size: true, userId: true },
            });

            if (expiredFiles.length > 0) {
                // Delete from MinIO
                for (const file of expiredFiles) {
                    try {
                        await deleteObject(config.minio.bucket, file.storageKey);
                    } catch (err) {
                        console.error(`Cleanup: failed to delete ${file.storageKey}`, err);
                    }
                }

                // Decrement storage per user
                const userSizeMap = new Map<string, bigint>();
                for (const file of expiredFiles) {
                    const current = userSizeMap.get(file.userId) || BigInt(0);
                    userSizeMap.set(file.userId, current + file.size);
                }
                for (const [userId, totalSize] of userSizeMap) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { storageUsed: { decrement: totalSize } },
                    });
                }

                // Delete from DB
                await prisma.file.deleteMany({
                    where: { id: { in: expiredFiles.map(f => f.id) } },
                });

                console.log(`🗑️  Permanently deleted ${expiredFiles.length} expired files`);
            }

            // Delete expired trashed folders
            const expiredFolders = await prisma.folder.findMany({
                where: { isTrashed: true, trashedAt: { lte: cutoff } },
                select: { id: true },
            });

            if (expiredFolders.length > 0) {
                await prisma.folder.deleteMany({
                    where: { id: { in: expiredFolders.map(f => f.id) } },
                });
                console.log(`🗑️  Permanently deleted ${expiredFolders.length} expired folders`);
            }

            if (expiredFiles.length === 0 && expiredFolders.length === 0) {
                console.log('🗑️  No expired trash items found');
            }
        },
        { connection, concurrency: 1 }
    );

    // Schedule trash cleanup to run every day at 3:00 AM
    await trashCleanupQueue.add(
        'daily-cleanup',
        {},
        {
            repeat: { pattern: '0 3 * * *' }, // cron: every day at 3 AM
            removeOnComplete: true,
            removeOnFail: false,
        }
    );

    console.log('✅ Background workers initialized');
}

// ---- Queue Helpers ----

export async function enqueueFileProcessing(fileId: string, action: string) {
    await fileProcessingQueue.add('process', { fileId, action });
}

export async function enqueueThumbnail(fileId: string, mimeType: string, storageKey: string) {
    await thumbnailQueue.add('thumbnail', { fileId, mimeType, storageKey });
}

export async function enqueueDedupScan(fileId: string, sha256Hash: string, userId: string) {
    await dedupScanQueue.add('dedup', { fileId, sha256Hash, userId });
}

