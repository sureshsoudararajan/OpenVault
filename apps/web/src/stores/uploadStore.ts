import { create } from 'zustand';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadItem {
    id: string;          // UUID unique to this upload task
    fileName: string;
    fileSize: number;    // total bytes
    uploaded: number;    // bytes uploaded so far
    speed: number;       // bytes/sec (rolling average)
    eta: number;         // seconds remaining
    status: UploadStatus;
    error?: string;
    startedAt?: number;  // Date.now() when upload started
    folderId?: string | null;
    // Abort controller for cancelling
    abort?: () => void;
}

interface UploadStore {
    uploads: UploadItem[];
    isMinimized: boolean;
    addUpload: (item: Omit<UploadItem, 'speed' | 'eta' | 'uploaded' | 'status'>) => void;
    updateUpload: (id: string, patch: Partial<UploadItem>) => void;
    removeUpload: (id: string) => void;
    clearCompleted: () => void;
    setMinimized: (v: boolean) => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
    uploads: [],
    isMinimized: false,

    addUpload: (item) =>
        set((state) => ({
            uploads: [
                ...state.uploads,
                { ...item, speed: 0, eta: 0, uploaded: 0, status: 'pending' },
            ],
        })),

    updateUpload: (id, patch) =>
        set((state) => ({
            uploads: state.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),

    removeUpload: (id) =>
        set((state) => ({
            uploads: state.uploads.filter((u) => u.id !== id),
        })),

    clearCompleted: () =>
        set((state) => ({
            uploads: state.uploads.filter((u) => u.status !== 'done' && u.status !== 'error'),
        })),

    setMinimized: (v) => set({ isMinimized: v }),
}));
