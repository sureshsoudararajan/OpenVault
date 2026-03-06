import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileManagerStore } from '../stores/fileManagerStore';
import { fileApi, folderApi, searchApi } from '../services/api';
import FilePreview from '../components/FilePreview';
import Thumbnail from '../components/Thumbnail';
import ShareDialog from '../components/ShareDialog';
import DetailsDialog from '../components/DetailsDialog';
import TagDialog from '../components/TagDialog';
import {
    Grid3X3, List, FolderPlus, Upload, ChevronRight,
    FileText, Image, Film, FileArchive, File, MoreVertical,
    Download, Pencil, Trash2, Share2, FolderOpen, Eye, Copy, Info, Music,
    Clipboard, CheckSquare, X, Tag as TagIcon, Palette
} from 'lucide-react';

interface FileItem {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
    thumbnailKey?: string | null;
    fileTags?: { tag: { id: string; name: string; color: string } }[];
}

interface FolderItem {
    id: string;
    name: string;
    color?: string | null;
    _count?: { files: number; children: number };
}

interface ContextMenuState {
    x: number;
    y: number;
    type: 'file' | 'folder' | 'background';
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
    const {
        viewMode, setViewMode, setCurrentFolderId, searchQuery,
        selectedFiles, selectedFolders, toggleFileSelection, toggleFolderSelection,
        selectAllFiles, clearSelection, clipboard,
        setClipboard, clearClipboard
    } = useFileManagerStore();

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

    // Share & Details
    const [detailsTarget, setDetailsTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);
    const [shareTarget, setShareTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);
    const [tagTarget, setTagTarget] = useState<FileItem | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const PRESET_COLORS = [
        { name: 'Default', value: null },
        { name: 'Red', value: '#EF4444' },
        { name: 'Orange', value: '#F97316' },
        { name: 'Yellow', value: '#F59E0B' },
        { name: 'Green', value: '#10B981' },
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Purple', value: '#8B5CF6' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Slate', value: '#64748B' },
    ];

    // Drag and drop
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [showDropOverlay, setShowDropOverlay] = useState(false);
    const dropOverlayCounter = useRef(0);

    // Paste status
    const [pasteStatus, setPasteStatus] = useState<string | null>(null);

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

    // ---- Keyboard Shortcuts ----
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't trigger when typing in inputs
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            // Ctrl+A — Select all
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                selectAllFiles(files.map(f => f.id));
            }

            // Ctrl+C — Copy
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                const items = [
                    ...Array.from(selectedFiles).map(id => {
                        const f = files.find(f => f.id === id);
                        return f ? { id: f.id, type: 'file' as const, name: f.name } : null;
                    }),
                    ...Array.from(selectedFolders).map(id => {
                        const f = folders.find(f => f.id === id);
                        return f ? { id: f.id, type: 'folder' as const, name: f.name } : null;
                    }),
                ].filter(Boolean) as { id: string; type: 'file' | 'folder'; name: string }[];

                if (items.length > 0) {
                    setClipboard(items, 'copy');
                    setPasteStatus(`${items.length} item(s) copied`);
                    setTimeout(() => setPasteStatus(null), 2000);
                }
            }

            // Ctrl+V — Paste
            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                handlePaste();
            }

            // Delete — Move to trash
            if (e.key === 'Delete') {
                e.preventDefault();
                handleBulkDelete();
            }

            // Escape — Clear selection
            if (e.key === 'Escape') {
                clearSelection();
                setContextMenu(null);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [files, folders, selectedFiles, selectedFolders, clipboard, folderId]);

    // ---- Paste handler ----
    const handlePaste = async () => {
        if (clipboard.length === 0) return;

        setPasteStatus('Pasting...');
        try {
            for (const item of clipboard) {
                if (item.type === 'file') {
                    await fileApi.copy(item.id, folderId ?? null);
                }
                // Folder copy can be added later
            }
            clearClipboard();
            setPasteStatus('Pasted successfully!');
            loadContent();
        } catch (err) {
            console.error('Paste failed:', err);
            setPasteStatus('Paste failed');
        }
        setTimeout(() => setPasteStatus(null), 2000);
    };

    // ---- Multi-select click handler ----
    const handleItemClick = (e: React.MouseEvent, id: string, type: 'file' | 'folder', fileIndex?: number) => {
        if (renaming?.id === id) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (type === 'file') toggleFileSelection(id);
            else toggleFolderSelection(id);
            return;
        }

        // Normal click — navigate folder or preview file
        clearSelection();
        if (type === 'folder') {
            navigate(`/folder/${id}`);
        } else if (fileIndex !== undefined) {
            setPreviewIndex(fileIndex);
        }
    };

    // ---- Context menu handlers ----
    const handleFileContextMenu = (e: React.MouseEvent, file: FileItem, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'file', id: file.id, name: file.name, mimeType: file.mimeType, fileIndex: index });
    };

    const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', id: folder.id, name: folder.name });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-ctx]')) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'background', id: '', name: '' });
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

    const handleBulkDelete = async () => {
        const fileIds = Array.from(selectedFiles);
        const folderIds = Array.from(selectedFolders);
        if (fileIds.length === 0 && folderIds.length === 0) return;

        try {
            await Promise.all([
                ...fileIds.map(id => fileApi.delete(id)),
                ...folderIds.map(id => folderApi.delete(id)),
            ]);
            clearSelection();
            loadContent();
        } catch (err) {
            console.error('Bulk delete failed:', err);
        }
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
        setShareTarget({ id: contextMenu.id, type: contextMenu.type as 'file' | 'folder', name: contextMenu.name });
        closeContextMenu();
    };

    const handleCopy = () => {
        if (!contextMenu || contextMenu.type === 'background') return;
        setClipboard([{ id: contextMenu.id, type: contextMenu.type, name: contextMenu.name }], 'copy');
        setPasteStatus('1 item copied');
        setTimeout(() => setPasteStatus(null), 2000);
        closeContextMenu();
    };

    const startRename = () => {
        if (!contextMenu) return;
        setRenaming({ type: contextMenu.type as 'file' | 'folder', id: contextMenu.id, name: contextMenu.name });
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

    // ---- Drag & Drop: Internal (move files/folders) ----
    const handleDragStart = (e: React.DragEvent, id: string, type: 'file' | 'folder', name: string) => {
        e.dataTransfer.setData('application/openvault', JSON.stringify({ id, type, name }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverFolder = (e: React.DragEvent, fId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if dragging internal item
        if (e.dataTransfer.types.includes('application/openvault')) {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'copy';
        }
        setDragOverFolderId(fId);
    };

    const handleDragLeaveFolder = () => {
        setDragOverFolderId(null);
    };

    const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);

        // Internal drag (move)
        const openvaultData = e.dataTransfer.getData('application/openvault');
        if (openvaultData) {
            try {
                const item = JSON.parse(openvaultData);
                if (item.id === targetFolderId) return; // Can't drop on itself
                if (item.type === 'file') {
                    await fileApi.move(item.id, targetFolderId);
                } else {
                    await folderApi.move(item.id, targetFolderId);
                }
                loadContent();
            } catch (err) {
                console.error('Move failed:', err);
            }
            return;
        }

        // External files dropped on a folder
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            for (const file of Array.from(droppedFiles)) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folderId', targetFolderId);
                try {
                    await fileApi.upload(formData);
                } catch (err) {
                    console.error('Upload failed:', err);
                }
            }
            loadContent();
        }
    };

    const handleDragEnd = () => {
        setDragOverFolderId(null);
    };

    // ---- Drag & Drop: Desktop upload overlay ----
    const handlePageDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
            dropOverlayCounter.current += 1;
            setShowDropOverlay(true);
        }
    };

    const handlePageDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dropOverlayCounter.current -= 1;
        if (dropOverlayCounter.current <= 0) {
            dropOverlayCounter.current = 0;
            setShowDropOverlay(false);
        }
    };

    const handlePageDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handlePageDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setShowDropOverlay(false);
        dropOverlayCounter.current = 0;

        const droppedFiles = e.dataTransfer.files;
        if (!droppedFiles.length) return;

        for (const file of Array.from(droppedFiles)) {
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

    // Menu position
    const getMenuPosition = (x: number, y: number) => {
        const menuW = 220;
        const menuH = 320;
        const position: React.CSSProperties = {};
        if (x + menuW > window.innerWidth) { position.right = window.innerWidth - x; } else { position.left = x; }
        if (y + menuH > window.innerHeight) { position.bottom = window.innerHeight - y; } else { position.top = y; }
        return position;
    };

    const totalSelected = selectedFiles.size + selectedFolders.size;

    return (
        <div
            className="animate-fade-in relative"
            onContextMenu={handleBackgroundContextMenu}
            onDragEnter={handlePageDragEnter}
            onDragLeave={handlePageDragLeave}
            onDragOver={handlePageDragOver}
            onDrop={handlePageDrop}
        >
            {/* Desktop Drop Overlay */}
            {showDropOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-500/10 backdrop-blur-sm border-4 border-dashed border-brand-400 rounded-2xl pointer-events-none animate-fade-in">
                    <div className="text-center">
                        <Upload className="h-16 w-16 text-brand-400 mx-auto mb-3 animate-bounce" />
                        <p className="text-lg font-semibold text-brand-400">Drop files to upload</p>
                        <p className="text-sm text-surface-400 mt-1">Files will be uploaded to the current folder</p>
                    </div>
                </div>
            )}

            {/* Paste Status Toast */}
            {pasteStatus && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-surface-800 border border-surface-700 text-sm text-white shadow-xl flex items-center gap-2 animate-slide-up">
                    <Clipboard className="h-4 w-4 text-brand-400" />
                    {pasteStatus}
                </div>
            )}

            {/* Selection Bar */}
            {totalSelected > 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-500/10 border border-brand-500/20 px-4 py-2.5 animate-slide-down">
                    <CheckSquare className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-medium text-brand-400">{totalSelected} selected</span>
                    <div className="flex-1" />
                    {clipboard.length === 0 && (
                        <button
                            onClick={() => {
                                const items = [
                                    ...Array.from(selectedFiles).map(id => {
                                        const f = files.find(f => f.id === id);
                                        return f ? { id, type: 'file' as const, name: f.name } : null;
                                    }),
                                    ...Array.from(selectedFolders).map(id => {
                                        const f = folders.find(f => f.id === id);
                                        return f ? { id, type: 'folder' as const, name: f.name } : null;
                                    }),
                                ].filter(Boolean) as { id: string; type: 'file' | 'folder'; name: string }[];
                                if (items.length > 0) {
                                    setClipboard(items, 'copy');
                                    setPasteStatus(`${items.length} item(s) copied`);
                                    setTimeout(() => setPasteStatus(null), 2000);
                                }
                            }}
                            className="btn-ghost text-xs flex items-center gap-1.5 text-brand-400"
                        >
                            <Copy className="h-3.5 w-3.5" /> Copy
                        </button>
                    )}
                    <button
                        onClick={handleBulkDelete}
                        className="btn-ghost text-xs flex items-center gap-1.5 text-red-400"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                    <button onClick={clearSelection} className="btn-ghost text-xs text-surface-400">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

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
                    {/* Paste button (when clipboard has items) */}
                    {clipboard.length > 0 && (
                        <button onClick={handlePaste} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5 text-brand-400 border-brand-500/30">
                            <Clipboard className="h-4 w-4" /> Paste ({clipboard.length})
                        </button>
                    )}

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
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, folder.id, 'folder', folder.name)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOverFolder(e, folder.id)}
                                        onDragLeave={handleDragLeaveFolder}
                                        onDrop={(e) => handleDropOnFolder(e, folder.id)}
                                        onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                                        onClick={(e) => handleItemClick(e, folder.id, 'folder')}
                                        className={`file-card group flex items-center gap-3 text-left w-full cursor-pointer transition-all
                                            ${viewMode === 'list' ? 'rounded-lg' : ''}
                                            ${selectedFolders.has(folder.id) ? 'ring-2 ring-brand-500 bg-brand-500/10' : ''}
                                            ${dragOverFolderId === folder.id ? 'ring-2 ring-brand-400 bg-brand-500/20 scale-[1.02]' : ''}
                                        `}
                                    >
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${!folder.color ? 'bg-brand-500/10' : ''}`} style={folder.color ? { backgroundColor: `${folder.color}20` } : undefined}>
                                            <FolderOpen className={`h-5 w-5 ${!folder.color ? 'text-brand-400' : ''}`} style={folder.color ? { color: folder.color } : undefined} />
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
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, file.id, 'file', file.name)}
                                            onDragEnd={handleDragEnd}
                                            className={`file-card group relative cursor-pointer transition-all
                                                ${selectedFiles.has(file.id) ? 'ring-2 ring-brand-500 bg-brand-500/10' : ''}
                                            `}
                                            onClick={(e) => handleItemClick(e, file.id, 'file', index)}
                                            onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                        >
                                            <div className="mb-3 flex justify-center py-4">
                                                {file.thumbnailKey ? (
                                                    <Thumbnail fileId={file.id} mimeType={file.mimeType} className="h-16 w-16 mx-auto rounded-lg shadow-sm ring-1 ring-surface-200 dark:ring-surface-700" />
                                                ) : (
                                                    getFileIcon(file.mimeType)
                                                )}
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
                                                    {file.fileTags && file.fileTags.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {file.fileTags.slice(0, 3).map(ft => (
                                                                <span key={ft.tag.id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${ft.tag.color}20`, color: ft.tag.color }}>
                                                                    {ft.tag.name}
                                                                </span>
                                                            ))}
                                                            {file.fileTags.length > 3 && <span className="text-[10px] text-surface-500">+{file.fileTags.length - 3}</span>}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {/* Selection checkbox overlay */}
                                            {(selectedFiles.size > 0 || selectedFolders.size > 0) && (
                                                <div
                                                    className={`absolute top-2 left-2 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors
                                                        ${selectedFiles.has(file.id) ? 'bg-brand-500 border-brand-500' : 'border-surface-500 bg-surface-800/50'}
                                                    `}
                                                    onClick={(e) => { e.stopPropagation(); toggleFileSelection(file.id); }}
                                                >
                                                    {selectedFiles.has(file.id) && <CheckSquare className="h-3 w-3 text-white" />}
                                                </div>
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
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, file.id, 'file', file.name)}
                                            onDragEnd={handleDragEnd}
                                            className={`file-card flex items-center gap-4 rounded-lg py-2 px-3 cursor-pointer transition-all
                                                ${selectedFiles.has(file.id) ? 'ring-2 ring-brand-500 bg-brand-500/10' : ''}
                                            `}
                                            onClick={(e) => handleItemClick(e, file.id, 'file', index)}
                                            onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                        >
                                            {(selectedFiles.size > 0 || selectedFolders.size > 0) && (
                                                <div
                                                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                                        ${selectedFiles.has(file.id) ? 'bg-brand-500 border-brand-500' : 'border-surface-500'}
                                                    `}
                                                    onClick={(e) => { e.stopPropagation(); toggleFileSelection(file.id); }}
                                                >
                                                    {selectedFiles.has(file.id) && <CheckSquare className="h-3 w-3 text-white" />}
                                                </div>
                                            )}
                                            {file.thumbnailKey ? (
                                                <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded overflow-hidden bg-surface-100 dark:bg-surface-800">
                                                    <Thumbnail fileId={file.id} mimeType={file.mimeType} className="h-full w-full object-cover" />
                                                </div>
                                            ) : (
                                                getFileIcon(file.mimeType)
                                            )}
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
                            <p className="mt-1 text-xs text-surface-600">You can also drag & drop files here</p>
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
                        className="fixed z-50 w-52 rounded-xl border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-900/95 py-1.5 shadow-xl backdrop-blur-md animate-scale-in"
                        style={getMenuPosition(contextMenu.x, contextMenu.y)}
                    >
                        {contextMenu.type === 'background' ? (
                            <>
                                {/* Background context menu */}
                                {clipboard.length > 0 && (
                                    <button onClick={() => { handlePaste(); closeContextMenu(); }} className="dropdown-item w-full">
                                        <Clipboard className="h-4 w-4" /> Paste ({clipboard.length} items)
                                    </button>
                                )}
                                <button onClick={() => { setShowNewFolderInput(true); closeContextMenu(); }} className="dropdown-item w-full">
                                    <FolderPlus className="h-4 w-4" /> New Folder
                                </button>
                                <label className="dropdown-item w-full cursor-pointer">
                                    <Upload className="h-4 w-4" /> Upload Files
                                    <input type="file" multiple className="hidden" onChange={(e) => { handleUpload(e); closeContextMenu(); }} />
                                </label>
                            </>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="border-b border-surface-200 dark:border-surface-700 px-3 py-2 mb-1">
                                    <p className="truncate text-xs font-medium text-surface-900 dark:text-surface-300">{contextMenu.name}</p>
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

                                <hr className="my-1 border-surface-200 dark:border-surface-700" />

                                {/* Share */}
                                <button onClick={handleShare} className="dropdown-item w-full">
                                    <Share2 className="h-4 w-4" /> Share
                                </button>

                                {/* Rename */}
                                <button onClick={startRename} className="dropdown-item w-full">
                                    <Pencil className="h-4 w-4" /> Rename
                                </button>

                                {/* File-only: Tags */}
                                {contextMenu.type === 'file' && (
                                    <button
                                        onClick={() => {
                                            const file = files.find(f => f.id === contextMenu.id);
                                            if (file) setTagTarget(file);
                                            closeContextMenu();
                                        }}
                                        className="dropdown-item w-full"
                                    >
                                        <TagIcon className="h-4 w-4" /> Manage Tags
                                    </button>
                                )}

                                {/* Folder-only: Color */}
                                {contextMenu.type === 'folder' && (
                                    <div className="relative group/color">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                                            className="dropdown-item w-full flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Palette className="h-4 w-4" /> Change Color
                                            </div>
                                            <ChevronRight className="h-3 w-3 opacity-50" />
                                        </button>

                                        {showColorPicker && (
                                            <div className="absolute left-full top-0 ml-1 w-40 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 py-1.5 shadow-xl animate-scale-in">
                                                <div className="grid grid-cols-5 gap-1.5 px-2 py-1">
                                                    {PRESET_COLORS.map(color => (
                                                        <button
                                                            key={color.name}
                                                            title={color.name}
                                                            onClick={async () => {
                                                                await folderApi.updateColor(contextMenu.id, color.value);
                                                                closeContextMenu();
                                                                loadContent();
                                                            }}
                                                            className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110"
                                                            style={{ backgroundColor: color.value || 'transparent' }}
                                                        >
                                                            {!color.value && <X className="h-3 w-3 mx-auto text-surface-400" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Copy */}
                                <button onClick={handleCopy} className="dropdown-item w-full">
                                    <Copy className="h-4 w-4" /> Copy
                                </button>

                                {/* Paste into folder */}
                                {contextMenu.type === 'folder' && clipboard.length > 0 && (
                                    <button onClick={async () => {
                                        for (const item of clipboard) {
                                            if (item.type === 'file') {
                                                await fileApi.copy(item.id, contextMenu.id);
                                            }
                                        }
                                        clearClipboard();
                                        closeContextMenu();
                                        loadContent();
                                    }} className="dropdown-item w-full">
                                        <Clipboard className="h-4 w-4" /> Paste Here
                                    </button>
                                )}

                                {/* Details */}
                                <button onClick={() => { setDetailsTarget({ id: contextMenu.id, type: contextMenu.type as 'file' | 'folder', name: contextMenu.name }); closeContextMenu(); }} className="dropdown-item w-full">
                                    <Info className="h-4 w-4" /> Details
                                </button>

                                <hr className="my-1 border-surface-700" />

                                {/* Delete */}
                                <button onClick={handleDelete} className="dropdown-item w-full text-red-400 hover:text-red-300">
                                    <Trash2 className="h-4 w-4" /> Move to Trash
                                </button>
                            </>
                        )}
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

            {/* Tag Dialog */}
            {tagTarget && (
                <TagDialog
                    fileId={tagTarget.id}
                    fileName={tagTarget.name}
                    initialTags={tagTarget.fileTags || []}
                    onClose={() => setTagTarget(null)}
                    onTagsUpdated={() => {
                        loadContent();
                        // Update the target object so the dialog reflects changes if it stayed open
                        // Actually we reload content which will update files array
                    }}
                />
            )}
        </div>
    );
}
