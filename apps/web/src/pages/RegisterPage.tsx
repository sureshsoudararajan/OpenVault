import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, Github } from 'lucide-react';
export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await authApi.register({ email, password, name });
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };
    if (success) {
        return (
            <div className="text-center animate-fade-in py-8">
                <div className="mb-6 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20">
                        <Mail className="h-8 w-8 text-brand-600 dark:text-brand-400" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Check your email</h2>
                <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-sm mx-auto">
                    We've sent an activation link to <span className="font-semibold text-surface-900 dark:text-white">{email}</span>. Please click the link to activate your account.
                </p>
                <Link to="/login" className="btn-primary w-full flex justify-center items-center gap-2">
                    Back to login <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        );
    }
    return (
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Create your account</h2>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">Start storing your files securely</p>
            </div>
            {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Full Name</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-field pl-10"
                            placeholder="Suresh S"
                            required
                        />
                    </div>
                </div>
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
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Password</label>
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        <>
                            Create Account
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-surface-200 dark:border-surface-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-white dark:bg-surface-900 px-2 text-surface-500">Or continue with</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Google
                </button>
                <button
                    onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/auth/github`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                >
                    <Github className="h-4 w-4" />
                    GitHub
                </button>
            </div>
            <div className="mt-6 text-center">
                <span className="text-sm text-surface-500 dark:text-surface-400">Already have an account? </span>
                <Link to="/login" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    Sign in
                </Link>
            </div>
        </>
    );
}
