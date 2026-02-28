import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import prisma from '../../db/index';
import { loadConfig } from '@openvault/config';
import { generateUrlSafeToken } from '@openvault/crypto';
import type { RegisterInput, LoginInput } from './schema';

const config = loadConfig();

/**
 * Register a new user.
 */
export async function registerUser(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
        throw Object.assign(new Error('Email already registered'), { statusCode: 409, code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    const user = await prisma.user.create({
        data: {
            email: input.email,
            passwordHash,
            name: input.name,
        },
        select: { id: true, email: true, name: true, role: true },
    });

    const tokens = await createSession(user.id, user.email, user.role);
    return { user, ...tokens };
}

/**
 * Authenticate a user with email and password.
 */
export async function loginUser(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }

    // Check MFA if enabled
    if (user.mfaEnabled && user.totpSecret) {
        if (!input.totpCode) {
            throw Object.assign(new Error('MFA code required'), { statusCode: 403, code: 'MFA_REQUIRED' });
        }
        const isValidTotp = authenticator.verify({ token: input.totpCode, secret: user.totpSecret });
        if (!isValidTotp) {
            throw Object.assign(new Error('Invalid MFA code'), { statusCode: 401, code: 'INVALID_MFA' });
        }
    }

    const tokens = await createSession(user.id, user.email, user.role, ipAddress, userAgent);
    return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
        ...tokens,
    };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string) {
    const session = await prisma.session.findFirst({
        where: { refreshToken, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!session) {
        throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401, code: 'INVALID_REFRESH' });
    }

    // Rotate refresh token
    const newRefreshToken = generateUrlSafeToken(48);
    const refreshExpiry = parseDuration(config.jwt.refreshExpiry);

    await prisma.session.update({
        where: { id: session.id },
        data: {
            refreshToken: newRefreshToken,
            expiresAt: new Date(Date.now() + refreshExpiry),
        },
    });

    const accessToken = generateAccessToken(session.user.id, session.user.email, session.user.role);

    return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Generate TOTP secret for MFA setup.
 */
export async function generateMfaSecret(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'OpenVault', secret);

    // Save secret temporarily (will be confirmed when user verifies)
    await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });

    return { secret, otpauthUrl };
}

/**
 * Verify and enable MFA for a user.
 */
export async function enableMfa(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true } });
    if (!user?.totpSecret) {
        throw Object.assign(new Error('MFA setup not initiated'), { statusCode: 400 });
    }

    const isValid = authenticator.verify({ token: totpCode, secret: user.totpSecret });
    if (!isValid) {
        throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 401 });
    }

    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
}

/**
 * Logout — invalidate a session.
 */
export async function logout(refreshToken: string) {
    await prisma.session.deleteMany({ where: { refreshToken } });
}

// ---- Internal Helpers ----

async function createSession(userId: string, email: string, role: string, ipAddress?: string, userAgent?: string) {
    const accessToken = generateAccessToken(userId, email, role);
    const refreshToken = generateUrlSafeToken(48);
    const refreshExpiry = parseDuration(config.jwt.refreshExpiry);

    await prisma.session.create({
        data: {
            userId,
            refreshToken,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            expiresAt: new Date(Date.now() + refreshExpiry),
        },
    });

    return { accessToken, refreshToken };
}

function generateAccessToken(userId: string, email: string, role: string): string {
    return jwt.sign({ sub: userId, email, role }, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry,
    });
}

function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600 * 1000; // default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 3600 * 1000,
        d: 24 * 3600 * 1000,
    };

    return value * (multipliers[unit] ?? 24 * 3600 * 1000);
}
