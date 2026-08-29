import { useState } from 'react';
import { X, Copy, CheckCircle2, Link as LinkIcon, Inbox } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface FileRequestDialogProps {
    folderId: string;
    folderName: string;
    onClose: () => void;
}

export default function FileRequestDialog({ folderId, folderName, onClose }: FileRequestDialogProps) {
    const [title, setTitle] = useState(`${folderName} - File Request`);
    const [description, setDescription] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [loading, setLoading] = useState(false);
    const [createdLink, setCreatedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        try {
            const body: any = { folderId, title, description };
            if (expiresAt) {
                // Parse datetime-local correctly to UTC
                const dateParts = expiresAt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                if (dateParts) {
                    const [_, y, m, d, h, min] = dateParts;
                    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
                    body.expiresAt = date.toISOString();
                }
            }
            
            const res = await fetch('/api/file-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${useAuthStore.getState().accessToken}`
                },
                body: JSON.stringify(body)
            }).then(r => r.json());

            if (res.success) {
                setCreatedLink(`${window.location.origin}/request/${res.requestLink.token}`);
            } else {
                alert(res.error?.message || 'Failed to create request');
            }
        } catch (err) {
            console.error('File request error:', err);
            alert('Failed to create file request link');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!createdLink) return;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(createdLink);
        } else {
            // Fallback for non-HTTPS local environments
            const textArea = document.createElement("textarea");
            textArea.value = createdLink;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            textArea.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <Inbox className="h-5 w-5 mr-2 text-indigo-500" />
                        Request Files
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {createdLink ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
                                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Request Link Created</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Anyone with this link can upload files directly into <span className="font-semibold text-gray-700 dark:text-gray-300">{folderName}</span>.</p>
                            </div>
                            
                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={createdLink}
                                    className="w-full pl-4 pr-12 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none"
                                />
                                <button
                                    onClick={handleCopy}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Wedding Photos"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Instructions for the uploaders..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={loading || !title.trim()}
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <LinkIcon className="h-4 w-4 mr-2" />
                                        Create Request Link
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
