// ============================================
// User Types
// ============================================

export type UserRole = 'admin' | 'member' | 'guest';

export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    oauthProvider: string | null;
    mfaEnabled: boolean;
    role: UserRole;
    storageQuota: number;
    storageUsed: number;
    createdAt: string;
    updatedAt: string;
}

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: UserRole;
}

export interface CreateUserInput {
    email: string;
    password: string;
    name: string;
}

export interface UpdateUserInput {
    name?: string;
    avatarUrl?: string | null;
}
