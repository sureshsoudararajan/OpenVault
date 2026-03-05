import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').max(100),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    totpCode: z.string().optional(),
    emailCode: z.string().optional(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const enableMfaSchema = z.object({
    totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const passwordConfirmSchema = z.object({
    passwordConfirm: z.string().min(1, 'Password confirmation is required'),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type EnableMfaInput = z.infer<typeof enableMfaSchema>;
export type PasswordConfirmInput = z.infer<typeof passwordConfirmSchema>;

export const activateSchema = z.object({
    token: z.string().min(1, 'Activation token is required'),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
    emailCode: z.string().min(6, 'Verification code is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ActivateInput = z.infer<typeof activateSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
