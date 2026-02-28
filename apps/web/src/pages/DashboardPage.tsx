import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileManagerStore } from '../stores/fileManagerStore';
import { fileApi, folderApi } from '../services/api';
import FilePreview from '../components/FilePreview';
import {
    Grid3X3, List, Plus, FolderPlus, Upload, ChevronRight,
    FileText, Image, Film, FileArchive, File, MoreVertical,
    Download, Pencil, Trash2, Share2, FolderOpen
} from 'lucide-react';

interface FileItem {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
}

interface FolderItem {
    id: string;
    name: string;
    _count?: { files: number; children: number };
}

const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-8 w-8 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Film className="h-8 w-8 text-purple-400" />;
    if (mimeType.includes('pdf')) return <FileText className="h-8 w-8 text-red-400" />;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return <FileArchive className="h-8 w-8 text-amber-400" />;
    return <File className="h-8 w-8 text-brand-400" />;
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function DashboardPage() {
    const { folderId } = useParams();
    const navigate = useNavigate();
    const { viewMode, setViewMode, setCurrentFolderId } = useFileManagerStore();

    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [contextMenu, setContextMenu] = useState<{ fileId: string; x: number; y: number } | null>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const loadContent = useCallback(async () => {
        setLoading(true);
        try {
            const [filesRes, foldersRes] = await Promise.all([
                fileApi.list(folderId),
                folderApi.list(folderId),
            ]) as any[];

            setFiles(filesRes.data || []);
            setFolders(foldersRes.data || []);

            // Build breadcrumbs
            const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'My Files' }];
            if (folderId) {
                const folderRes: any = await folderApi.get(folderId);
                const pathParts = folderRes.data?.path?.split('/').filter(Boolean) || [];
                // Simple breadcrumb from the current folder name
                crumbs.push({ id: folderId, name: folderRes.data?.name || 'Folder' });
            }
            setBreadcrumbs(crumbs);
        } catch (err) {
            console.error('Failed to load content:', err);
        } finally {
            setLoading(false);
        }
    }, [folderId]);

    useEffect(() => {
        setCurrentFolderId(folderId || null);
        loadContent();
    }, [folderId, loadContent, setCurrentFolderId]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await folderApi.create({ name: newFolderName, parentId: folderId });
            setNewFolderName('');
            setShowNewFolderInput(false);
            loadContent();
        } catch (err) {
            console.error('Failed to create folder:', err);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        for (const file of Array.from(fileList)) {
            const formData = new FormData();
            formData.append('file', file);
            if (folderId) formData.append('folderId', folderId);

            try {
                await fileApi.upload(formData);
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }
        loadContent();
    };

    const handleDelete = async (fileId: string) => {
        try {
            await fileApi.delete(fileId);
            loadContent();
        } catch (err) {
            console.error('Delete failed:', err);
        }
        setContextMenu(null);
    };

    const handleDownload = async (fileId: string) => {
        try {
            const res: any = await fileApi.download(fileId);
            window.open(res.data.downloadUrl, '_blank');
        } catch (err) {
            console.error('Download failed:', err);
        }
        setContextMenu(null);
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-sm">
                        {breadcrumbs.map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-surface-600" />}
                                <button
                                    onClick={() => crumb.id ? navigate(`/folder/${crumb.id}`) : navigate('/')}
                                    className={`transition-colors hover:text-white ${i === breadcrumbs.length - 1 ? 'font-medium text-white' : 'text-surface-400'
                                        }`}
                                >
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex rounded-lg border border-surface-700 bg-surface-800/50 p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-500 hover:text-white'
                                }`}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-500 hover:text-white'
                                }`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>

                    {/* New Folder */}
                    <button onClick={() => setShowNewFolderInput(true)} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
                        <FolderPlus className="h-4 w-4" /> New Folder
                    </button>

                    {/* Upload */}
                    <label className="btn-primary flex items-center gap-1.5 text-sm cursor-pointer px-4 py-1.5">
                        <Upload className="h-4 w-4" /> Upload
                        <input type="file" multiple className="hidden" onChange={handleUpload} />
                    </label>
                </div>
            </div>

            {/* New Folder Input */}
            {showNewFolderInput && (
                <div className="mb-4 flex items-center gap-2 animate-slide-down">
                    <FolderOpen className="h-5 w-5 text-brand-400" />
                    <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        className="input-field max-w-xs text-sm"
                        placeholder="Folder name"
                        autoFocus
                    />
                    <button onClick={handleCreateFolder} className="btn-primary text-sm px-3 py-1.5">Create</button>
                    <button onClick={() => setShowNewFolderInput(false)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
            ) : (
                <>
                    {/* Folders */}
                    {folders.length > 0 && (
                        <div className="mb-6">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Folders</h3>
                            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'space-y-1'}>
                                {folders.map((folder) => (
                                    <button
                                        key={folder.id}
                                        onClick={() => navigate(`/folder/${folder.id}`)}
                                        className={`file-card flex items-center gap-3 text-left w-full ${viewMode === 'list' ? 'rounded-lg' : ''
                                            }`}
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                                            <FolderOpen className="h-5 w-5 text-brand-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-white">{folder.name}</p>
                                            <p className="text-xs text-surface-500">
                                                {folder._count?.files ?? 0} files
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files */}
                    {files.length > 0 && (
                        <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Files</h3>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {files.map((file, index) => (
                                        <div key={file.id} className="file-card group relative" onClick={() => setPreviewIndex(index)}>
                                            <div className="mb-3 flex justify-center py-4">
                                                {getFileIcon(file.mimeType)}
                                            </div>
                                            <p className="truncate text-sm font-medium text-white">{file.name}</p>
                                            <p className="mt-0.5 text-xs text-surface-500">{formatSize(file.size)}</p>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); setContextMenu({ fileId: file.id, x: e.clientX, y: e.clientY }); }}
                                                className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-700"
                                            >
                                                <MoreVertical className="h-4 w-4 text-surface-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {files.map((file, index) => (
                                        <div key={file.id} className="file-card flex items-center gap-4 rounded-lg py-2 px-3 cursor-pointer" onClick={() => setPreviewIndex(index)}>
                                            {getFileIcon(file.mimeType)}
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-white">{file.name}</p>
                                            </div>
                                            <span className="text-xs text-surface-500">{formatSize(file.size)}</span>
                                            <span className="text-xs text-surface-500">{formatDate(file.createdAt)}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setContextMenu({ fileId: file.id, x: 0, y: 0 }); }}
                                                className="rounded-md p-1 hover:bg-surface-700"
                                            >
                                                <MoreVertical className="h-4 w-4 text-surface-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {folders.length === 0 && files.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800">
                                <FolderOpen className="h-8 w-8 text-surface-600" />
                            </div>
                            <h3 className="text-lg font-medium text-surface-300">No files yet</h3>
                            <p className="mt-1 text-sm text-surface-500">Upload files or create a folder to get started</p>
                            <label className="btn-primary mt-4 flex cursor-pointer items-center gap-2 text-sm">
                                <Upload className="h-4 w-4" /> Upload Files
                                <input type="file" multiple className="hidden" onChange={handleUpload} />
                            </label>
                        </div>
                    )}
                </>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="dropdown-menu z-50"
                        style={{ position: 'fixed', left: contextMenu.x || '50%', top: contextMenu.y || '50%' }}
                    >
                        <button onClick={() => handleDownload(contextMenu.fileId)} className="dropdown-item w-full">
                            <Download className="h-4 w-4" /> Download
                        </button>
                        <button className="dropdown-item w-full">
                            <Share2 className="h-4 w-4" /> Share
                        </button>
                        <button className="dropdown-item w-full">
                            <Pencil className="h-4 w-4" /> Rename
                        </button>
                        <hr className="my-1 border-surface-700" />
                        <button onClick={() => handleDelete(contextMenu.fileId)} className="dropdown-item w-full text-red-400 hover:text-red-300">
                            <Trash2 className="h-4 w-4" /> Move to Trash
                        </button>
                    </div>
                </>
            )}

            {/* File Preview Modal */}
            {previewIndex !== null && files[previewIndex] && (
                <FilePreview
                    fileId={files[previewIndex].id}
                    fileName={files[previewIndex].name}
                    mimeType={files[previewIndex].mimeType}
                    fileSize={files[previewIndex].size}
                    onClose={() => setPreviewIndex(null)}
                    onPrev={previewIndex > 0 ? () => setPreviewIndex(previewIndex - 1) : undefined}
                    onNext={previewIndex < files.length - 1 ? () => setPreviewIndex(previewIndex + 1) : undefined}
                />
            )}
        </div>
    );
}
