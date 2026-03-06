import { Queue, Worker, type Job } from 'bullmq';
import { loadConfig, type AppConfig } from '@openvault/config';
import IORedis from 'ioredis';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import prisma from '../db/index';
import { getObject, uploadObject } from '../storage/minio';
import { Stream, PassThrough } from 'stream';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

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
    fileProcessingQueue = new Queue(QUEUE_NAMES.FILE_PROCESSING, { connection: connection as any });
    thumbnailQueue = new Queue(QUEUE_NAMES.THUMBNAIL, { connection: connection as any });
    dedupScanQueue = new Queue(QUEUE_NAMES.DEDUP_SCAN, { connection: connection as any });
    trashCleanupQueue = new Queue(QUEUE_NAMES.TRASH_CLEANUP, { connection: connection as any });

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
                case 'extract_metadata': {
                    const file = await prisma.file.findUnique({ where: { id: fileId } });
                    if (!file) break;

                    const isImage = file.mimeType.startsWith('image/');
                    if (!isImage) break;

                    try {
                        const fileStream = await getObject(config.minio.bucket, file.storageKey);
                        const chunks: Buffer[] = [];
                        for await (const chunk of fileStream as any) {
                            chunks.push(chunk);
                        }
                        const buffer = Buffer.concat(chunks);
                        const metadata = await sharp(buffer).metadata();

                        // Sanitize metadata to be JSON-safe (remove large/binary buffers like 'exif' if any)
                        const sanitizedMetadata = {
                            format: metadata.format,
                            width: metadata.width,
                            height: metadata.height,
                            space: metadata.space,
                            channels: metadata.channels,
                            depth: metadata.depth,
                            density: metadata.density,
                            hasAlpha: metadata.hasAlpha,
                        };

                        await prisma.file.update({
                            where: { id: fileId },
                            data: { metadata: sanitizedMetadata as any },
                        });
                        console.log(`✅ Extracted metadata for file ${fileId}`);
                    } catch (err) {
                        console.error(`❌ Failed to extract metadata for ${fileId}:`, err);
                    }
                    break;
                }
                default:
                    console.warn(`Unknown file processing action: ${action}`);
            }
        },
        { connection: connection as any, concurrency: 3 }
    );

    // ---- Thumbnail Worker ----
    new Worker(
        QUEUE_NAMES.THUMBNAIL,
        async (job: Job) => {
            const { fileId, mimeType, storageKey } = job.data;
            console.log(`🖼️  Generating thumbnail for ${fileId} (${mimeType})`);

            const isImage = mimeType.startsWith('image/');
            const isVideo = mimeType.startsWith('video/');

            if (!isImage && !isVideo) {
                console.log(`⏭️  Skipping thumbnail for non-supported type ${fileId} (${mimeType})`);
                return;
            }

            let tempVideoPath: string | null = null;
            let tempFramePath: string | null = null;

            try {
                let frameBuffer: Buffer;

                if (isImage) {
                    // 1. Download original image
                    const fileStream = await getObject(appConfig.minio.bucket, storageKey);
                    const chunks: Buffer[] = [];
                    for await (const chunk of fileStream as any) {
                        chunks.push(chunk);
                    }
                    frameBuffer = Buffer.concat(chunks);
                } else {
                    // 1. For videos, we need to extract a frame. 
                    // FFMPEG works best with files, so we'll download to a temp file.
                    const fileStream = await getObject(appConfig.minio.bucket, storageKey);

                    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ov-thumb-'));
                    tempVideoPath = path.join(tempDir, 'input_video');
                    tempFramePath = path.join(tempDir, 'frame.jpg');

                    // Write stream to temp file
                    const writeStream = (await import('fs')).createWriteStream(tempVideoPath);
                    await new Promise((resolve, reject) => {
                        (fileStream as Stream).pipe(writeStream);
                        writeStream.on('finish', () => resolve(undefined));
                        writeStream.on('error', reject);
                    });

                    // Extract frame at 1s mark
                    await new Promise((resolve, reject) => {
                        ffmpeg(tempVideoPath!)
                            .screenshots({
                                timestamps: [1],
                                folder: tempDir,
                                filename: 'frame.jpg',
                                size: '640x?'
                            })
                            .on('end', resolve)
                            .on('error', reject);
                    });

                    frameBuffer = await fs.readFile(tempFramePath);
                }

                // 2. Generate optimized thumbnail with sharp
                const thumbnailBuffer = await sharp(frameBuffer)
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
            } finally {
                // Cleanup temp files
                if (tempVideoPath) {
                    try {
                        const dir = path.dirname(tempVideoPath);
                        await fs.rm(dir, { recursive: true, force: true });
                    } catch (e) {
                        console.error('Failed to cleanup temp files:', e);
                    }
                }
            }
        },
        { connection: connection as any, concurrency: 2 }
    );

    // ---- Dedup Scan Worker ----
    new Worker(
        QUEUE_NAMES.DEDUP_SCAN,
        async (job: Job) => {
            const { fileId, sha256Hash, userId } = job.data;
            console.log(`🔍 Running dedup scan for file ${fileId}`);

            // Find other files with the same hash belonging to the same user
            const duplicates = await prisma.file.findMany({
                where: {
                    sha256Hash: sha256Hash,
                    userId: userId,
                    id: { not: fileId },
                    isTrashed: false,
                },
                select: { id: true, name: true },
            });

            if (duplicates.length > 0) {
                console.log(`👯 Found ${duplicates.length} duplicates for file ${fileId} (hash: ${sha256Hash})`);

                // Track in activity log
                await prisma.activityLog.create({
                    data: {
                        userId: userId,
                        action: 'dedup_found',
                        resourceId: fileId,
                        resourceType: 'file',
                        metadata: {
                            duplicateCount: duplicates.length,
                            duplicateIds: duplicates.map(d => d.id),
                            hash: sha256Hash
                        },
                    }
                });
            } else {
                console.log(`✅ No duplicates found for file ${fileId}`);
            }
        },
        { connection: connection as any, concurrency: 1 }
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
        { connection: connection as any, concurrency: 1 }
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

