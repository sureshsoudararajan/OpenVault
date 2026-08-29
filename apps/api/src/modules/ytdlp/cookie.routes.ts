import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authGuard } from '../../middleware/auth';
import prisma from '../../db/index';
import { loadConfig } from '@openvault/config';
import { uploadObject, deleteObject } from '../../storage/minio';
import { randomUUID } from 'crypto';

const config = loadConfig();

const createCookieSchema = z.object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Name must contain only letters, numbers, and underscores'),
    domain: z.string().optional()
});

const updateCookieSchema = z.object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/, 'Name must contain only letters, numbers, and underscores').optional(),
    domain: z.string().optional()
});

export async function ytdlpCookieRoutes(app: FastifyInstance) {
    // GET /api/ytdlp/cookies
    app.get('/cookies', { preHandler: [authGuard] }, async (request, reply) => {
        const cookies = await prisma.ytdlpCookie.findMany({
            where: { userId: request.userId },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send({ success: true, data: cookies });
    });

    // POST /api/ytdlp/cookies
    app.post('/cookies', { preHandler: [authGuard] }, async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No cookie file uploaded' } });
        }

        // We assume fields come as JSON in a 'metadata' field, or just as separate fields.
        // Fastify multipart handles fields on `data.fields`.
        let name = '';
        let domain = '';

        if (data.fields.name && 'value' in data.fields.name) {
            name = String(data.fields.name.value);
        }
        if (data.fields.domain && 'value' in data.fields.domain) {
            domain = String(data.fields.domain.value);
        }

        const parseResult = createCookieSchema.safeParse({ name, domain });
        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: parseResult.error.errors[0].message }
            });
        }

        // Check if name already exists for user
        const existing = await prisma.ytdlpCookie.findUnique({
            where: { userId_name: { userId: request.userId, name: parseResult.data.name } }
        });
        if (existing) {
            return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'A cookie profile with this name already exists' } });
        }

        const fileBuffer = await data.toBuffer();
        if (fileBuffer.length > 5 * 1024 * 1024) { // 5MB limit for cookies.txt
            return reply.status(413).send({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Cookie file is too large' } });
        }

        const storageKey = `cookies/${request.userId}/${randomUUID()}.txt`;

        await uploadObject(config.minio.bucket, storageKey, fileBuffer, {
            'Content-Type': 'text/plain',
        });

        const cookie = await prisma.ytdlpCookie.create({
            data: {
                userId: request.userId,
                name: parseResult.data.name,
                domain: parseResult.data.domain || null,
                storageKey,
            }
        });

        return reply.send({ success: true, data: cookie });
    });

    // PUT /api/ytdlp/cookies/:id
    app.put('/cookies/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const data = await request.file(); // Might be undefined if only updating metadata

        let name = undefined;
        let domain = undefined;

        if (data) {
            if (data.fields.name && 'value' in data.fields.name) name = String(data.fields.name.value);
            if (data.fields.domain && 'value' in data.fields.domain) domain = String(data.fields.domain.value);
        } else {
            // Might be JSON body if no file is sent
            const bodyParse = updateCookieSchema.safeParse(request.body || {});
            if (bodyParse.success) {
                name = bodyParse.data.name;
                domain = bodyParse.data.domain;
            }
        }

        const cookie = await prisma.ytdlpCookie.findUnique({ where: { id } });
        if (!cookie || cookie.userId !== request.userId) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cookie profile not found' } });
        }

        if (name && name !== cookie.name) {
            const existing = await prisma.ytdlpCookie.findUnique({
                where: { userId_name: { userId: request.userId, name } }
            });
            if (existing) {
                return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'A cookie profile with this name already exists' } });
            }
        }

        let storageKey = cookie.storageKey;
        if (data && data.filename) {
            const fileBuffer = await data.toBuffer();
            if (fileBuffer.length > 5 * 1024 * 1024) {
                return reply.status(413).send({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Cookie file is too large' } });
            }
            await deleteObject(config.minio.bucket, storageKey).catch(() => {});
            storageKey = `cookies/${request.userId}/${randomUUID()}.txt`;
            await uploadObject(config.minio.bucket, storageKey, fileBuffer, {
                'Content-Type': 'text/plain',
            });
        }

        const updatedCookie = await prisma.ytdlpCookie.update({
            where: { id },
            data: {
                name: name || cookie.name,
                domain: domain !== undefined ? (domain || null) : cookie.domain,
                storageKey
            }
        });

        return reply.send({ success: true, data: updatedCookie });
    });

    // DELETE /api/ytdlp/cookies/:id
    app.delete('/cookies/:id', { preHandler: [authGuard] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const cookie = await prisma.ytdlpCookie.findUnique({ where: { id } });
        
        if (!cookie || cookie.userId !== request.userId) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cookie profile not found' } });
        }

        await deleteObject(config.minio.bucket, cookie.storageKey).catch(err => {
            app.log.warn({ err }, `Failed to delete cookie file ${cookie.storageKey} from MinIO`);
        });

        await prisma.ytdlpCookie.delete({ where: { id } });

        return reply.send({ success: true });
    });
}
