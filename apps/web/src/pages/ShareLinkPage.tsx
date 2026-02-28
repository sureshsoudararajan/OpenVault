import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sharingApi } from '../services/api';
import { Shield, FileText, Lock, Download, Loader2 } from 'lucide-react';

export default function ShareLinkPage() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if (!token) return;
        sharingApi.getLink(token)
            .then((res: any) => setData(res.data))
            .catch((err: any) => setError(err.message))
            .finally(() => setLoading(false));
    }, [token]);

    const handleVerifyPassword = async () => {
        if (!token || !passwordInput) return;
        setVerifying(true);
        try {
            await sharingApi.verifyPassword(token, passwordInput);
            setPasswordVerified(true);
        } catch (err: any) {
            setError(err.message || 'Wrong password');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface-950">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 p-4">
                <Shield className="mb-4 h-12 w-12 text-red-400" />
                <h1 className="text-xl font-semibold text-white">Link unavailable</h1>
                <p className="mt-2 text-sm text-surface-400">{error}</p>
            </div>
        );
    }

    const needsPassword = data?.requiresPassword && !passwordVerified;

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-[30%] -top-[30%] h-[60%] w-[60%] rounded-full bg-brand-600/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-fade-in">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-lg font-bold gradient-text">OpenVault</h1>
                </div>

                <div className="glass-card p-6">
                    {needsPassword ? (
                        <>
                            <div className="mb-4 text-center">
                                <Lock className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                                <h2 className="font-semibold text-white">Password Protected</h2>
                                <p className="mt-1 text-sm text-surface-400">Enter the password to access this content</p>
                            </div>

                            {error && (
                                <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => { setPasswordInput(e.target.value); setError(''); }}
                                    className="input-field flex-1"
                                    placeholder="Enter password"
                                />
                                <button onClick={handleVerifyPassword} disabled={verifying} className="btn-primary">
                                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {data?.file && (
                                <div className="text-center">
                                    <FileText className="mx-auto mb-3 h-12 w-12 text-brand-400" />
                                    <h2 className="text-lg font-semibold text-white">{data.file.name}</h2>
                                    <p className="mt-1 text-sm text-surface-400">
                                        {(data.file.size / (1024 * 1024)).toFixed(1)} MB · {data.file.mimeType}
                                    </p>
                                    <button className="btn-primary mt-6 flex items-center gap-2 mx-auto">
                                        <Download className="h-4 w-4" /> Download File
                                    </button>
                                </div>
                            )}

                            {data?.folder && (
                                <div>
                                    <h2 className="mb-3 text-lg font-semibold text-white">{data.folder.name}</h2>
                                    <div className="space-y-1">
                                        {data.folder.files?.map((f: any) => (
                                            <div key={f.id} className="flex items-center gap-3 rounded-lg bg-surface-800/50 px-3 py-2">
                                                <FileText className="h-4 w-4 text-surface-400" />
                                                <span className="flex-1 truncate text-sm text-white">{f.name}</span>
                                                <span className="text-xs text-surface-500">{(f.size / 1024).toFixed(0)} KB</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
