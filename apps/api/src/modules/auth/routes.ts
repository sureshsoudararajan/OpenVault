import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema, enableMfaSchema, passwordConfirmSchema } from './schema';
import * as authService from './service';
import { authGuard } from '../../middleware/auth';

export async function authRoutes(app: FastifyInstance) {
    // POST /api/auth/register
    app.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const result = await authService.registerUser(body);
        reply.status(201).send({ success: true, data: result });
    });

    // POST /api/auth/login
    app.post('/login', async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const result = await authService.loginUser(body, request.ip, request.headers['user-agent']);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/refresh
    app.post('/refresh', async (request, reply) => {
        const body = refreshTokenSchema.parse(request.body);
        const result = await authService.refreshAccessToken(body.refreshToken);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/logout
    app.post('/logout', async (request, reply) => {
        const body = refreshTokenSchema.parse(request.body);
        await authService.logout(body.refreshToken);
        reply.send({ success: true });
    });

    // GET /api/auth/mfa/setup — Generate TOTP secret
    app.get('/mfa/setup', { preHandler: [authGuard] }, async (request, reply) => {
        const result = await authService.generateMfaSecret(request.userId);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/mfa/enable — Verify and enable MFA
    app.post('/mfa/enable', { preHandler: [authGuard] }, async (request, reply) => {
        const body = enableMfaSchema.parse(request.body);
        const result = await authService.enableMfa(request.userId, body.totpCode);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/mfa/regenerate — Regenerate backup codes
    app.post('/mfa/regenerate', { preHandler: [authGuard] }, async (request, reply) => {
        const body = passwordConfirmSchema.parse(request.body);
        const result = await authService.regenerateMfaCodes(request.userId, body.passwordConfirm, body.totpCode);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/mfa/disable — Disable MFA entirely
    app.post('/mfa/disable', { preHandler: [authGuard] }, async (request, reply) => {
        const body = passwordConfirmSchema.parse(request.body);
        const result = await authService.disableMfa(request.userId, body.passwordConfirm, body.totpCode);
        reply.send({ success: true, data: result });
    });
}
