import React, { useCallback, useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
import { AuthContext } from '../contexts/AuthContext';
import api from '../services/api';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'gestor';
    const [supportUnread,setSupportUnread]=useState(0);
    const [announcementUnread,setAnnouncementUnread]=useState(0);
    const [attendancePending,setAttendancePending]=useState(0);

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

    const refreshAttendancePending=useCallback(async()=>{
        if(userRole!=='professor'){setAttendancePending(0);return;}
        try { const response=await api.get('/api/frequencia/pendentes');setAttendancePending(Number(response.data.total||0)); }
        catch { setAttendancePending(0); }
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

    useEffect(()=>{
        refreshAttendancePending();
        const interval=setInterval(refreshAttendancePending,30000);
        window.addEventListener('focus',refreshAttendancePending);
        window.addEventListener('attendance:updated',refreshAttendancePending);
        return()=>{clearInterval(interval);window.removeEventListener('focus',refreshAttendancePending);window.removeEventListener('attendance:updated',refreshAttendancePending);};
    },[refreshAttendancePending]);

    const navLinks = [
        { path: "/dashboard", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>, label: "Dashboard", role: ['gestor', 'professor'] },
        { path: "/cursos", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v11.494m-9-5.747h18"></path></svg>, label: "Cursos", role: ['gestor'] },
        { path: "/alunos", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>, label: "Alunos", role: ['gestor', 'professor'] },
        { path: "/professores", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>, label: "Professores", role: ['gestor'] },
        { path: "/relatorios", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>, label: "Relatórios", role: ['gestor', 'professor'] },
        { path: "/informativos", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>, label: "Informativos", role: ['gestor', 'professor'], unread: userRole==='professor'?announcementUnread:0 },
        { path: "/suporte", icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>, label: "Suporte", role: ['gestor', 'professor'], unread: supportUnread },
    ];

    if (userRole === 'professor') {
        navLinks.splice(2, 0, {
            path: '/frequencia',
            icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
            label: 'Frequência',
            role: ['professor'],
            unread: attendancePending,
        });
    }

    const configuracoesLink = {
        path: "/configuracoes",
        icon: <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>,
        label: "Configurações",
        role: ['gestor', 'professor']
    };

    return (
        <aside
            id="sidebar"
            aria-label="Menu principal"
            className={`fixed inset-y-0 left-0 z-40 flex shrink-0 transform flex-col text-text-inverse shadow-lg transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64 ${isCollapsed ? 'lg:w-20' : ''}`}
        >
            <div className={`flex items-center h-20 border-b border-white/10 px-4 shrink-0 overflow-hidden ${isCollapsed ? 'lg:justify-center justify-between' : 'justify-between'}`}>
                <div className={`flex items-center overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:w-0 lg:opacity-0 w-full opacity-100' : 'w-full opacity-100'}`}>
                    <img src={Logo} alt="Projeto Aprendiz" className="h-10 w-auto ml-2" />
                </div>
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex items-center justify-center min-w-10 min-h-10 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
                    title={isCollapsed ? "Expandir" : "Recolher"}
                >
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-3">
                <nav aria-label="Seções principais" className="flex-1 space-y-1.5">
                    {navLinks.filter(link => link.role.includes(userRole)).map(link => (
                        <NavLink
                            key={link.label}
                            to={`/${userRole}${link.path}`}
                            title={isCollapsed ? link.label : undefined}
                            className={({ isActive }) =>
                                `group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
                            }
                            onClick={() => setSidebarOpen(false)}
                        >
                            <div className="flex shrink-0 items-center justify-center">{link.icon}</div>
                            <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0 w-auto opacity-100 ml-3' : 'w-auto opacity-100 ml-3'}`}>
                                {link.label}
                            </span>
                            {link.unread>0&&<span className={`ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-primary ${isCollapsed?'lg:absolute lg:right-1 lg:top-1 lg:min-w-4 lg:px-1 lg:text-[0.6rem]':''}`} aria-label={`${link.unread} item(ns) não lido(s) em ${link.label}`}>{link.unread>99?'99+':link.unread}</span>}
                        </NavLink>
                    ))}
                </nav>

                <nav aria-label="Configurações" className="mt-auto pt-4 border-t border-white/10 space-y-1.5">
                    <NavLink
                        to={configuracoesLink.path}
                        title={isCollapsed ? configuracoesLink.label : undefined}
                        className={({ isActive }) =>
                            `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
                        }
                        onClick={() => setSidebarOpen(false)}
                    >
                        <div className="flex shrink-0 items-center justify-center">{configuracoesLink.icon}</div>
                        <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0 w-auto opacity-100 ml-3' : 'w-auto opacity-100 ml-3'}`}>
                            {configuracoesLink.label}
                        </span>
                    </NavLink>
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;
