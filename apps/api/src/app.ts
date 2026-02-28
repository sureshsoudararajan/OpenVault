import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { loadConfig } from '@openvault/config';
import { authRoutes } from './modules/auth/routes';
import { userRoutes } from './modules/users/routes';
import { fileRoutes } from './modules/files/routes';
import { folderRoutes } from './modules/folders/routes';
import { versionRoutes } from './modules/versions/routes';
import { sharingRoutes } from './modules/sharing/routes';
import { collaborationRoutes } from './modules/collaboration/routes';
import { searchRoutes } from './modules/search/routes';
import { dedupRoutes } from './modules/dedup/routes';

export async function buildApp() {
    const config = loadConfig();

    const app = Fastify({
        logger: {
            level: config.nodeEnv === 'production' ? 'info' : 'debug',
            transport:
                config.nodeEnv === 'development'
                    ? { target: 'pino-pretty', options: { colorize: true } }
                    : undefined,
        },
        maxParamLength: 256,
    });

    // ---- Core Plugins ----
    await app.register(helmet, {
        contentSecurityPolicy: config.nodeEnv === 'production',
    });

    await app.register(cors, {
        origin: config.frontendUrl,
        credentials: true,
    });

    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    await app.register(cookie, {
        secret: config.jwt.refreshSecret,
    });

    await app.register(multipart, {
        limits: {
            fileSize: config.upload.maxChunkSize,
            files: 10,
        },
    });

    await app.register(websocket);

    // ---- Health Check ----
    app.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
    }));

    // ---- API Routes ----
    await app.register(
        async (api) => {
            await api.register(authRoutes, { prefix: '/auth' });
            await api.register(userRoutes, { prefix: '/users' });
            await api.register(fileRoutes, { prefix: '/files' });
            await api.register(folderRoutes, { prefix: '/folders' });
            await api.register(versionRoutes, { prefix: '/versions' });
            await api.register(sharingRoutes, { prefix: '/sharing' });
            await api.register(collaborationRoutes, { prefix: '/collaboration' });
            await api.register(searchRoutes, { prefix: '/search' });
            await api.register(dedupRoutes, { prefix: '/dedup' });
        },
        { prefix: '/api' }
    );

    // ---- Global Error Handler ----
    app.setErrorHandler((error, request, reply) => {
        const statusCode = error.statusCode ?? 500;

        app.log.error({
            err: error,
            request: {
                method: request.method,
                url: request.url,
                ip: request.ip,
            },
        });

        reply.status(statusCode).send({
            success: false,
            error: {
                code: error.code ?? 'INTERNAL_ERROR',
                message:
                    config.nodeEnv === 'production' && statusCode >= 500
                        ? 'Internal server error'
                        : error.message,
            },
        });
    });

    return app;
}
