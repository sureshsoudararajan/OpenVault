import { useState, useEffect } from 'react';
import { fileApi, folderApi } from '../services/api';
import {
    X, FileText, Image, Film, Music, FileArchive, File,
    FolderOpen, Calendar, HardDrive, Hash, Users, Clock, Loader2
} from 'lucide-react';

interface DetailsDialogProps {
    id: string;
    type: 'file' | 'folder';
    name: string;
    onClose: () => void;
}

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

const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <Image className="h-10 w-10 text-pink-400" />;
    if (mimeType?.startsWith('video/')) return <Film className="h-10 w-10 text-purple-400" />;
    if (mimeType?.startsWith('audio/')) return <Music className="h-10 w-10 text-cyan-400" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-10 w-10 text-red-400" />;
    if (mimeType?.includes('zip') || mimeType?.includes('archive')) return <FileArchive className="h-10 w-10 text-amber-400" />;
    return <File className="h-10 w-10 text-brand-400" />;
};

export default function DetailsDialog({ id, type, name, onClose }: DetailsDialogProps) {
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res: any = type === 'file'
                    ? await fileApi.get(id)
                    : await folderApi.get(id);
                setDetails(res.data || res);
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

    const rows: { icon: React.ReactNode; label: string; value: string }[] = [];

    if (details && type === 'file') {
        rows.push(
            { icon: <FileText className="h-4 w-4" />, label: 'Type', value: details.mimeType || 'Unknown' },
            { icon: <HardDrive className="h-4 w-4" />, label: 'Size', value: formatSize(Number(details.size) || 0) },
            { icon: <Calendar className="h-4 w-4" />, label: 'Created', value: formatDate(details.createdAt) },
            { icon: <Clock className="h-4 w-4" />, label: 'Modified', value: formatDate(details.updatedAt || details.createdAt) },
        );
        if (details.sha256) rows.push({ icon: <Hash className="h-4 w-4" />, label: 'SHA-256', value: details.sha256.substring(0, 16) + '...' });
        if (details.storagePath) rows.push({ icon: <HardDrive className="h-4 w-4" />, label: 'Storage', value: details.storagePath });
        if (details._count?.versions) rows.push({ icon: <Clock className="h-4 w-4" />, label: 'Versions', value: String(details._count.versions) });
    }

    if (details && type === 'folder') {
        rows.push(
            { icon: <Calendar className="h-4 w-4" />, label: 'Created', value: formatDate(details.createdAt) },
        );
        if (details._count?.files !== undefined) rows.push({ icon: <FileText className="h-4 w-4" />, label: 'Files', value: String(details._count.files) });
        if (details._count?.children !== undefined) rows.push({ icon: <FolderOpen className="h-4 w-4" />, label: 'Subfolders', value: String(details._count.children) });
        if (details.path) rows.push({ icon: <Hash className="h-4 w-4" />, label: 'Path', value: details.path });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-800">
                            {type === 'folder' ? <FolderOpen className="h-6 w-6 text-brand-400" /> : getFileIcon(details?.mimeType)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white max-w-[220px]">{name}</p>
                            <p className="text-xs text-surface-500 capitalize">{type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rows.map((row, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-surface-500">{row.icon}</span>
                                    <span className="text-xs font-medium text-surface-400 w-20">{row.label}</span>
                                    <span className="text-sm text-surface-200 truncate flex-1">{row.value}</span>
                                </div>
                            ))}
                            {rows.length === 0 && (
                                <p className="text-sm text-surface-500 text-center py-4">No details available</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
