// ============================================
// Folder Types
// ============================================

export interface Folder {
    id: string;
    userId: string;
    parentId: string | null;
    name: string;
    path: string;
    isTeamFolder: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FolderTreeNode {
    id: string;
    name: string;
    parentId: string | null;
    children: FolderTreeNode[];
    fileCount?: number;
}

export interface CreateFolderInput {
    name: string;
    parentId?: string | null;
}

export interface MoveFolderInput {
    folderId: string;
    newParentId: string | null;
}
