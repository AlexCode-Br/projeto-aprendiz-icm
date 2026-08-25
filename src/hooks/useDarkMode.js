import { useState, useEffect } from 'react';

const useDarkMode = () => {
    // Inicializa o estado buscando o tema do localStorage ou a preferência do sistema
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme) {
                return storedTheme === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Efeito que aplica/remove a classe 'dark' no <html> e salva no localStorage
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    return [isDark, setIsDark];
};

export default useDarkMode;