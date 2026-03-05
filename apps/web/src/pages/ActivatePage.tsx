import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ActivatePage() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    const location = useLocation();
    const navigate = useNavigate();
    const token = new URLSearchParams(location.search).get('token');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        const activateAccount = async () => {
            try {
                const res: any = await authApi.activate(token);
                setStatus('success');
                setMessage(res.data?.message || 'Account activated successfully!');
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Failed to activate account. The link may be invalid or expired.');
            }
        };

        activateAccount();
    }, [token, navigate]);

    return (
        <div className="text-center animate-fade-in py-8">
            <div className="mb-6 flex justify-center">
                {status === 'loading' && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                        <Loader2 className="h-8 w-8 text-brand-600 dark:text-brand-400 animate-spin" />
                    </div>
                )}
                {status === 'success' && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                )}
                {status === 'error' && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                )}
            </div>

            <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                {status === 'loading' ? 'Activating Account...' :
                    status === 'success' ? 'Account Activated!' : 'Activation Failed'}
            </h2>

            <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-sm mx-auto">
                {status === 'loading' ? 'Please wait while we verify your activation link.' : message}
            </p>

            {status !== 'loading' && (
                <Link to="/login" className="btn-primary w-full flex justify-center items-center gap-2">
                    Continue to Login <ArrowRight className="h-4 w-4" />
                </Link>
            )}
        </div>
    );
}
