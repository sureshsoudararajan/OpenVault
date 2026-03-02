import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileManagerStore } from '../stores/fileManagerStore';
import { fileApi, folderApi, searchApi } from '../services/api';
import FilePreview from '../components/FilePreview';
import ShareDialog from '../components/ShareDialog';
import DetailsDialog from '../components/DetailsDialog';
import {
    Grid3X3, List, FolderPlus, Upload, ChevronRight,
    FileText, Image, Film, FileArchive, File, MoreVertical,
    Download, Pencil, Trash2, Share2, FolderOpen, Eye, Copy, Info, Music
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

interface ContextMenuState {
    x: number;
    y: number;
    type: 'file' | 'folder';
    id: string;
    name: string;
    mimeType?: string;
    fileIndex?: number;
}

const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-8 w-8 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Film className="h-8 w-8 text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-8 w-8 text-cyan-400" />;
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
    const { viewMode, setViewMode, setCurrentFolderId, searchQuery } = useFileManagerStore();

    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    // Rename state
    const [renaming, setRenaming] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Share dialog state
    const [shareTarget, setShareTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);

    // Details dialog state
    const [detailsTarget, setDetailsTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);

    const loadContent = useCallback(async () => {
        setLoading(true);
        try {
            if (searchQuery) {
                const searchRes: any = await searchApi.search(searchQuery);
                setFiles(searchRes.data || []);
                setFolders([]);
                setBreadcrumbs([{ id: null, name: `Search results for "${searchQuery}"` }]);
            } else {
                const [filesRes, foldersRes] = await Promise.all([
                    fileApi.list(folderId),
                    folderApi.list(folderId),
                ]) as any[];

                setFiles(filesRes.data || []);
                setFolders(foldersRes.data || []);

                const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'My Files' }];
                if (folderId) {
                    const folderRes: any = await folderApi.get(folderId);
                    crumbs.push({ id: folderId, name: folderRes.data?.name || 'Folder' });
                }
                setBreadcrumbs(crumbs);
            }
        } catch (err) {
            console.error('Failed to load content:', err);
        } finally {
            setLoading(false);
        }
    }, [folderId, searchQuery]);

    useEffect(() => {
        setCurrentFolderId(folderId || null);
        const timeout = setTimeout(() => {
            loadContent();
        }, searchQuery ? 300 : 0);
        return () => clearTimeout(timeout);
    }, [folderId, loadContent, setCurrentFolderId, searchQuery]);

    // Right-click handler for files
    const handleFileContextMenu = (e: React.MouseEvent, file: FileItem, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'file', id: file.id, name: file.name, mimeType: file.mimeType, fileIndex: index });
    };

    // Right-click handler for folders
    const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', id: folder.id, name: folder.name });
    };

    const closeContextMenu = () => setContextMenu(null);

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

    const handleDelete = async () => {
        if (!contextMenu) return;
        try {
            if (contextMenu.type === 'file') {
                await fileApi.delete(contextMenu.id);
            } else {
                await folderApi.delete(contextMenu.id);
            }
            loadContent();
        } catch (err) {
            console.error('Delete failed:', err);
        }
        closeContextMenu();
    };

    const handleDownload = async () => {
        if (!contextMenu || contextMenu.type !== 'file') return;
        try {
            const res: any = await fileApi.download(contextMenu.id);
            window.open(res.data.downloadUrl, '_blank');
        } catch (err) {
            console.error('Download failed:', err);
        }
        closeContextMenu();
    };

    const handlePreview = () => {
        if (!contextMenu || contextMenu.type !== 'file') return;
        if (contextMenu.fileIndex !== undefined) {
            setPreviewIndex(contextMenu.fileIndex);
        }
        closeContextMenu();
    };

    const handleShare = () => {
        if (!contextMenu) return;
        setShareTarget({ id: contextMenu.id, type: contextMenu.type, name: contextMenu.name });
        closeContextMenu();
    };

    const startRename = () => {
        if (!contextMenu) return;
        setRenaming({ type: contextMenu.type, id: contextMenu.id, name: contextMenu.name });
        setRenameValue(contextMenu.name);
        closeContextMenu();
    };

    const handleRename = async () => {
        if (!renaming || !renameValue.trim()) return;
        try {
            if (renaming.type === 'file') {
                await fileApi.rename(renaming.id, renameValue.trim());
            } else {
                await folderApi.rename(renaming.id, renameValue.trim());
            }
            setRenaming(null);
            loadContent();
        } catch (err) {
            console.error('Rename failed:', err);
        }
    };

    // Ensure context menu doesn't go off screen
    const getMenuPosition = (x: number, y: number) => {
        // Safe estimates for the context menu dimensions
        const menuW = 220;
        const menuH = 320;

        const position: React.CSSProperties = {};

        if (x + menuW > window.innerWidth) {
            position.right = window.innerWidth - x;
        } else {
            position.left = x;
        }

        if (y + menuH > window.innerHeight) {
            position.bottom = window.innerHeight - y;
        } else {
            position.top = y;
        }

        return position;
    };

    return (
        <div className="animate-fade-in" onContextMenu={(e) => { if (!(e.target as HTMLElement).closest('[data-ctx]')) { e.preventDefault(); } }}>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-1 text-sm">
                        {breadcrumbs.map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-surface-600" />}
                                <button
                                    onClick={() => crumb.id ? navigate(`/folder/${crumb.id}`) : navigate('/')}
                                    className={`transition-colors hover:text-white ${i === breadcrumbs.length - 1 ? 'font-medium text-surface-900 dark:text-white' : 'text-surface-400'}`}
                                >
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-100/50 dark:bg-surface-800/50 p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>

                    <button onClick={() => setShowNewFolderInput(true)} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
                        <FolderPlus className="h-4 w-4" /> New Folder
                    </button>

                    <label className="btn-primary flex items-center gap-1.5 text-sm cursor-pointer px-4 py-1.5 !text-white">
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
                                    <div
                                        key={folder.id}
                                        data-ctx="folder"
                                        onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                                        onClick={() => {
                                            if (renaming?.id === folder.id) return;
                                            navigate(`/folder/${folder.id}`);
                                        }}
                                        className={`file-card group flex items-center gap-3 text-left w-full cursor-pointer ${viewMode === 'list' ? 'rounded-lg' : ''}`}
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                                            <FolderOpen className="h-5 w-5 text-brand-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {renaming?.id === folder.id ? (
                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                        className="input-field text-sm py-0.5 px-1"
                                                        autoFocus
                                                    />
                                                    <button onClick={handleRename} className="text-xs text-brand-400 hover:text-brand-300">Save</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{folder.name}</p>
                                                    <p className="text-xs text-surface-500">{folder._count?.files ?? 0} files</p>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleFolderContextMenu(e, folder); }}
                                            className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-700"
                                        >
                                            <MoreVertical className="h-4 w-4 text-surface-400" />
                                        </button>
                                    </div>
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
                                        <div
                                            key={file.id}
                                            data-ctx="file"
                                            className="file-card group relative cursor-pointer"
                                            onClick={() => setPreviewIndex(index)}
                                            onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                        >
                                            <div className="mb-3 flex justify-center py-4">
                                                {getFileIcon(file.mimeType)}
                                            </div>
                                            {renaming?.id === file.id ? (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                        className="input-field text-sm py-0.5 px-1 w-full"
                                                        autoFocus
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{file.name}</p>
                                                    <p className="mt-0.5 text-xs text-surface-500">{formatSize(file.size)}</p>
                                                </>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleFileContextMenu(e, file, index); }}
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
                                        <div
                                            key={file.id}
                                            data-ctx="file"
                                            className="file-card flex items-center gap-4 rounded-lg py-2 px-3 cursor-pointer"
                                            onClick={() => setPreviewIndex(index)}
                                            onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                        >
                                            {getFileIcon(file.mimeType)}
                                            <div className="min-w-0 flex-1">
                                                {renaming?.id === file.id ? (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                            className="input-field text-sm py-0.5 px-1"
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{file.name}</p>
                                                )}
                                            </div>
                                            <span className="text-xs text-surface-500">{formatSize(file.size)}</span>
                                            <span className="text-xs text-surface-500">{formatDate(file.createdAt)}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleFileContextMenu(e, file, index); }}
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

            {/* Right-Click Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
                    <div
                        className="fixed z-50 w-52 rounded-xl border border-surface-700 dark:border-surface-700 bg-white dark:bg-surface-900/95 py-1.5 shadow-xl backdrop-blur-sm animate-scale-in"
                        style={getMenuPosition(contextMenu.x, contextMenu.y)}
                    >
                        {/* Header */}
                        <div className="border-b border-surface-700 px-3 py-2 mb-1">
                            <p className="truncate text-xs font-medium text-surface-300">{contextMenu.name}</p>
                            <p className="text-[10px] text-surface-500 capitalize">{contextMenu.type}</p>
                        </div>

                        {/* File-only: Preview */}
                        {contextMenu.type === 'file' && (
                            <button onClick={handlePreview} className="dropdown-item w-full">
                                <Eye className="h-4 w-4" /> Preview
                            </button>
                        )}

                        {/* File-only: Download */}
                        {contextMenu.type === 'file' && (
                            <button onClick={handleDownload} className="dropdown-item w-full">
                                <Download className="h-4 w-4" /> Download
                            </button>
                        )}

                        {/* Folder: Open */}
                        {contextMenu.type === 'folder' && (
                            <button onClick={() => { navigate(`/folder/${contextMenu.id}`); closeContextMenu(); }} className="dropdown-item w-full">
                                <FolderOpen className="h-4 w-4" /> Open
                            </button>
                        )}

                        <hr className="my-1 border-surface-700" />

                        {/* Share */}
                        <button onClick={handleShare} className="dropdown-item w-full">
                            <Share2 className="h-4 w-4" /> Share
                        </button>

                        {/* Rename */}
                        <button onClick={startRename} className="dropdown-item w-full">
                            <Pencil className="h-4 w-4" /> Rename
                        </button>

                        {/* Copy (placeholder) */}
                        <button onClick={closeContextMenu} className="dropdown-item w-full">
                            <Copy className="h-4 w-4" /> Copy
                        </button>

                        {/* Details */}
                        <button onClick={() => { setDetailsTarget({ id: contextMenu.id, type: contextMenu.type, name: contextMenu.name }); closeContextMenu(); }} className="dropdown-item w-full">
                            <Info className="h-4 w-4" /> Details
                        </button>

                        <hr className="my-1 border-surface-700" />

                        {/* Delete */}
                        <button onClick={handleDelete} className="dropdown-item w-full text-red-400 hover:text-red-300">
                            <Trash2 className="h-4 w-4" /> Move to Trash
                        </button>
                    </div>
                </>
            )}

            {/* Details Dialog */}
            {detailsTarget && (
                <DetailsDialog
                    id={detailsTarget.id}
                    type={detailsTarget.type}
                    name={detailsTarget.name}
                    onClose={() => setDetailsTarget(null)}
                />
            )}

            {/* Share Dialog */}
            {shareTarget && (
                <ShareDialog
                    resourceId={shareTarget.id}
                    resourceType={shareTarget.type}
                    resourceName={shareTarget.name}
                    onClose={() => setShareTarget(null)}
                />
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
