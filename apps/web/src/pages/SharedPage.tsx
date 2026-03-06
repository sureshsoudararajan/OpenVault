import { useState, useEffect, useCallback } from 'react';
import { sharingApi } from '../services/api';
import {
    Share2, Loader2, File, Folder, Image, Film, FileText,
    Download, AlertCircle, UserCircle, Clock, LayoutGrid, List,
    Search
} from 'lucide-react';
import Thumbnail from '../components/Thumbnail';
import FilePreview from '../components/FilePreview';

interface SharedItem {
    permissionId: string;
    role: string;
    sharedAt: string;
    expiresAt: string | null;
    sharedBy: { id: string; name: string; email: string; avatarUrl?: string } | null;
    file: {
        id: string; name: string; mimeType: string;
        size: number; thumbnailKey?: string; createdAt: string; updatedAt: string;
    } | null;
    folder: {
        id: string; name: string; color?: string; createdAt: string; updatedAt: string;
    } | null;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function MimeIcon({ mimeType, className = 'h-10 w-10' }: { mimeType?: string; className?: string }) {
    if (!mimeType) return <File className={`${className} text-surface-400`} />;
    if (mimeType.startsWith('image/')) return <Image className={`${className} text-pink-500`} />;
    if (mimeType.startsWith('video/')) return <Film className={`${className} text-purple-500`} />;
    if (mimeType.includes('pdf')) return <FileText className={`${className} text-red-500`} />;
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return <FileText className={`${className} text-blue-500`} />;
    if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) return <FileText className={`${className} text-emerald-500`} />;
    return <File className={`${className} text-surface-400`} />;
}

const isMedia = (mimeType?: string) => mimeType?.startsWith('image/') || mimeType?.startsWith('video/');

export default function SharedPage() {
    const [items, setItems] = useState<SharedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [search, setSearch] = useState('');
    const [previewFile, setPreviewFile] = useState<NonNullable<SharedItem['file']> | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res: any = await sharingApi.sharedWithMe();
            setItems(res.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load shared files');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = items.filter((item) => {
        const name = item.file?.name || item.folder?.name || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const fileItems = filtered.filter((i) => i.file);
    const folderItems = filtered.filter((i) => i.folder);

    return (
        <div className="animate-fade-in flex flex-col h-full">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-500/10">
                        <Share2 className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-surface-900 dark:text-white">Shared with me</h1>
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                            {loading ? 'Loading...' : `${items.length} item${items.length !== 1 ? 's' : ''} shared with you`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-9 text-sm w-full"
                        />
                    </div>
                    <div className="flex gap-1 rounded-lg border border-surface-200 dark:border-surface-700 p-1 bg-surface-50 dark:bg-surface-800">
                        <button
                            onClick={() => setView('grid')}
                            className={`rounded-md p-1.5 transition-colors ${view === 'grid' ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`rounded-md p-1.5 transition-colors ${view === 'list' ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                    <p className="text-sm text-surface-500">Loading shared files...</p>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="flex flex-col items-center py-20 gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/10">
                        <AlertCircle className="h-7 w-7 text-red-500" />
                    </div>
                    <p className="text-sm text-red-500">{error}</p>
                    <button onClick={load} className="btn-secondary text-sm">Try again</button>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && items.length === 0 && (
                <div className="flex flex-col items-center py-24 text-center">
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/10">
                        <Share2 className="h-10 w-10 text-brand-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">Nothing shared yet</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 max-w-xs">
                        When someone shares a file or folder directly with your email address, it will appear here.
                    </p>
                </div>
            )}

            {/* Content */}
            {!loading && !error && items.length > 0 && (
                <div className="flex-1 overflow-auto space-y-8">
                    {/* Folders */}
                    {folderItems.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                                <Folder className="h-3.5 w-3.5" /> Shared Folders ({folderItems.length})
                            </h2>
                            <div className={view === 'grid'
                                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
                                : 'space-y-2'
                            }>
                                {folderItems.map((item) => (
                                    <FolderCard key={item.permissionId} item={item} view={view} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Files */}
                    {fileItems.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                                <File className="h-3.5 w-3.5" /> Shared Files ({fileItems.length})
                            </h2>
                            {view === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {fileItems.map((item) => (
                                        <FileCard key={item.permissionId} item={item} onPreview={setPreviewFile} />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {fileItems.map((item) => (
                                        <FileListRow key={item.permissionId} item={item} onPreview={setPreviewFile} />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}

            {/* In-app file preview modal */}
            {previewFile && (
                <FilePreview
                    fileId={previewFile.id}
                    fileName={previewFile.name}
                    mimeType={previewFile.mimeType}
                    fileSize={previewFile.size}
                    onClose={() => setPreviewFile(null)}
                    downloadFn={(id) => sharingApi.downloadSharedWithMe(id) as any}
                />
            )}
        </div>
    );
}

function AvatarOrInitial({ user }: { user?: { name: string; email: string; avatarUrl?: string } | null }) {
    if (!user) return <UserCircle className="h-5 w-5 text-surface-400" />;
    return user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="h-5 w-5 rounded-full object-cover" />
    ) : (
        <div className="h-5 w-5 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-600 dark:text-brand-400 flex-shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : '?'}
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${role === 'editor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-surface-200/70 dark:bg-surface-700 text-surface-600 dark:text-surface-300'}`}>
            {role}
        </span>
    );
}

type FileRef = NonNullable<SharedItem['file']>;

function FileCard({ item, onPreview }: { item: SharedItem; onPreview: (f: FileRef) => void }) {
    const file = item.file!;
    const showThumb = isMedia(file.mimeType) && !!file.thumbnailKey;

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res: any = await sharingApi.downloadSharedWithMe(file.id);
            if (res.data?.downloadUrl) window.open(res.data.downloadUrl, '_blank');
        } catch (err) {
            console.error('Failed to download', err);
        }
    };

    return (
        <div
            onClick={() => onPreview(file)}
            className="group relative flex flex-col rounded-xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-surface-800/60 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/30 hover:-translate-y-0.5"
        >
            {/* Thumbnail / Icon */}
            <div className="aspect-square bg-surface-50 dark:bg-surface-900/50 flex items-center justify-center overflow-hidden">
                {showThumb ? (
                    <Thumbnail fileId={file.id} mimeType={file.mimeType} className="h-full w-full object-cover" isShared />
                ) : (
                    <MimeIcon mimeType={file.mimeType} className="h-12 w-12" />
                )}
            </div>

            {/* Meta */}
            <div className="p-2.5 flex flex-col gap-1">
                <p className="truncate text-xs font-semibold text-surface-900 dark:text-white leading-tight">{file.name}</p>
                <p className="text-[10px] text-surface-400">{formatBytes(file.size)}</p>
                <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-surface-100 dark:border-surface-700/50">
                    <AvatarOrInitial user={item.sharedBy} />
                    <span className="text-[10px] text-surface-500 truncate flex-1">{item.sharedBy?.name || 'Unknown User'}</span>
                    <RoleBadge role={item.role} />
                </div>
            </div>

            {/* Download btn on hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={handleDownload}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-surface-800/90 shadow text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    title="Download"
                >
                    <Download className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function FileListRow({ item, onPreview }: { item: SharedItem; onPreview: (f: FileRef) => void }) {
    const file = item.file!;

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res: any = await sharingApi.downloadSharedWithMe(file.id);
            if (res.data?.downloadUrl) window.open(res.data.downloadUrl, '_blank');
        } catch (err) {
            console.error('Failed to download', err);
        }
    };

    return (
        <div
            onClick={() => onPreview(file)}
            className="flex items-center gap-3 rounded-xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-surface-800/60 px-4 py-2.5 transition-all hover:shadow-sm hover:border-brand-300 dark:hover:border-brand-500/30 cursor-pointer"
        >
            <MimeIcon mimeType={file.mimeType} className="h-8 w-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-surface-400">{formatBytes(file.size)} · {file.mimeType ? file.mimeType.split('/')[1] : 'unknown'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-surface-500 hidden sm:flex">
                <UserCircle className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{item.sharedBy?.name || 'Unknown User'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-surface-400 hidden md:flex">
                <Clock className="h-3 w-3" />
                {formatDate(item.sharedAt)}
            </div>
            <RoleBadge role={item.role} />
            <button
                onClick={handleDownload}
                className="ml-1 flex-shrink-0 rounded-lg p-1.5 text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                title="Download"
            >
                <Download className="h-4 w-4" />
            </button>
        </div>
    );
}

function FolderCard({ item, view }: { item: SharedItem; view: 'grid' | 'list' }) {
    const folder = item.folder!;
    const color = folder.color || '#6366f1';

    if (view === 'list') {
        return (
            <div
                onClick={() => window.location.href = `/?folder=${folder.id}`}
                className="flex items-center gap-3 rounded-xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-surface-800/60 px-4 py-2.5 transition-all hover:shadow-sm cursor-pointer"
            >
                <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                    <Folder className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{folder.name}</p>
                    <p className="text-xs text-surface-400">Folder</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-500 hidden sm:flex">
                    <UserCircle className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">{item.sharedBy?.name || 'Unknown User'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-surface-400 hidden md:flex">
                    <Clock className="h-3 w-3" />
                    {formatDate(item.sharedAt)}
                </div>
                <RoleBadge role={item.role} />
            </div>
        );
    }

    return (
        <div
            onClick={() => window.location.href = `/?folder=${folder.id}`}
            className="group relative flex flex-col rounded-xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-surface-800/60 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ borderTopColor: color, borderTopWidth: '3px' }}
        >
            <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                <Folder className="h-14 w-14" style={{ color }} />
            </div>
            <div className="p-2.5 flex flex-col gap-1">
                <p className="truncate text-xs font-semibold text-surface-900 dark:text-white leading-tight">{folder.name}</p>
                <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-surface-100 dark:border-surface-700/50">
                    <AvatarOrInitial user={item.sharedBy} />
                    <span className="text-[10px] text-surface-500 truncate flex-1">{item.sharedBy?.name || 'Unknown User'}</span>
                    <RoleBadge role={item.role} />
                </div>
            </div>
        </div>
    );
}
