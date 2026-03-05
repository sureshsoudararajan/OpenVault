import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, Send, ShieldCheck, Key } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<'email' | 'code' | 'success'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Step 1: Send verification code to email
    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authApi.forgotPassword(email);
            setStep('code');
        } catch (err: any) {
            setError(err.message || 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify code and reset password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await authApi.resetPassword({ email, emailCode: code, newPassword: password });
            setStep('success');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setLoading(true);
        setError('');
        try {
            await authApi.forgotPassword(email);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to resend code');
        } finally {
            setLoading(false);
        }
    };

    // Success screen
    if (step === 'success') {
        return (
            <div className="text-center animate-fade-in py-8">
                <div className="mb-6 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                        <Key className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Password Reset!</h2>
                <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-sm mx-auto">
                    Your password has been successfully reset. Redirecting to login...
                </p>
                <Link to="/login" className="btn-primary w-full flex justify-center items-center gap-2">
                    Back to login
                </Link>
            </div>
        );
    }

    // Step 2: Enter code + new password
    if (step === 'code') {
        return (
            <div className="animate-fade-in">
                <button
                    onClick={() => setStep('email')}
                    className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft className="h-4 w-4" /> Change email
                </button>

                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Reset your password</h2>
                    <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                        We sent a 6-digit code to <span className="font-semibold text-surface-900 dark:text-white">{email}</span>. Enter it below along with your new password.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                        {error}
                    </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Verification Code</label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="input-field pl-10 tracking-widest text-center text-lg"
                                placeholder="000000"
                                maxLength={6}
                                required
                                autoFocus
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={loading}
                            className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-50"
                        >
                            Didn't receive the code? Resend
                        </button>
                    </div>

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
                                className="input-field pl-10"
                                placeholder="Confirm new password"
                                minLength={8}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !code || !password || !confirmPassword}
                        className="btn-primary w-full flex items-center justify-center gap-2 !text-white py-3 text-sm font-semibold"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</> : 'Reset Password'}
                    </button>
                </form>
            </div>
        );
    }

    // Step 1: Enter email
    return (
        <div className="animate-fade-in">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>

            <div className="mb-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Forgot password</h2>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                    Enter your email address and we'll send you a verification code to reset your password.
                </p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                    {error}
                </div>
            )}

            <form onSubmit={handleSendCode} className="space-y-6">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Email address</label>
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

                <button
                    type="submit"
                    disabled={loading || !email}
                    className="btn-primary w-full flex items-center justify-center gap-2 !text-white py-3 text-sm font-semibold"
                >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Verification Code</>}
                </button>
            </form>
        </div>
    );
}
