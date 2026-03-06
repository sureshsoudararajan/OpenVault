/**
 * uploadManager.ts
 * Handles direct browser→MinIO uploads via presigned PUT URLs.
 * Uses XMLHttpRequest for real-time progress tracking.
 */

import { fileApi } from './api';
import { useUploadStore } from '../stores/uploadStore';

// Generate a simple UUID for tracking upload items
function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UploadOptions {
    folderId?: string | null;
    /** Called when a file finishes uploading successfully */
    onComplete?: (file: any) => void;
    /** Called when a file fails */
    onError?: (fileName: string, error: string) => void;
}

/**
 * Upload a single file via presigned MinIO URL with real-time progress.
 * Returns a promise that resolves to the created file record.
 */
export async function uploadFile(file: File, options: UploadOptions = {}): Promise<any> {
    const { folderId = null, onComplete, onError } = options;
    const store = useUploadStore.getState();
    const id = uid();

    store.addUpload({
        id,
        fileName: file.name,
        fileSize: file.size,
        folderId,
    });

    try {
        // Step 1: Request a presigned upload URL from the backend
        const initRes: any = await fileApi.initUpload({
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            folderId,
        });

        const { uploadUrl, storageKey } = initRes.data;

        store.updateUpload(id, { status: 'uploading', startedAt: Date.now() });

        // Step 2: Upload directly to MinIO using XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let lastLoaded = 0;
            let lastTime = Date.now();
            const SPEED_WINDOW = 2000; // 2s rolling window
            const speedSamples: { loaded: number; time: number }[] = [];

            // Register abort callback
            store.updateUpload(id, {
                abort: () => {
                    xhr.abort();
                    reject(new Error('Upload cancelled'));
                },
            });

            xhr.upload.addEventListener('progress', (event) => {
                if (!event.lengthComputable) return;

                const now = Date.now();
                const { uploaded: _prev } = useUploadStore.getState().uploads.find(u => u.id === id) || {};

                // Rolling speed calculation
                speedSamples.push({ loaded: event.loaded, time: now });
                const cutoff = now - SPEED_WINDOW;
                while (speedSamples.length > 1 && speedSamples[0].time < cutoff) {
                    speedSamples.shift();
                }
                const oldest = speedSamples[0];
                const bytesInWindow = event.loaded - oldest.loaded;
                const timeInWindow = (now - oldest.time) / 1000;
                const speed = timeInWindow > 0 ? bytesInWindow / timeInWindow : 0;
                const remaining = event.total - event.loaded;
                const eta = speed > 0 ? remaining / speed : 0;

                store.updateUpload(id, {
                    uploaded: event.loaded,
                    speed: Math.round(speed),
                    eta: Math.round(eta),
                });

                lastLoaded = event.loaded;
                lastTime = now;
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Storage upload failed: HTTP ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            xhr.send(file);
        });

        // Step 3: Notify the backend to create the DB record
        const completeRes: any = await fileApi.completeUpload({
            storageKey,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            folderId,
        });

        store.updateUpload(id, {
            status: 'done',
            uploaded: file.size,
            speed: 0,
            eta: 0,
        });

        // Auto-remove after 4 seconds
        setTimeout(() => {
            useUploadStore.getState().removeUpload(id);
        }, 4000);

        onComplete?.(completeRes.data);
        return completeRes.data;
    } catch (err: any) {
        const errorMsg = err.message || 'Upload failed';
        store.updateUpload(id, { status: 'error', error: errorMsg });
        onError?.(file.name, errorMsg);
        throw err;
    }
}

/**
 * Upload multiple files concurrently (up to maxConcurrent at a time).
 */
export async function uploadFiles(
    files: FileList | File[],
    options: UploadOptions = {},
    maxConcurrent = 3
): Promise<void> {
    const arr = Array.from(files);
    const queue = [...arr];
    const active: Promise<any>[] = [];

    const runNext = (): Promise<any> | null => {
        if (queue.length === 0) return null;
        const file = queue.shift()!;
        const p = uploadFile(file, options).catch(() => { /* individual errors handled */ });
        return p;
    };

    // Fill initial concurrent slots
    for (let i = 0; i < Math.min(maxConcurrent, arr.length); i++) {
        const p = runNext();
        if (p) active.push(p);
    }

    // As each finishes, start the next
    while (active.length > 0) {
        await Promise.race(active);
        // Remove settled promises
        for (let i = active.length - 1; i >= 0; i--) {
            // Check if settled by racing with a resolved promise
            const settled = await Promise.race([active[i], Promise.resolve('pending')]);
            if (settled !== 'pending') {
                active.splice(i, 1);
                const p = runNext();
                if (p) active.push(p);
            }
        }
    }
}
