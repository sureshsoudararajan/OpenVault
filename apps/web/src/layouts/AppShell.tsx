import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useFileManagerStore } from '../stores/fileManagerStore';
import { fileApi } from '../services/api';
import {
    FolderOpen, Trash2, Share2, Settings, Search, Upload, LogOut,
    Shield, HardDrive, Menu, X, ChevronDown
} from 'lucide-react';
import { useState } from 'react';

export default function AppShell() {
    const { user, logout } = useAuthStore();
    const { searchQuery, setSearchQuery } = useFileManagerStore();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        // Extract current folderId from URL if on a folder page
        const folderMatch = location.pathname.match(/\/folder\/(.+)/);
        const folderId = folderMatch?.[1];

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
        // Reset input so same file can be re-uploaded
        e.target.value = '';
        // Reload the page to reflect new files
        window.location.reload();
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const storagePercent = user ? Math.round((user.storageUsed / user.storageQuota) * 100) : 0;
    const formatStorage = (bytes: number) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    };

    return (
        <div className="flex h-screen bg-surface-950">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
                    } flex flex-col border-r border-surface-800 bg-surface-900/50 transition-all duration-300`}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 border-b border-surface-800 px-5 py-4">
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
                <nav className="flex-1 space-y-1 px-3">
                    <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FolderOpen className="h-4 w-4" />
                        My Files
                    </NavLink>
                    <NavLink to="/shared" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Share2 className="h-4 w-4" />
                        Shared with Me
                    </NavLink>
                    <NavLink to="/trash" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Trash2 className="h-4 w-4" />
                        Trash
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings className="h-4 w-4" />
                        Settings
                    </NavLink>
                </nav>

                {/* Storage Usage */}
                <div className="border-t border-surface-800 p-4">
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
                        {user ? `${formatStorage(user.storageUsed)} / ${formatStorage(user.storageQuota)}` : '—'}
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="flex items-center gap-4 border-b border-surface-800 bg-surface-900/30 px-6 py-3 backdrop-blur-sm">
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
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field pl-10 py-2 text-sm"
                        />
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-800"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-purple-500 text-sm font-semibold text-white">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="hidden text-sm font-medium text-surface-300 md:block">{user?.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
                        </button>

                        {userMenuOpen && (
                            <div className="dropdown-menu right-0 top-full mt-2">
                                <div className="border-b border-surface-700 px-3 py-2">
                                    <p className="text-sm font-medium text-white">{user?.name}</p>
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
        </div>
    );
}
