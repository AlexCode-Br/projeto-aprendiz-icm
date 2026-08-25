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

    return (
        <header className="relative flex items-center justify-between h-20 px-4 md:px-6 bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-20 shrink-0">
            <button id="menu-button" className={`md:hidden text-text-muted ${sidebarOpen ? 'menu-open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
                <svg className="w-6 h-6 icon-hamburger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                <svg className="w-6 h-6 icon-close" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="flex-1 flex justify-center md:justify-start">
                <h1 className="text-xl sm:text-2xl font-semibold text-text-default truncate">Projeto Aprendiz 2025</h1>
            </div>
            <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-3 group">
                    <img className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-surface ring-primary/70 group-hover:ring-primary transition-all duration-300" src="https://placehold.co/100x100/b71c1c/FFFFFF?text=A" alt="Avatar do Administrador" />
                    <div className="hidden md:block text-left">
                        <div className="font-medium text-text-default">{user?.nome}</div>
                        <div className="text-sm text-text-muted">{user?.email}</div>
                    </div>
                </button>
                <div 
                    id="profile-dropdown" 
                    className={`absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 z-50 transition-all duration-200 ease-out origin-top-right ${dropdownOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}
                >
                    <Link to="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        Editar Perfil
                    </Link>
                    <button type="button" onClick={logout} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Sair
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
