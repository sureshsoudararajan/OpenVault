import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';
import { Lock, Eye, EyeOff, Loader2, Key } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const token = new URLSearchParams(location.search).get('token');

    useEffect(() => {
        if (!token) {
            navigate('/login');
        }
    }, [token, navigate]);



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!token) return;
        setLoading(true);

        try {
            const payload: any = { token, newPassword: password };
            // The actual backend doesn't seem to track RequiresMfa/emailCode in the reset route
            // For now just pass the new password.

            await authApi.resetPassword(payload);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            if (err.code === 'INVALID_CODE') {
                setError('Invalid or expired verification code. Please check the code and try again.');
            } else {
                setError(err.message || 'Failed to reset password');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center animate-fade-in py-8">
                <div className="mb-6 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                        <Key className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Password Reset!</h2>
                <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-sm mx-auto">
                    Your password has been successfully reset. You will be redirected to the login page shortly.
                </p>
                <Link to="/login" className="btn-primary w-full flex justify-center items-center gap-2">
                    Back to login
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Choose a new password</h2>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                    Make sure it's at least 8 characters long.
                </p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">New Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field pl-10 pr-10"
                            placeholder="Min 8 characters"
                            minLength={8}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Confirm Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input-field pl-10 pr-10"
                            placeholder="Confirm new password"
                            minLength={8}
                            required
                        />
                    </div>
                </div>



                <button
                    type="submit"
                    disabled={loading || !password || !confirmPassword}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Reset Password'}
                </button>
            </form>

            <p className="mt-4 text-center text-xs text-surface-500 dark:text-surface-400">
                Remember your password?{' '}
                <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
