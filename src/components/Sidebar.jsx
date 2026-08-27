import React, { useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import {
  DashboardIcon,
  AlunosIcon,
  ProfessoresIcon,
  TurmasIcon,
  CursosIcon,
  LocaisIcon,
  FrequenciaIcon,
  RelatoriosIcon,
  InformativosIcon,
  SuporteIcon,
  ConfiguracoesIcon,
  ChevronLeftIcon,
} from './icons/index.jsx';

/* ── Nav item structure ──────────────────────────────────────────────────── */
const GESTOR_LINKS = [
  {
    group: 'Visão Geral',
    items: [
      { path: '/dashboard',   icon: DashboardIcon,   label: 'Dashboard' },
    ],
  },
  {
    group: 'Operação',
    items: [
      { path: '/alunos',      icon: AlunosIcon,      label: 'Alunos' },
      { path: '/cursos',      icon: TurmasIcon,       label: 'Turmas' },
      { path: '/frequencia',  icon: FrequenciaIcon,  label: 'Frequência' },
    ],
  },
  {
    group: 'Estrutura',
    items: [
      { path: '/catalogo',    icon: CursosIcon,      label: 'Catálogo' },
      { path: '/professores', icon: ProfessoresIcon, label: 'Professores' },
    ],
  },
  {
    group: 'Comunicação',
    items: [
      { path: '/informativos', icon: InformativosIcon, label: 'Informativos',  badge: 'announce' },
      { path: '/suporte',      icon: SuporteIcon,      label: 'Suporte',       badge: 'support' },
    ],
  },
  {
    group: 'Análise',
    items: [
      { path: '/relatorios',  icon: RelatoriosIcon,  label: 'Relatórios' },
    ],
  },
];

const PROFESSOR_LINKS = [
  {
    group: 'Início',
    items: [
      { path: '/dashboard',   icon: DashboardIcon,   label: 'Dashboard' },
    ],
  },
  {
    group: 'Minha Rotina',
    items: [
      { path: '/frequencia',  icon: FrequenciaIcon,  label: 'Frequência' },
      { path: '/alunos',      icon: AlunosIcon,      label: 'Alunos' },
    ],
  },
  {
    group: 'Comunicação',
    items: [
      { path: '/informativos', icon: InformativosIcon, label: 'Informativos', badge: 'announce' },
      { path: '/suporte',      icon: SuporteIcon,      label: 'Suporte',      badge: 'support' },
    ],
  },
  {
    group: 'Análise',
    items: [
      { path: '/relatorios',  icon: RelatoriosIcon,  label: 'Relatórios' },
    ],
  },
];

/* ── Sidebar Component ────────────────────────────────────────────────────── */
const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { user } = useContext(AuthContext);
  const userRole = user?.role || 'gestor';
  const location = useLocation();

  const [supportUnread, setSupportUnread] = useState(0);
  const [announcementUnread, setAnnouncementUnread] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('sidebarCollapsed') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }, [isCollapsed]);

  const refreshSupportUnread = useCallback(async () => {
    try {
      const r = await api.get('/api/suporte/nao-lidos');
      setSupportUnread(Number(r.data.total || 0));
    } catch { setSupportUnread(0); }
  }, []);

  const refreshAnnouncementUnread = useCallback(async () => {
    if (userRole !== 'professor') { setAnnouncementUnread(0); return; }
    try {
      const r = await api.get('/api/informativos/nao-lidos');
      setAnnouncementUnread(Number(r.data.total || 0));
    } catch { setAnnouncementUnread(0); }
  }, [userRole]);

  useEffect(() => {
    refreshSupportUnread();
    refreshAnnouncementUnread();
    const i1 = setInterval(refreshSupportUnread, 30_000);
    const i2 = setInterval(refreshAnnouncementUnread, 30_000);
    const onFocus = () => { refreshSupportUnread(); refreshAnnouncementUnread(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('support:updated', refreshSupportUnread);
    window.addEventListener('announcements:updated', refreshAnnouncementUnread);
    return () => {
      clearInterval(i1); clearInterval(i2);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('support:updated', refreshSupportUnread);
      window.removeEventListener('announcements:updated', refreshAnnouncementUnread);
    };
  }, [refreshSupportUnread, refreshAnnouncementUnread]);

  const getBadge = (badge) => {
    if (badge === 'support') return supportUnread;
    if (badge === 'announce') return userRole === 'professor' ? announcementUnread : 0;
    return 0;
  };

  const groups = userRole === 'professor' ? PROFESSOR_LINKS : GESTOR_LINKS;

  const closeMobile = () => setSidebarOpen(false);

  return (
    <aside
      id="sidebar"
      aria-label="Menu principal"
      className={[
        'fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col text-white',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        isCollapsed ? 'lg:w-[72px] w-64' : 'w-64',
        'transition-all duration-250 ease-in-out',
      ].join(' ')}
    >
      {/* ── Logo / brand bar ─────────────────────────────────────────────── */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/8 px-4">
        <div className={`flex items-center gap-3 overflow-hidden transition-all duration-250 ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-full opacity-100'}`}>
          <img
            src={Logo}
            alt="Projeto Aprendiz"
            className="h-7 w-auto shrink-0"
          />
        </div>
        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeftIcon className={`w-4 h-4 transition-transform duration-250 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── Nav groups ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-3">
        <nav aria-label="Navegação principal" className="flex-1 px-2 space-y-5">
          {groups.map((group) => (
            <div key={group.group}>
              {/* Group label — hidden when collapsed */}
              {!isCollapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35 lg:block">
                  {group.group}
                </p>
              )}
              <ul className="space-y-0.5" role="list">
                {group.items.map(({ path, icon: Icon, label, badge }) => {
                  const badgeCount = getBadge(badge);
                  const fullPath = `/${userRole}${path}`;
                  const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');

                  return (
                    <li key={path}>
                      <NavLink
                        to={fullPath}
                        title={isCollapsed ? label : undefined}
                        onClick={closeMobile}
                        className={[
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/65 hover:bg-white/8 hover:text-white',
                        ].join(' ')}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-white"
                          />
                        )}

                        {React.createElement(Icon, { className: 'w-5 h-5 shrink-0', 'aria-hidden': true })}

                        <span className={[
                          'whitespace-nowrap transition-all duration-250 overflow-hidden',
                          isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0' : 'opacity-100',
                        ].join(' ')}>
                          {label}
                        </span>

                        {badgeCount > 0 && (
                          <span
                            className={[
                              'ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold bg-white text-primary',
                              isCollapsed ? 'lg:absolute lg:right-1 lg:top-1' : '',
                            ].join(' ')}
                            aria-label={`${badgeCount} não lido(s)`}
                          >
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <div className="mt-auto border-t border-white/8 px-2 pt-3">
          <NavLink
            to={`/${userRole}/configuracoes`}
            title={isCollapsed ? 'Configurações' : undefined}
            onClick={closeMobile}
            className={({ isActive }) => [
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
              isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white',
            ].join(' ')}
          >
            <ConfiguracoesIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className={`whitespace-nowrap transition-all duration-250 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'}`}>
              Configurações
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
