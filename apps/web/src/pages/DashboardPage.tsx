import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    if (mimeType.startsWith('image/')) return <Image className="h-8 w-8 text-pink-500 dark:text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Film className="h-8 w-8 text-purple-500 dark:text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-8 w-8 text-cyan-500 dark:text-cyan-400" />;
    if (mimeType.includes('pdf')) return <FileText className="h-8 w-8 text-red-500 dark:text-red-400" />;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return <FileArchive className="h-8 w-8 text-amber-500 dark:text-amber-400" />;
    return <File className="h-8 w-8 text-gray-500 dark:text-gray-400" />;
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

function DashboardPage() {
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

    const [renaming, setRenaming] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
    const [renameValue, setRenameValue] = useState('');

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

    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [showDropOverlay, setShowDropOverlay] = useState(false);
    const dropOverlayCounter = useRef(0);
    const [pasteStatus, setPasteStatus] = useState<string | null>(null);

    const loadContent = useCallback(async () => {
        setLoading(true);
        try {
            if (searchQuery) {
                const searchRes: any = await searchApi.search(searchQuery);
                setFiles(searchRes.data || []);
                setFolders([]);
                setBreadcrumbs([{ id: null, name: `Search: "${searchQuery}"` }]);
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
        const timeout = setTimeout(() => { loadContent(); }, searchQuery ? 300 : 0);
        return () => clearTimeout(timeout);
    }, [folderId, loadContent, setCurrentFolderId, searchQuery]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAllFiles(files.map(f => f.id)); }
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                const items = [
                    ...Array.from(selectedFiles).map(id => { const f = files.find(f => f.id === id); return f ? { id: f.id, type: 'file' as const, name: f.name } : null; }),
                    ...Array.from(selectedFolders).map(id => { const f = folders.find(f => f.id === id); return f ? { id: f.id, type: 'folder' as const, name: f.name } : null; }),
                ].filter(Boolean) as { id: string; type: 'file' | 'folder'; name: string }[];
                if (items.length > 0) { setClipboard(items, 'copy'); setPasteStatus(`${items.length} item(s) copied`); setTimeout(() => setPasteStatus(null), 2000); }
            }
            if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); }
            if (e.key === 'Delete') { e.preventDefault(); handleBulkDelete(); }
            if (e.key === 'Escape') { clearSelection(); setContextMenu(null); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [files, folders, selectedFiles, selectedFolders, clipboard, folderId]);

    const handlePaste = async () => {
        if (clipboard.length === 0) return;
        setPasteStatus('Pasting...');
        try {
            for (const item of clipboard) { if (item.type === 'file') await fileApi.copy(item.id, folderId ?? null); }
            clearClipboard(); setPasteStatus('Pasted successfully!'); loadContent();
        } catch (err) { console.error('Paste failed:', err); setPasteStatus('Paste failed'); }
        setTimeout(() => setPasteStatus(null), 2000);
    };

    const handleItemClick = (e: React.MouseEvent, id: string, type: 'file' | 'folder', fileIndex?: number) => {
        if (renaming?.id === id) return;
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (type === 'file') toggleFileSelection(id); else toggleFolderSelection(id); return; }
        clearSelection();
        if (type === 'folder') navigate(`/folder/${id}`);
        else if (fileIndex !== undefined) setPreviewIndex(fileIndex);
    };

    const handleFileContextMenu = (e: React.MouseEvent, file: FileItem, index: number) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'file', id: file.id, name: file.name, mimeType: file.mimeType, fileIndex: index }); };
    const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', id: folder.id, name: folder.name }); };
    const handleBackgroundContextMenu = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('[data-ctx]')) return; e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'background', id: '', name: '' }); };
    const closeContextMenu = () => setContextMenu(null);

    const handleCreateFolder = async () => { if (!newFolderName.trim()) return; try { await folderApi.create({ name: newFolderName, parentId: folderId }); setNewFolderName(''); setShowNewFolderInput(false); loadContent(); } catch (err) { console.error('Failed to create folder:', err); } };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files; if (!fileList?.length) return;
        for (const file of Array.from(fileList)) { const formData = new FormData(); formData.append('file', file); if (folderId) formData.append('folderId', folderId); try { await fileApi.upload(formData); } catch (err) { console.error('Upload failed:', err); } }
        loadContent();
    };

    const handleDelete = async () => { if (!contextMenu) return; try { if (contextMenu.type === 'file') await fileApi.delete(contextMenu.id); else await folderApi.delete(contextMenu.id); loadContent(); } catch (err) { console.error('Delete failed:', err); } closeContextMenu(); };

    const handleBulkDelete = async () => {
        const fileIds = Array.from(selectedFiles); const folderIds = Array.from(selectedFolders);
        if (fileIds.length === 0 && folderIds.length === 0) return;
        try { await Promise.all([...fileIds.map(id => fileApi.delete(id)), ...folderIds.map(id => folderApi.delete(id))]); clearSelection(); loadContent(); } catch (err) { console.error('Bulk delete failed:', err); }
    };

    const handleDownload = async () => { if (!contextMenu || contextMenu.type !== 'file') return; try { const res: any = await fileApi.download(contextMenu.id); window.open(res.data.downloadUrl, '_blank'); } catch (err) { console.error('Download failed:', err); } closeContextMenu(); };
    const handlePreview = () => { if (!contextMenu || contextMenu.type !== 'file') return; if (contextMenu.fileIndex !== undefined) setPreviewIndex(contextMenu.fileIndex); closeContextMenu(); };
    const handleShare = () => { if (!contextMenu) return; setShareTarget({ id: contextMenu.id, type: contextMenu.type as 'file' | 'folder', name: contextMenu.name }); closeContextMenu(); };
    const handleCopy = () => { if (!contextMenu || contextMenu.type === 'background') return; setClipboard([{ id: contextMenu.id, type: contextMenu.type, name: contextMenu.name }], 'copy'); setPasteStatus('1 item copied'); setTimeout(() => setPasteStatus(null), 2000); closeContextMenu(); };
    const startRename = () => { if (!contextMenu) return; setRenaming({ type: contextMenu.type as 'file' | 'folder', id: contextMenu.id, name: contextMenu.name }); setRenameValue(contextMenu.name); closeContextMenu(); };
    const handleRename = async () => { if (!renaming || !renameValue.trim()) return; try { if (renaming.type === 'file') await fileApi.rename(renaming.id, renameValue.trim()); else await folderApi.rename(renaming.id, renameValue.trim()); setRenaming(null); loadContent(); } catch (err) { console.error('Rename failed:', err); } };

    // Drag & Drop
    const handleDragStart = (e: React.DragEvent, id: string, type: 'file' | 'folder', name: string) => { e.dataTransfer.setData('application/openvault', JSON.stringify({ id, type, name })); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOverFolder = (e: React.DragEvent, fId: string) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/openvault') ? 'move' : 'copy'; setDragOverFolderId(fId); };
    const handleDragLeaveFolder = () => setDragOverFolderId(null);
    const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null);
        const openvaultData = e.dataTransfer.getData('application/openvault');
        if (openvaultData) { try { const item = JSON.parse(openvaultData); if (item.id === targetFolderId) return; if (item.type === 'file') await fileApi.move(item.id, targetFolderId); else await folderApi.move(item.id, targetFolderId); loadContent(); } catch (err) { console.error('Move failed:', err); } return; }
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) { for (const file of Array.from(droppedFiles)) { const formData = new FormData(); formData.append('file', file); formData.append('folderId', targetFolderId); try { await fileApi.upload(formData); } catch (err) { console.error('Upload failed:', err); } } loadContent(); }
    };
    const handleDragEnd = () => setDragOverFolderId(null);

    const handlePageDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) { dropOverlayCounter.current += 1; setShowDropOverlay(true); } };
    const handlePageDragLeave = (e: React.DragEvent) => { e.preventDefault(); dropOverlayCounter.current -= 1; if (dropOverlayCounter.current <= 0) { dropOverlayCounter.current = 0; setShowDropOverlay(false); } };
    const handlePageDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const handlePageDrop = async (e: React.DragEvent) => {
        e.preventDefault(); setShowDropOverlay(false); dropOverlayCounter.current = 0;
        const droppedFiles = e.dataTransfer.files; if (!droppedFiles.length) return;
        for (const file of Array.from(droppedFiles)) { const formData = new FormData(); formData.append('file', file); if (folderId) formData.append('folderId', folderId); try { await fileApi.upload(formData); } catch (err) { console.error('Upload failed:', err); } }
        loadContent();
    };

    const getMenuPosition = (x: number, y: number) => {
        const menuW = 240; const menuH = 320;
        const position: React.CSSProperties = {};
        if (x + menuW > window.innerWidth) position.right = window.innerWidth - x; else position.left = x;
        if (y + menuH > window.innerHeight) position.bottom = window.innerHeight - y; else position.top = y;
        return position;
    };

    const totalSelected = selectedFiles.size + selectedFolders.size;

    return (
        <div
            className="relative min-h-full"
            onContextMenu={handleBackgroundContextMenu}
            onDragEnter={handlePageDragEnter}
            onDragLeave={handlePageDragLeave}
            onDragOver={handlePageDragOver}
            onDrop={handlePageDrop}
        >
            {/* Drop Overlay */}
            {showDropOverlay && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xl m-4 rounded-2xl border-2 border-dashed border-gray-400 dark:border-gray-500 pointer-events-none">
                    <div className="text-center p-10 rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 shadow-2xl">
                        <div className="h-20 w-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Upload className="h-10 w-10 text-gray-600 dark:text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Drop to Upload</h2>
                        <p className="text-gray-500 dark:text-gray-400">Release files to start uploading</p>
                    </div>
                </div>
            )}

            {/* Paste Toast */}
            {pasteStatus && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold shadow-xl flex items-center gap-3 animate-slide-up text-sm">
                    <Clipboard className="h-4 w-4" />
                    <span>{pasteStatus}</span>
                </div>
            )}

            {/* Selection Bar */}
            {totalSelected > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-4 rounded-2xl bg-gray-900 dark:bg-white border border-gray-800 dark:border-gray-200 px-6 py-3 shadow-2xl animate-slide-up">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                            <CheckSquare className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-white dark:text-gray-900">{totalSelected} selected</span>
                    </div>
                    <div className="h-6 w-px bg-gray-700 dark:bg-gray-300" />
                    <div className="flex items-center gap-1">
                        {clipboard.length === 0 && (
                            <button
                                onClick={() => {
                                    const items = [
                                        ...Array.from(selectedFiles).map(id => { const f = files.find(f => f.id === id); return f ? { id, type: 'file' as const, name: f.name } : null; }),
                                        ...Array.from(selectedFolders).map(id => { const f = folders.find(f => f.id === id); return f ? { id, type: 'folder' as const, name: f.name } : null; }),
                                    ].filter(Boolean) as { id: string; type: 'file' | 'folder'; name: string }[];
                                    if (items.length > 0) { setClipboard(items, 'copy'); setPasteStatus(`${items.length} item(s) copied`); setTimeout(() => setPasteStatus(null), 2000); }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
                            >
                                <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                        )}
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 dark:hover:text-red-600 hover:bg-red-500/10 transition-colors text-sm font-medium">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                    </div>
                    <button onClick={clearSelection} className="p-1.5 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    </button>
                </div>
            )}

            {/* Main Content */}
            <div className="pb-24">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-1">
                            {breadcrumbs.map((crumb, i) => (
                                <span key={i} className="flex items-center">
                                    {i > 0 && <ChevronRight className="mx-1 h-4 w-4 text-gray-400 dark:text-gray-600" />}
                                    <button
                                        onClick={() => crumb.id ? navigate(`/folder/${crumb.id}`) : navigate('/')}
                                        className={`px-2 py-1 rounded-lg transition-colors ${i === breadcrumbs.length - 1
                                            ? 'text-2xl font-bold text-gray-900 dark:text-white'
                                            : 'text-lg font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        {crumb.name}
                                    </button>
                                </span>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            {clipboard.length > 0 && (
                                <button onClick={handlePaste} className="btn-primary !bg-indigo-500 !text-white flex items-center gap-2 text-sm">
                                    <Clipboard className="h-4 w-4" /> Paste ({clipboard.length})
                                </button>
                            )}
                            <button
                                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                                className="btn-ghost p-2.5 rounded-xl border border-gray-200 dark:border-gray-700"
                                title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
                            >
                                {viewMode === 'grid' ? <List className="h-5 w-5" /> : <Grid3X3 className="h-5 w-5" />}
                            </button>
                            <button onClick={() => setShowNewFolderInput(true)} className="btn-secondary flex items-center gap-2 text-sm">
                                <FolderPlus className="h-4 w-4" /> New Folder
                            </button>
                            <label className="btn-primary cursor-pointer flex items-center gap-2 text-sm">
                                <Upload className="h-4 w-4" /> Upload
                                <input type="file" multiple className="hidden" onChange={handleUpload} />
                            </label>
                        </div>
                    </div>

                    {/* New Folder Input */}
                    {showNewFolderInput && (
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 animate-slide-down">
                            <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                                <FolderOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolderInput(false); }}
                                className="bg-transparent text-lg font-medium text-gray-900 dark:text-white outline-none flex-1 placeholder-gray-400 dark:placeholder-gray-600"
                                placeholder="Folder name..."
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={handleCreateFolder} className="btn-primary text-sm !px-4 !py-2">Create</button>
                                <button onClick={() => setShowNewFolderInput(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="h-10 w-10 rounded-xl border-2 border-gray-200 dark:border-gray-700 border-t-indigo-500 animate-spin" />
                        <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
                    </div>
                ) : (
                    <>
                        {/* Folders */}
                        {folders.length > 0 && (
                            <div className="mb-10">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 px-1">Folders</h3>
                                <div className={viewMode === 'grid'
                                    ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                                    : 'space-y-2'
                                }>
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
                                            className={`group dashboard-item p-4 flex items-center gap-4
                                                ${selectedFolders.has(folder.id) ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30' : ''}
                                                ${dragOverFolderId === folder.id ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-500/10 scale-[1.02]' : ''}
                                                ${viewMode === 'list' ? 'flex-row' : 'flex-col text-center justify-center'}
                                            `}
                                        >
                                            <div className="relative">
                                                <div
                                                    className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105
                                                        ${!folder.color ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                                                    style={folder.color ? { backgroundColor: `${folder.color}18`, border: `1px solid ${folder.color}30` } : undefined}
                                                >
                                                    <FolderOpen
                                                        className={`h-6 w-6 ${!folder.color ? 'text-gray-500 dark:text-gray-400' : ''}`}
                                                        style={folder.color ? { color: folder.color } : undefined}
                                                    />
                                                </div>
                                                {selectedFolders.has(folder.id) && (
                                                    <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-indigo-500 rounded-md flex items-center justify-center">
                                                        <CheckSquare className="h-3 w-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {renaming?.id === folder.id ? (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text" value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                            className="bg-transparent border-b-2 border-indigo-400 text-sm font-semibold w-full outline-none text-gray-900 dark:text-white"
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className={viewMode === 'list' ? 'text-left' : ''}>
                                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{folder.name}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{folder._count?.files ?? 0} items</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files */}
                        {files.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 px-1">Files</h3>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                        {files.map((file, index) => (
                                            <div
                                                key={file.id}
                                                data-ctx="file"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, file.id, 'file', file.name)}
                                                onDragEnd={handleDragEnd}
                                                className={`group dashboard-item p-0 overflow-hidden
                                                    ${selectedFiles.has(file.id) ? 'ring-2 ring-indigo-500 border-indigo-300 dark:border-indigo-500/30' : ''}
                                                `}
                                                onClick={(e) => handleItemClick(e, file.id, 'file', index)}
                                                onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                            >
                                                {/* Thumbnail area */}
                                                <div className="aspect-[4/3] w-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center overflow-hidden relative">
                                                    {file.thumbnailKey ? (
                                                        <Thumbnail fileId={file.id} mimeType={file.mimeType} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="opacity-40 group-hover:opacity-70 transition-opacity">
                                                            {React.cloneElement(getFileIcon(file.mimeType) as React.ReactElement, { size: 48, className: '!h-12 !w-12' })}
                                                        </div>
                                                    )}

                                                    {/* Selection badge */}
                                                    {selectedFiles.has(file.id) && (
                                                        <div className="absolute top-3 left-3 h-6 w-6 rounded-md bg-indigo-500 flex items-center justify-center">
                                                            <CheckSquare className="h-3.5 w-3.5 text-white" />
                                                        </div>
                                                    )}

                                                    {/* More button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleFileContextMenu(e, file, index); }}
                                                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/80 text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-white dark:hover:bg-gray-900 transition-all shadow-sm"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                {/* File info */}
                                                <div className="p-3">
                                                    {renaming?.id === file.id ? (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text" value={renameValue}
                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                                className="bg-transparent border-b-2 border-indigo-400 text-sm font-medium w-full outline-none text-gray-900 dark:text-white"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white mb-1">{file.name}</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs text-gray-400 dark:text-gray-500">{formatSize(file.size)}</p>
                                                                {file.fileTags && file.fileTags.length > 0 && (
                                                                    <div className="flex -space-x-1">
                                                                        {file.fileTags.slice(0, 3).map(ft => (
                                                                            <div key={ft.tag.id} className="h-3 w-3 rounded-full ring-1 ring-white dark:ring-gray-900" style={{ backgroundColor: ft.tag.color }} title={ft.tag.name} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* List View */
                                    <div className="space-y-1">
                                        {files.map((file, index) => (
                                            <div
                                                key={file.id}
                                                data-ctx="file"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, file.id, 'file', file.name)}
                                                onDragEnd={handleDragEnd}
                                                className={`group dashboard-item !rounded-xl flex items-center gap-4 py-3 px-4
                                                    ${selectedFiles.has(file.id) ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30' : ''}
                                                `}
                                                onClick={(e) => handleItemClick(e, file.id, 'file', index)}
                                                onContextMenu={(e) => handleFileContextMenu(e, file, index)}
                                            >
                                                {/* Checkbox area */}
                                                <div className="flex-shrink-0">
                                                    {selectedFiles.has(file.id) ? (
                                                        <div className="h-6 w-6 bg-indigo-500 rounded-md flex items-center justify-center">
                                                            <CheckSquare className="h-3.5 w-3.5 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-6 w-6 rounded-md border border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500 transition-colors" />
                                                    )}
                                                </div>

                                                {/* Icon / Thumbnail */}
                                                <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 overflow-hidden">
                                                    {file.thumbnailKey ? (
                                                        <Thumbnail fileId={file.id} mimeType={file.mimeType} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="scale-75 opacity-60">{getFileIcon(file.mimeType)}</div>
                                                    )}
                                                </div>

                                                {/* Name */}
                                                <div className="min-w-0 flex-1">
                                                    {renaming?.id === file.id ? (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                                className="bg-transparent border-b-2 border-indigo-400 text-sm font-medium w-full outline-none text-gray-900 dark:text-white"
                                                                autoFocus />
                                                        </div>
                                                    ) : (
                                                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                                                    )}
                                                </div>

                                                {/* Tags */}
                                                {file.fileTags && file.fileTags.length > 0 && (
                                                    <div className="hidden md:flex gap-1.5 flex-shrink-0">
                                                        {file.fileTags.slice(0, 2).map(ft => (
                                                            <span key={ft.tag.id} className="badge text-[10px]" style={{ borderColor: ft.tag.color + '40', color: ft.tag.color }}>
                                                                {ft.tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Size & Date */}
                                                <div className="hidden md:flex flex-col items-end gap-0.5 flex-shrink-0 w-28">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(file.createdAt)}</span>
                                                </div>

                                                {/* More */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleFileContextMenu(e, file, index); }}
                                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-all"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty State */}
                        {folders.length === 0 && files.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                                    <FolderOpen className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No files yet</h3>
                                <p className="max-w-xs text-gray-500 dark:text-gray-400 mb-6">
                                    Upload files or create a folder to get started.
                                </p>
                                <div className="flex gap-3">
                                    <label className="btn-primary cursor-pointer flex items-center gap-2 text-sm">
                                        <Upload className="h-4 w-4" /> Upload Files
                                        <input type="file" multiple className="hidden" onChange={handleUpload} />
                                    </label>
                                    <button onClick={() => setShowNewFolderInput(true)} className="btn-secondary flex items-center gap-2 text-sm">
                                        <FolderPlus className="h-4 w-4" /> New Folder
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[120]" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
                    <div className="context-menu" style={getMenuPosition(contextMenu.x, contextMenu.y)}>
                        {contextMenu.type === 'background' ? (
                            <div>
                                {clipboard.length > 0 && (
                                    <button onClick={() => { handlePaste(); closeContextMenu(); }} className="menu-item">
                                        <Clipboard className="h-4 w-4" /> Paste ({clipboard.length})
                                    </button>
                                )}
                                <button onClick={() => { setShowNewFolderInput(true); closeContextMenu(); }} className="menu-item">
                                    <FolderPlus className="h-4 w-4" /> New Folder
                                </button>
                                <label className="menu-item cursor-pointer">
                                    <Upload className="h-4 w-4" /> Upload Files
                                    <input type="file" multiple className="hidden" onChange={(e) => { handleUpload(e); closeContextMenu(); }} />
                                </label>
                            </div>
                        ) : (
                            <div>
                                {/* Item header */}
                                <div className="px-3 py-2 mb-1 border-b" style={{ borderColor: 'var(--border-default)' }}>
                                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{contextMenu.name}</p>
                                    <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{contextMenu.type}</p>
                                </div>

                                {contextMenu.type === 'file' && <button onClick={handlePreview} className="menu-item"><Eye className="h-4 w-4" /> Preview</button>}
                                {contextMenu.type === 'file' && <button onClick={handleDownload} className="menu-item"><Download className="h-4 w-4" /> Download</button>}
                                {contextMenu.type === 'folder' && <button onClick={() => { navigate(`/folder/${contextMenu.id}`); closeContextMenu(); }} className="menu-item"><FolderOpen className="h-4 w-4" /> Open</button>}

                                <div className="h-px my-1" style={{ background: 'var(--border-default)' }} />

                                <button onClick={handleShare} className="menu-item"><Share2 className="h-4 w-4" /> Share</button>
                                <button onClick={startRename} className="menu-item"><Pencil className="h-4 w-4" /> Rename</button>

                                {contextMenu.type === 'file' && (
                                    <button onClick={() => { const file = files.find(f => f.id === contextMenu.id); if (file) setTagTarget(file); closeContextMenu(); }} className="menu-item">
                                        <TagIcon className="h-4 w-4" /> Tags
                                    </button>
                                )}

                                {contextMenu.type === 'folder' && (
                                    <div>
                                        <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }} className="menu-item justify-between">
                                            <div className="flex items-center gap-3"><Palette className="h-4 w-4" /> Color</div>
                                            <ChevronRight className={`h-3 w-3 transition-transform ${showColorPicker ? 'rotate-90' : ''}`} />
                                        </button>
                                        {showColorPicker && (
                                            <div className="px-3 py-2 border-y" style={{ borderColor: 'var(--border-default)', background: 'var(--hover-bg)' }}>
                                                <div className="grid grid-cols-5 gap-1.5">
                                                    {PRESET_COLORS.map(color => (
                                                        <button key={color.name} title={color.name}
                                                            onClick={async () => { await folderApi.updateColor(contextMenu.id, color.value); closeContextMenu(); loadContent(); }}
                                                            className="h-6 w-6 rounded-lg border border-gray-200 dark:border-gray-700 transition-transform hover:scale-110 flex items-center justify-center"
                                                            style={{ backgroundColor: color.value || 'transparent' }}
                                                        >
                                                            {!color.value && <X className="h-3 w-3 text-gray-400" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button onClick={handleCopy} className="menu-item"><Copy className="h-4 w-4" /> Copy</button>

                                {contextMenu.type === 'folder' && clipboard.length > 0 && (
                                    <button onClick={async () => { for (const item of clipboard) { if (item.type === 'file') await fileApi.copy(item.id, contextMenu.id); } clearClipboard(); closeContextMenu(); loadContent(); }} className="menu-item text-emerald-600 dark:text-emerald-400">
                                        <Clipboard className="h-4 w-4" /> Paste Here
                                    </button>
                                )}

                                <button onClick={() => { setDetailsTarget({ id: contextMenu.id, type: contextMenu.type as 'file' | 'folder', name: contextMenu.name }); closeContextMenu(); }} className="menu-item">
                                    <Info className="h-4 w-4" /> Details
                                </button>

                                <div className="h-px my-1" style={{ background: 'var(--border-default)' }} />

                                <button onClick={handleDelete} className="menu-item !text-red-500 dark:!text-red-400 hover:!bg-red-50 dark:hover:!bg-red-500/10">
                                    <Trash2 className="h-4 w-4" /> Move to Trash
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Dialogs */}
            {detailsTarget && <DetailsDialog id={detailsTarget.id} type={detailsTarget.type} name={detailsTarget.name} onClose={() => setDetailsTarget(null)} />}
            {shareTarget && <ShareDialog resourceId={shareTarget.id} resourceType={shareTarget.type} resourceName={shareTarget.name} onClose={() => setShareTarget(null)} />}
            {previewIndex !== null && files[previewIndex] && (
                <FilePreview fileId={files[previewIndex].id} fileName={files[previewIndex].name} mimeType={files[previewIndex].mimeType} fileSize={files[previewIndex].size}
                    onClose={() => setPreviewIndex(null)}
                    onPrev={previewIndex > 0 ? () => setPreviewIndex(previewIndex - 1) : undefined}
                    onNext={previewIndex < files.length - 1 ? () => setPreviewIndex(previewIndex + 1) : undefined}
                />
            )}
            {tagTarget && <TagDialog fileId={tagTarget.id} fileName={tagTarget.name} initialTags={tagTarget.fileTags || []} onClose={() => setTagTarget(null)} onTagsUpdated={() => loadContent()} />}
        </div>
    );
}

export default DashboardPage;
