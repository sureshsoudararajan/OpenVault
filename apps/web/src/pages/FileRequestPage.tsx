import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Inbox, UploadCloud, AlertTriangle } from 'lucide-react';
import { uploadRequestFiles } from '../services/uploadManager';
import UploadProgressPanel from '../components/UploadProgressPanel';

export default function FileRequestPage() {
    const { token } = useParams<{ token: string }>();
    const [requestLink, setRequestLink] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch(`/api/file-requests/${token}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setRequestLink(data.requestLink);
                } else {
                    setError(data.error?.message || 'Failed to load file request');
                }
            })
            .catch(() => setError('Network error'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        try {
            await uploadRequestFiles(files, token as string);
        } catch (err) {
            console.error('Upload failed:', err);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    }

    if (error || !requestLink) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 text-center border border-gray-100 dark:border-gray-700">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Link</h2>
                    <p className="text-gray-500 dark:text-gray-400">{error || 'This file request link is invalid or has expired.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Inbox className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xl font-bold text-gray-900 dark:text-white">OpenVault</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 flex flex-col mt-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
                    <div className="flex items-center space-x-4 mb-6">
                        {requestLink.createdBy.avatarUrl ? (
                            <img src={requestLink.createdBy.avatarUrl} alt="" className="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-700" />
                        ) : (
                            <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                                {requestLink.createdBy.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{requestLink.title}</h1>
                            <p className="text-gray-500 dark:text-gray-400">{requestLink.createdBy.name} is requesting files</p>
                        </div>
                    </div>

                    {requestLink.description && (
                        <div className="mb-8 prose prose-indigo dark:prose-invert">
                            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{requestLink.description}</p>
                        </div>
                    )}

                    <div
                        className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors ${
                            isDragging 
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
                        }}
                    >
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={(e) => {
                                if (e.target.files) handleFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full mb-4">
                            <UploadCloud className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Drag & drop files here
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-sm">
                            or click below to browse files on your device
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                        >
                            Select Files
                        </button>
                    </div>
                </div>
            </main>

            <UploadProgressPanel />
        </div>
    );
}
