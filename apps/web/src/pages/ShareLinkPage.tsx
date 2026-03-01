import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sharingApi } from '../services/api';
import {
    Shield, FileText, Lock, Download, Loader2, Eye,
    Clock, AlertTriangle, FolderOpen, Key, Sun, Moon
} from 'lucide-react';

function useCountdown(target: string | null) {
    const [remaining, setRemaining] = useState('');
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        if (!target) return;
        const update = () => {
            const diff = new Date(target).getTime() - Date.now();
            if (diff <= 0) { setExpired(true); setRemaining(''); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [target]);

    return { remaining, expired };
}

const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export default function ShareLinkPage() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [errorCode, setErrorCode] = useState('');

    // Auth steps
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [otpVerified, setOtpVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [authError, setAuthError] = useState('');

    // Download/Preview
    const [downloading, setDownloading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewData, setPreviewData] = useState<any>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Text Edit
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editContent, setEditContent] = useState('');

    // Theme
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const stored = localStorage.getItem('theme');
        return stored === 'light' ? 'light' : 'dark';
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Fetch link data
    useEffect(() => {
        if (!token) return;
        sharingApi.getLink(token)
            .then((res: any) => setData(res.data))
            .catch((err: any) => {
                setError(err.message || 'Link unavailable');
                setErrorCode(err.code || '');
                // Completely overwrite data with error metadata (if present) to prevent stale file data leaks
                if (err.data?.opensAt) {
                    setData({ opensAt: err.data.opensAt });
                } else {
                    setData(null);
                }
            })
            .finally(() => setLoading(false));
    }, [token]);

    const opensCountdown = useCountdown(data?.opensAt);
    const expiresCountdown = useCountdown(data?.expiresAt);

    const handleVerifyPassword = async () => {
        if (!token || !passwordInput) return;
        setVerifying(true);
        setAuthError('');
        try {
            await sharingApi.verifyPassword(token, passwordInput);
            setPasswordVerified(true);
        } catch (err: any) {
            setAuthError(err.message || 'Wrong password');
        } finally {
            setVerifying(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!token || !otpInput) return;
        setVerifying(true);
        setAuthError('');
        try {
            await sharingApi.verifyOtp(token, otpInput);
            setOtpVerified(true);
        } catch (err: any) {
            setAuthError(err.message || 'Invalid OTP');
        } finally {
            setVerifying(false);
        }
    };

    const handleDownload = async (fileId?: string) => {
        if (!token) return;
        setDownloading(true);
        try {
            const res: any = await sharingApi.downloadShared(token, fileId);
            if (res.data?.downloadUrl) {
                window.open(res.data.downloadUrl, '_blank');
            }
        } catch (err: any) {
            setError(err.message || 'Download failed');
        } finally {
            setDownloading(false);
        }
    };

    const handlePreview = async (fileId?: string) => {
        if (!token) return;
        setLoadingPreview(true);
        try {
            const res: any = await sharingApi.previewShared(token, fileId);
            if (res.data) {
                setPreviewUrl(res.data.previewUrl);
                setPreviewData({ ...res.data, id: fileId });
                setTextContent(null);
                setIsEditing(false);
            }
        } catch (err: any) {
            setError(err.message || 'Preview failed');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!token || !previewData) return;
        setSavingEdit(true);
        try {
            // Need the fileId. If previewData.id is available, use it. Otherwise fallback to data.file.id
            const fileId = previewData.id || data?.file?.id;
            await sharingApi.editShared(token, fileId, editContent);
            setTextContent(editContent);
            setIsEditing(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save edits');
        } finally {
            setSavingEdit(false);
        }
    };

    // Auto-fetch Text Content for previews
    useEffect(() => {
        if (previewUrl && previewData) {
            const mime = previewData.mimeType || '';
            const isText = mime.startsWith('text/') || mime === 'application/json' || mime.includes('markdown');
            if (isText && textContent === null) {
                fetch(previewUrl)
                    .then(r => r.text())
                    .then(txt => {
                        setTextContent(txt);
                        setEditContent(txt);
                    })
                    .catch(() => setTextContent('Failed to load text content'));
            }
        }
    }, [previewUrl, previewData, textContent]);

    // Loading
    if (loading) {
        return (
            <div className={`flex min-h-screen items-center justify-center ${theme === 'dark' ? 'bg-surface-950' : 'bg-surface-50'}`}>
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
        );
    }

    // Determine auth flow
    const needsPassword = data?.requiresPassword && !passwordVerified;
    const needsOtp = data?.requiresOtp && !otpVerified;
    const isAuthenticated = !needsPassword && !needsOtp;

    // Error states
    const isNotYetOpen = errorCode === 'NOT_YET_OPEN' || (data?.opensAt && new Date(data.opensAt) > new Date());
    const isExpired = errorCode === 'EXPIRED';
    const isLimitReached = errorCode === 'LIMIT_REACHED';
    const isDisabled = errorCode === 'DISABLED';
    const isLocked = isNotYetOpen || isExpired || isLimitReached || isDisabled;

    // Preview rendering
    if (previewUrl && previewData) {
        const mime = previewData.mimeType || '';
        const isImage = mime.startsWith('image/');
        const isPdf = mime === 'application/pdf';
        const isVideo = mime.startsWith('video/');
        const isAudio = mime.startsWith('audio/');
        const isText = mime.startsWith('text/') || mime === 'application/json' || mime.includes('markdown');
        const canEdit = data?.permission === 'editor' && isText;

        return (
            <div className={`flex min-h-screen flex-col ${theme === 'dark' ? 'bg-surface-950' : 'bg-surface-50'}`}>
                {/* Preview Header */}
                <div className={`flex items-center justify-between border-b px-4 py-3 ${theme === 'dark' ? 'border-surface-800 bg-surface-900' : 'border-surface-200 bg-white'}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                            <Shield className="h-4 w-4 text-brand-400" />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>{previewData.fileName}</p>
                            <p className="text-xs text-surface-500">{formatSize(previewData.fileSize)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleDownload()} className="btn-primary flex items-center gap-2 text-sm !text-white">
                            <Download className="h-4 w-4" /> Download
                        </button>
                        <button onClick={() => { setPreviewUrl(''); setPreviewData(null); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${theme === 'dark' ? 'text-surface-400 hover:text-white hover:bg-surface-800' : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100'}`}>
                            Back
                        </button>
                    </div>
                </div>
                {/* Preview Content */}
                <div className="flex-1 flex items-center justify-center p-4">
                    {isImage && <img src={previewUrl} alt={previewData.fileName} className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-lg" />}
                    {isPdf && <iframe src={previewUrl} title={previewData.fileName} className="h-[85vh] w-full max-w-4xl rounded-lg border-0 shadow-lg" />}
                    {isVideo && <video src={previewUrl} controls className="max-h-[80vh] max-w-full rounded-lg shadow-lg" />}
                    {isAudio && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-500/10">
                                <FileText className="h-12 w-12 text-brand-400" />
                            </div>
                            <audio src={previewUrl} controls className="w-80" />
                        </div>
                    )}
                    {isText && textContent !== null && (
                        <div className="w-full max-w-5xl h-[85vh] flex flex-col rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden">
                            {canEdit && (
                                <div className="flex items-center justify-end gap-2 p-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors">Cancel</button>
                                            <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 !text-white">
                                                {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                                                Save
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="btn-primary py-1.5 px-3 text-xs !text-white">
                                            Edit File
                                        </button>
                                    )}
                                </div>
                            )}
                            {isEditing ? (
                                <textarea
                                    className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-surface-900 dark:text-gray-100"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    disabled={savingEdit}
                                />
                            ) : (
                                <pre className="flex-1 p-4 font-mono text-sm overflow-auto text-surface-800 dark:text-gray-200 whitespace-pre-wrap">
                                    {textContent}
                                </pre>
                            )}
                        </div>
                    )}
                    {!isImage && !isPdf && !isVideo && !isAudio && !isText && (
                        <div className="text-center">
                            <FileText className={`mx-auto mb-3 h-16 w-16 ${theme === 'dark' ? 'text-surface-600' : 'text-surface-300'}`} />
                            <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>Preview not available for this file type</p>
                            <button onClick={() => handleDownload()} className="btn-primary mt-4 flex items-center gap-2 mx-auto !text-white">
                                <Download className="h-4 w-4" /> Download Instead
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex min-h-screen items-center justify-center p-4 ${theme === 'dark' ? 'bg-surface-950' : 'bg-surface-50'}`}>
            {/* Ambient */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-[30%] -top-[30%] h-[60%] w-[60%] rounded-full bg-brand-600/5 blur-3xl" />
                <div className="absolute -right-[20%] -bottom-[20%] h-[50%] w-[50%] rounded-full bg-purple-600/5 blur-3xl" />
            </div>

            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`fixed top-4 right-4 z-50 rounded-lg p-2 transition-colors ${theme === 'dark' ? 'text-surface-400 hover:text-yellow-400 hover:bg-surface-800' : 'text-surface-500 hover:text-amber-500 hover:bg-surface-100'}`}
            >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative w-full max-w-md animate-fade-in">
                {/* Branding */}
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/20">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-purple-500 bg-clip-text text-transparent">OpenVault</h1>
                    <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-surface-500' : 'text-surface-400'}`}>Secure File Sharing</p>
                </div>

                {/* Card */}
                <div className={`rounded-xl border p-6 shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'border-surface-700 bg-surface-900/80' : 'border-surface-200 bg-white/80'}`}>

                    {/* Error: Not Yet Open */}
                    {isNotYetOpen && (
                        <div className="text-center">
                            <Clock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Not Yet Available</h2>
                            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>This link opens in:</p>
                            {opensCountdown.remaining && (
                                <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                                    <p className="text-2xl font-bold text-amber-500 font-mono">{opensCountdown.remaining}</p>
                                </div>
                            )}
                            {data?.opensAt && (
                                <p className="mt-2 text-xs text-surface-500">
                                    Available from: {new Date(data.opensAt).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error: Expired */}
                    {isExpired && (
                        <div className="text-center">
                            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" />
                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Link Expired</h2>
                            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>This share link has expired and is no longer available.</p>
                        </div>
                    )}

                    {/* Error: Download Limit */}
                    {isLimitReached && (
                        <div className="text-center">
                            <Download className="mx-auto mb-3 h-10 w-10 text-red-400" />
                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Download Limit Reached</h2>
                            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>The maximum number of downloads for this link has been reached.</p>
                        </div>
                    )}

                    {/* Error: Disabled */}
                    {isDisabled && (
                        <div className="text-center">
                            <Shield className="mx-auto mb-3 h-10 w-10 text-red-400" />
                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Link Disabled</h2>
                            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>This share link has been disabled by the owner.</p>
                        </div>
                    )}

                    {/* Error: Generic */}
                    {error && !isNotYetOpen && !isExpired && !isLimitReached && !isDisabled && !data && (
                        <div className="text-center">
                            <Shield className="mx-auto mb-3 h-10 w-10 text-red-400" />
                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Link Unavailable</h2>
                            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>{error}</p>
                        </div>
                    )}

                    {/* Auth Step: Password */}
                    {!error && data && needsPassword && (
                        <>
                            <div className="mb-4 text-center">
                                <Lock className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                                <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Password Protected</h2>
                                <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>Enter the password to access this content</p>
                            </div>

                            {authError && (
                                <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500 dark:text-red-400">
                                    {authError}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => { setPasswordInput(e.target.value); setAuthError(''); }}
                                    className="input-field flex-1"
                                    placeholder="Enter password"
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                />
                                <button onClick={handleVerifyPassword} disabled={verifying} className="btn-primary !text-white">
                                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Auth Step: OTP */}
                    {!error && data && !needsPassword && needsOtp && (
                        <>
                            <div className="mb-4 text-center">
                                <Key className="mx-auto mb-2 h-8 w-8 text-brand-400" />
                                <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>OTP Verification</h2>
                                <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>Enter the 6-digit code provided by the sender</p>
                            </div>

                            {authError && (
                                <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500 dark:text-red-400">
                                    {authError}
                                </div>
                            )}

                            <div className="mb-3">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otpInput}
                                    onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6)); setAuthError(''); }}
                                    className={`w-full text-center text-2xl tracking-[0.5em] font-mono font-bold rounded-lg border px-4 py-3 ${theme === 'dark'
                                        ? 'border-surface-700 bg-surface-800 text-white focus:border-brand-500'
                                        : 'border-surface-200 bg-surface-50 text-surface-900 focus:border-brand-500'
                                        } focus:outline-none focus:ring-1 focus:ring-brand-500`}
                                    placeholder="000000"
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                                />
                            </div>
                            <button onClick={handleVerifyOtp} disabled={verifying || otpInput.length !== 6} className="btn-primary w-full !text-white flex items-center justify-center gap-2">
                                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                                Verify Code
                            </button>
                        </>
                    )}

                    {/* Authenticated: Show File/Folder */}
                    {!error && data && !isLocked && isAuthenticated && (
                        <>
                            {/* File Share */}
                            {data.file && (
                                <div className="text-center">
                                    <FileText className="mx-auto mb-3 h-12 w-12 text-brand-400" />
                                    <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>{data.file.name}</h2>
                                    <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>
                                        {formatSize(data.file.size)} · {data.file.mimeType}
                                    </p>

                                    {/* Info badges */}
                                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                        {data.expiresAt && (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${theme === 'dark' ? 'bg-surface-800 text-surface-400' : 'bg-surface-100 text-surface-500'
                                                }`}>
                                                <Clock className="h-3 w-3" />
                                                {expiresCountdown.remaining ? `Expires in ${expiresCountdown.remaining}` : 'Expires soon'}
                                            </span>
                                        )}
                                        {data.maxDownloads && (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${theme === 'dark' ? 'bg-surface-800 text-surface-400' : 'bg-surface-100 text-surface-500'
                                                }`}>
                                                <Download className="h-3 w-3" />
                                                {data.downloadCount}/{data.maxDownloads} downloads
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-6 flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => handlePreview()}
                                            disabled={loadingPreview}
                                            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${theme === 'dark'
                                                ? 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                                                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                                }`}
                                        >
                                            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => handleDownload()}
                                            disabled={downloading}
                                            className="btn-primary flex items-center gap-2 !text-white"
                                        >
                                            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            Download
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Folder Share */}
                            {data.folder && (
                                <div>
                                    <div className="mb-4 flex items-center gap-3">
                                        <FolderOpen className="h-8 w-8 text-brand-400" />
                                        <div>
                                            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>{data.folder.name}</h2>
                                            <p className={`text-xs ${theme === 'dark' ? 'text-surface-500' : 'text-surface-400'}`}>
                                                {data.folder.files?.length || 0} files
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                        {data.folder.files?.map((f: any) => (
                                            <div key={f.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${theme === 'dark' ? 'bg-surface-800/50 hover:bg-surface-800' : 'bg-surface-50 hover:bg-surface-100'} transition-colors`}>
                                                <FileText className={`h-4 w-4 flex-shrink-0 ${theme === 'dark' ? 'text-surface-500' : 'text-surface-400'}`} />
                                                <span className={`flex-1 truncate text-sm ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>{f.name}</span>
                                                <span className="text-xs text-surface-500">{formatSize(f.size)}</span>
                                                <button
                                                    onClick={() => handleDownload(f.id)}
                                                    className="rounded-md p-1.5 text-surface-500 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <p className={`mt-4 text-center text-[11px] ${theme === 'dark' ? 'text-surface-600' : 'text-surface-400'}`}>
                    Secured by OpenVault · End-to-end encrypted
                </p>
            </div>
        </div>
    );
}
