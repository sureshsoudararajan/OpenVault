import { useState, useEffect } from 'react';
import { fileApi, folderApi, sharingApi } from '../services/api';
import {
    X, FileText, Image, Film, Music, FileArchive, File,
    FolderOpen, Calendar, HardDrive, Hash, Clock, Loader2,
    Shield, Link2, Eye, Tag, Layers, MapPin, Copy, Check
} from 'lucide-react';

interface DetailsDialogProps {
    id: string;
    type: 'file' | 'folder';
    name: string;
    onClose: () => void;
}

type Tab = 'info' | 'activity' | 'sharing';

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatDate = (date: string) =>
    new Date(date).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

const getRelativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(date);
};

const getFileIcon = (mimeType: string, size: string = 'h-10 w-10') => {
    if (mimeType?.startsWith('image/')) return <Image className={`${size} text-pink-400`} />;
    if (mimeType?.startsWith('video/')) return <Film className={`${size} text-purple-400`} />;
    if (mimeType?.startsWith('audio/')) return <Music className={`${size} text-cyan-400`} />;
    if (mimeType?.includes('pdf')) return <FileText className={`${size} text-red-400`} />;
    if (mimeType?.includes('zip') || mimeType?.includes('archive')) return <FileArchive className={`${size} text-amber-400`} />;
    return <File className={`${size} text-brand-400`} />;
};

const getFileCategory = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return 'Image';
    if (mimeType?.startsWith('video/')) return 'Video';
    if (mimeType?.startsWith('audio/')) return 'Audio';
    if (mimeType?.includes('pdf')) return 'Document';
    if (mimeType?.startsWith('text/')) return 'Text';
    if (mimeType?.includes('zip') || mimeType?.includes('archive')) return 'Archive';
    if (mimeType?.includes('json') || mimeType?.includes('xml')) return 'Data';
    return 'File';
};

const getExtension = (name: string) => {
    const parts = name.split('.');
    return parts.length > 1 ? `.${parts.pop()?.toUpperCase()}` : 'N/A';
};

export default function DetailsDialog({ id, type, name, onClose }: DetailsDialogProps) {
    const [details, setDetails] = useState<any>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('info');
    const [copiedField, setCopiedField] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res: any = type === 'file'
                    ? await fileApi.get(id)
                    : await folderApi.get(id);
                setDetails(res.data || res);

                // Load permissions
                try {
                    const permRes: any = await sharingApi.listPermissions(id);
                    setPermissions(permRes.data || []);
                } catch { /* ignore if permissions fail */ }
            } catch (err) {
                console.error('Failed to load details:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, type]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'info', label: 'Info', icon: <Eye className="h-3.5 w-3.5" /> },
        { id: 'sharing', label: 'Sharing', icon: <Shield className="h-3.5 w-3.5" /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 shadow-2xl overflow-hidden animate-slide-up">

                {/* Hero Header with gradient */}
                <div className="relative bg-gradient-to-b from-surface-800 to-surface-900 px-5 pt-5 pb-4">
                    <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>

                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-900/60 border border-surface-700 backdrop-blur-sm">
                            {type === 'folder' ? <FolderOpen className="h-7 w-7 text-brand-400" /> : getFileIcon(details?.mimeType, 'h-7 w-7')}
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                            <p className="truncate text-base font-semibold text-white">{name}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-400 border border-brand-500/20">
                                    {type === 'folder' ? 'Folder' : getFileCategory(details?.mimeType)}
                                </span>
                                {type === 'file' && (
                                    <span className="text-[11px] text-surface-500">{getExtension(name)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick stats strip */}
                    {!loading && details && (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {type === 'file' ? (
                                <>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Size</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">{formatSize(Number(details.size) || 0)}</p>
                                    </div>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Version</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">v{details.currentVersion || 1}</p>
                                    </div>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Modified</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">{getRelativeTime(details.updatedAt || details.createdAt)}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Files</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">{details._count?.files ?? 0}</p>
                                    </div>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Subfolders</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">{details._count?.children ?? 0}</p>
                                    </div>
                                    <div className="rounded-lg bg-surface-900/50 border border-surface-700/50 px-3 py-2 text-center">
                                        <p className="text-[10px] uppercase tracking-wider text-surface-500">Created</p>
                                        <p className="text-xs font-semibold text-white mt-0.5">{getRelativeTime(details.createdAt)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-surface-700 bg-surface-900/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 ${activeTab === tab.id
                                    ? 'border-brand-500 text-brand-400'
                                    : 'border-transparent text-surface-500 hover:text-surface-300'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-5 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                        </div>
                    ) : activeTab === 'info' ? (
                        <div className="space-y-4">
                            {/* Properties Section */}
                            <div>
                                <h4 className="mb-2.5 text-[10px] uppercase tracking-widest text-surface-500 font-semibold">Properties</h4>
                                <div className="space-y-0 rounded-lg border border-surface-700 bg-surface-800/30 overflow-hidden divide-y divide-surface-700/50">
                                    {type === 'file' && (
                                        <>
                                            <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="MIME Type" value={details?.mimeType || 'Unknown'} />
                                            <DetailRow icon={<HardDrive className="h-3.5 w-3.5" />} label="File Size" value={formatSize(Number(details?.size) || 0)} />
                                            <DetailRow icon={<Layers className="h-3.5 w-3.5" />} label="Version" value={`v${details?.currentVersion || 1}`} />
                                        </>
                                    )}
                                    <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={formatDate(details?.createdAt)} />
                                    <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Modified" value={formatDate(details?.updatedAt || details?.createdAt)} />
                                    {type === 'folder' && details?.path && (
                                        <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Path" value={details.path} />
                                    )}
                                </div>
                            </div>

                            {/* Security Section (files only) */}
                            {type === 'file' && details?.sha256 && (
                                <div>
                                    <h4 className="mb-2.5 text-[10px] uppercase tracking-widest text-surface-500 font-semibold">Security & Integrity</h4>
                                    <div className="rounded-lg border border-surface-700 bg-surface-800/30 overflow-hidden divide-y divide-surface-700/50">
                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                            <Hash className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] text-surface-500 uppercase tracking-wider">SHA-256 Hash</p>
                                                <p className="text-xs text-surface-300 font-mono mt-0.5 truncate">{details.sha256}</p>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(details.sha256, 'sha256')}
                                                className="flex-shrink-0 rounded-md p-1 text-surface-500 hover:text-white hover:bg-surface-700 transition-colors"
                                                title="Copy hash"
                                            >
                                                {copiedField === 'sha256' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                        {details?.storageKey && (
                                            <div className="flex items-center gap-3 px-3 py-2.5">
                                                <Shield className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">Storage Key</p>
                                                    <p className="text-xs text-surface-300 font-mono mt-0.5 truncate">{details.storageKey}</p>
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(details.storageKey, 'storageKey')}
                                                    className="flex-shrink-0 rounded-md p-1 text-surface-500 hover:text-white hover:bg-surface-700 transition-colors"
                                                    title="Copy key"
                                                >
                                                    {copiedField === 'storageKey' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Resource ID */}
                            <div>
                                <h4 className="mb-2.5 text-[10px] uppercase tracking-widest text-surface-500 font-semibold">Identifiers</h4>
                                <div className="rounded-lg border border-surface-700 bg-surface-800/30 overflow-hidden">
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                        <Hash className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-surface-500 uppercase tracking-wider">Resource ID</p>
                                            <p className="text-xs text-surface-300 font-mono mt-0.5 truncate">{id}</p>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(id, 'id')}
                                            className="flex-shrink-0 rounded-md p-1 text-surface-500 hover:text-white hover:bg-surface-700 transition-colors"
                                            title="Copy ID"
                                        >
                                            {copiedField === 'id' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'sharing' ? (
                        <div className="space-y-4">
                            {permissions.length > 0 ? (
                                <>
                                    <h4 className="text-[10px] uppercase tracking-widest text-surface-500 font-semibold">Users with Access</h4>
                                    <div className="space-y-2">
                                        {permissions.map((perm: any) => (
                                            <div key={perm.id} className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/30 px-3 py-2.5">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-purple-500 text-xs font-semibold text-white">
                                                    {perm.grantedTo?.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white truncate">{perm.grantedTo?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-surface-500 truncate">{perm.grantedTo?.email}</p>
                                                </div>
                                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${perm.role === 'owner' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        perm.role === 'editor' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                            'bg-surface-700 text-surface-300 border border-surface-600'
                                                    }`}>
                                                    {perm.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-800 mb-3">
                                        <Link2 className="h-6 w-6 text-surface-600" />
                                    </div>
                                    <p className="text-sm text-surface-400">Not shared yet</p>
                                    <p className="text-xs text-surface-600 mt-1">Use the Share option to create a share link</p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/** Reusable detail row component */
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-surface-500 flex-shrink-0">{icon}</span>
            <span className="text-[10px] uppercase tracking-wider text-surface-500 w-20 flex-shrink-0">{label}</span>
            <span className="text-xs text-surface-200 truncate flex-1 text-right">{value}</span>
        </div>
    );
}
