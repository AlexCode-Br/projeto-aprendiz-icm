import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import useDarkMode from '../hooks/useDarkMode';
import {
  MenuIcon,
  CloseIcon,
  SunIcon,
  MoonIcon,
  LogoutIcon,
  UserCircleIcon,
  ConfiguracoesIcon,
} from './icons/index.jsx';

/* Map route segments to human-readable page titles */
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  alunos:       'Alunos',
  professores:  'Professores',
  cursos:       'Turmas',
  catalogo:     'Catálogo de Cursos',
  frequencia:   'Frequência',
  relatorios:   'Relatórios',
  informativos: 'Informativos',
  suporte:      'Suporte',
  configuracoes:'Configurações',
};

function getPageTitle(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  // segments[0] is role ('gestor'|'professor'), segments[1] is page
  const page = segments[1];
  // If third segment exists it's likely a detail page — don't show the id
  if (segments[2] && isNaN(Number(segments[2]))) return PAGE_TITLES[segments[2]] || '';
  return PAGE_TITLES[page] || '';
}

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useContext(AuthContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isDark, setIsDark] = useDarkMode();
  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initial = user?.nome?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const roleName = user?.role === 'gestor' ? 'Gestor' : 'Professor';

  return (
    <header className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-sm sm:px-5">
      {/* Mobile menu toggle */}
      <button
        id="menu-button"
        type="button"
        aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-controls="sidebar"
        aria-expanded={sidebarOpen}
        className={`icon-btn mr-1 lg:hidden ${sidebarOpen ? 'menu-open' : ''}`}
        onClick={() => setSidebarOpen(s => !s)}
      >
        <MenuIcon className="w-5 h-5 icon-hamburger" />
        <CloseIcon className="w-5 h-5 icon-close" />
      </button>

      {/* Page title */}
      <div className="flex min-w-0 flex-1">
        {pageTitle && (
          <h1 className="truncate text-base font-semibold text-text-default sm:text-[15px]">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          type="button"
          aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          className="icon-btn"
          onClick={() => setIsDark(!isDark)}
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Menu da conta"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen(d => !d)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-semibold text-sm text-white ring-2 ring-primary/20 ring-offset-2 ring-offset-surface transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true">{initial}</span>
          </button>

          {/* Dropdown menu */}
          <div
            role="menu"
            aria-label="Opções da conta"
            className={[
              'absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-surface shadow-lg',
              'transition-all duration-150 origin-top-right',
              dropdownOpen ? 'scale-100 opacity-100 visible' : 'scale-95 opacity-0 invisible pointer-events-none',
            ].join(' ')}
          >
            {/* User info */}
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-text-default">{user?.nome}</p>
              <p className="text-xs text-text-muted mt-0.5">{roleName} · {user?.email}</p>
            </div>

            <div className="py-1">
              <Link
                to="/configuracoes"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-text-default hover:bg-surface-hover hover:text-primary transition-colors min-h-[2.25rem]"
              >
                <ConfiguracoesIcon className="w-4 h-4" aria-hidden="true" />
                Configurações de perfil
              </Link>
            </div>

            <div className="border-t border-border py-1">
              <button
                role="menuitem"
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-default hover:bg-danger-bg hover:text-danger transition-colors min-h-[2.25rem]"
              >
                <LogoutIcon className="w-4 h-4" aria-hidden="true" />
                Sair do sistema
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
