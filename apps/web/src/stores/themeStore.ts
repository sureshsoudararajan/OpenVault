import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            setTheme: (theme) => {
                set({ theme });
                applyTheme(theme);
            },
            toggleTheme: () => {
                const next = get().theme === 'dark' ? 'light' : 'dark';
                set({ theme: next });
                applyTheme(next);
            },
        }),
        { name: 'openvault-theme' }
    )
);

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.add('light');
        root.classList.remove('dark');
    }
}

// Initialize theme on load
const storedTheme = JSON.parse(localStorage.getItem('openvault-theme') || '{}');
applyTheme(storedTheme?.state?.theme || 'dark');
