import { useState, useEffect } from 'react';
import { fileApi } from '../services/api';
import { Image, Film } from 'lucide-react';

interface ThumbnailProps {
    fileId: string;
    mimeType: string;
    className?: string;
}

export default function Thumbnail({ fileId, mimeType, className = '' }: ThumbnailProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadThumbnail = async () => {
            try {
                const res: any = await fileApi.getThumbnail(fileId);
                if (mounted && res.data?.downloadUrl) {
                    setUrl(res.data.downloadUrl);
                }
            } catch (err) {
                if (mounted) setError(true);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadThumbnail();
        return () => { mounted = false; };
    }, [fileId]);

    const isVideo = mimeType.startsWith('video/');

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-surface-100 dark:bg-surface-800 animate-pulse ${className}`}>
                {isVideo ? <Film className="h-6 w-6 text-surface-400 opacity-50" /> : <Image className="h-6 w-6 text-surface-400 opacity-50" />}
            </div>
        );
    }

    if (error || !url) {
        return (
            <div className={`flex items-center justify-center bg-surface-100 dark:bg-surface-800 ${className}`}>
                {isVideo ? <Film className="h-8 w-8 text-purple-400" /> : <Image className="h-8 w-8 text-pink-400" />}
            </div>
        );
    }

    return (
        <img
            src={url}
            alt="Thumbnail"
            className={`object-cover ${className}`}
            loading="lazy"
            onError={() => setError(true)}
        />
    );
}
