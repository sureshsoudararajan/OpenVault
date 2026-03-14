import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema, enableMfaSchema, passwordConfirmSchema, activateSchema, forgotPasswordSchema, resetPasswordSchema, verifyMfaSchema } from './schema';
import * as authService from './service';
import { authGuard } from '../../middleware/auth';
import oauth2 from '@fastify/oauth2';
import axios from 'axios';
import { loadConfig } from '@openvault/config';

const config = loadConfig();

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

    // POST /api/auth/mfa/verify — Complete login with MFA
    app.post('/mfa/verify', async (request, reply) => {
        const body = verifyMfaSchema.parse(request.body);
        const result = await authService.verifyMfa(body, request.ip, request.headers['user-agent']);
        reply.send({ success: true, data: result });
    });

    // ---- OAuth2 Support ----

    if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
        await app.register(oauth2, {
            name: 'googleOAuth2',
            scope: ['profile', 'email'],
            credentials: {
                client: {
                    id: config.oauth.google.clientId,
                    secret: config.oauth.google.clientSecret,
                },
                auth: oauth2.GOOGLE_CONFIGURATION,
            },
            startRedirectPath: '/google',
            callbackUri: `${config.apiUrl}/auth/google/callback`,
        });

        app.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { token } = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
                const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token.access_token}` },
                });

                const result: any = await authService.loginWithOAuth({
                    id: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    avatarUrl: profile.picture,
                    provider: 'google'
                }, request.ip, request.headers['user-agent']);

                const redirectUrl = new URL(`${config.frontendUrl}/login`);
                
                if (result.mfaRequired) {
                    redirectUrl.searchParams.set('mfaRequired', 'true');
                    redirectUrl.searchParams.set('mfaToken', result.mfaToken);
                    redirectUrl.searchParams.set('email', result.email);
                } else {
                    redirectUrl.searchParams.set('accessToken', result.accessToken);
                    redirectUrl.searchParams.set('refreshToken', result.refreshToken);
                }

                return reply.redirect(redirectUrl.toString());
            } catch (err: any) {
                app.log.error(err, 'Google OAuth Callback Error');
                return reply.redirect(`${config.frontendUrl}/login?error=OAuth failed`);
            }
        });
    }

    if (config.oauth.github.clientId && config.oauth.github.clientSecret) {
        await app.register(oauth2, {
            name: 'githubOAuth2',
            scope: ['user:email', 'read:user'],
            credentials: {
                client: {
                    id: config.oauth.github.clientId,
                    secret: config.oauth.github.clientSecret,
                },
                auth: oauth2.GITHUB_CONFIGURATION,
            },
            startRedirectPath: '/github',
            callbackUri: `${config.apiUrl}/auth/github/callback`,
        });

        app.get('/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { token } = await (app as any).githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

                const { data: profile } = await axios.get('https://api.github.com/user', {
                    headers: { Authorization: `Bearer ${token.access_token}` },
                });

                // GitHub might not return email in primary profile if private
                let email = profile.email;
                if (!email) {
                    const { data: emails } = await axios.get('https://api.github.com/user/emails', {
                        headers: { Authorization: `Bearer ${token.access_token}` },
                    });
                    email = emails.find((e: any) => e.primary && e.verified)?.email || emails[0]?.email;
                }

                const result: any = await authService.loginWithOAuth({
                    id: String(profile.id),
                    email,
                    name: profile.name || profile.login,
                    avatarUrl: profile.avatar_url,
                    provider: 'github'
                }, request.ip, request.headers['user-agent']);

                const redirectUrl = new URL(`${config.frontendUrl}/login`);
                
                if (result.mfaRequired) {
                    redirectUrl.searchParams.set('mfaRequired', 'true');
                    redirectUrl.searchParams.set('mfaToken', result.mfaToken);
                    redirectUrl.searchParams.set('email', result.email);
                } else {
                    redirectUrl.searchParams.set('accessToken', result.accessToken);
                    redirectUrl.searchParams.set('refreshToken', result.refreshToken);
                }

                return reply.redirect(redirectUrl.toString());
            } catch (err: any) {
                app.log.error(err, 'GitHub OAuth Callback Error');
                return reply.redirect(`${config.frontendUrl}/login?error=OAuth failed`);
            }
        });
    }
}
