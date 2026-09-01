import React, { useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import EnrollmentOverviewChart from '../../components/charts/EnrollmentOverviewChart.jsx';
import RecentActivities from '../../components/RecentActivities';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const AlunosIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);

const TurmasIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
    </svg>
);

const ProfessoresIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const SuporteIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const Dashboard = () => {
    const [dashboard, setDashboard] = useState({ stats: {}, alunosPorTurma: [], ultimasInscricoes: [] });
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        api.get('/api/dashboard/gestor')
            .then(({ data }) => setDashboard(data))
            .catch(error => showToast(error.message || 'Não foi possível carregar o painel.', 'error'))
            .finally(() => setLoading(false));
    }, [showToast]);

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Visão geral</h1><p className="page-description">Acompanhe alunos, turmas, professores e atendimentos em um só lugar.</p></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6">
                <StatCard to="/gestor/alunos" title="Total de Alunos" value={dashboard.stats.totalAlunos ?? 0} loading={loading} icon={<AlunosIcon />} colorClass="primary" delay="100" />
                <StatCard to="/gestor/cursos" title="Turmas Ativas" value={dashboard.stats.cursosAtivos ?? 0} loading={loading} icon={<TurmasIcon />} colorClass="neutral" delay="200" />
                <StatCard to="/gestor/professores" title="Professores" value={dashboard.stats.professores ?? 0} loading={loading} icon={<ProfessoresIcon />} colorClass="primary" delay="300" />
                <StatCard to="/gestor/suporte" title="Tickets Pendentes" value={dashboard.stats.ticketsPendentes ?? 0} loading={loading} icon={<SuporteIcon />} colorClass="warning" delay="400" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section className="panel p-4 md:p-6 xl:col-span-2" aria-labelledby="students-by-class-title">
                    <h2 id="students-by-class-title" className="text-lg font-semibold text-text-default">Alunos por turma</h2>
                    <p className="mt-1 text-sm text-text-muted">Quantidade de alunos atualmente matriculados em cada turma ativa.</p>
                    <div className="mt-4" style={{ position: 'relative', height: '40vh', minHeight: '320px' }}>
                        {loading ? <div className="skeleton h-full rounded-xl" /> : <EnrollmentOverviewChart data={dashboard.alunosPorTurma || []} />}
                    </div>
                </section>
                <RecentActivities students={dashboard.ultimasInscricoes || []} />
            </div>
        </>
    );
};

export default Dashboard;
