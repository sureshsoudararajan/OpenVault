import { Outlet } from 'react-router-dom';
import { Shield, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

export default function AuthLayout() {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-950 p-4 transition-colors duration-300">
            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="fixed top-4 right-4 z-50 rounded-xl p-2.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500 hover:text-amber-500 dark:hover:text-yellow-400 shadow-lg transition-all duration-300 hover:scale-105"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Ambient background */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-[30%] -top-[30%] h-[60%] w-[60%] rounded-full bg-brand-500/5 dark:bg-brand-600/5 blur-3xl" />
                <div className="absolute -bottom-[20%] -right-[20%] h-[50%] w-[50%] rounded-full bg-purple-500/5 dark:bg-purple-600/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/20 transition-transform hover:scale-105">
                        <Shield className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">OpenVault</h1>
                    <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">Secure, self-hosted cloud storage</p>
                </div>

                {/* Auth Form Card */}
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-8 shadow-xl shadow-surface-200/50 dark:shadow-black/20 backdrop-blur-lg">
                    <Outlet />
                </div>

                <p className="mt-6 text-center text-xs text-surface-400 dark:text-surface-600">
                    Privacy-focused · End-to-end encrypted · Open source
                </p>
            </div>
        </div>
    );
}
