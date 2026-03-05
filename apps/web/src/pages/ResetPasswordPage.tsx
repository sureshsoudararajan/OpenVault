import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';
import { Lock, Eye, EyeOff, Loader2, Key, MailOpen, ShieldCheck } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // For 2FA users: initially show TOTP input, can switch to secondary email
    const [requiresMfa, setRequiresMfa] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [useSecondaryEmail, setUseSecondaryEmail] = useState(false);

    // For non-2FA users: the email code is sent alongside the reset link
    const [emailCode, setEmailCode] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const token = new URLSearchParams(location.search).get('token');

    useEffect(() => {
        if (!token) {
            navigate('/login');
        }
    }, [token, navigate]);

    const handleSendSecondaryCode = async () => {
        if (!token) return;
        setSendingCode(true);
        setError('');
        try {
            await authApi.sendSecondaryCode(token);
            setUseSecondaryEmail(true);
            setCodeSent(true);
        } catch (err: any) {
            if (err.code === 'NO_SECONDARY_EMAIL') {
                setError('No secondary email configured. Please use your authenticator app instead.');
            } else {
                setError(err.message || 'Failed to send secondary code');
            }
        } finally {
            setSendingCode(false);
        }
    };

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

            if (requiresMfa) {
                // 2FA user: use TOTP or secondary email code
                if (useSecondaryEmail) {
                    payload.emailCode = mfaCode;
                } else {
                    payload.totpCode = mfaCode;
                }
            } else {
                // Non-2FA user: email code was sent in the reset email
                payload.emailCode = emailCode;
            }

            await authApi.resetPassword(payload);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            if (err.code === 'MFA_REQUIRED') {
                setRequiresMfa(true);
            } else if (err.code === 'INVALID_CODE') {
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

                {/* Verification code section */}
                {requiresMfa ? (
                    // 2FA user: show TOTP or secondary email option
                    <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
                            <ShieldCheck className="h-4 w-4 text-brand-500" />
                            Two-Factor Verification
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">
                                {useSecondaryEmail ? 'Code sent to secondary email' : 'Authenticator app code'}
                            </label>
                            <div className="relative">
                                {useSecondaryEmail ? (
                                    <MailOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                                ) : (
                                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                                )}
                                <input
                                    type="text"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    className="input-field pl-10 tracking-widest text-center"
                                    placeholder="000000"
                                    maxLength={8}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        {!useSecondaryEmail && !codeSent && (
                            <button
                                type="button"
                                onClick={handleSendSecondaryCode}
                                disabled={sendingCode}
                                className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-50"
                            >
                                {sendingCode ? 'Sending...' : 'Don\'t have access? Send code to secondary email'}
                            </button>
                        )}
                        {codeSent && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Code sent! Check your secondary email.</p>
                        )}
                    </div>
                ) : (
                    // Non-2FA user: email code was included in the reset email
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                            Email Verification Code
                        </label>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
                            Enter the 6-digit code included in your password reset email.
                        </p>
                        <div className="relative">
                            <MailOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                            <input
                                type="text"
                                value={emailCode}
                                onChange={(e) => setEmailCode(e.target.value)}
                                className="input-field pl-10 tracking-widest text-center"
                                placeholder="000000"
                                maxLength={6}
                                required
                            />
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !password || !confirmPassword || (requiresMfa ? !mfaCode : !emailCode)}
                    className="btn-primary w-full flex items-center justify-center gap-2 !text-white py-3 text-sm font-semibold"
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
