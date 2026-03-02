import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // MFA States
    const [requireMfa, setRequireMfa] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((s) => s.setAuth);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload: any = { email, password };
            if (requireMfa && totpCode) {
                payload.totpCode = totpCode;
            }
            const res: any = await authApi.login(payload);
            setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
            navigate('/');
        } catch (err: any) {
            if (err.code === 'MFA_REQUIRED' || err.response?.data?.error?.code === 'MFA_REQUIRED') {
                setRequireMfa(true);
            } else {
                setError(err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    if (requireMfa) {
        return (
            <>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Two-Factor Authentication</h2>
                    <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                        {isRecoveryMode ? 'Enter one of your 8-character backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                            {isRecoveryMode ? 'Recovery Code' : 'Authentication Code'}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value)}
                                className="input-field pl-10 tracking-widest text-center"
                                placeholder={isRecoveryMode ? 'XXXXXXXX' : '000000'}
                                maxLength={isRecoveryMode ? 8 : 6}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !totpCode}
                        className="btn-primary w-full flex items-center justify-center gap-2 !text-white py-3 text-sm font-semibold"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : 'Verify & Continue'}
                    </button>

                    <div className="text-center mt-4">
                        <button
                            type="button"
                            onClick={() => setIsRecoveryMode(!isRecoveryMode)}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                        >
                            {isRecoveryMode ? 'Use Authenticator App instead' : 'Use a Recovery Code'}
                        </button>
                    </div>
                </form>
            </>
        );
    }

    return (
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back</h2>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">Sign in to access your files</p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field pl-10"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                </div>

                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Password</label>
                        <button type="button" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                            Forgot password?
                        </button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field pl-10 pr-10"
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 !text-white py-3 text-sm font-semibold"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        <>
                            Sign In
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <span className="text-sm text-surface-500 dark:text-surface-400">Don't have an account? </span>
                <Link to="/register" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    Create one
                </Link>
            </div>
        </>
    );
}
