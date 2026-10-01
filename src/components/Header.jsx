import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import useDarkMode from '../hooks/useDarkMode';
import ProfileAvatar from './ProfileAvatar';
import { Menu, X, ChevronDown, UserRound, Sun, Moon, LogOut } from 'lucide-react';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
    const location = useLocation();
    const pageNames = {
        '/gestor/dashboard': 'Visão geral',
        '/gestor/cursos': 'Turmas',
        '/gestor/alunos': 'Alunos',
        '/gestor/professores': 'Professores',
        '/gestor/informativos': 'Informativos',
        '/gestor/suporte': 'Central de Suporte',
        '/aluno/dashboard': 'Visão geral',
        '/aluno/perfil': 'Meus dados',
        '/aluno/turmas': 'Minhas turmas',
        '/aluno/cursos': 'Meus cursos',
        '/aluno/calendario': 'Calendário de aulas',
        '/aluno/frequencia': 'Minha frequência',
        '/aluno/informativos': 'Meus cursos',
        '/aluno/notificacoes': 'Notificações',
        '/professor/dashboard': 'Visão geral',
        '/professor/turmas': 'Minhas turmas',
        '/professor/alunos': 'Meus alunos',
        '/professor/frequencia': 'Chamada',
        '/professor/relatorios': 'Meus relatórios',
        '/professor/informativos': 'Informativos e avisos',
        '/professor/suporte': 'Suporte',
        '/configuracoes': 'Configurações da conta',
    };
    const pageName = pageNames[location.pathname] || (location.pathname.startsWith('/aluno/cursos/') ? 'Meu curso' : 'Projeto Aprendiz');
    const triggerRef = useRef(null);
    const { user, logout } = useContext(AuthContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [isDark, setIsDark] = useDarkMode();
    const [photoVersion, setPhotoVersion] = useState(Date.now());

    useEffect(() => {
        const clickHandler = ({ target }) => {
            if (!dropdownRef.current || dropdownRef.current.contains(target)) return;
            setDropdownOpen(false);
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    }, []);

    useEffect(() => {
        const refreshPhoto = () => setPhotoVersion(Date.now());
        window.addEventListener('profile-photo:updated', refreshPhoto);
        return () => window.removeEventListener('profile-photo:updated', refreshPhoto);
    }, []);

    useEffect(() => {
        if (!dropdownOpen) return;
        const keyDown = event => {
            if (event.key === 'Escape') { setDropdownOpen(false); triggerRef.current?.focus(); }
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            const items = [...dropdownRef.current.querySelectorAll('[role="menuitem"]')];
            const index = items.indexOf(document.activeElement);
            items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        };
        const container = dropdownRef.current;
        container.addEventListener('keydown', keyDown);
        return () => container.removeEventListener('keydown', keyDown);
    }, [dropdownOpen]);

    return (
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/95 px-3 backdrop-blur-md sm:h-[76px] sm:px-5 lg:px-6">
            <button id="menu-button" type="button" aria-label={sidebarOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'} aria-controls="sidebar" aria-expanded={sidebarOpen} className={`icon-button mr-2 lg:hidden ${sidebarOpen ? 'menu-open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <div className="flex min-w-0 flex-1 justify-start">
                <p className="truncate text-sm font-semibold text-text-default">{pageName}</p>
            </div>
            <div className="relative flex items-center" ref={dropdownRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false); }}>
                <button ref={triggerRef} type="button" aria-label="Abrir menu da conta" aria-haspopup="menu" aria-expanded={dropdownOpen} onClick={() => setDropdownOpen(!dropdownOpen)} className="group flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-xl p-1.5 transition hover:bg-surface-hover">
                    <ProfileAvatar name={user?.nome} src={`/api/profile-photo?v=${photoVersion}`} className="h-9 w-9" />
                    <span className="hidden max-w-40 text-left sm:block"><span className="block truncate text-sm font-semibold">{user?.nome}</span><span className="block text-xs text-text-muted">{user?.role === 'gestor' ? 'Gestor' : user?.role === 'aluno' ? 'Aluno' : 'Professor'}</span></span><ChevronDown aria-hidden="true" className={`!h-4 !w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <div
                    id="profile-dropdown"
                    role="menu"
                    className={`absolute right-0 top-12 z-50 mt-2 w-56 origin-top-right rounded-xl border border-border bg-surface shadow-lg transition-all duration-200 ease-out ${dropdownOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0 pointer-events-none'}`}
                >
                    <div className="border-b border-border px-4 py-3">
                        <p className="truncate text-sm font-medium text-text-default">{user?.nome}</p>
                        <p className="truncate text-xs text-text-muted">{user?.email}</p>
                    </div>

                    <div className="py-1">
                        <Link to="/configuracoes" role="menuitem" onClick={() => setDropdownOpen(false)} className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm text-text-default hover:bg-surface-hover hover:text-primary transition-colors">
                            <UserRound aria-hidden="true" />
                            Editar Perfil
                        </Link>

                        <button role="menuitem" type="button" onClick={() => { setIsDark(!isDark); setDropdownOpen(false); }} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-sm text-text-default hover:bg-surface-hover hover:text-primary transition-colors">
                            {isDark ? (
                                <>
                                    <Sun aria-hidden="true" />
                                    Tema Claro
                                </>
                            ) : (
                                <>
                                    <Moon aria-hidden="true" />
                                    Tema Escuro
                                </>
                            )}
                        </button>
                    </div>

                    <div className="border-t border-border py-1">
                        <button role="menuitem" type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-sm text-text-default hover:bg-surface-hover hover:text-danger transition-colors">
                            <LogOut aria-hidden="true" />
                            Sair
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
