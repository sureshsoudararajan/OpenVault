import type { FastifyInstance } from 'fastify';
import { MeiliSearch } from 'meilisearch';
import { loadConfig } from '@openvault/config';
import prisma from '../../db/index.js';
import { authGuard } from '../../middleware/auth.js';

const config = loadConfig();
let meiliClient: MeiliSearch;

function getMeili(): MeiliSearch {
    if (!meiliClient) {
        meiliClient = new MeiliSearch({
            host: config.meili.host,
            apiKey: config.meili.masterKey,
        });
    }
    return meiliClient;
}

const FILES_INDEX = 'files';

export async function searchRoutes(app: FastifyInstance) {
    // POST /api/search/index — Index a file (internal use / after upload)
    app.post('/index', { preHandler: [authGuard] }, async (request, reply) => {
        const { fileId } = request.body as { fileId: string };

        const file = await prisma.file.findFirst({
            where: { id: fileId, userId: request.userId },
            select: { id: true, name: true, mimeType: true, size: true, userId: true, folderId: true, createdAt: true },
        });

        if (!file) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        }

        try {
            const index = getMeili().index(FILES_INDEX);
            await index.addDocuments([
                {
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: Number(file.size),
                    userId: file.userId,
                    folderId: file.folderId,
                    createdAt: file.createdAt.toISOString(),
                },
            ]);
        } catch {
            // MeiliSearch may not be available — graceful degradation
            app.log.warn('MeiliSearch unavailable, skipping indexing');
        }

        return { success: true };
    });

    // GET /api/search — Search files
    app.get('/', { preHandler: [authGuard] }, async (request) => {
        const { q, page = 1, perPage = 20 } = request.query as { q: string; page?: number; perPage?: number };

        if (!q || q.trim().length === 0) {
            return { success: true, data: [], meta: { page, perPage, total: 0 } };
        }

        try {
            const index = getMeili().index(FILES_INDEX);
            const results = await index.search(q, {
                filter: [`userId = "${request.userId}"`],
                limit: perPage,
                offset: (page - 1) * perPage,
            });

            return {
                success: true,
                data: results.hits,
                meta: {
                    page,
                    perPage,
                    total: results.estimatedTotalHits ?? 0,
                    processingTimeMs: results.processingTimeMs,
                },
            };
        } catch {
            // Fallback to database search if MeiliSearch is unavailable
            const [files, total] = await Promise.all([
                prisma.file.findMany({
                    where: {
                        userId: request.userId,
                        isTrashed: false,
                        name: { contains: q, mode: 'insensitive' },
                    },
                    skip: (page - 1) * perPage,
                    take: perPage,
                    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
                }),
                prisma.file.count({
                    where: { userId: request.userId, isTrashed: false, name: { contains: q, mode: 'insensitive' } },
                }),
            ]);

            return {
                success: true,
                data: files.map((f) => ({ ...f, size: Number(f.size) })),
                meta: { page, perPage, total, fallback: true },
            };
        }
    });
}
