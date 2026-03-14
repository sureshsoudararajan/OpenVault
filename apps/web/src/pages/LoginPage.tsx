import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, RefreshCw, Send, Github } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // MFA States
    const [requireMfa, setRequireMfa] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [isEmailCodeMode, setIsEmailCodeMode] = useState(false);
    const [sendingEmailCode, setSendingEmailCode] = useState(false);
    const [emailCodeSent, setEmailCodeSent] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [notActivated, setNotActivated] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const setAuth = useAuthStore((s: any) => s.setAuth);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const errorParam = searchParams.get('error');

        if (accessToken && refreshToken) {
            // We need to fetch user profile since OAuth callback only gave us tokens
            authApi.getMeWithToken(accessToken).then((res: any) => {
                setAuth(res.data, accessToken, refreshToken);
                navigate('/');
            }).catch(() => {
                setError('Failed to complete social login');
            });
        } else if (errorParam) {
            setError(errorParam);
        }
    }, [searchParams, setAuth, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload: any = { email, password };
            if (requireMfa && totpCode) {
                if (isEmailCodeMode) {
                    payload.emailCode = totpCode;
                } else {
                    payload.totpCode = totpCode;
                }
            }
            const res: any = await authApi.login(payload);
            setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
            navigate('/');
        } catch (err: any) {
            if (err.code === 'MFA_REQUIRED' || err.response?.data?.error?.code === 'MFA_REQUIRED') {
                setRequireMfa(true);
            } else if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
                setNotActivated(true);
                setError('Your account is not yet activated. Please check your email or resend the activation link.');
            } else {
                setError(err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendActivation = async () => {
        setResending(true);
        setResendSuccess(false);
        try {
            await authApi.resendActivation(email);
            setResendSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Failed to resend activation email');
        } finally {
            setResending(false);
        }
    };

    const handleSendEmailCode = async () => {
        setSendingEmailCode(true);
        setError('');
        try {
            await authApi.sendLoginCode(email);
            setIsEmailCodeMode(true);
            setIsRecoveryMode(false);
            setEmailCodeSent(true);
            setTotpCode('');
        } catch (err: any) {
            setError(err.message || 'Failed to send email code');
        } finally {
            setSendingEmailCode(false);
        }
    };

    if (requireMfa) {
        return (
            <>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Two-Factor Authentication</h2>
                    <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                        {isEmailCodeMode
                            ? 'Enter the 6-digit code sent to your email.'
                            : isRecoveryMode
                                ? 'Enter one of your 8-character backup codes.'
                                : 'Enter the 6-digit code from your authenticator app.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-fade-in">
                        {error}
                    </div>
                )}

                {emailCodeSent && (
                    <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 animate-fade-in">
                        ✓ Verification code sent to your email!
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                            {isEmailCodeMode ? 'Email Code' : isRecoveryMode ? 'Recovery Code' : 'Authentication Code'}
                        </label>
                        <div className="relative">
                            {isEmailCodeMode ? (
                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                            ) : (
                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                            )}
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value)}
                                className="input-field pl-10 tracking-widest text-center"
                                placeholder={isEmailCodeMode ? '000000' : isRecoveryMode ? 'XXXXXXXX' : '000000'}
                                maxLength={isRecoveryMode ? 8 : 6}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !totpCode}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : 'Verify & Continue'}
                    </button>

                    <div className="flex flex-col items-center gap-2 mt-4">
                        {!isRecoveryMode && !isEmailCodeMode && (
                            <button
                                type="button"
                                onClick={() => { setIsRecoveryMode(true); setTotpCode(''); }}
                                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                            >
                                Use a Recovery Code
                            </button>
                        )}
                        {(isRecoveryMode || isEmailCodeMode) && (
                            <button
                                type="button"
                                onClick={() => { setIsRecoveryMode(false); setIsEmailCodeMode(false); setTotpCode(''); setEmailCodeSent(false); }}
                                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                            >
                                Use Authenticator App
                            </button>
                        )}
                        {!isEmailCodeMode && (
                            <button
                                type="button"
                                onClick={handleSendEmailCode}
                                disabled={sendingEmailCode}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors disabled:opacity-50"
                            >
                                {sendingEmailCode
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                                    : <><Send className="h-3.5 w-3.5" /> Lost authenticator? Send code to email</>}
                            </button>
                        )}
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

            {notActivated && !resendSuccess && (
                <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 animate-fade-in">
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">Your account needs to be activated.</p>
                    <button
                        onClick={handleResendActivation}
                        disabled={resending}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-50"
                    >
                        {resending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</> : <><RefreshCw className="h-3.5 w-3.5" /> Resend Activation Email</>}
                    </button>
                </div>
            )}

            {resendSuccess && (
                <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 animate-fade-in">
                    ✓ Activation email sent! Please check your inbox and click the activation link.
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
                        <Link to="/forgot-password" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                            Forgot password?
                        </Link>
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
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
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
                <span className="text-sm text-surface-500 dark:text-surface-400">Don't have an account? </span>
                <Link to="/register" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    Create one
                </Link>
            </div>
        </>
    );
}
