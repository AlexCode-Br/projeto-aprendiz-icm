import { useState, useEffect, useCallback } from 'react';

const readTheme = () => {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export default function useDarkMode() {
    const [isDark, setTheme] = useState(readTheme);
    useEffect(() => {
        const sync = () => {
            const dark = readTheme();
            document.documentElement.classList.toggle('dark', dark);
            setTheme(dark);
        };
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        window.addEventListener('theme:changed', sync);
        window.addEventListener('storage', sync);
        media.addEventListener('change', sync);
        return () => {
            window.removeEventListener('theme:changed', sync);
            window.removeEventListener('storage', sync);
            media.removeEventListener('change', sync);
        };
    }, []);
    const setIsDark = useCallback(value => {
        const dark = typeof value === 'function' ? value(readTheme()) : Boolean(value);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', dark);
        window.dispatchEvent(new Event('theme:changed'));
    }, []);
    return [isDark, setIsDark];
}
