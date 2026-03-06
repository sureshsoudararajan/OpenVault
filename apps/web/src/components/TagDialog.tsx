import { useState, useEffect } from 'react';
import { tagApi } from '../services/api';
import {
    X, Tag as TagIcon, Plus, Trash2, Check, Loader2, Hash
} from 'lucide-react';

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface TagDialogProps {
    fileId: string;
    fileName: string;
    initialTags: { tag: Tag }[];
    onClose: () => void;
    onTagsUpdated: () => void;
}

const PRESET_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
];

export default function TagDialog({ fileId, fileName, initialTags, onClose, onTagsUpdated }: TagDialogProps) {
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState('');

    const assignedTagIds = new Set(initialTags.map(t => t.tag.id));

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        try {
            const res: any = await tagApi.list();
            setTags(res.data || []);
        } catch (err) {
            setError('Failed to load tags');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTag = async (tagId: string) => {
        setActionLoading(tagId);
        try {
            if (assignedTagIds.has(tagId)) {
                await tagApi.removeFromFile(tagId, fileId);
            } else {
                await tagApi.addToFile(tagId, fileId);
            }
            onTagsUpdated();
        } catch (err) {
            setError('Failed to update tag');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        setActionLoading('create');
        try {
            await tagApi.create(newTagName.trim(), newTagColor);
            setNewTagName('');
            setShowCreate(false);
            await loadTags();
        } catch (err) {
            setError('Failed to create tag');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteTag = async (e: React.MouseEvent, tagId: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this tag? It will be removed from all files.')) return;
        setActionLoading(`delete-${tagId}`);
        try {
            await tagApi.delete(tagId);
            await loadTags();
            onTagsUpdated();
        } catch (err) {
            setError('Failed to delete tag');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10">
                            <TagIcon className="h-5 w-5 text-pink-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Manage Tags</h3>
                            <p className="text-xs text-surface-500 truncate max-w-[250px]">{fileName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Tag List */}
                            <div className="grid grid-cols-1 gap-2">
                                {tags.length === 0 ? (
                                    <p className="text-center text-sm text-surface-500 py-4">No tags created yet.</p>
                                ) : (
                                    tags.map(tag => (
                                        <div
                                            key={tag.id}
                                            onClick={() => handleToggleTag(tag.id)}
                                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${assignedTagIds.has(tag.id)
                                                ? 'bg-brand-500/10 border-brand-500/30'
                                                : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:border-surface-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                                <span className="text-sm font-medium text-surface-700 dark:text-surface-200">{tag.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {actionLoading === tag.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
                                                ) : assignedTagIds.has(tag.id) ? (
                                                    <Check className="h-4 w-4 text-brand-500" />
                                                ) : null}
                                                <button
                                                    onClick={(e) => handleDeleteTag(e, tag.id)}
                                                    className="p-1 text-surface-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Create New Tag */}
                            {showCreate ? (
                                <div className="mt-4 p-4 rounded-xl border border-brand-500/20 bg-brand-500/5 space-y-3 animate-slide-up">
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-brand-400" />
                                        <input
                                            type="text"
                                            value={newTagName}
                                            onChange={(e) => setNewTagName(e.target.value)}
                                            placeholder="Tag name"
                                            className="bg-transparent border-none outline-none text-sm w-full p-0 focus:ring-0 text-surface-900 dark:text-white"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewTagColor(color)}
                                                className={`h-6 w-6 rounded-full transition-transform ${newTagColor === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-brand-500' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setShowCreate(false)}
                                            className="flex-1 px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateTag}
                                            disabled={!newTagName.trim() || actionLoading === 'create'}
                                            className="flex-1 btn-primary py-1.5 text-xs"
                                        >
                                            {actionLoading === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Create Tag'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-surface-300 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-500 hover:border-brand-500 hover:text-brand-500 transition-all"
                                >
                                    <Plus className="h-4 w-4" /> Create New Tag
                                </button>
                            )}

                            {error && <p className="text-center text-xs text-red-500">{error}</p>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-surface-200 dark:border-surface-700 px-5 py-3">
                    <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
