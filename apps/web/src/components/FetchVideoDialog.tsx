import { useState } from 'react';
import { Download, Film, Music, X, Loader2, AlertCircle } from 'lucide-react';
import { ytdlpApi } from '../services/api';

interface FetchVideoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentFolderId: string | null;
    onComplete: () => void;
}

interface FormatItem {
    format_id: string;
    ext: string;
    resolution: string;
    filesize?: number;
    vcodec: string;
    acodec: string;
    video_ext: string;
    audio_ext: string;
    format_note?: string;
    tbr?: number;
}

interface VideoInfo {
    id: string;
    title: string;
    thumbnail: string;
    description: string;
    duration: number;
    formats: FormatItem[];
}

export default function FetchVideoDialog({ isOpen, onClose, currentFolderId, onComplete }: FetchVideoDialogProps) {
    const [url, setUrl] = useState('');
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

    const [selectedVideoFormat, setSelectedVideoFormat] = useState<string | null>(null);
    const [selectedAudioFormat, setSelectedAudioFormat] = useState<string | null>(null);

    const [progress, setProgress] = useState<number>(0);
    const [speed, setSpeed] = useState<string>('');
    const [eta, setEta] = useState<string>('');
    const [downloadSize, setDownloadSize] = useState<string>('');

    if (!isOpen) return null;

    const formatSize = (bytes?: number) => {
        if (!bytes) return 'Unknown size';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const handleFetchInfo = async () => {
        if (!url.trim()) {
            setError('Please enter a valid URL');
            return;
        }

        setError(null);
        setLoadingInfo(true);
        setVideoInfo(null);
        setSelectedVideoFormat(null);
        setSelectedAudioFormat(null);

        try {
            const res: any = await ytdlpApi.fetchInfo(url);
            setVideoInfo(res.data);
            
            // Auto-select best ones by default if they exist
            const vFormats = res.data.formats.filter((f: FormatItem) => f.vcodec !== 'none');
            const aFormats = res.data.formats.filter((f: FormatItem) => f.acodec !== 'none' && f.vcodec === 'none');
            
            if (vFormats.length > 0) setSelectedVideoFormat(vFormats[vFormats.length - 1].format_id); // Pick last (usually best)
            if (aFormats.length > 0) setSelectedAudioFormat(aFormats[aFormats.length - 1].format_id);
            
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to fetch video information. Ensure the URL is valid.');
        } finally {
            setLoadingInfo(false);
        }
    };

    const handleDownload = async (type: 'video' | 'audio' | 'both') => {
        if (!videoInfo) return;
        
        let formatToRequest = '';
        if (type === 'video') {
            if (!selectedVideoFormat) return setError('Please select a video format');
            formatToRequest = selectedVideoFormat;
        } else if (type === 'audio') {
            if (!selectedAudioFormat) return setError('Please select an audio format');
             formatToRequest = selectedAudioFormat;
        } else {
             if (!selectedVideoFormat || !selectedAudioFormat) return setError('Please select both formats to combine');
             formatToRequest = `${selectedVideoFormat}+${selectedAudioFormat}`;
        }

        setError(null);
        setDownloading(true);
        setProgress(0);
        setSpeed('');
        setEta('');
        setDownloadSize('');

        try {
            const response = await ytdlpApi.downloadStream(url, formatToRequest, currentFolderId || null);
            
            if (!response.body) {
                throw new Error("No response body returned");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            let done = false;
            let buffer = "";

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            
                            if (data.type === 'progress') {
                                setProgress(data.percent);
                                setSpeed(data.speed);
                                setEta(data.eta);
                                setDownloadSize(data.size);
                            } else if (data.type === 'error') {
                                setError(data.error || 'Failed to download the video.');
                                setDownloading(false);
                                return;
                            } else if (data.type === 'complete') {
                                onComplete();
                                handleClose();
                            }
                        } catch (e) {
                            console.warn("Failed to parse NDJSON chunk", e);
                        }
                    }
                }
            }

        } catch (err: any) {
             setError(err.message || 'Failed to download the video.');
             setDownloading(false);
        }
    };

    const handleClose = () => {
        setUrl('');
        setVideoInfo(null);
        setError(null);
        setDownloading(false);
        onClose();
    };

    // Separate formats
    const videoFormats = videoInfo?.formats.filter(f => f.vcodec !== 'none') || [];
    const audioFormats = videoInfo?.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none') || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-inner">
                            <Download className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fetch Video / Audio</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Download media directly to your vault</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-xl p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                        disabled={downloading}
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar relative min-h-[300px]">
                    {/* URL Input Area */}
                    <div className="space-y-3 max-w-2xl mx-auto w-full">
                        <div className="flex gap-3">
                            <div className="relative flex-1 group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Film className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Paste YouTube, Twitter, TikTok link here..."
                                    className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all font-medium"
                                    disabled={loadingInfo || downloading}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleFetchInfo(); }}
                                    autoFocus
                                />
                            </div>
                            <button 
                                onClick={handleFetchInfo} 
                                className="btn-primary min-w-[140px] px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all font-bold text-md disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!url.trim() || loadingInfo || downloading}
                            >
                                {loadingInfo ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Fetch Info'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400 flex items-center gap-3 max-w-2xl mx-auto shadow-sm animate-shake">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {downloading && (
                         <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-b-2xl px-6">
                             <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-indigo-500">
                                    <Download className="h-8 w-8 animate-pulse" />
                                </div>
                             </div>
                             <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Downloading Media...</h3>
                             
                             <div className="w-full max-w-md mt-6 space-y-4">
                                <div className="flex justify-between text-sm font-bold text-gray-700 dark:text-gray-300">
                                    <span>{progress.toFixed(1)}%</span>
                                    <span>{downloadSize || 'Calculating size...'}</span>
                                </div>
                                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner hidden border border-gray-100 dark:border-gray-800" style={{ display: 'block' }}>
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-500">
                                    <span>{speed ? `${speed}` : 'Starting stream...'}</span>
                                    <span>{eta ? `ETA: ${eta}` : ''}</span>
                                </div>
                             </div>

                             <p className="text-gray-500 dark:text-gray-400 font-medium text-center mt-8 text-sm max-w-sm">Please keep this window open while the transfer completes.</p>
                         </div>
                    )}

                    {/* Results Area */}
                    {videoInfo && !loadingInfo && !downloading && (
                        <div className="animate-slide-up space-y-8">
                            
                            {/* Metadata Card */}
                            <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
                                <div className="relative overflow-hidden rounded-2xl w-full sm:w-64 aspect-video bg-gray-200 dark:bg-gray-700 flex-shrink-0 shadow-inner group">
                                    <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                                        <span className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md">
                                            {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight" title={videoInfo.title}>{videoInfo.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{videoInfo.description || "No description provided."}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Video Formats */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg px-2">
                                        <Film className="h-5 w-5" /> Video Quality
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto pr-2 space-y-3 no-scrollbar pb-4">
                                        {videoFormats.length === 0 ? (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">No video formats found</p>
                                        ) : (
                                            videoFormats.slice().reverse().map(fmt => (
                                                <label key={fmt.format_id} className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm ${selectedVideoFormat === fmt.format_id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 shadow-indigo-100 dark:shadow-none' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800'}`}>
                                                    <input 
                                                        type="radio" 
                                                        name="videoFormat" 
                                                        value={fmt.format_id} 
                                                        checked={selectedVideoFormat === fmt.format_id}
                                                        onChange={() => setSelectedVideoFormat(fmt.format_id)}
                                                        className="mt-1.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 pointer-events-none"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-base font-bold text-gray-900 dark:text-white uppercase">{fmt.resolution || fmt.format_note || 'N/A'}</span>
                                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{fmt.ext}</span>
                                                        </div>
                                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-2 font-medium overflow-hidden">
                                                            <span className="flex-shrink-0 whitespace-nowrap">{formatSize(fmt.filesize)}</span>
                                                            <span className="text-gray-300 dark:text-gray-600">•</span>
                                                            <span className="truncate">{fmt.vcodec}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Audio Formats */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-lg px-2">
                                        <Music className="h-5 w-5" /> Audio Quality
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto pr-2 space-y-3 no-scrollbar pb-4">
                                        {audioFormats.length === 0 ? (
                                             <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">No audio formats found</p>
                                        ) : (
                                            audioFormats.slice().reverse().map(fmt => (
                                                <label key={fmt.format_id} className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm ${selectedAudioFormat === fmt.format_id ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-500/10 shadow-cyan-100 dark:shadow-none' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-cyan-200 dark:hover:border-cyan-800'}`}>
                                                    <input 
                                                        type="radio" 
                                                        name="audioFormat" 
                                                        value={fmt.format_id} 
                                                        checked={selectedAudioFormat === fmt.format_id}
                                                        onChange={() => setSelectedAudioFormat(fmt.format_id)}
                                                        className="mt-1.5 h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 pointer-events-none"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                             <span className="text-base font-bold text-gray-900 dark:text-white">{fmt.format_note || 'Audio Only'}</span>
                                                             <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 rounded-full">{fmt.ext}</span>
                                                        </div>
                                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-2 font-medium overflow-hidden">
                                                            <span className="flex-shrink-0 whitespace-nowrap">{formatSize(fmt.filesize)}</span>
                                                            <span className="text-gray-300 dark:text-gray-600">•</span>
                                                            <span className="truncate">{fmt.acodec}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                {videoInfo && !loadingInfo && !downloading && (
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row items-center gap-4 justify-end">
                        <button 
                            onClick={() => handleDownload('audio')} 
                            disabled={!selectedAudioFormat}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm bg-white dark:bg-gray-900 border-2 border-cyan-200 dark:border-cyan-900/50 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-300 dark:hover:border-cyan-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Music className="h-4 w-4 group-hover:scale-110 transition-transform" /> Download Audio Only
                        </button>
                        <button 
                            onClick={() => handleDownload('video')} 
                            disabled={!selectedVideoFormat}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm bg-white dark:bg-gray-900 border-2 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Film className="h-4 w-4 group-hover:scale-110 transition-transform" /> Download Video Only
                        </button>
                        <button 
                            onClick={() => handleDownload('both')} 
                            disabled={!selectedVideoFormat || !selectedAudioFormat}
                            className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" /> Download Combined
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
