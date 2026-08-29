import { useState, useEffect, useRef } from 'react';
import { ytdlpApi } from '../services/api';
import { X, Cookie, Trash2, Plus, Loader2, AlertCircle, Save } from 'lucide-react';

interface CookieProfile {
    id: string;
    name: string;
    domain: string | null;
    createdAt: string;
}

interface CookieManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCookieSelected?: (id: string) => void;
}

export default function CookieManagerDialog({ isOpen, onClose, onCookieSelected }: CookieManagerDialogProps) {
    const [cookies, setCookies] = useState<CookieProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state for creating/editing
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadCookies();
        }
    }, [isOpen]);

    const loadCookies = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await ytdlpApi.getCookies();
            setCookies(res.data);
        } catch (err: any) {
            setError('Failed to load cookies');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this cookie profile?')) return;
        
        try {
            await ytdlpApi.deleteCookie(id);
            setCookies(cookies.filter(c => c.id !== id));
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to delete cookie');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return setError('Name is required');
        if (!/^[a-zA-Z0-9_]+$/.test(name)) return setError('Name can only contain letters, numbers, and underscores');
        if (!editingId && !file) return setError('Cookie file is required');

        setSaving(true);
        const formData = new FormData();
        formData.append('name', name);
        if (domain.trim()) formData.append('domain', domain.trim());
        if (file) formData.append('file', file);

        try {
            let res;
            if (editingId) {
                res = await ytdlpApi.updateCookie(editingId, formData);
            } else {
                res = await ytdlpApi.createCookie(formData);
            }
            
            await loadCookies();
            setIsFormOpen(false);
            resetForm();
            
            if (!editingId && onCookieSelected && res.data?.id) {
                onCookieSelected(res.data.id);
            }

        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to save cookie profile');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDomain('');
        setFile(null);
        setEditingId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openEdit = (c: CookieProfile) => {
        setEditingId(c.id);
        setName(c.name);
        setDomain(c.domain || '');
        setFile(null);
        setIsFormOpen(true);
    };

    const openCreate = () => {
        resetForm();
        setIsFormOpen(true);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]" onContextMenu={e => e.stopPropagation()}>
                
                <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
                            <Cookie className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cookie Profiles</h2>
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-500/10 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                        </div>
                    )}

                    {isFormOpen ? (
                        <form onSubmit={handleSave} className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                                {editingId ? 'Edit Cookie Profile' : 'Add New Cookie Profile'}
                            </h3>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (No spaces)</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                    placeholder="e.g. YT_DLP_COOKIE"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain (Optional)</label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="e.g. youtube.com"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Cookie File {editingId && <span className="text-gray-400 font-normal">(Leave empty to keep existing)</span>}
                                </label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".txt"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                                    required={!editingId}
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="btn-primary px-6 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Profile
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={openCreate} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors bg-gray-50 dark:bg-gray-800/20 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 gap-2">
                                <Plus className="h-6 w-6" />
                                <span className="font-bold">Add Cookie Profile</span>
                            </button>

                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                            ) : cookies.length === 0 ? (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No cookie profiles found. Add one above.</p>
                            ) : (
                                <div className="space-y-3">
                                    {cookies.map(cookie => (
                                        <div key={cookie.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
                                                    <Cookie className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{cookie.name}</h4>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                        {cookie.domain && <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{cookie.domain}</span>}
                                                        <span>Added {new Date(cookie.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {onCookieSelected && (
                                                    <button onClick={() => { onCookieSelected(cookie.id); onClose(); }} className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                                                        Use
                                                    </button>
                                                )}
                                                <button onClick={() => openEdit(cookie)} className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDelete(cookie.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
