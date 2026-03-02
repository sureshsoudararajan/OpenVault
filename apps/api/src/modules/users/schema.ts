import { z } from 'zod';

export const updateUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name max 100 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    avatarUrl: z.string().url('Invalid URL').optional(),
    currentPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
}).refine(data => {
    // If providing a new password, they MUST provide the current password
    if (data.newPassword && !data.currentPassword) {
        return false;
    }
    return true;
}, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
