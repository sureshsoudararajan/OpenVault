import { Queue, Worker, type Job } from 'bullmq';
import type { AppConfig } from '@openvault/config';
import IORedis from 'ioredis';

// ---- Queue Definitions ----
export const QUEUE_NAMES = {
    FILE_PROCESSING: 'file-processing',
    THUMBNAIL: 'thumbnail',
    DEDUP_SCAN: 'dedup-scan',
} as const;

let connection: IORedis;
let fileProcessingQueue: Queue;
let thumbnailQueue: Queue;
let dedupScanQueue: Queue;

/**
 * Initialize all BullMQ workers and queues.
 */
export async function initWorkers(config: AppConfig): Promise<void> {
    connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });

    // Create queues
    fileProcessingQueue = new Queue(QUEUE_NAMES.FILE_PROCESSING, { connection });
    thumbnailQueue = new Queue(QUEUE_NAMES.THUMBNAIL, { connection });
    dedupScanQueue = new Queue(QUEUE_NAMES.DEDUP_SCAN, { connection });

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

            // TODO: Generate thumbnails for images and PDFs
            // Use sharp for images, pdf-lib or pdfjs for PDFs
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
