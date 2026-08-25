import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
    const { user, logout } = useContext(AuthContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const clickHandler = ({ target }) => {
            if (!dropdownRef.current || dropdownRef.current.contains(target)) return;
            setDropdownOpen(false);
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    }, []);

    const initial = user?.nome?.trim()?.charAt(0)?.toUpperCase() || 'U';
    const roleLabel = user?.role === 'professor' ? 'Professor' : 'Gestor';

    return (
        <header className="relative sticky top-0 z-20 flex h-20 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-3 backdrop-blur-md sm:px-5 lg:px-6">
            <button id="menu-button" type="button" aria-label={sidebarOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'} aria-controls="sidebar" aria-expanded={sidebarOpen} className={`icon-button mr-2 lg:hidden ${sidebarOpen ? 'menu-open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
                <svg className="w-6 h-6 icon-hamburger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                <svg className="w-6 h-6 icon-close" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="flex min-w-0 flex-1 justify-start">
                <p className="truncate text-lg font-semibold text-text-default sm:text-xl">Projeto Aprendiz</p>
            </div>
            <div className="relative" ref={dropdownRef}>
                <button type="button" aria-label="Abrir menu da conta" aria-haspopup="menu" aria-expanded={dropdownOpen} onClick={() => setDropdownOpen(!dropdownOpen)} className="group flex min-h-11 min-w-11 items-center justify-end gap-3 rounded-lg">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white ring-2 ring-primary/25 ring-offset-2 ring-offset-surface transition group-hover:ring-primary/60">{initial}</span>
                    <span className="hidden max-w-52 text-left lg:block">
                        <span className="block truncate text-sm font-medium text-text-default">{user?.nome}</span>
                        <span className="block truncate text-xs text-text-muted">{roleLabel} · {user?.email}</span>
                    </span>
                </button>
                <div 
                    id="profile-dropdown" 
                    role="menu"
                    className={`absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-xl border border-border bg-surface py-1.5 shadow-lg transition-all duration-200 ease-out ${dropdownOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0 pointer-events-none'}`}
                >
                    <Link to="/configuracoes" role="menuitem" onClick={() => setDropdownOpen(false)} className="flex min-h-11 items-center px-4 py-2 text-sm text-text-default hover:bg-gray-100 hover:text-primary dark:hover:bg-white/10">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        Editar Perfil
                    </Link>
                    <button role="menuitem" type="button" onClick={logout} className="flex min-h-11 w-full items-center px-4 py-2 text-sm text-text-default hover:bg-gray-100 hover:text-primary dark:hover:bg-white/10">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Sair
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
