import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useFileManagerStore } from '../stores/fileManagerStore';
import { useThemeStore } from '../stores/themeStore';
import { userApi, tagApi } from '../services/api';
import { uploadFiles } from '../services/uploadManager';
import UploadProgressPanel from '../components/UploadProgressPanel';
import {
    FolderOpen, Trash2, Share2, Settings, Search, Upload, LogOut,
    Shield, HardDrive, Menu, X, ChevronDown, Sun, Moon, Tag as TagIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AppShell() {
    const { user, logout } = useAuthStore();
    const { searchQuery, setSearchQuery, selectedTag, setSelectedTag, setCurrentFolderId } = useFileManagerStore();
    const { theme, toggleTheme } = useThemeStore();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [tags, setTags] = useState<{ id: string; name: string; color: string; order: number }[]>([]);
    const [draggedTagId, setDraggedTagId] = useState<string | null>(null);
    const [tagContextMenu, setTagContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const res = await tagApi.list();
                setTags((res as any).data || []);
            } catch (err) {
                console.error('Failed to fetch tags:', err);
            }
        };

        const fetchUser = async () => {
            try {
                const res: any = await userApi.getMe();
                if (res.data) {
                    useAuthStore.getState().updateUser(res.data);
                }
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
            }
        };

        fetchTags();
        fetchUser();

        const handleClick = () => {
            setTagContextMenu(null);
            setUserMenuOpen(false);
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('refresh-profile', fetchUser);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('refresh-profile', fetchUser);
        };
    }, []);

    const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        // Extract current folderId from URL if on a folder page
        const folderMatch = location.pathname.match(/\/folder\/(.+)/);
        const folderId = folderMatch?.[1] || null;

        try {
            await uploadFiles(fileList, {
                folderId,
                onComplete: () => {
                    // Refresh current view if possible
                    window.dispatchEvent(new CustomEvent('refresh-files'));
                }
            });
        } catch (err) {
            console.error('Upload process failed:', err);
        }

        // Reset input so same file can be re-uploaded
        e.target.value = '';
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleTagDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tag?')) return;
        try {
            await tagApi.delete(id);
            setTags(tags.filter(t => t.id !== id));
            if (selectedTag?.id === id) setSelectedTag(null);
            setTagContextMenu(null);
        } catch (err) {
            console.error('Failed to delete tag:', err);
        }
    };

    const handleTagDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTagId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleTagDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleTagDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedTagId || draggedTagId === targetId) return;

        const newTags = [...tags];
        const draggedIndex = newTags.findIndex(t => t.id === draggedTagId);
        const targetIndex = newTags.findIndex(t => t.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = newTags.splice(draggedIndex, 1);
        newTags.splice(targetIndex, 0, removed);

        // Update local state for immediate feedback
        const reorderedTags = newTags.map((t, i) => ({ ...t, order: i }));
        setTags(reorderedTags);
        setDraggedTagId(null);

        // Persist to backend
        try {
            await tagApi.reorder(reorderedTags.map(t => ({ id: t.id, order: t.order })));
        } catch (err) {
            console.error('Failed to persist tag order:', err);
        }
    };

    const handleTagContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setTagContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    const used = user?.storageUsed || 0;
    const quota = user?.storageQuota || (5 * 1024 * 1024 * 1024); // default 5GB
    const storagePercent = quota > 0 ? Math.round((used / quota) * 100) : 0;
    const formatStorage = (bytes: number) => {
        if (!bytes || isNaN(bytes)) return '0 MB';
        const gb = bytes / (1024 * 1024 * 1024);
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    };

    return (
        <div className={`flex h-screen ${theme === 'dark' ? 'bg-surface-950' : 'bg-surface-50'}`}>
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
                    } flex flex-col border-r transition-all duration-300 ${theme === 'dark' ? 'border-surface-800 bg-surface-900/50' : 'border-surface-200 bg-white'}`}
            >
                {/* Logo */}
                <div className={`flex items-center gap-3 border-b px-5 py-4 ${theme === 'dark' ? 'border-surface-800' : 'border-surface-200'}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
                        <Shield className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold gradient-text">OpenVault</span>
                </div>

                {/* Upload Button */}
                <div className="px-4 py-4">
                    <label className="btn-primary flex w-full items-center justify-center gap-2 text-sm cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Upload Files
                        <input type="file" multiple className="hidden" onChange={handleSidebarUpload} />
                    </label>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 overflow-y-auto custom-scrollbar">
                    <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive && !selectedTag ? 'active' : ''}`} onClick={() => { setSelectedTag(null); setCurrentFolderId(null); }}>
                        <FolderOpen className="h-4 w-4" />
                        My Files
                    </NavLink>
                    <NavLink to="/shared" className={({ isActive }) => `nav-item ${isActive && !selectedTag ? 'active' : ''}`} onClick={() => setSelectedTag(null)}>
                        <Share2 className="h-4 w-4" />
                        Shared with Me
                    </NavLink>
                    <NavLink to="/trash" className={({ isActive }) => `nav-item ${isActive && !selectedTag ? 'active' : ''}`} onClick={() => setSelectedTag(null)}>
                        <Trash2 className="h-4 w-4" />
                        Trash
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive && !selectedTag ? 'active' : ''}`} onClick={() => setSelectedTag(null)}>
                        <Settings className="h-4 w-4" />
                        Settings
                    </NavLink>

                    {tags.length > 0 && (
                        <div className="pb-4">
                            <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                Tags
                            </div>
                            {tags.map(tag => (
                                <div
                                    key={tag.id}
                                    draggable
                                    onDragStart={(e) => handleTagDragStart(e, tag.id)}
                                    onDragOver={handleTagDragOver}
                                    onDrop={(e) => handleTagDrop(e, tag.id)}
                                    className="group relative"
                                >
                                    <button
                                        onClick={() => {
                                            setSelectedTag({ id: tag.id, name: tag.name });
                                            setCurrentFolderId(null);
                                            navigate('/');
                                        }}
                                        onContextMenu={(e) => handleTagContextMenu(e, tag.id)}
                                        className={`nav-item w-full justify-start pr-8 ${selectedTag?.id === tag.id ? 'active' : ''}`}
                                    >
                                        <TagIcon className="h-4 w-4" style={{ color: tag.color }} />
                                        <span className="truncate">{tag.name}</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTagDelete(tag.id); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 opacity-0 hover:text-red-500 group-hover:opacity-100 transition-all cursor-pointer"
                                        title="Delete tag"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </nav>

                {/* Storage Usage */}
                <div className={`border-t p-4 ${theme === 'dark' ? 'border-surface-800' : 'border-surface-200'}`}>
                    <div className="flex items-center gap-2 text-xs text-surface-400">
                        <HardDrive className="h-3.5 w-3.5" />
                        <span>Storage</span>
                    </div>
                    <div className="progress-bar mt-2">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.min(storagePercent, 100)}%` }}
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-surface-500">
                        {`${formatStorage(used)} / ${formatStorage(quota)}`}
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Bar */}
                <header className={`relative z-40 flex items-center gap-4 border-b px-6 py-3 backdrop-blur-sm ${theme === 'dark' ? 'border-surface-800 bg-surface-900/30' : 'border-surface-200 bg-white/70'}`}>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-ghost p-1.5">
                        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>

                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                        <input
                            type="text"
                            placeholder="Search files and folders..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (e.target.value && !location.pathname.startsWith('/folder') && location.pathname !== '/') {
                                    navigate('/');
                                }
                            }}
                            className="input-field pl-10 py-2 text-sm w-full"
                        />
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className={`rounded-lg p-2 transition-all duration-300 ${theme === 'dark' ? 'text-surface-400 hover:text-yellow-400 hover:bg-surface-800' : 'text-surface-500 hover:text-amber-500 hover:bg-surface-100'}`}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>

                    {/* User Menu */}
                    <div className="relative ml-auto">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white overflow-hidden">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                                ) : (
                                    user?.name?.charAt(0).toUpperCase() || 'U'
                                )}
                            </div>
                            <span className={`hidden text-sm font-medium md:block ${theme === 'dark' ? 'text-surface-300' : 'text-surface-600'}`}>{user?.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
                        </button>

                        {userMenuOpen && (
                            <div className="dropdown-menu right-0 top-full mt-2">
                                <div className={`border-b px-3 py-2 ${theme === 'dark' ? 'border-surface-700' : 'border-surface-200'}`}>
                                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>{user?.name}</p>
                                    <p className="text-xs text-surface-500">{user?.email}</p>
                                </div>
                                <div className="py-1">
                                    <button onClick={() => { navigate('/settings'); setUserMenuOpen(false); }} className="dropdown-item w-full">
                                        <Settings className="h-4 w-4" /> Settings
                                    </button>
                                    <button onClick={handleLogout} className="dropdown-item w-full text-red-400 hover:text-red-300">
                                        <LogOut className="h-4 w-4" /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
            {/* Global upload progress panel */}
            {/* Tag Context Menu */}
            {tagContextMenu && (
                <div
                    className="fixed z-50 w-48 rounded-xl border bg-white py-2 shadow-2xl dark:border-surface-800 dark:bg-surface-900"
                    style={{ top: tagContextMenu.y, left: tagContextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => handleTagDelete(tagContextMenu.id)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Tag
                    </button>
                </div>
            )}

            <UploadProgressPanel />
        </div>
    );
}
