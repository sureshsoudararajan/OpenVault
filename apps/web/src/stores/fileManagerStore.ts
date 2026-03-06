import { create } from 'zustand';

export type ViewMode = 'grid' | 'list';
export type SortBy = 'name' | 'size' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

interface ClipboardItem {
    id: string;
    type: 'file' | 'folder';
    name: string;
}

interface FileManagerState {
    viewMode: ViewMode;
    sortBy: SortBy;
    sortOrder: SortOrder;
    selectedFiles: Set<string>;
    selectedFolders: Set<string>;
    currentFolderId: string | null;
    searchQuery: string;
    isUploading: boolean;
    uploadProgress: number;
    clipboard: ClipboardItem[];
    clipboardOperation: 'copy' | null;

    setViewMode: (mode: ViewMode) => void;
    setSortBy: (sortBy: SortBy) => void;
    setSortOrder: (order: SortOrder) => void;
    toggleFileSelection: (fileId: string) => void;
    toggleFolderSelection: (folderId: string) => void;
    selectAllFiles: (fileIds: string[]) => void;
    clearSelection: () => void;
    setCurrentFolderId: (folderId: string | null) => void;
    setSearchQuery: (query: string) => void;
    setUploading: (uploading: boolean, progress?: number) => void;
    setClipboard: (items: ClipboardItem[], operation: 'copy') => void;
    clearClipboard: () => void;
}

export const useFileManagerStore = create<FileManagerState>((set) => ({
    viewMode: 'grid',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    selectedFiles: new Set(),
    selectedFolders: new Set(),
    currentFolderId: null,
    searchQuery: '',
    isUploading: false,
    uploadProgress: 0,
    clipboard: [],
    clipboardOperation: null,

    setViewMode: (viewMode) => set({ viewMode }),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortOrder: (sortOrder) => set({ sortOrder }),

    toggleFileSelection: (fileId) =>
        set((state) => {
            const newSelected = new Set(state.selectedFiles);
            if (newSelected.has(fileId)) {
                newSelected.delete(fileId);
            } else {
                newSelected.add(fileId);
            }
            return { selectedFiles: newSelected };
        }),

    toggleFolderSelection: (folderId) =>
        set((state) => {
            const newSelected = new Set(state.selectedFolders);
            if (newSelected.has(folderId)) {
                newSelected.delete(folderId);
            } else {
                newSelected.add(folderId);
            }
            return { selectedFolders: newSelected };
        }),

    selectAllFiles: (fileIds) => set({ selectedFiles: new Set(fileIds) }),
    clearSelection: () => set({ selectedFiles: new Set(), selectedFolders: new Set() }),
    setCurrentFolderId: (currentFolderId) => set({ currentFolderId }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setUploading: (isUploading, uploadProgress = 0) => set({ isUploading, uploadProgress }),
    setClipboard: (clipboard, clipboardOperation) => set({ clipboard, clipboardOperation }),
    clearClipboard: () => set({ clipboard: [], clipboardOperation: null }),
}));
