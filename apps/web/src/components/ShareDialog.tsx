import { useState } from 'react';
import { sharingApi } from '../services/api';
import { X, Link2, Copy, Check, Lock, Clock, Download as DownloadIcon, Loader2 } from 'lucide-react';

interface ShareDialogProps {
    resourceId: string;
    resourceType: 'file' | 'folder';
    resourceName: string;
    onClose: () => void;
}

export default function ShareDialog({ resourceId, resourceType, resourceName, onClose }: ShareDialogProps) {
    const [shareUrl, setShareUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    // Options
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [expiresIn, setExpiresIn] = useState('');
    const [maxDownloads, setMaxDownloads] = useState('');
    const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');

    const handleCreateLink = async () => {
        setLoading(true);
        setError('');
        try {
            const payload: any = {
                permission,
            };
            // Backend expects fileId or folderId, not resourceId/resourceType
            if (resourceType === 'file') {
                payload.fileId = resourceId;
            } else {
                payload.folderId = resourceId;
            }
            if (usePassword && password) payload.password = password;
            if (expiresIn) {
                const hours = parseInt(expiresIn);
                if (hours > 0) payload.expiresIn = hours;
            }
            if (maxDownloads) {
                const max = parseInt(maxDownloads);
                if (max > 0) payload.maxDownloads = max;
            }

            const res: any = await sharingApi.createLink(payload);
            const token = res.data?.token || res.data?.shareLink?.token;
            if (token) {
                setShareUrl(`${window.location.origin}/share/${token}`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create share link');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-HTTPS
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                            <Link2 className="h-5 w-5 text-brand-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Share {resourceType}</h3>
                            <p className="text-xs text-surface-400 truncate max-w-[250px]">{resourceName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4 p-5">
                    {/* Share URL output */}
                    {shareUrl ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 p-3">
                                <Link2 className="h-4 w-4 flex-shrink-0 text-brand-400" />
                                <span className="flex-1 truncate text-sm text-surface-200">{shareUrl}</span>
                                <button onClick={handleCopy} className="flex-shrink-0 rounded-md bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-500/30">
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            {copied && (
                                <p className="text-center text-xs text-emerald-400 animate-fade-in">Link copied to clipboard!</p>
                            )}
                            <button onClick={() => { setShareUrl(''); }} className="text-xs text-surface-400 hover:text-white transition-colors">
                                Create another link
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Permission */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-400">Permission</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPermission('viewer')}
                                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${permission === 'viewer' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600'
                                            }`}
                                    >
                                        View only
                                    </button>
                                    <button
                                        onClick={() => setPermission('editor')}
                                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${permission === 'editor' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600'
                                            }`}
                                    >
                                        Can edit
                                    </button>
                                </div>
                            </div>

                            {/* Password Protection */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-surface-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={usePassword}
                                        onChange={() => setUsePassword(!usePassword)}
                                        className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
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

                            {/* Expiry */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    Expires after
                                </label>
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(e.target.value)}
                                    className="input-field text-sm"
                                >
                                    <option value="">Never</option>
                                    <option value="1">1 hour</option>
                                    <option value="24">24 hours</option>
                                    <option value="168">7 days</option>
                                    <option value="720">30 days</option>
                                </select>
                            </div>

                            {/* Max Downloads */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-400">
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

                            {/* Error */}
                            {error && <p className="text-xs text-red-400">{error}</p>}

                            {/* Submit */}
                            <button
                                onClick={handleCreateLink}
                                disabled={loading}
                                className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
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
