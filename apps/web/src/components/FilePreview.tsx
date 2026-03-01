import { useState, useEffect } from 'react';
import { fileApi } from '../services/api';
import {
    X, Download, Share2, ChevronLeft, ChevronRight,
    FileText, Image, Film, Music, FileArchive, File,
    Maximize2, Minimize2, Loader2
} from 'lucide-react';

interface FilePreviewProps {
    fileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export default function FilePreview({
    fileId, fileName, mimeType, fileSize, onClose, onNext, onPrev
}: FilePreviewProps) {
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
        const loadPreview = async () => {
            setLoading(true);
            setError('');
            try {
                const res: any = await fileApi.download(fileId);
                setDownloadUrl(res.data?.downloadUrl || null);
            } catch (err: any) {
                setError(err.message || 'Failed to load preview');
            } finally {
                setLoading(false);
            }
        };
        loadPreview();
    }, [fileId]);

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
    const isText = mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml';
    const isPreviewable = isImage || isVideo || isAudio || isPdf || isText;

    const getFileIcon = () => {
        if (isImage) return <Image className="h-16 w-16 text-pink-400" />;
        if (isVideo) return <Film className="h-16 w-16 text-purple-400" />;
        if (isAudio) return <Music className="h-16 w-16 text-cyan-400" />;
        if (isPdf) return <FileText className="h-16 w-16 text-red-400" />;
        if (mimeType.includes('zip') || mimeType.includes('archive')) return <FileArchive className="h-16 w-16 text-amber-400" />;
        return <File className="h-16 w-16 text-brand-400" />;
    };

    const handleDownload = () => {
        if (downloadUrl) {
            window.open(downloadUrl, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />

            <div className={`relative z-10 flex flex-col ${fullscreen ? 'h-full w-full' : 'h-[90vh] w-[90vw] max-w-5xl rounded-xl'
                } overflow-hidden bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-2xl transition-all duration-300`}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/90 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                            {isImage && <Image className="h-5 w-5 text-pink-400" />}
                            {isVideo && <Film className="h-5 w-5 text-purple-400" />}
                            {isAudio && <Music className="h-5 w-5 text-cyan-400" />}
                            {isPdf && <FileText className="h-5 w-5 text-red-400" />}
                            {!isImage && !isVideo && !isAudio && !isPdf && <File className="h-5 w-5 text-brand-400" />}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{fileName}</p>
                            <p className="text-xs text-surface-500">{formatSize(fileSize)} · {mimeType}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={handleDownload} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white" title="Download">
                            <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setFullscreen(!fullscreen)} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white" title="Toggle fullscreen">
                            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                        <button onClick={onClose} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-red-50 dark:hover:bg-surface-800 hover:text-red-500 dark:hover:text-red-400" title="Close">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-100 dark:bg-surface-950 p-4">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                            <p className="text-sm text-surface-500 dark:text-surface-400">Loading preview...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-3 text-center">
                            {getFileIcon()}
                            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                            <button onClick={handleDownload} className="btn-primary text-sm mt-2 !text-white">
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
                            <button onClick={handleDownload} className="btn-primary flex items-center gap-2 text-sm mt-2 !text-white">
                                <Download className="h-4 w-4" /> Download File
                            </button>
                        </div>
                    ) : (
                        <>
                            {isImage && downloadUrl && (
                                <img
                                    src={downloadUrl}
                                    alt={fileName}
                                    className="max-h-full max-w-full object-contain rounded-lg"
                                    onError={() => setError('Failed to load image')}
                                />
                            )}

                            {isVideo && downloadUrl && (
                                <video
                                    src={downloadUrl}
                                    controls
                                    autoPlay={false}
                                    className="max-h-full max-w-full rounded-lg"
                                    onError={() => setError('Failed to load video')}
                                >
                                    <source src={downloadUrl} type={mimeType} />
                                    Your browser does not support video playback.
                                </video>
                            )}

                            {isAudio && downloadUrl && (
                                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                                        <Music className="h-16 w-16 text-cyan-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-medium text-surface-900 dark:text-white">{fileName}</p>
                                        <p className="text-sm text-surface-500 dark:text-surface-400">{formatSize(fileSize)}</p>
                                    </div>
                                    <audio
                                        src={downloadUrl}
                                        controls
                                        className="w-full"
                                        onError={() => setError('Failed to load audio')}
                                    >
                                        Your browser does not support audio playback.
                                    </audio>
                                </div>
                            )}

                            {isPdf && downloadUrl && (
                                <iframe
                                    src={downloadUrl}
                                    title={fileName}
                                    className="h-full w-full rounded-lg border-0"
                                />
                            )}

                            {isText && downloadUrl && (
                                <TextPreview url={downloadUrl} />
                            )}
                        </>
                    )}
                </div>

                {/* Navigation Arrows */}
                {onPrev && (
                    <button
                        onClick={onPrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 dark:bg-surface-800/80 p-2 text-surface-700 dark:text-white backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-surface-700 hover:scale-110 shadow-lg"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}
                {onNext && (
                    <button
                        onClick={onNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 dark:bg-surface-800/80 p-2 text-surface-700 dark:text-white backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-surface-700 hover:scale-110 shadow-lg"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
}

function TextPreview({ url }: { url: string }) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(url)
            .then((res) => res.text())
            .then((text) => setContent(text))
            .catch(() => setContent('Failed to load file content'))
            .finally(() => setLoading(false));
    }, [url]);

    if (loading) {
        return <Loader2 className="h-6 w-6 animate-spin text-brand-400" />;
    }

    return (
        <pre className="h-full w-full overflow-auto rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-6 text-sm text-surface-800 dark:text-surface-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {content}
        </pre>
    );
}
