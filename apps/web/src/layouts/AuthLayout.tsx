import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function AuthLayout() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4">
            {/* Ambient background gradient */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-[30%] -top-[30%] h-[60%] w-[60%] rounded-full bg-brand-600/5 blur-3xl" />
                <div className="absolute -bottom-[20%] -right-[20%] h-[50%] w-[50%] rounded-full bg-purple-600/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/20">
                        <Shield className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">OpenVault</h1>
                    <p className="mt-1 text-sm text-surface-400">Secure, self-hosted cloud storage</p>
                </div>

                {/* Auth Form Card */}
                <div className="glass-card p-8">
                    <Outlet />
                </div>

                <p className="mt-6 text-center text-xs text-surface-600">
                    Privacy-focused · End-to-end encrypted · Open source
                </p>
            </div>
        </div>
    );
}
