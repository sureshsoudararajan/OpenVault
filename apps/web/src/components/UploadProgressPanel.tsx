import { useUploadStore } from '../stores/uploadStore';
import type { UploadItem } from '../stores/uploadStore';
import {
    X, ChevronDown, ChevronUp, Check, AlertCircle,
    Loader2, FileUp, Pause
} from 'lucide-react';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bps: number): string {
    return `${formatBytes(bps)}/s`;
}

function formatEta(seconds: number): string {
    if (!seconds || seconds === Infinity || seconds > 86400) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

function UploadItemRow({ item }: { item: UploadItem }) {
    const { removeUpload } = useUploadStore();
    const pct = item.fileSize > 0 ? Math.min(100, Math.round((item.uploaded / item.fileSize) * 100)) : 0;

    const statusColor = {
        pending: 'text-surface-400 dark:text-surface-500',
        uploading: 'text-brand-500 dark:text-brand-400',
        done: 'text-emerald-500',
        error: 'text-red-500',
    }[item.status];

    const barColor = item.status === 'error' ? 'bg-red-500' :
        item.status === 'done' ? 'bg-emerald-500' : 'bg-brand-500';

    return (
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 last:border-0">
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`mt-0.5 flex-shrink-0 ${statusColor}`}>
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {item.status === 'pending' && <Pause className="h-4 w-4" />}
                    {item.status === 'done' && <Check className="h-4 w-4" />}
                    {item.status === 'error' && <AlertCircle className="h-4 w-4" />}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    {/* File name & close */}
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-surface-900 dark:text-white truncate flex-1">
                            {item.fileName}
                        </p>
                        <button
                            onClick={() => {
                                item.abort?.();
                                removeUpload(item.id);
                            }}
                            className="flex-shrink-0 text-surface-300 dark:text-surface-600 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Progress bar */}
                    {(item.status === 'uploading' || item.status === 'pending') && (
                        <div className="mb-1.5 h-1.5 w-full rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    )}
                    {item.status === 'done' && (
                        <div className="mb-1.5 h-1.5 w-full rounded-full bg-emerald-100 dark:bg-emerald-900/30 overflow-hidden">
                            <div className="h-full w-full rounded-full bg-emerald-500" />
                        </div>
                    )}
                    {item.status === 'error' && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 mb-1 leading-tight">{item.error}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-2 text-[10px] text-surface-400 dark:text-surface-500 flex-wrap">
                        {item.status === 'uploading' && (
                            <>
                                <span>{formatBytes(item.uploaded)} / {formatBytes(item.fileSize)}</span>
                                <span className="text-surface-300 dark:text-surface-600">·</span>
                                <span>{formatSpeed(item.speed)}</span>
                                {item.eta > 0 && (
                                    <>
                                        <span className="text-surface-300 dark:text-surface-600">·</span>
                                        <span>{formatEta(item.eta)} left</span>
                                    </>
                                )}
                                <span className="ml-auto font-semibold text-brand-600 dark:text-brand-400">{pct}%</span>
                            </>
                        )}
                        {item.status === 'done' && (
                            <span className="text-emerald-500 font-medium">
                                {formatBytes(item.fileSize)} · Complete
                            </span>
                        )}
                        {item.status === 'pending' && (
                            <span>Waiting · {formatBytes(item.fileSize)}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function UploadProgressPanel() {
    const { uploads, isMinimized, setMinimized, clearCompleted } = useUploadStore();

    if (uploads.length === 0) return null;

    const uploading = uploads.filter((u) => u.status === 'uploading').length;
    const done = uploads.filter((u) => u.status === 'done').length;
    const errors = uploads.filter((u) => u.status === 'error').length;
    const total = uploads.length;

    const summaryText = uploading > 0
        ? `Uploading ${uploading} of ${total} file${total !== 1 ? 's' : ''}…`
        : done === total
            ? `${done} upload${done !== 1 ? 's' : ''} complete`
            : `${total} file${total !== 1 ? 's' : ''} · ${errors} failed`;

    return (
        <div
            className="fixed bottom-4 right-4 z-[9999] w-80 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden animate-slide-up"
            style={{ maxHeight: isMinimized ? '54px' : '420px', transition: 'max-height 0.3s ease' }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white">
                <div className="flex-shrink-0">
                    {uploading > 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : done === total ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <FileUp className="h-4 w-4" />
                    )}
                </div>
                <p className="flex-1 text-xs font-semibold truncate">{summaryText}</p>
                <div className="flex items-center gap-1">
                    {done > 0 && !isMinimized && (
                        <button
                            onClick={clearCompleted}
                            className="text-white/70 hover:text-white transition-colors text-[10px] mr-1"
                            title="Clear completed"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        onClick={() => setMinimized(!isMinimized)}
                        className="text-white/80 hover:text-white transition-colors"
                        title={isMinimized ? 'Expand' : 'Minimize'}
                    >
                        {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Progress bar for overall */}
            {uploading > 0 && (
                <div className="h-0.5 bg-brand-100 dark:bg-surface-800 w-full">
                    <div
                        className="h-full bg-brand-400 transition-all duration-300"
                        style={{
                            width: `${Math.round(
                                (uploads.reduce((sum, u) => sum + u.uploaded, 0) /
                                    Math.max(1, uploads.reduce((sum, u) => sum + u.fileSize, 0))) * 100
                            )}%`,
                        }}
                    />
                </div>
            )}

            {/* Upload list */}
            {!isMinimized && (
                <div className="overflow-y-auto" style={{ maxHeight: '366px' }}>
                    {uploads.map((item) => (
                        <UploadItemRow key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}
