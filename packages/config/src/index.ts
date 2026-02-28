// ============================================
// Shared Environment Configuration
// ============================================

export interface AppConfig {
    nodeEnv: string;
    port: number;
    frontendUrl: string;
    apiUrl: string;

    database: {
        url: string;
    };

    redis: {
        url: string;
    };

    minio: {
        endpoint: string;
        port: number;
        accessKey: string;
        secretKey: string;
        bucket: string;
        useSSL: boolean;
    };

    meili: {
        host: string;
        masterKey: string;
    };

    jwt: {
        accessSecret: string;
        refreshSecret: string;
        accessExpiry: string;
        refreshExpiry: string;
    };

    oauth: {
        google: {
            clientId: string;
            clientSecret: string;
            callbackUrl: string;
        };
        github: {
            clientId: string;
            clientSecret: string;
            callbackUrl: string;
        };
    };

    encryption: {
        serverKey: string;
    };

    upload: {
        maxFileSize: number;
        maxChunkSize: number;
        defaultStorageQuota: number;
    };
}

/**
 * Load configuration from environment variables.
 * Call this at application startup.
 */
export function loadConfig(): AppConfig {
    return {
        nodeEnv: env('NODE_ENV', 'development'),
        port: envInt('PORT', 4000),
        frontendUrl: env('FRONTEND_URL', 'http://localhost:5173'),
        apiUrl: env('API_URL', 'http://localhost:4000'),

        database: {
            url: env('DATABASE_URL'),
        },

        redis: {
            url: env('REDIS_URL', 'redis://localhost:6379'),
        },

        minio: {
            endpoint: env('MINIO_ENDPOINT', 'localhost'),
            port: envInt('MINIO_PORT', 9000),
            accessKey: env('MINIO_ACCESS_KEY', 'openvault_minio'),
            secretKey: env('MINIO_SECRET_KEY', 'openvault_minio_secret'),
            bucket: env('MINIO_BUCKET', 'openvault-files'),
            useSSL: envBool('MINIO_USE_SSL', false),
        },

        meili: {
            host: env('MEILI_HOST', 'http://localhost:7700'),
            masterKey: env('MEILI_MASTER_KEY', ''),
        },

        jwt: {
            accessSecret: env('JWT_ACCESS_SECRET', 'dev-access-secret-change-me!!!!!'),
            refreshSecret: env('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me!!!!!'),
            accessExpiry: env('JWT_ACCESS_EXPIRY', '15m'),
            refreshExpiry: env('JWT_REFRESH_EXPIRY', '7d'),
        },

        oauth: {
            google: {
                clientId: env('GOOGLE_CLIENT_ID', ''),
                clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
                callbackUrl: env('GOOGLE_CALLBACK_URL', 'http://localhost:4000/api/auth/google/callback'),
            },
            github: {
                clientId: env('GITHUB_CLIENT_ID', ''),
                clientSecret: env('GITHUB_CLIENT_SECRET', ''),
                callbackUrl: env('GITHUB_CALLBACK_URL', 'http://localhost:4000/api/auth/github/callback'),
            },
        },

        encryption: {
            serverKey: env('ENCRYPTION_SERVER_KEY', 'dev-server-key-change-me-32chars!!'),
        },

        upload: {
            maxFileSize: envInt('MAX_FILE_SIZE', 5368709120),       // 5GB
            maxChunkSize: envInt('MAX_CHUNK_SIZE', 10485760),       // 10MB
            defaultStorageQuota: envInt('DEFAULT_STORAGE_QUOTA', 5368709120), // 5GB
        },
    };
}

// ---- Helpers ----

function env(key: string, fallback?: string): string {
    const value = process.env[key];
    if (value !== undefined) return value;
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
}

function envInt(key: string, fallback?: number): number {
    const value = process.env[key];
    if (value !== undefined) return parseInt(value, 10);
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
}

function envBool(key: string, fallback?: boolean): boolean {
    const value = process.env[key];
    if (value !== undefined) return value === 'true' || value === '1';
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
}
