import { useState, useEffect } from 'react';
import { fileApi } from '../services/api';
import {
    X, Download, ChevronLeft, ChevronRight,
    Image, Film, Music,
    FileText, FileArchive, File, FileCode2,
    AlignLeft, Table, Presentation,
    Maximize2, Minimize2, Loader2, Save, Pencil, Eye as EyeIcon,
    ChevronDown, Settings, LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import * as XLSX from 'xlsx';

interface FilePreviewProps {
    fileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    downloadFn?: (id: string) => Promise<{ data?: { downloadUrl?: string } }>;
}

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const EXCEL_MIMES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/x-excel',
];
const WORD_MIMES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
];
const ODT_MIMES = [
    'application/vnd.oasis.opendocument.text',
];

export default function FilePreview({
    fileId, fileName, mimeType, fileSize, onClose, onNext, onPrev, downloadFn
}: FilePreviewProps) {
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    useEffect(() => {
        const loadPreview = async () => {
            setLoading(true);
            setError('');
            try {
                const loader = downloadFn ?? ((id: string) => fileApi.download(id));
                const res: any = await loader(fileId);
                setDownloadUrl(res.data?.downloadUrl || null);
            } catch (err: any) {
                setError(err.message || 'Failed to load preview');
            } finally {
                setLoading(false);
            }
        };
        loadPreview();
    }, [fileId, downloadFn]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && onNext) onNext();
            if (e.key === 'ArrowLeft' && onPrev) onPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const isPdf = mimeType === 'application/pdf';
    const isMarkdown = mimeType === 'text/markdown' || fileName.match(/\.md$/i);
    const isText = (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') && !isMarkdown;
    const isExcel = EXCEL_MIMES.includes(mimeType) || fileName.match(/\.(xlsx?|csv)$/i);
    const isWord = WORD_MIMES.includes(mimeType) || fileName.match(/\.docx?$/i);
    const isOdt = ODT_MIMES.includes(mimeType) || fileName.match(/\.odt$/i);
    const isPreviewable = isImage || isVideo || isAudio || isPdf || isText || isMarkdown || isExcel || isWord || isOdt;

    const getFileIcon = () => {
        if (mimeType.startsWith('image/')) return <Image className="h-20 w-20 text-pink-500 dark:text-pink-400" />;
        if (mimeType.startsWith('video/')) return <Film className="h-20 w-20 text-purple-500 dark:text-purple-400" />;
        if (mimeType.startsWith('audio/')) return <Music className="h-20 w-20 text-cyan-500 dark:text-cyan-400" />;
        if (mimeType.includes('pdf')) return <FileText className="h-20 w-20 text-red-500 dark:text-red-400" />;
        if (mimeType.includes('zip') || mimeType.includes('archive')) return <FileArchive className="h-20 w-20 text-amber-500 dark:text-amber-400" />;
        if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css')) return <FileCode2 className="h-20 w-20 text-blue-500 dark:text-blue-400" />;

        // Word Documents
        if (mimeType.includes('wordprocessingml.document') || mimeType.includes('msword') || mimeType.includes('vnd.oasis.opendocument.text')) {
            return <AlignLeft className="h-20 w-20 text-blue-600 dark:text-blue-400" />;
        }

        // Excel Documents
        if (mimeType.includes('spreadsheetml.sheet') || mimeType.includes('ms-excel') || mimeType.includes('vnd.oasis.opendocument.spreadsheet') || mimeType.includes('csv')) {
            return <Table className="h-20 w-20 text-green-600 dark:text-green-400" />;
        }

        // PowerPoint Documents
        if (mimeType.includes('presentationml.presentation') || mimeType.includes('ms-powerpoint') || mimeType.includes('vnd.oasis.opendocument.presentation')) {
            return <Presentation className="h-20 w-20 text-orange-600 dark:text-orange-400" />;
        }

        if (mimeType.startsWith('text/')) {
            return <FileText className="h-20 w-20 text-gray-500 dark:text-gray-400" />;
        }

        return <File className="h-20 w-20 text-gray-500 dark:text-gray-400" />;
    };

    const handleDownload = () => {
        if (downloadUrl) window.open(downloadUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-md animate-fade-in p-4 md:p-8">
            <div className="absolute inset-0" onClick={onClose} />

            <div className={`relative z-10 flex flex-col ${fullscreen ? 'h-full w-full rounded-none' : 'h-[85vh] md:h-[80vh] w-full max-w-5xl rounded-3xl'
                } overflow-hidden bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl border border-white/20 dark:border-surface-700/50 shadow-2xl transition-all duration-500`}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200/50 dark:border-surface-700/50 bg-white/95 dark:bg-surface-900/50 px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="flex-shrink-0 p-2 rounded-xl bg-surface-100 dark:bg-surface-800">
                            {isImage && <Image className="h-4 w-4 md:h-5 md:w-5 text-pink-500" />}
                            {isVideo && <Film className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />}
                            {isAudio && <Music className="h-4 w-4 md:h-5 md:w-5 text-cyan-500" />}
                            {isPdf && <FileText className="h-4 w-4 md:h-5 md:w-5 text-red-500" />}
                            {isExcel && <Table className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />}
                            {isWord && <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
                            {isOdt && <FileText className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />}
                            {!isImage && !isVideo && !isAudio && !isPdf && !isExcel && !isWord && !isOdt && <File className="h-4 w-4 md:h-5 md:w-5 text-brand-500" />}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs md:text-sm font-bold text-surface-900 dark:text-white leading-tight">{fileName}</p>
                            <p className="text-[10px] md:text-xs text-surface-500 font-medium">{formatSize(fileSize)} · {mimeType.split('/')[1] || mimeType}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                        <button onClick={handleDownload} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white" title="Download">
                            <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setFullscreen(!fullscreen)} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white" title="Toggle fullscreen">
                            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                        <button onClick={onClose} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-red-50 dark:hover:bg-surface-800 hover:text-red-500 dark:hover:text-red-400" title="Close">
                            <X className="h-4 w-4" />
                        </button>

                        <div className="h-4 w-px bg-surface-200 dark:bg-surface-700 mx-1 hidden md:block" />

                        {/* User Profile Button - Now at the end */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                                className="flex items-center gap-2 rounded-xl p-1 transition-all hover:bg-surface-200/50 dark:hover:bg-surface-800/50 active:scale-95"
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 text-[10px] font-semibold text-white overflow-hidden shadow-inner">
                                    {user?.avatarUrl ? (
                                        <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                                    ) : (
                                        user?.name?.charAt(0).toUpperCase() || 'U'
                                    )}
                                </div>
                                <span className="hidden text-xs font-semibold md:block max-w-[80px] truncate text-surface-900 dark:text-white">{user?.name}</span>
                                <ChevronDown className={`h-3 w-3 text-surface-600 dark:text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {userMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-xl overflow-hidden py-1 z-50 animate-slide-up">
                                    <div className="border-b border-surface-100 dark:border-surface-700 px-3 py-2">
                                        <p className="text-xs font-bold text-surface-900 dark:text-white truncate">{user?.name}</p>
                                        <p className="text-[10px] text-surface-500 truncate">{user?.email}</p>
                                    </div>
                                    <button onClick={() => { navigate('/settings'); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
                                        <Settings className="h-3.5 w-3.5" /> Settings
                                    </button>
                                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                        <LogOut className="h-3.5 w-3.5" /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 items-center justify-center overflow-auto bg-transparent p-4 md:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                            <p className="text-sm text-surface-500 dark:text-surface-400">Loading preview...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-3 text-center">
                            {getFileIcon()}
                            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                            <button onClick={handleDownload} className="btn-primary text-sm mt-2">
                                <Download className="mr-2 inline h-4 w-4" /> Download Instead
                            </button>
                        </div>
                    ) : !isPreviewable ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            {getFileIcon()}
                            <div>
                                <p className="text-lg font-medium text-surface-900 dark:text-white">{fileName}</p>
                                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{formatSize(fileSize)}</p>
                                <p className="mt-0.5 text-xs text-surface-400 dark:text-surface-500">Preview not available for this file type</p>
                            </div>
                            <button onClick={handleDownload} className="btn-primary flex items-center gap-2 text-sm mt-2">
                                <Download className="h-4 w-4" /> Download File
                            </button>
                        </div>
                    ) : (
                        <>
                            {isImage && downloadUrl && (
                                <img src={downloadUrl} alt={fileName} className="max-h-full max-w-full object-contain rounded-lg" onError={() => setError('Failed to load image')} />
                            )}
                            {isVideo && downloadUrl && (
                                <video 
                                    src={downloadUrl} 
                                    controls 
                                    className="max-h-full max-w-full rounded-lg shadow-lg" 
                                    onError={() => setError('Failed to load video')}
                                    autoPlay
                                />
                            )}
                            {isAudio && downloadUrl && (
                                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                                        <Music className="h-16 w-16 text-cyan-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-medium text-surface-900 dark:text-white">{fileName}</p>
                                        <p className="text-sm text-surface-500">{formatSize(fileSize)}</p>
                                    </div>
                                    <audio src={downloadUrl} controls className="w-full" onError={() => setError('Failed to load audio')} />
                                </div>
                            )}
                            {isPdf && downloadUrl && (
                                <iframe src={downloadUrl} title={fileName} className="h-full w-full rounded-lg border-0" />
                            )}
                            {isText && downloadUrl && <NotepadEditor url={downloadUrl} fileId={fileId} />}
                            {isMarkdown && downloadUrl && <MarkdownPreview url={downloadUrl} fileId={fileId} />}
                            {isExcel && downloadUrl && <ExcelPreview url={downloadUrl} />}
                            {isWord && downloadUrl && <WordPreview url={downloadUrl} />}
                            {isOdt && downloadUrl && <OdtPreview url={downloadUrl} />}
                        </>
                    )}
                </div>

                {/* Navigation Arrows - Hidden on small mobile */}
                {onPrev && (
                    <button onClick={onPrev} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-surface-800/90 p-2 md:p-3 text-surface-700 dark:text-white backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-surface-700 hover:scale-110 shadow-lg hidden sm:flex">
                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                )}
                {onNext && (
                    <button onClick={onNext} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-surface-800/90 p-2 md:p-3 text-surface-700 dark:text-white backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-surface-700 hover:scale-110 shadow-lg hidden sm:flex">
                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── Notepad Editor (txt, json, xml, etc.) ─── */
function NotepadEditor({ url, fileId }: { url: string; fileId: string }) {
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch(url)
            .then((res) => res.text())
            .then((text) => { setContent(text); setOriginalContent(text); })
            .catch(() => setContent('Failed to load file content'))
            .finally(() => setLoading(false));
    }, [url]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fileApi.updateContent(fileId, content);
            window.dispatchEvent(new CustomEvent('refresh-profile'));
            setOriginalContent(content);
            setSaved(true);
            setEditing(false);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = content !== originalContent;

    if (loading) return <Loader2 className="h-6 w-6 animate-spin text-brand-400" />;

    return (
        <div className="flex h-full w-full flex-col rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-surface-500 font-medium">
                        {editing ? 'Editing' : 'Read-only'}
                    </span>
                    {saved && <span className="text-[10px] text-emerald-500 font-medium animate-fade-in">✓ Saved</span>}
                </div>
                <div className="flex items-center gap-1">
                    {!editing ? (
                        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                            <Pencil className="h-3 w-3" /> Edit
                        </button>
                    ) : (
                        <>
                            <button onClick={() => { setContent(originalContent); setEditing(false); }} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!hasChanges || saving}
                                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                            >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save
                            </button>
                        </>
                    )}
                </div>
            </div>
            {/* Editor */}
            {editing ? (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full resize-none bg-white/50 dark:bg-surface-900/50 p-6 text-sm text-surface-800 dark:text-surface-200 font-mono leading-relaxed focus:outline-none"
                    spellCheck={false}
                />
            ) : (
                <pre className="flex-1 w-full overflow-auto bg-white/50 dark:bg-surface-900/50 p-6 text-sm text-surface-800 dark:text-surface-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {content}
                </pre>
            )}
            {/* Status bar */}
            <div className="border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1 text-[10px] text-surface-400">
                {content.split('\n').length} lines · {new Blob([content]).size} bytes
            </div>
        </div>
    );
}

/* ─── Markdown Preview ─── */
function MarkdownPreview({ url, fileId }: { url: string; fileId: string }) {
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [renderedHtml, setRenderedHtml] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<'preview' | 'edit'>('preview');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch(url)
            .then((res) => res.text())
            .then((text) => { setContent(text); setOriginalContent(text); })
            .catch(() => setContent('Failed to load markdown'))
            .finally(() => setLoading(false));
    }, [url]);

    // Render markdown asynchronously (marked v12+ returns Promise)
    useEffect(() => {
        if (!content) { setRenderedHtml(''); return; }
        const render = async () => {
            try {
                const { marked } = await import('marked');
                const result = await Promise.resolve(marked.parse(content, { breaks: true, gfm: true }));
                setRenderedHtml(typeof result === 'string' ? result : String(result));
            } catch (err) {
                console.error('Markdown render error:', err);
                // Fallback: simple conversion
                setRenderedHtml(content.replace(/\n/g, '<br/>'));
            }
        };
        render();
    }, [content]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fileApi.updateContent(fileId, content);
            window.dispatchEvent(new CustomEvent('refresh-profile'));
            setOriginalContent(content);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = content !== originalContent;

    if (loading) return <Loader2 className="h-6 w-6 animate-spin text-brand-400" />;

    return (
        <div className="flex h-full w-full flex-col rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1.5">
                <div className="flex items-center gap-1 rounded-lg bg-surface-100 dark:bg-surface-800 p-0.5">
                    <button
                        onClick={() => setMode('preview')}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${mode === 'preview' ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}
                    >
                        <EyeIcon className="h-3 w-3" /> Preview
                    </button>
                    <button
                        onClick={() => setMode('edit')}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${mode === 'edit' ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}
                    >
                        <Pencil className="h-3 w-3" /> Edit
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {saved && <span className="text-[10px] text-emerald-500 font-medium animate-fade-in">✓ Saved</span>}
                    {mode === 'edit' && (
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {mode === 'preview' ? (
                <div className="flex-1 overflow-auto bg-white/50 dark:bg-surface-900/50 p-8">
                    {renderedHtml ? (
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none
                                prose-headings:text-surface-900 dark:prose-headings:text-white
                                prose-p:text-surface-700 dark:prose-p:text-surface-300
                                prose-strong:text-surface-900 dark:prose-strong:text-white
                                prose-a:text-brand-600 dark:prose-a:text-brand-400
                                prose-code:text-brand-600 dark:prose-code:text-brand-400
                                prose-code:bg-surface-100/50 dark:prose-code:bg-surface-800/50
                                prose-pre:bg-surface-50/50 dark:prose-pre:bg-surface-800/50
                                prose-blockquote:border-brand-500"
                            dangerouslySetInnerHTML={{ __html: renderedHtml }}
                        />
                    ) : (
                        <p className="text-sm text-surface-500">Rendering markdown...</p>
                    )}
                </div>
            ) : (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full resize-none bg-white/50 dark:bg-surface-900/50 p-6 text-sm text-surface-800 dark:text-surface-200 font-mono leading-relaxed focus:outline-none"
                    spellCheck={false}
                />
            )}

            {/* Status bar */}
            <div className="border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1 text-[10px] text-surface-400">
                {content.split('\n').length} lines · Markdown
            </div>
        </div>
    );
}

/* ─── Excel Preview ─── */
function ExcelPreview({ url }: { url: string }) {
    const [sheets, setSheets] = useState<{ name: string; data: any[][] }[]>([]);
    const [activeSheet, setActiveSheet] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                const workbook = XLSX.read(buf, { type: 'array' });

                const parsed = workbook.SheetNames.map((name) => {
                    const sheet = workbook.Sheets[name];
                    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    return { name, data };
                });
                setSheets(parsed);
            } catch (err) {
                setError('Failed to parse spreadsheet');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [url]);

    if (loading) return <Loader2 className="h-6 w-6 animate-spin text-brand-400" />;
    if (error) return <p className="text-sm text-red-500 dark:text-red-400">{error}</p>;
    if (!sheets.length) return <p className="text-sm text-surface-500">Empty spreadsheet</p>;

    const current = sheets[activeSheet];

    return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-surface-200/50 dark:border-surface-700/50 bg-white/50 dark:bg-surface-900/50">
            {/* Sheet Tabs */}
            {sheets.length > 1 && (
                <div className="flex border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 overflow-x-auto">
                    {sheets.map((sheet, idx) => (
                        <button
                            key={sheet.name}
                            onClick={() => setActiveSheet(idx)}
                            className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${idx === activeSheet
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-white dark:bg-surface-900'
                                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                }`}
                        >
                            {sheet.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 px-3 py-1.5 text-[10px] text-surface-500 font-medium w-10">#</th>
                            {current.data[0]?.map((_: any, colIdx: number) => (
                                <th key={colIdx} className="border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 px-3 py-1.5 text-[10px] text-surface-500 font-medium min-w-[100px]">
                                    {String.fromCharCode(65 + (colIdx % 26))}
                                    {colIdx >= 26 ? String.fromCharCode(65 + Math.floor(colIdx / 26) - 1) : ''}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {current.data.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                                <td className="border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1 text-[10px] text-surface-400 text-center font-mono">
                                    {rowIdx + 1}
                                </td>
                                {row.map((cell: any, colIdx: number) => (
                                    <td key={colIdx} className="border border-surface-200 dark:border-surface-700 px-3 py-1 text-xs text-surface-800 dark:text-surface-200 whitespace-nowrap">
                                        {cell?.toString() || ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 px-3 py-1.5 text-[10px] text-surface-400">
                {current.data.length} rows · Sheet: {current.name}
            </div>
        </div>
    );
}

/* ─── Word Preview ─── */
function WordPreview({ url }: { url: string }) {
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = await res.arrayBuffer();

                // Dynamic import to ensure browser build is used
                const mammothModule = await import('mammoth');
                const mammothLib = mammothModule.default || mammothModule;

                const result = await mammothLib.convertToHtml({ arrayBuffer: buf });
                if (result.value) {
                    setHtml(result.value);
                } else {
                    setError('Document appears to be empty');
                }
                if (result.messages?.length) {
                    console.warn('Mammoth warnings:', result.messages);
                }
            } catch (err: any) {
                console.error('Word preview error:', err);
                setError(`Failed to parse document: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [url]);

    if (loading) return (
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            <p className="text-xs text-surface-500">Parsing document...</p>
        </div>
    );
    if (error) return (
        <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-12 w-12 text-blue-400" />
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            <p className="text-xs text-surface-500">Try downloading the file to view it in your desktop application</p>
        </div>
    );

    return (
        <div className="h-full w-full overflow-auto rounded-lg border border-surface-200/50 dark:border-surface-700/50 bg-white/50 dark:bg-surface-900/50 p-8">
            <div
                className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-surface-900 dark:prose-headings:text-white
                    prose-p:text-surface-700 dark:prose-p:text-surface-300
                    prose-strong:text-surface-900 dark:prose-strong:text-white
                    prose-a:text-brand-600 dark:prose-a:text-brand-400
                    prose-table:border-surface-200 dark:prose-table:border-surface-700
                    prose-th:bg-surface-50 dark:prose-th:bg-surface-800
                    prose-th:text-surface-900 dark:prose-th:text-white
                    prose-td:border-surface-200 dark:prose-td:border-surface-700"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}

/* ─── ODT Preview ─── */
function OdtPreview({ url }: { url: string }) {
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = await res.arrayBuffer();

                const JSZip = (await import('jszip')).default;
                const zip = await JSZip.loadAsync(buf);

                const contentFile = zip.file('content.xml');
                if (!contentFile) throw new Error('No content.xml found in ODT file');

                const xmlText = await contentFile.async('text');
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlText, 'text/xml');

                // Convert ODF XML to HTML
                const bodyEl = doc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'body')[0];
                const textEl = bodyEl?.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'text')[0];

                if (!textEl) throw new Error('No text content found');

                let htmlContent = '';
                const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
                const TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';

                const processNode = (node: Element): string => {
                    let result = '';
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];
                        if (child.nodeType === Node.TEXT_NODE) {
                            result += child.textContent || '';
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            const el = child as Element;
                            const localName = el.localName;
                            const ns = el.namespaceURI;

                            if (ns === TEXT_NS) {
                                switch (localName) {
                                    case 'p': {
                                        const styleName = el.getAttributeNS(TEXT_NS, 'style-name') || '';
                                        if (styleName.includes('Heading') || styleName.match(/^H\d/i)) {
                                            const level = styleName.match(/\d/) ? styleName.match(/\d/)![0] : '2';
                                            result += `<h${level}>${processNode(el)}</h${level}>`;
                                        } else {
                                            result += `<p>${processNode(el)}</p>`;
                                        }
                                        break;
                                    }
                                    case 'h': {
                                        const level = el.getAttributeNS(TEXT_NS, 'outline-level') || '2';
                                        result += `<h${level}>${processNode(el)}</h${level}>`;
                                        break;
                                    }
                                    case 'span':
                                        result += `<span>${processNode(el)}</span>`;
                                        break;
                                    case 'a': {
                                        const href = el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '#';
                                        result += `<a href="${href}">${processNode(el)}</a>`;
                                        break;
                                    }
                                    case 'list':
                                        result += `<ul>${processNode(el)}</ul>`;
                                        break;
                                    case 'list-item':
                                        result += `<li>${processNode(el)}</li>`;
                                        break;
                                    case 'line-break':
                                        result += '<br/>';
                                        break;
                                    case 'tab':
                                        result += '&emsp;';
                                        break;
                                    case 's': {
                                        const count = parseInt(el.getAttributeNS(TEXT_NS, 'c') || '1');
                                        result += '&nbsp;'.repeat(count);
                                        break;
                                    }
                                    default:
                                        result += processNode(el);
                                }
                            } else if (ns === TABLE_NS) {
                                switch (localName) {
                                    case 'table':
                                        result += `<table><tbody>${processNode(el)}</tbody></table>`;
                                        break;
                                    case 'table-row':
                                        result += `<tr>${processNode(el)}</tr>`;
                                        break;
                                    case 'table-cell':
                                        result += `<td>${processNode(el)}</td>`;
                                        break;
                                    default:
                                        result += processNode(el);
                                }
                            } else {
                                result += processNode(el);
                            }
                        }
                    }
                    return result;
                };

                htmlContent = processNode(textEl);

                if (!htmlContent.trim()) {
                    setError('Document appears to be empty');
                } else {
                    setHtml(htmlContent);
                }
            } catch (err: any) {
                console.error('ODT preview error:', err);
                setError(`Failed to parse ODT: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [url]);

    if (loading) return (
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            <p className="text-xs text-surface-500">Parsing ODT document...</p>
        </div>
    );
    if (error) return (
        <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-12 w-12 text-orange-400" />
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            <p className="text-xs text-surface-500">Try downloading the file to view it in LibreOffice</p>
        </div>
    );

    return (
        <div className="h-full w-full overflow-auto rounded-lg border border-surface-200/50 dark:border-surface-700/50 bg-white/50 dark:bg-surface-900/50 p-8">
            <div
                className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-surface-900 dark:prose-headings:text-white
                    prose-p:text-surface-700 dark:prose-p:text-surface-300
                    prose-strong:text-surface-900 dark:prose-strong:text-white
                    prose-a:text-brand-600 dark:prose-a:text-brand-400
                    prose-table:border-surface-200 dark:prose-table:border-surface-700
                    prose-th:bg-surface-50 dark:prose-th:bg-surface-800
                    prose-td:border-surface-200 dark:prose-td:border-surface-700"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}

