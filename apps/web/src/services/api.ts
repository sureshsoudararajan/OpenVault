import { useAuthStore } from '../stores/authStore';

const API_BASE = '/api';

interface RequestOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

/**
 * Core API client with automatic auth token injection and refresh.
 */
async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { accessToken, refreshToken, setAuth, logout } = useAuthStore.getState();

    const headers: Record<string, string> = {
        ...options.headers,
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body
            ? options.body instanceof FormData
                ? options.body
                : JSON.stringify(options.body)
            : undefined,
    });

    // Handle 401 — try token refresh
    if (response.status === 401 && refreshToken) {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            const { user } = useAuthStore.getState();
            if (user) {
                setAuth(user, refreshData.data.accessToken, refreshData.data.refreshToken);
            }

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
            const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
                method: options.method || 'GET',
                headers,
                body: options.body
                    ? options.body instanceof FormData
                        ? options.body
                        : JSON.stringify(options.body)
                    : undefined,
            });

            if (!retryResponse.ok) {
                const errorData = await retryResponse.json().catch(() => ({}));
                throw new ApiError(retryResponse.status, errorData.error?.message || 'Request failed', errorData.error?.code);
            }

            return retryResponse.json();
        } else {
            logout();
            throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
        }
    }
    // Otherwise throw standard error logic
    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const message = errData?.message || errData?.error?.message || (typeof errData?.error === 'string' ? errData.error : false) || `Request failed with status ${response.status}`;
        const errorToThrow = new ApiError(response.status, message, errData?.code || errData?.error?.code);
        if (errData?.data) {
            (errorToThrow as any).data = errData.data;
        }
        throw errorToThrow;
    }

    return response.json().catch(() => ({}));
}

export class ApiError extends Error {
    constructor(public status: number, message: string, public code?: string) {
        super(message);
        this.name = 'ApiError';
    }
}

// ============================================
// Auth APIs
// ============================================

export const authApi = {
    register: (data: { email: string; password: string; name: string }) =>
        request('/auth/register', { method: 'POST', body: data }),

    login: (data: { email: string; password: string; totpCode?: string }) =>
        request('/auth/login', { method: 'POST', body: data }),

    refresh: (refreshToken: string) =>
        request('/auth/refresh', { method: 'POST', body: { refreshToken } }),

    logout: (refreshToken: string) =>
        request('/auth/logout', { method: 'POST', body: { refreshToken } }),

    getMfaSetup: () => request('/auth/mfa/setup'),
    enableMfa: (totpCode: string) => request('/auth/mfa/enable', { method: 'POST', body: { totpCode } }),
    regenerateMfa: (passwordConfirm: string, totpCode: string) => request('/auth/mfa/regenerate', { method: 'POST', body: { passwordConfirm, totpCode } }),
    disableMfa: (passwordConfirm: string, totpCode: string) => request('/auth/mfa/disable', { method: 'POST', body: { passwordConfirm, totpCode } }),
};

// ============================================
// User APIs
// ============================================

export const userApi = {
    getMe: () => request('/users/me'),
    updateMe: (data: { name?: string; avatarUrl?: string }) =>
        request('/users/me', { method: 'PATCH', body: data }),
};

// ============================================
// File APIs
// ============================================

export const fileApi = {
    list: (folderId?: string | null, page = 1) =>
        request(`/files?folderId=${folderId || ''}&page=${page}`),

    get: (id: string) => request(`/files/${id}`),

    upload: (formData: FormData) =>
        request('/files/upload', { method: 'POST', body: formData }),

    download: (id: string) => request(`/files/${id}/download`),

    delete: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),

    restore: (id: string) => request(`/files/${id}/restore`, { method: 'PATCH' }),

    rename: (id: string, name: string) =>
        request(`/files/${id}/rename`, { method: 'PATCH', body: { name } }),

    move: (id: string, folderId: string | null) =>
        request(`/files/${id}/move`, { method: 'PATCH', body: { folderId } }),

    listTrash: () => request('/files/trash/list'),

    updateContent: (id: string, content: string) =>
        request(`/files/${id}/content`, { method: 'PUT', body: { content } }),
};

// ============================================
// Folder APIs
// ============================================

export const folderApi = {
    list: (parentId?: string) => request(`/folders?parentId=${parentId || ''}`),

    get: (id: string) => request(`/folders/${id}`),

    create: (data: { name: string; parentId?: string }) =>
        request('/folders', { method: 'POST', body: data }),

    rename: (id: string, name: string) =>
        request(`/folders/${id}`, { method: 'PATCH', body: { name } }),

    delete: (id: string) => request(`/folders/${id}`, { method: 'DELETE' }),

    getTree: () => request('/folders/tree'),

    move: (id: string, newParentId: string | null) =>
        request(`/folders/${id}/move`, { method: 'PATCH', body: { newParentId } }),
};

// ============================================
// Version APIs
// ============================================

export const versionApi = {
    list: (fileId: string) => request(`/versions/${fileId}`),
    download: (fileId: string, version: number) => request(`/versions/${fileId}/${version}/download`),
    rollback: (fileId: string, version: number) =>
        request(`/versions/${fileId}/rollback/${version}`, { method: 'POST' }),
};

// ============================================
// Sharing APIs
// ============================================

export const sharingApi = {
    createLink: (data: {
        fileId?: string; folderId?: string; permission?: string;
        password?: string; opensAt?: string; expiresAt?: string;
        expiresIn?: number; maxDownloads?: number; otpEnabled?: boolean;
    }) =>
        request('/sharing/link', { method: 'POST', body: data }),

    getLink: (token: string) => request(`/sharing/link/${token}`),

    verifyPassword: (token: string, password: string) =>
        request(`/sharing/link/${token}/verify`, { method: 'POST', body: { password } }),

    verifyOtp: (token: string, otp: string) =>
        request(`/sharing/link/${token}/verify-otp`, { method: 'POST', body: { otp } }),

    downloadShared: (token: string, fileId?: string) =>
        request(`/sharing/link/${token}/download`, { method: 'POST', body: { fileId } }),

    previewShared: (token: string, fileId?: string) =>
        request(`/sharing/link/${token}/preview`, { method: 'POST', body: { fileId } }),

    editShared: (token: string, fileId: string | undefined, content: string) =>
        request(`/sharing/link/${token}/edit`, { method: 'POST', body: { fileId, content } }),

    grantPermission: (data: { fileId?: string; folderId?: string; userId: string; role: string }) =>
        request('/sharing/permission', { method: 'POST', body: data }),

    listPermissions: (resourceId: string) => request(`/sharing/permissions/${resourceId}`),

    revokePermission: (id: string) => request(`/sharing/permission/${id}`, { method: 'DELETE' }),

    deleteLink: (id: string) => request(`/sharing/link/delete/${id}`, { method: 'DELETE' }),
};

// ============================================
// Collaboration APIs
// ============================================

export const collaborationApi = {
    createComment: (data: { fileId: string; body: string; parentId?: string }) =>
        request('/collaboration/comments', { method: 'POST', body: data }),

    listComments: (fileId: string) => request(`/collaboration/comments/${fileId}`),

    deleteComment: (id: string) => request(`/collaboration/comments/${id}`, { method: 'DELETE' }),

    getActivity: (page = 1) => request(`/collaboration/activity?page=${page}`),
};

// ============================================
// Search APIs
// ============================================

export const searchApi = {
    search: (query: string, page = 1) => request(`/search?q=${encodeURIComponent(query)}&page=${page}`),
};

// ============================================
// Dedup APIs
// ============================================

export const dedupApi = {
    scan: () => request('/dedup/scan'),
    merge: (keepFileId: string, deleteFileIds: string[]) =>
        request('/dedup/merge', { method: 'POST', body: { keepFileId, deleteFileIds } }),
};
