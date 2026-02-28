import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { loadConfig } from '@openvault/config';
import type { TokenPayload } from '@openvault/shared-types';

const config = loadConfig();

declare module 'fastify' {
    interface FastifyRequest {
        userId: string;
        userEmail: string;
        userRole: string;
    }
}

/**
 * Authentication guard — verifies JWT access token.
 * Attach to routes that require authentication.
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
        request.userId = payload.sub;
        request.userEmail = payload.email;
        request.userRole = payload.role;
    } catch (err) {
        reply.status(401).send({
            success: false,
            error: { code: 'TOKEN_EXPIRED', message: 'Access token is invalid or expired' },
        });
    }
}

/**
 * Role-based access control guard.
 * Use after authGuard to check user roles.
 */
export function requireRole(...roles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!roles.includes(request.userRole)) {
            reply.status(403).send({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
            });
        }
    };
}
