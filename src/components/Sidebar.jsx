import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
import { AuthContext } from '../contexts/AuthContext';
import useDarkMode from '../hooks/useDarkMode';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const [isDark, setIsDark] = useDarkMode();

    const toggleTheme = () => {
        setIsDark(!isDark);
    };
    
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'gestor';

    const navLinks = [
        { path: "/dashboard", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>, label: "Dashboard", role: ['gestor', 'professor'] },
        { path: "/cursos", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v11.494m-9-5.747h18"></path></svg>, label: "Cursos", role: ['gestor'] },
        { path: "/alunos", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>, label: "Alunos", role: ['gestor', 'professor'] },
        { path: "/professores", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>, label: "Professores", role: ['gestor'] },
        { path: "/relatorios", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>, label: "Relatórios", role: ['gestor', 'professor'] },
        { path: "/informativos", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>, label: "Informativos", role: ['gestor', 'professor'] },
        { path: "/suporte", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>, label: "Suporte", role: ['gestor', 'professor'] },
        { path: "/configuracoes", icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>, label: "Configurações", role: ['gestor', 'professor'] }
    ];

    if (userRole === 'professor') {
        navLinks.splice(2, 0, {
            path: '/frequencia',
            icon: <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
            label: 'Frequência',
            role: ['professor'],
        });
    }

    return (
        <aside id="sidebar" aria-label="Menu principal" className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col text-text-inverse shadow-lg ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
            <div className="flex items-center justify-center h-20 border-b border-white/10 px-6 shrink-0">
                <img src={Logo} alt="Projeto Aprendiz" className="h-12 w-auto" />
            </div>
            <nav aria-label="Seções da aplicação" className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
                {navLinks.filter(link => link.role.includes(userRole)).map(link => (
                    <NavLink
                        key={link.label}
                        to={link.path === '/configuracoes' ? link.path : `/${userRole}${link.path}`}
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                        }
                        onClick={() => setSidebarOpen(false)}
                    >
                        {link.icon}
                        {link.label}
                    </NavLink>
                ))}
                <div className="mt-auto pt-4 border-t border-white/10">
                    <button type="button" onClick={toggleTheme} aria-pressed={isDark} className="flex min-h-11 w-full items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-white/10">
                        {isDark ? (
                             <svg id="theme-icon-dark" className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        ) : (
                           <svg id="theme-icon-light" className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                        )}
                        <span>{isDark ? 'Tema Claro' : 'Tema Escuro'}</span>
                    </button>
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
