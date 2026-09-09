import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PageSkeleton from '../components/PageSkeleton';

const MainLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const mainRef = useRef(null);
    const location = useLocation();
    useLayoutEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        root.classList.add('app-shell-active');
        body.classList.add('app-shell-active');
        root.scrollTop = 0;
        body.scrollTop = 0;
        return () => {
            root.classList.remove('app-shell-active');
            body.classList.remove('app-shell-active');
        };
    }, []);
    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 1024px)');
        const closeMobileMenu = () => { if (desktop.matches) setSidebarOpen(false); };
        desktop.addEventListener('change', closeMobileMenu);
        return () => desktop.removeEventListener('change', closeMobileMenu);
    }, []);
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 });
        mainRef.current?.focus({ preventScroll: true });
    }, [location.pathname]);

    return (
        <div className="app-shell flex overflow-hidden bg-background">
            <a href="#main-content" className="sr-only z-[60] rounded-lg bg-surface px-4 py-3 text-text-default shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ir para o conteúdo principal</a>
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            
            <button
                type="button"
                aria-label="Fechar menu de navegação"
                id="sidebar-overlay" 
                className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setSidebarOpen(false)}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col" {...(sidebarOpen ? { inert: '' } : {})}>
                <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                <main ref={mainRef} id="main-content" tabIndex="-1" className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none sm:p-6 lg:p-8">
                    <div className="page-shell"><React.Suspense fallback={<PageSkeleton />}>{children}</React.Suspense></div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
