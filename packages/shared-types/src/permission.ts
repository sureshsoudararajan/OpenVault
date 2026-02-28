// ============================================
// Permission & Sharing Types
// ============================================

export type PermissionRole = 'viewer' | 'editor' | 'owner';
export type ResourceType = 'file' | 'folder';

export interface Permission {
    id: string;
    resourceId: string;
    resourceType: ResourceType;
    grantedTo: string;
    grantedBy: string;
    role: PermissionRole;
    expiresAt: string | null;
    createdAt: string;
}

export interface ShareLink {
    id: string;
    resourceId: string;
    resourceType: ResourceType;
    token: string;
    hasPassword: boolean;
    permission: PermissionRole;
    downloadCount: number;
    maxDownloads: number | null;
    expiresAt: string | null;
    createdAt: string;
}

export interface CreateShareLinkInput {
    resourceId: string;
    resourceType: ResourceType;
    permission?: PermissionRole;
    password?: string;
    expiresAt?: string;
    maxDownloads?: number;
}

export interface GrantPermissionInput {
    resourceId: string;
    resourceType: ResourceType;
    userId: string;
    role: PermissionRole;
    expiresAt?: string;
}

// ============================================
// Activity & Collaboration Types
// ============================================

export type ActivityAction =
    | 'upload'
    | 'download'
    | 'share'
    | 'delete'
    | 'rename'
    | 'restore'
    | 'move'
    | 'version_create'
    | 'comment';

export interface ActivityLog {
    id: string;
    userId: string;
    action: ActivityAction;
    resourceId: string;
    resourceType: ResourceType;
    metadata: Record<string, unknown>;
    ipAddress: string;
    createdAt: string;
    user?: { name: string; avatarUrl: string | null };
}

export interface Comment {
    id: string;
    fileId: string;
    userId: string;
    body: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; avatarUrl: string | null };
    replies?: Comment[];
}

export interface CreateCommentInput {
    fileId: string;
    body: string;
    parentId?: string;
}

// ============================================
// Auth Types
// ============================================

export interface LoginInput {
    email: string;
    password: string;
    totpCode?: string;
}

export interface RegisterInput {
    email: string;
    password: string;
    name: string;
}

export interface AuthTokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface TokenPayload {
    sub: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}

import type { UserRole } from './user';

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    meta?: {
        page?: number;
        perPage?: number;
        total?: number;
    };
}

export interface PaginationParams {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
