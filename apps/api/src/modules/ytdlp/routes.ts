import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import youtubedl from 'youtube-dl-exec';
import { authGuard } from '../../middleware/auth';
import prisma from '../../db/index';
import { loadConfig } from '@openvault/config';
import { sha256 } from '@openvault/crypto';
import { uploadObject, buildStorageKey, getObject } from '../../storage/minio';
import { enqueueThumbnail, enqueueDedupScan } from '../../jobs/index';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const config = loadConfig();

const fetchSchema = z.object({
    url: z.string().url(),
    cookieId: z.string().uuid().optional().nullable(),
});

export async function ytdlpRoutes(app: FastifyInstance) {
    // POST /api/ytdlp/fetch-info — Fetch video metadata and formats
    app.post('/fetch-info', { preHandler: [authGuard] }, async (request, reply) => {
        const bodyParse = fetchSchema.safeParse(request.body);
        if (!bodyParse.success) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_URL', message: 'Please provide a valid URL' }
            });
        }

        const { url, cookieId } = bodyParse.data;

        let tempCookiePath: string | null = null;

        try {
            const options: any = {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificates: true,
                preferFreeFormats: true,
                extractorArgs: 'youtube:player-client=web,default',
            };

            if (cookieId) {
                const cookieProfile = await prisma.ytdlpCookie.findUnique({
                    where: { id: cookieId }
                });
                if (!cookieProfile || cookieProfile.userId !== request.userId) {
                    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Cookie profile not found or unauthorized' } });
                }
                
                tempCookiePath = `/tmp/ytdlp_cookie_${randomUUID()}.txt`;
                const cookieStream = await getObject(config.minio.bucket, cookieProfile.storageKey);
                await pipeline(cookieStream, createWriteStream(tempCookiePath));
                options.cookies = tempCookiePath;
            } else if (process.env.YTDLP_COOKIES_FILE) {
                options.cookies = process.env.YTDLP_COOKIES_FILE;
            }

            const output: any = await youtubedl(url, options);

            return reply.send({
                success: true,
                data: {
                    id: output.id,
                    title: output.title,
                    thumbnail: output.thumbnail,
                    description: output.description,
                    duration: output.duration,
                    formats: output.formats?.map((f: any) => ({
                        format_id: f.format_id,
                        ext: f.ext,
                        resolution: f.resolution,
                        filesize: f.filesize,
                        vcodec: f.vcodec,
                        acodec: f.acodec,
                        video_ext: f.video_ext,
                        audio_ext: f.audio_ext,
                        format_note: f.format_note,
                        tbr: f.tbr,
                    })).filter((f: any) => f.vcodec !== 'none' || f.acodec !== 'none')
                }
            });
        } catch (error: any) {
            app.log.error({ err: error, url }, 'Failed to fetch video info');
            return reply.status(500).send({
                success: false,
                error: { code: 'YTDLP_ERROR', message: 'Failed to fetch video information. Ensure the URL is valid and supported.' }
            });
        } finally {
            if (tempCookiePath) {
                await fs.unlink(tempCookiePath).catch(() => {});
            }
        }
    });

    const downloadSchema = z.object({
        url: z.string().url(),
        format: z.string().min(1),
        folderId: z.string().uuid().nullable().optional(),
        cookieId: z.string().uuid().optional().nullable(),
    });

    // Helper for random string
    const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length);

    // POST /api/ytdlp/download — Download the select format
    app.post('/download', { preHandler: [authGuard] }, async (request, reply) => {
        const bodyParse = downloadSchema.safeParse(request.body);
        if (!bodyParse.success) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Please provide valid url and format' }
            });
        }

        const { url, format, folderId, cookieId } = bodyParse.data;
        const tempFilename = `ytdlp_${Date.now()}_${randomString()}`;
        const tempPathPattern = `/tmp/${tempFilename}.%(ext)s`;
        let tempCookiePath: string | null = null;

        try {
            // Check storage quota first before downloading
            const user = await prisma.user.findUnique({
                where: { id: request.userId },
                select: { storageUsed: true, storageQuota: true },
            });
            if (!user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
            
            // Note: We can't perfectly check quota before download without fetching format info again,
            // but we'll enforce it as much as possible once downloaded file exists. Minimum check:
            if (user.storageUsed >= user.storageQuota) {
                return reply.status(413).send({ success: false, error: { code: 'QUOTA_EXCEEDED', message: 'Storage quota exceeded' }});
            }

            // Set headers for NDJSON streaming
            reply.raw.setHeader('Content-Type', 'application/x-ndjson');
            reply.raw.setHeader('Transfer-Encoding', 'chunked');

            app.log.info({ url, format }, 'Starting yt-dlp download streams...');

            const dlOptions: any = {
                format: format,
                output: tempPathPattern,
                noWarnings: true,
                noCheckCertificates: true,
                writeInfoJson: true, // Saves metadata for title extraction
                newline: true, // Ensures progress updates are on new lines
                extractorArgs: 'youtube:player-client=web,default'
            };

            if (cookieId) {
                const cookieProfile = await prisma.ytdlpCookie.findUnique({
                    where: { id: cookieId }
                });
                if (!cookieProfile || cookieProfile.userId !== request.userId) {
                    reply.raw.write(JSON.stringify({ type: 'error', error: 'Cookie profile not found or unauthorized' }) + '\n');
                    return reply.raw.end();
                }
                
                tempCookiePath = `/tmp/ytdlp_cookie_${randomString()}.txt`;
                const cookieStream = await getObject(config.minio.bucket, cookieProfile.storageKey);
                await pipeline(cookieStream, createWriteStream(tempCookiePath));
                dlOptions.cookies = tempCookiePath;
            } else if (process.env.YTDLP_COOKIES_FILE) {
                dlOptions.cookies = process.env.YTDLP_COOKIES_FILE;
            }

            const ytProcess = youtubedl.exec(url, dlOptions);

            if (ytProcess.stdout) {
                ytProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    // Example regex: [download]  84.7% of   11.28MiB at  237.07KiB/s ETA 00:07
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([~\d.\w]+)\s+at\s+([\d.\w]+\/s)\s+ETA\s+([\d:]+)/);
                        if (match) {
                            const percent = parseFloat(match[1]);
                            const size = match[2];
                            const speed = match[3];
                            const eta = match[4];
                            
                            reply.raw.write(JSON.stringify({
                                type: 'progress',
                                percent,
                                size,
                                speed,
                                eta
                            }) + '\n');
                        }
                    }
                });
            }

            await new Promise((resolve, reject) => {
                ytProcess.on('close', (code) => {
                    if (code === 0) resolve(undefined);
                    else reject(new Error(`yt-dlp exited with code ${code}`));
                });
                ytProcess.on('error', reject);
            });

            // Extract title from info.json
            const infoJsonPath = `/tmp/${tempFilename}.info.json`;
            let videoTitle = 'Video Download';
            try {
                const infoContent = await fs.readFile(infoJsonPath, 'utf8');
                const output = JSON.parse(infoContent);
                if (output.title) videoTitle = output.title;
            } catch (err) {
                app.log.warn({ err }, 'Could not read info.json for video title');
            }

            // yt-dlp might merge files into a different extension (.mkv, .mp4, etc.)
            // so we scan /tmp for the unique file prefix
            const tmpFiles = await fs.readdir('/tmp');
            const downloadedFile = tmpFiles.find(f => f.startsWith(tempFilename) && !f.endsWith('.info.json'));

            if (!downloadedFile) {
                throw new Error("Could not locate downloaded file in /tmp");
            }

            const actualTempPath = path.join('/tmp', downloadedFile);
            const fileStat = await fs.stat(actualTempPath);
            const fileSize = BigInt(fileStat.size);

            if (user.storageUsed + fileSize > user.storageQuota) {
                await fs.unlink(actualTempPath).catch(() => {});
                await fs.unlink(`/tmp/${tempFilename}.info.json`).catch(() => {});
                reply.raw.write(JSON.stringify({ type: 'error', error: 'File is too large for remaining storage quota' }) + '\n');
                return reply.raw.end();
            }

            const fileBuffer = await fs.readFile(actualTempPath);
            const hash = sha256(fileBuffer);

            // Determine mime type based on ext
            const ext = path.extname(actualTempPath).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (ext === '.mp4') mimeType = 'video/mp4';
            else if (ext === '.webm') mimeType = 'video/webm';
            else if (ext === '.mkv') mimeType = 'video/x-matroska';
            else if (ext === '.mp3') mimeType = 'audio/mpeg';
            else if (ext === '.m4a') mimeType = 'audio/mp4';
            else if (ext === '.wav') mimeType = 'audio/wav';
            else if (ext === '.ogg') mimeType = 'audio/ogg';

            const name = `${videoTitle}${ext}`;
            const storageKey = buildStorageKey(request.userId, folderId || null, hash);

            await uploadObject(config.minio.bucket, storageKey, fileBuffer, {
                'Content-Type': mimeType,
            });

            const file = await prisma.file.create({
                data: {
                    userId: request.userId,
                    folderId: folderId || null,
                    name: name,
                    mimeType: mimeType,
                    size: fileSize,
                    sha256Hash: hash,
                    storageKey,
                },
            });

            await prisma.fileVersion.create({
                data: {
                    fileId: file.id,
                    versionNumber: 1,
                    size: fileSize,
                    sha256Hash: hash,
                    storageKey,
                    createdBy: request.userId,
                },
            });

            await prisma.user.update({
                where: { id: request.userId },
                data: { storageUsed: { increment: fileSize } },
            });

            await prisma.activityLog.create({
                data: {
                    userId: request.userId,
                    action: 'upload',
                    resourceId: file.id,
                    resourceType: 'file',
                    metadata: { fileName: name, size: Number(fileSize), source: 'ytdlp' },
                    ipAddress: request.ip,
                },
            });

            // Make sure these are properly extracted imports at top of file
            await enqueueThumbnail(file.id, mimeType, storageKey);
            await enqueueDedupScan(file.id, hash, request.userId);

            try {
                await fetch(`${config.apiUrl}/api/search/index`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer INTERNAL_${config.jwt.accessSecret}` 
                    },
                    body: JSON.stringify({ fileId: file.id })
                });
            } catch (e: any) {
                app.log.warn({ err: e }, `⚠️ Failed to trigger initial search indexing for yt-dlp download ${file.id}`);
            }

            // Clean up temporary files
            await fs.unlink(actualTempPath).catch(() => {});
            await fs.unlink(`/tmp/${tempFilename}.info.json`).catch(() => {});

            // Send complete payload
            reply.raw.write(JSON.stringify({
                type: 'complete',
                file: { ...file, size: Number(file.size) }
            }) + '\n');
            reply.raw.end();
            // We tell fastify that we have already handled the response raw
            return reply;

        } catch (error: any) {
             app.log.error({ err: error, url, format }, 'Failed to download video');
            
             // Check if headers are already sent
             if (!reply.raw.headersSent) {
                 return reply.status(500).send({
                     success: false,
                     error: { code: 'DOWNLOAD_FAILED', message: 'Failed to download the requested format. Check logs.' }
                 });
             } else {
                  reply.raw.write(JSON.stringify({ type: 'error', error: 'Failed to download the requested format. Check logs.' }) + '\n');
                  return reply.raw.end();
             }
        } finally {
             if (tempCookiePath) {
                 await fs.unlink(tempCookiePath).catch(() => {});
             }
        }
    });
}
