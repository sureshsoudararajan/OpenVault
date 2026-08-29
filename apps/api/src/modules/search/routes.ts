import type { FastifyInstance } from 'fastify';
import { MeiliSearch } from 'meilisearch';
import { loadConfig } from '@openvault/config';
import prisma from '../../db/index';
import { authGuard } from '../../middleware/auth';

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
            where: { 
                id: fileId, 
                ...(request.userId !== 'system' ? { userId: request.userId } : {})
            },
            select: { id: true, name: true, mimeType: true, size: true, userId: true, folderId: true, createdAt: true, thumbnailKey: true },
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
                    thumbnailKey: file.thumbnailKey,
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

        // 1. Resolve shared files and folders to include in search
        const permissions = await prisma.permission.findMany({
            where: { grantedToId: request.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            include: { folder: { select: { path: true, id: true } } }
        });

        const explicitFileIds = permissions.map(p => p.fileId).filter(Boolean) as string[];
        const explicitFolderPaths = permissions.map(p => p.folder?.path).filter(Boolean) as string[];
        
        let allAccessibleFolderIds: string[] = permissions.map(p => p.folderId).filter(Boolean) as string[];
        
        if (explicitFolderPaths.length > 0) {
            const nested = await prisma.folder.findMany({
                where: { OR: explicitFolderPaths.map(path => ({ path: { startsWith: path } })) },
                select: { id: true }
            });
            allAccessibleFolderIds = Array.from(new Set([...allAccessibleFolderIds, ...nested.map(f => f.id)]));
        }

        try {
            const index = getMeili().index(FILES_INDEX);
            
            let filter = `userId = "${request.userId}"`;
            if (explicitFileIds.length > 0 || allAccessibleFolderIds.length > 0) {
                const parts = [];
                if (explicitFileIds.length > 0) parts.push(`id IN [${explicitFileIds.map(id => `"${id}"`).join(', ')}]`);
                if (allAccessibleFolderIds.length > 0) parts.push(`folderId IN [${allAccessibleFolderIds.map(id => `"${id}"`).join(', ')}]`);
                filter = `(${filter}) OR (${parts.join(' OR ')})`;
            }

            const results = await index.search(q, {
                filter,
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
            const dbWhere: any = {
                isTrashed: false,
                name: { contains: q, mode: 'insensitive' },
            };

            if (explicitFileIds.length > 0 || allAccessibleFolderIds.length > 0) {
                dbWhere.OR = [
                    { userId: request.userId },
                    ...(explicitFileIds.length > 0 ? [{ id: { in: explicitFileIds } }] : []),
                    ...(allAccessibleFolderIds.length > 0 ? [{ folderId: { in: allAccessibleFolderIds } }] : [])
                ];
            } else {
                dbWhere.userId = request.userId;
            }

            const [files, total] = await Promise.all([
                prisma.file.findMany({
                    where: dbWhere,
                    skip: (page - 1) * perPage,
                    take: perPage,
                    select: { id: true, name: true, mimeType: true, size: true, createdAt: true, thumbnailKey: true },
                }),
                prisma.file.count({ where: dbWhere }),
            ]);

            return {
                success: true,
                data: files.map((f: any) => ({ ...f, size: Number(f.size) })),
                meta: { page, perPage, total, fallback: true },
            };
        }
    });
}
