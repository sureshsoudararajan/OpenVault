import { useState, useEffect } from 'react';
import { fileApi } from '../services/api';
import { Trash2, RotateCcw, File, FileText, Image, Film } from 'lucide-react';

interface TrashedFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    trashedAt: string;
}

const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Film className="h-5 w-5 text-purple-400" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    return <File className="h-5 w-5 text-brand-400" />;
};

export default function TrashPage() {
    const [files, setFiles] = useState<TrashedFile[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res: any = await fileApi.listTrash();
            setFiles(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleRestore = async (id: string) => {
        await fileApi.restore(id);
        load();
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-6 flex items-center gap-3">
                <Trash2 className="h-6 w-6 text-red-400" />
                <h1 className="text-xl font-semibold text-white">Trash</h1>
                <span className="badge-warning">{files.length} items</span>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
            ) : files.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <Trash2 className="mb-4 h-12 w-12 text-surface-600" />
                    <p className="text-surface-400">Trash is empty</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {files.map((file) => (
                        <div key={file.id} className="file-card flex items-center gap-4 rounded-lg px-4 py-3">
                            {getIcon(file.mimeType)}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">{file.name}</p>
                                <p className="text-xs text-surface-500">
                                    Deleted {new Date(file.trashedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button onClick={() => handleRestore(file.id)} className="btn-ghost flex items-center gap-1.5 text-xs text-emerald-400">
                                <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
