import { useState, useEffect } from 'react';
import { fileApi, folderApi } from '../services/api';
import { Trash2, RotateCcw, File, FileText, Image, Film, Folder, AlertTriangle, Loader2, X } from 'lucide-react';

interface TrashedFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    trashedAt: string;
    type: 'file';
}

interface TrashedFolder {
    id: string;
    name: string;
    trashedAt: string;
    type: 'folder';
}

type TrashedItem = TrashedFile | TrashedFolder;

const getIcon = (item: TrashedItem) => {
    if (item.type === 'folder') return <Folder className="h-5 w-5 text-amber-400" />;
    const file = item as TrashedFile;
    if (file.mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-pink-400" />;
    if (file.mimeType.startsWith('video/')) return <Film className="h-5 w-5 text-purple-400" />;
    if (file.mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    return <File className="h-5 w-5 text-brand-400" />;
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getDaysRemaining = (trashedAt: string) => {
    const trashed = new Date(trashedAt);
    const expiry = new Date(trashed.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
};

export default function TrashPage() {
    const [files, setFiles] = useState<TrashedFile[]>([]);
    const [folders, setFolders] = useState<TrashedFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
    const [emptyingTrash, setEmptyingTrash] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res: any = await fileApi.listTrash();
            setFiles(res.data?.files || []);
            setFolders(res.data?.folders || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleRestoreFile = async (id: string) => {
        await fileApi.restore(id);
        load();
    };

    const handleRestoreFolder = async (id: string) => {
        await folderApi.restore(id);
        load();
    };

    const handlePermanentDeleteFile = async (id: string) => {
        setDeletingId(id);
        try {
            await fileApi.permanentDelete(id);
            load();
        } finally {
            setDeletingId(null);
        }
    };

    const handlePermanentDeleteFolder = async (id: string) => {
        setDeletingId(id);
        try {
            await folderApi.permanentDelete(id);
            load();
        } finally {
            setDeletingId(null);
        }
    };

    const handleEmptyTrash = async () => {
        setEmptyingTrash(true);
        try {
            await fileApi.emptyTrash();
            setShowEmptyConfirm(false);
            load();
        } finally {
            setEmptyingTrash(false);
        }
    };

    const allItems: TrashedItem[] = [
        ...folders.map(f => ({ ...f, type: 'folder' as const })),
        ...files.map(f => ({ ...f, type: 'file' as const })),
    ].sort((a, b) => new Date(b.trashedAt).getTime() - new Date(a.trashedAt).getTime());

    const totalCount = allItems.length;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Trash2 className="h-6 w-6 text-red-400" />
                    <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Trash</h1>
                    <span className="badge-warning">{totalCount} items</span>
                </div>
                {totalCount > 0 && (
                    <button
                        onClick={() => setShowEmptyConfirm(true)}
                        className="btn-ghost text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5"
                    >
                        <Trash2 className="h-4 w-4" /> Empty Trash
                    </button>
                )}
            </div>

            {/* Auto-delete notice */}
            {totalCount > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>Items in trash are automatically permanently deleted after <strong>30 days</strong>.</p>
                </div>
            )}

            {/* Empty Trash Confirmation Modal */}
            {showEmptyConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-surface-800 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Empty Trash?</h3>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400 mb-6">
                            This will <strong>permanently delete all {totalCount} items</strong> in the trash. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowEmptyConfirm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                            <button
                                onClick={handleEmptyTrash}
                                disabled={emptyingTrash}
                                className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2.5 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {emptyingTrash ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
            ) : totalCount === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <Trash2 className="mb-4 h-12 w-12 text-surface-600" />
                    <p className="text-surface-400">Trash is empty</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {allItems.map((item) => {
                        const daysLeft = getDaysRemaining(item.trashedAt);
                        const isDeleting = deletingId === item.id;

                        return (
                            <div key={`${item.type}-${item.id}`} className="file-card flex items-center gap-4 rounded-lg px-4 py-3">
                                {getIcon(item)}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">
                                        {item.name}
                                        {item.type === 'folder' && <span className="ml-1.5 text-xs text-surface-400 font-normal">(folder)</span>}
                                    </p>
                                    <p className="text-xs text-surface-500">
                                        Deleted {new Date(item.trashedAt).toLocaleDateString()}
                                        {item.type === 'file' && ` · ${formatSize((item as TrashedFile).size)}`}
                                        {' · '}
                                        <span className={daysLeft <= 7 ? 'text-red-400 font-medium' : ''}>
                                            {daysLeft} days left
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => item.type === 'file' ? handleRestoreFile(item.id) : handleRestoreFolder(item.id)}
                                        className="btn-ghost flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                                    </button>
                                    <button
                                        onClick={() => item.type === 'file' ? handlePermanentDeleteFile(item.id) : handlePermanentDeleteFolder(item.id)}
                                        disabled={isDeleting}
                                        className="btn-ghost flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                    >
                                        {isDeleting
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <X className="h-3.5 w-3.5" />}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
