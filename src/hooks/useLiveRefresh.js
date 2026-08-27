import { useEffect, useRef } from 'react';

const useLiveRefresh = (refresh, { intervalMs = 15000, eventName, enabled = true } = {}) => {
    const refreshRef = useRef(refresh);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        if (!enabled) return undefined;
        let running = false;
        let mounted = true;

        const run = async () => {
            if (!mounted || running || document.visibilityState === 'hidden') return;
            running = true;
            try {
                await refreshRef.current();
            } catch (error) {
                console.error('Não foi possível atualizar os dados em segundo plano:', error);
            } finally {
                running = false;
            }
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') void run();
        };

        const interval = window.setInterval(run, intervalMs);
        window.addEventListener('focus', run);
        document.addEventListener('visibilitychange', handleVisibility);
        if (eventName) window.addEventListener(eventName, run);

        return () => {
            mounted = false;
            window.clearInterval(interval);
            window.removeEventListener('focus', run);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (eventName) window.removeEventListener(eventName, run);
        };
    }, [enabled, eventName, intervalMs]);
};

export default useLiveRefresh;
