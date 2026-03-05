import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema, enableMfaSchema, passwordConfirmSchema, activateSchema, forgotPasswordSchema, resetPasswordSchema } from './schema';
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

    // POST /api/auth/disable — Disable MFA with password confirmation
    app.post('/mfa/disable', { preHandler: [authGuard] }, async (request, reply) => {
        const body = passwordConfirmSchema.parse(request.body);
        const result = await authService.disableMfaWithPassword(request.userId, body.passwordConfirm);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/activate
    app.post('/activate', async (request, reply) => {
        const body = activateSchema.parse(request.body);
        const result = await authService.activateAccount(body.token);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/resend-activation
    app.post('/resend-activation', async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body); // same { email } structure
        const result = await authService.resendActivation(body.email);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/forgot-password
    app.post('/forgot-password', async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body);
        const result = await authService.requestPasswordReset(body.email);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/reset-password/secondary-code
    app.post('/reset-password/secondary-code', async (request, reply) => {
        const body = activateSchema.parse(request.body); // same structure { token }
        const result = await authService.sendSecondaryCodeForReset(body.token);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/reset-password
    app.post('/reset-password', async (request, reply) => {
        const body = resetPasswordSchema.parse(request.body);
        const result = await authService.resetPassword(body);
        reply.send({ success: true, data: result });
    });

    // POST /api/auth/send-login-code — send email code for 2FA users who lost authenticator
    app.post('/send-login-code', async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body); // same { email } structure
        const result = await authService.sendLoginEmailCode(body.email);
        reply.send({ success: true, data: result });
    });
}
