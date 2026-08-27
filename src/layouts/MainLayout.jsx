import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const MainLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-dvh min-h-screen overflow-hidden bg-background">
            <a href="#main-content" className="sr-only z-[60] rounded-lg bg-surface px-4 py-3 text-text-default shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ir para o conteúdo principal</a>
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            
            <button
                type="button"
                aria-label="Fechar menu de navegação"
                id="sidebar-overlay" 
                className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setSidebarOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                <main id="main-content" tabIndex="-1" className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
                    <div className="page-shell">{children}</div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
