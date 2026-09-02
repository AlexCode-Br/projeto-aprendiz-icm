import React, { useCallback, useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../assets/projeto-aprendiz-logo.png';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';
import { LayoutDashboard, BookOpen, Users, GraduationCap, ChartNoAxesCombined, Megaphone, MessagesSquare, CalendarCheck2, Settings, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const asideRef = React.useRef(null);
    useEffect(() => { setSidebarOpen(false); }, [location.pathname, setSidebarOpen]);
    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const previous = document.activeElement;
        asideRef.current?.querySelector('[data-mobile-close]')?.focus();
        const close = event => {
            if (event.key === 'Escape') setSidebarOpen(false);
            if (event.key !== 'Tab' || window.matchMedia('(min-width: 1024px)').matches) return;
            const items = [...asideRef.current.querySelectorAll('a,button')].filter(item => item.getClientRects().length);
            if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
        };
        document.addEventListener('keydown', close);
        return () => { document.removeEventListener('keydown', close); previous?.focus?.(); };
    }, [sidebarOpen, setSidebarOpen]);
    const userRole = user?.role || 'gestor';
    const [supportUnread,setSupportUnread]=useState(0);
    const [announcementUnread,setAnnouncementUnread]=useState(0);

    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }, [isCollapsed]);

    const refreshSupportUnread=useCallback(async()=>{
        try { const response=await api.get('/api/suporte/nao-lidos');setSupportUnread(Number(response.data.total||0)); }
        catch { setSupportUnread(0); }
    },[]);

    const refreshAnnouncementUnread=useCallback(async()=>{
        if(userRole!=='professor'){setAnnouncementUnread(0);return;}
        try { const response=await api.get('/api/informativos/nao-lidos');setAnnouncementUnread(Number(response.data.total||0)); }
        catch { setAnnouncementUnread(0); }
    },[userRole]);

    useEffect(()=>{
        refreshSupportUnread();
        const interval=setInterval(refreshSupportUnread,30000);
        window.addEventListener('focus',refreshSupportUnread);
        window.addEventListener('support:updated',refreshSupportUnread);
        return()=>{clearInterval(interval);window.removeEventListener('focus',refreshSupportUnread);window.removeEventListener('support:updated',refreshSupportUnread);};
    },[refreshSupportUnread,userRole]);

    useEffect(()=>{
        refreshAnnouncementUnread();
        const interval=setInterval(refreshAnnouncementUnread,30000);
        window.addEventListener('focus',refreshAnnouncementUnread);
        window.addEventListener('announcements:updated',refreshAnnouncementUnread);
        return()=>{clearInterval(interval);window.removeEventListener('focus',refreshAnnouncementUnread);window.removeEventListener('announcements:updated',refreshAnnouncementUnread);};
    },[refreshAnnouncementUnread]);

    const navLinks = [
        { path: "/dashboard", icon: <LayoutDashboard aria-hidden="true" />, label: "Dashboard", role: ['gestor', 'professor'] },
        { path: "/cursos", icon: <BookOpen aria-hidden="true" />, label: "Cursos", role: ['gestor'] },
        { path: "/alunos", icon: <Users aria-hidden="true" />, label: "Alunos", role: ['gestor', 'professor'] },
        { path: "/professores", icon: <GraduationCap aria-hidden="true" />, label: "Professores", role: ['gestor'] },
        { path: "/relatorios", icon: <ChartNoAxesCombined aria-hidden="true" />, label: "Relatórios", role: ['professor'] },
        { path: "/informativos", icon: <Megaphone aria-hidden="true" />, label: "Informativos", role: ['gestor', 'professor'], unread: userRole==='professor'?announcementUnread:0 },
        { path: "/suporte", icon: <MessagesSquare aria-hidden="true" />, label: "Suporte", role: ['gestor', 'professor'], unread: supportUnread },
    ];

    if (userRole === 'professor') {
        navLinks.splice(2, 0, {
            path: '/frequencia',
            icon: <CalendarCheck2 aria-hidden="true" />,
            label: 'Frequência',
            role: ['professor'],
        });
    }

    const configuracoesLink = {
        path: "/configuracoes",
        icon: <Settings aria-hidden="true" />,
        label: "Configurações",
        role: ['gestor', 'professor']
    };

    return (
        <aside
            id="sidebar"
            ref={asideRef}
            aria-label="Menu principal"
            className={`${sidebarOpen ? 'visible' : 'invisible lg:visible'} fixed inset-y-0 left-0 z-40 flex shrink-0 transform flex-col text-text-inverse shadow-lg transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64 ${isCollapsed ? 'lg:w-20' : ''}`}
        >
            <div className={`flex items-center h-[76px] border-b border-white/10 px-4 shrink-0 overflow-hidden ${isCollapsed ? 'lg:justify-center justify-between' : 'justify-between'}`}>
                <div className={`flex flex-col items-start overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:w-0 lg:opacity-0 w-full opacity-100' : 'w-full opacity-100'}`}>
                    <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="h-14 w-40 object-contain brightness-0 invert" />
                </div>
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex items-center justify-center min-w-10 min-h-10 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
                    title={isCollapsed ? "Expandir" : "Recolher"}
                >
                    {isCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                </button>
                <button type="button" data-mobile-close onClick={() => setSidebarOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 lg:hidden" aria-label="Fechar menu"><X aria-hidden="true" /></button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-3">
                <p className={`mb-4 mt-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 ${isCollapsed ? 'lg:sr-only' : ''}`}>{userRole === 'gestor' ? 'Área do gestor' : 'Área do professor'}</p>
                <nav aria-label="Seções principais" className="flex-1 space-y-1.5">
                    {navLinks.filter(link => link.role.includes(userRole)).map(link => (
                        <NavLink
                            key={link.label}
                            to={`/${userRole}${link.path}`}
                            title={isCollapsed ? link.label : undefined}
                            className="sidebar-link"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <div className="flex shrink-0 items-center justify-center">{link.icon}</div>
                            <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0 lg:-ml-3 w-auto opacity-100' : 'w-auto opacity-100'}`}>
                                {link.label}
                            </span>
                            {link.unread>0&&<span className={`ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-black/15 px-1.5 py-0.5 text-xs font-bold text-current ${isCollapsed?'lg:absolute lg:right-1 lg:top-1 lg:min-w-4 lg:px-1 lg:text-[0.6rem]':''}`} aria-label={`${link.unread} item(ns) não lido(s) em ${link.label}`}>{link.unread>99?'99+':link.unread}</span>}
                        </NavLink>
                    ))}
                </nav>

                <nav aria-label="Configurações" className="mt-auto pt-4 border-t border-white/10 space-y-1.5">
                    <NavLink
                        to={configuracoesLink.path}
                        title={isCollapsed ? configuracoesLink.label : undefined}
                        className="sidebar-link"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <div className="flex shrink-0 items-center justify-center">{configuracoesLink.icon}</div>
                        <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0 lg:-ml-3 w-auto opacity-100' : 'w-auto opacity-100'}`}>
                            {configuracoesLink.label}
                        </span>
                    </NavLink>
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;
