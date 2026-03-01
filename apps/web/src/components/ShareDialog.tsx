import { useState } from 'react';
import { sharingApi } from '../services/api';
import {
    X, Link2, Copy, Check, Lock, Clock, Download as DownloadIcon,
    Loader2, Key, CalendarClock, Shield
} from 'lucide-react';

interface ShareDialogProps {
    resourceId: string;
    resourceType: 'file' | 'folder';
    resourceName: string;
    onClose: () => void;
}

export default function ShareDialog({ resourceId, resourceType, resourceName, onClose }: ShareDialogProps) {
    const [shareUrl, setShareUrl] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedOtp, setCopiedOtp] = useState(false);
    const [error, setError] = useState('');

    // Options
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [opensAt, setOpensAt] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [maxDownloads, setMaxDownloads] = useState('');
    const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');
    const [otpEnabled, setOtpEnabled] = useState(false);

    const handleCreateLink = async () => {
        setLoading(true);
        setError('');
        try {
            const payload: any = { permission, otpEnabled };

            if (resourceType === 'file') {
                payload.fileId = resourceId;
            } else {
                payload.folderId = resourceId;
            }
            if (usePassword && password) payload.password = password;
            if (opensAt) payload.opensAt = new Date(opensAt).toISOString();
            if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
            if (maxDownloads) {
                const max = parseInt(maxDownloads);
                if (max > 0) payload.maxDownloads = max;
            }

            const res: any = await sharingApi.createLink(payload);
            const token = res.data?.token;
            if (token) {
                setShareUrl(`${window.location.origin}/share/${token}`);
            }
            if (res.data?.otpCode) {
                setOtpCode(res.data.otpCode);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create share link');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, setter: (v: boolean) => void) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                            <Link2 className="h-5 w-5 text-brand-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Share {resourceType}</h3>
                            <p className="text-xs text-surface-500 dark:text-surface-400 truncate max-w-[250px]">{resourceName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4 p-5 max-h-[70vh] overflow-y-auto">
                    {shareUrl ? (
                        <div className="space-y-4">
                            {/* Share URL */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-surface-500 dark:text-surface-400">Share Link</label>
                                <div className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3">
                                    <Link2 className="h-4 w-4 flex-shrink-0 text-brand-400" />
                                    <span className="flex-1 truncate text-sm text-surface-700 dark:text-surface-200">{shareUrl}</span>
                                    <button onClick={() => handleCopy(shareUrl, setCopied)} className="flex-shrink-0 rounded-md bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 transition-colors hover:bg-brand-500/30">
                                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                                {copied && (
                                    <p className="text-center text-xs text-emerald-500 animate-fade-in">Link copied to clipboard!</p>
                                )}
                            </div>

                            {/* OTP Code — only if generated */}
                            {otpCode && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                                        <Key className="h-3.5 w-3.5 text-amber-500" /> OTP Access Code
                                    </label>
                                    <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">Share this code with the recipient. They'll need it to access the file.</p>
                                        <div className="flex items-center gap-2">
                                            <span className="flex-1 text-center text-2xl font-bold tracking-[0.5em] text-amber-600 dark:text-amber-400 font-mono">{otpCode}</span>
                                            <button onClick={() => handleCopy(otpCode, setCopiedOtp)} className="flex-shrink-0 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/30">
                                                {copiedOtp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button onClick={() => { setShareUrl(''); setOtpCode(''); }} className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors">
                                Create another link
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Permission */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Permission</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPermission('viewer')}
                                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${permission === 'viewer'
                                            ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                                            : 'bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                            }`}
                                    >
                                        View only
                                    </button>
                                    <button
                                        onClick={() => setPermission('editor')}
                                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${permission === 'editor'
                                            ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                                            : 'bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                            }`}
                                    >
                                        Can edit
                                    </button>
                                </div>
                            </div>

                            {/* Schedule — Opens At */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Opens at (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={opensAt}
                                    onChange={(e) => setOpensAt(e.target.value)}
                                    className="input-field text-sm text-surface-900 dark:text-white"
                                />
                            </div>

                            {/* Schedule — Expires At */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    Expires at (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="input-field text-sm text-surface-900 dark:text-white"
                                />
                            </div>

                            {/* Max Downloads */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                                    <DownloadIcon className="h-3.5 w-3.5" />
                                    Max downloads
                                </label>
                                <input
                                    type="number"
                                    value={maxDownloads}
                                    onChange={(e) => setMaxDownloads(e.target.value)}
                                    placeholder="Unlimited"
                                    min={1}
                                    className="input-field text-sm"
                                />
                            </div>

                            {/* Password Protection */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={usePassword}
                                        onChange={() => setUsePassword(!usePassword)}
                                        className="rounded border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500"
                                    />
                                    <Lock className="h-3.5 w-3.5" />
                                    Password protection
                                </label>
                                {usePassword && (
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="input-field mt-2 text-sm"
                                    />
                                )}
                            </div>

                            {/* OTP Verification */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={otpEnabled}
                                        onChange={() => setOtpEnabled(!otpEnabled)}
                                        className="rounded border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500"
                                    />
                                    <Shield className="h-3.5 w-3.5" />
                                    OTP verification required
                                </label>
                                {otpEnabled && (
                                    <p className="mt-1.5 ml-6 text-[11px] text-surface-400 dark:text-surface-500">
                                        A 6-digit code will be generated. Share it with the recipient separately.
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

                            {/* Submit */}
                            <button
                                onClick={handleCreateLink}
                                disabled={loading}
                                className="btn-primary flex w-full items-center justify-center gap-2 text-sm !text-white"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                {loading ? 'Creating...' : 'Create Share Link'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
