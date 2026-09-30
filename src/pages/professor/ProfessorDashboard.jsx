import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    ChevronRight,
    GraduationCap,
    LifeBuoy,
    MapPin,
    Megaphone,
    Users,
} from 'lucide-react';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import { AuthContext } from '../../contexts/AuthContext';

const emptySummary = {
    stats: { totalAlunos: 0, turmasAtivas: 0, informativos: 0, ticketsAbertos: 0, conflitosHorario: 0 },
    proximasAulas: [],
    frequenciaPorTurma: [],
    conflitosHorario: [],
};

const displayClassName = item => item.label && item.label !== `${item.curso} — ${item.local}` ? item.label : item.curso;

const ProfessorDashboard = () => {
    const { user } = useContext(AuthContext);
    const [summary, setSummary] = useState(emptySummary);
    const [informativos, setInformativos] = useState([]);
    const [agendaDate, setAgendaDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const [infoResponse, dashboardResponse] = await Promise.all([
                api.get('/api/informativos', { params: { page: 1, limit: 3, order: 'recent' } }),
                api.get('/api/dashboard/professor', { params: agendaDate ? { date: agendaDate } : {} }),
            ]);
            setSummary({ ...emptySummary, ...dashboardResponse.data, stats: { ...emptySummary.stats, ...dashboardResponse.data.stats } });
            setInformativos(infoResponse.data.items || []);
            setError('');
        } catch (requestError) {
            if (!silent) setError(requestError.message || 'Falha ao carregar os dados do dashboard.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [agendaDate]);

    useEffect(() => {
        fetchData();
        const refresh = () => fetchData({ silent: true });
        const interval = window.setInterval(refresh, 30_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('attendance:updated', refresh);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('attendance:updated', refresh);
        };
    }, [fetchData]);

    if (loading) return <div role="status" aria-label="Carregando painel">
        <div className="skeleton h-9 w-72 max-w-full"/><div className="skeleton mt-3 h-4 w-96 max-w-full"/>
        <div className="mb-8 mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-6">{[0,1,2,3].map(index=><div key={index} className="skeleton min-h-36 rounded-xl"/>)}</div>
        <div className="grid gap-8 lg:grid-cols-2"><div className="skeleton h-72 rounded-xl"/><div className="skeleton h-72 rounded-xl"/></div>
    </div>;
    if (error) return <div className="panel p-10 text-center"><p className="text-danger" role="alert">{error}</p><button type="button" onClick={()=>fetchData()} className="btn btn-secondary mt-4">Tentar novamente</button></div>;

    return <div>
        <h1 className="page-title mb-2">Olá, {user?.nome?.split(' ')[0] || 'professor'}!</h1>
        <p className="page-description mb-8">Acompanhe suas turmas, próximos horários e a frequência registrada em cada uma.</p>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-6">
            <StatCard icon={<Users/>} title="Meus alunos" value={summary.stats.totalAlunos} colorClass="primary" to="/professor/alunos"/>
            <StatCard icon={<GraduationCap/>} title="Minhas turmas" value={summary.stats.turmasAtivas} detail={summary.stats.conflitosHorario?`${summary.stats.conflitosHorario} conflito(s) para revisar`:'Horários organizados'} colorClass={summary.stats.conflitosHorario?'warning':'primary'} to="/professor/turmas"/>
            <StatCard icon={<Megaphone/>} title="Avisos e informativos" value={summary.stats.informativos} colorClass="neutral" to="/professor/informativos"/>
            <StatCard icon={<LifeBuoy/>} title="Chamados em aberto" value={summary.stats.ticketsAbertos} colorClass="neutral" to="/professor/suporte"/>
        </div>

        {summary.conflitosHorario.length>0&&<div className="alert-warning mb-6" role="alert">
            <div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0"/><div><strong className="block text-text-default">Existem turmas no mesmo horário</strong><p className="mt-1 text-sm">Revise {summary.conflitosHorario.map(item=>item.descricao).join('; ')} em <Link to="/professor/turmas" className="font-semibold underline">Minhas turmas</Link>.</p></div></div>
        </div>}

        <div className="mb-8 grid gap-8 lg:grid-cols-2">
            <section className="panel overflow-hidden" aria-labelledby="upcoming-classes-title">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5"><div><h2 id="upcoming-classes-title" className="text-lg font-semibold">Próximas aulas</h2><p className="mt-1 text-sm text-text-muted">Consulte a agenda recorrente por qualquer data.</p></div><CalendarDays aria-hidden="true" className="text-primary"/></div>
                <div className="border-b border-border bg-surface-muted/30 p-4"><label htmlFor="professor-agenda-date" className="form-label">Escolher data</label><div className="flex flex-wrap items-center gap-2"><input id="professor-agenda-date" type="date" value={agendaDate} onChange={event=>setAgendaDate(event.target.value)} className="form-control max-w-xs"/><button type="button" onClick={()=>setAgendaDate('')} className="btn btn-ghost text-sm" disabled={!agendaDate}>Próximos horários</button></div><p className="mt-2 text-xs text-text-muted">As turmas são recorrentes pelo dia da semana. Escolha uma segunda-feira para consultar as aulas desse dia.</p></div>
                {summary.proximasAulas.length?<ul className="divide-y divide-border">{summary.proximasAulas.map((lesson,index)=><li key={`${lesson.id}-${lesson.weekday}-${lesson.start_time}-${index}`} className="p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-text-default">{displayClassName(lesson)}</p><p className="mt-1 text-sm font-medium text-primary">{lesson.data ? `${new Date(`${lesson.data}T12:00:00Z`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})} · ${lesson.descricao}` : lesson.descricao}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted"><MapPin aria-hidden="true" className="h-4 w-4 shrink-0"/>{lesson.local}<span aria-hidden="true">·</span>{Number(lesson.alunos||0)} {Number(lesson.alunos||0)===1?'aluno':'alunos'}</p></div>{lesson.conflito&&<span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">Conflito</span>}</div>
                </li>)}</ul>:<div className="empty-state"><strong className="text-text-default">Nenhum horário definido</strong><p>Abra Minhas turmas para cadastrar os dias e horários das aulas.</p></div>}
                <div className="border-t border-border p-4"><Link to="/professor/turmas" className="btn btn-secondary w-full">Gerenciar horários <ChevronRight aria-hidden="true"/></Link></div>
            </section>

            <section className="panel overflow-hidden" aria-labelledby="class-attendance-title">
                <div className="flex items-center justify-between gap-3 border-b border-border p-5"><div><h2 id="class-attendance-title" className="text-lg font-semibold">Frequência por turma</h2><p className="mt-1 text-sm text-text-muted">Presenças e justificativas entre os registros salvos.</p></div><BarChart3 aria-hidden="true" className="text-primary"/></div>
                {summary.frequenciaPorTurma.length?<ul className="divide-y divide-border">{summary.frequenciaPorTurma.map(item=><li key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-text-default">{displayClassName(item)}</p><p className="mt-1 text-sm text-text-muted">{item.local} · {item.aulas} {item.aulas===1?'aula registrada':'aulas registradas'}</p></div><strong className={item.frequencia===null?'text-sm text-text-muted':'text-xl text-text-default'}>{item.frequencia===null?'Sem chamada':`${item.frequencia}%`}</strong></div>
                    {item.frequencia!==null&&<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label={`Frequência de ${displayClassName(item)}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={item.frequencia}><div className="h-full rounded-full bg-primary" style={{width:`${item.frequencia}%`}}/></div>}
                </li>)}</ul>:<div className="empty-state"><strong className="text-text-default">Nenhuma turma ativa</strong><p>Crie sua primeira oferta em Minhas turmas, informando curso, local e horários.</p></div>}
                <div className="border-t border-border p-4"><Link to="/professor/frequencia" className="btn btn-secondary w-full">Registrar frequência <ChevronRight aria-hidden="true"/></Link></div>
            </section>
        </div>

        <div className="grid grid-cols-1 gap-8">
            <section className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border p-5"><h2 className="text-lg font-semibold">Avisos e informativos</h2><Link to="/professor/informativos" className="flex items-center text-sm font-semibold text-primary hover:underline">Ver todos <ChevronRight aria-hidden="true"/></Link></div>
                <ul className="divide-y divide-border">{informativos.length?informativos.map(info=><li key={info.id} className="p-4 transition-colors hover:bg-surface-hover"><p className="font-semibold">{info.titulo}</p><p className="mt-1 line-clamp-2 text-sm text-text-muted">{String(info.conteudo||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')}</p><p className="mt-2 text-xs text-text-muted">{new Date(info.data_publicacao).toLocaleDateString('pt-BR')}</p></li>):<li className="empty-state"><strong className="text-text-default">Nenhum informativo recente</strong><p>Os próximos avisos da gestão aparecerão aqui.</p></li>}</ul>
            </section>
        </div>
    </div>;
};

export default ProfessorDashboard;
