// ============================================
// File Types
// ============================================

export interface FileItem {
    id: string;
    userId: string;
    folderId: string | null;
    name: string;
    mimeType: string;
    size: number;
    sha256Hash: string;
    storageKey: string;
    currentVersion: number;
    isTrashed: boolean;
    trashedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface FileVersion {
    id: string;
    fileId: string;
    versionNumber: number;
    size: number;
    sha256Hash: string;
    storageKey: string;
    changeSummary: string | null;
    createdBy: string;
    createdAt: string;
}

export interface UploadFileInput {
    folderId?: string | null;
    name: string;
    mimeType: string;
    size: number;
}

export interface ChunkUploadMeta {
    uploadId: string;
    fileId: string;
    chunkIndex: number;
    totalChunks: number;
    chunkSize: number;
}

export interface FilePreview {
    fileId: string;
    previewUrl: string;
    mimeType: string;
    name: string;
    size: number;
}
