import { useState, useEffect, useMemo } from 'react';
import { ytdlpApi } from '../services/api';
import { Settings, Plus, Cookie, Check, Loader2 } from 'lucide-react';

interface CookieProfile {
    id: string;
    name: string;
    domain: string | null;
}

interface CookieSelectorProps {
    url: string;
    selectedCookieId: string | null;
    onChange: (id: string | null) => void;
    onManageCookies: () => void;
    onUploadNew: () => void;
}

export default function CookieSelector({ url, selectedCookieId, onChange, onManageCookies, onUploadNew }: CookieSelectorProps) {
    const [cookies, setCookies] = useState<CookieProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const loadCookies = async () => {
        setLoading(true);
        try {
            const res = await ytdlpApi.getCookies();
            setCookies(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Load cookies when dropdown opens or component mounts
    useEffect(() => {
        loadCookies();
    }, []);

    // Provide a way for parent to force refresh (e.g. via a ref or just reloading on mount is enough)

    // Smart suggestions: parse URL and boost matching domain
    const suggestedCookies = useMemo(() => {
        if (!url) return cookies;
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase().replace('www.', '');
            
            return [...cookies].sort((a, b) => {
                const aMatch = a.domain && host.includes(a.domain.toLowerCase()) ? 1 : 0;
                const bMatch = b.domain && host.includes(b.domain.toLowerCase()) ? 1 : 0;
                return bMatch - aMatch;
            });
        } catch (e) {
            return cookies;
        }
    }, [url, cookies]);

    const selectedCookie = cookies.find(c => c.id === selectedCookieId);

    return (
        <div className="relative mt-2">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cookies (Optional)
                </label>
                <button 
                    type="button"
                    onClick={onManageCookies}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                    <Settings className="h-3 w-3" /> Manage Profiles
                </button>
            </div>
            
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between pl-4 pr-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-left text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-all font-medium"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Cookie className={`h-4 w-4 flex-shrink-0 ${selectedCookie ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="truncate">
                            {selectedCookie ? selectedCookie.name : 'Select a cookie profile...'}
                        </span>
                    </div>
                    <div className="flex items-center">
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />}
                        <span className="text-gray-400">▼</span>
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => { onChange(null); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between ${!selectedCookieId ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                            <span>No cookies</span>
                            {!selectedCookieId && <Check className="h-4 w-4" />}
                        </button>
                        
                        {suggestedCookies.map(cookie => {
                            const isSelected = selectedCookieId === cookie.id;
                            return (
                                <button
                                    key={cookie.id}
                                    type="button"
                                    onClick={() => { onChange(cookie.id); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="truncate">{cookie.name}</span>
                                        {cookie.domain && <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{cookie.domain}</span>}
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => { onUploadNew(); setIsOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700"
                        >
                            <Plus className="h-4 w-4" /> Upload New Cookie...
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden backdrop to close dropdown */}
            {isOpen && (
                <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)}></div>
            )}
        </div>
    );
}
