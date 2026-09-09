import { Users as AlunosIcon, BookOpen as TurmasIcon, GraduationCap as ProfessoresIcon, MessagesSquare as SuporteIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatCard from '../../components/StatCard';
import EnrollmentOverviewChart from '../../components/charts/EnrollmentOverviewChart.jsx';
import RecentActivities from '../../components/RecentActivities';
import StudentDetailsModal from '../../components/StudentDetailsModal';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Dashboard = () => {
    const [dashboard, setDashboard] = useState({ stats: {}, alunosPorTurma: [], ultimasInscricoes: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recentEnrollments, setRecentEnrollments] = useState([]);
    const [recentPeriod, setRecentPeriod] = useState('recentes');
    const [recentPagination, setRecentPagination] = useState({ pagina: 1, temAnterior: false, temProxima: false });
    const [recentLoading, setRecentLoading] = useState(false);
    const [recentError, setRecentError] = useState('');
    const recentRequestId = useRef(0);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [studentDetails, setStudentDetails] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);
    const [studentError, setStudentError] = useState('');
    const [studentRetry, setStudentRetry] = useState(0);
    const { showToast } = useToast();

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        api.get('/api/dashboard/gestor')
            .then(({ data }) => {
                recentRequestId.current += 1;
                setDashboard(data);
                setRecentEnrollments(data.ultimasInscricoes || []);
                setRecentPagination(data.ultimasInscricoesPaginacao || { pagina: 1, temAnterior: false, temProxima: false });
                setRecentPeriod('recentes');
                setRecentError('');
            })
            .catch(error => { setError('Não foi possível carregar o painel.'); showToast(error.message || 'Não foi possível carregar o painel.', 'error'); })
            .finally(() => setLoading(false));
    }, [showToast]);
    useEffect(load, [load]);

    const loadRecentEnrollments = useCallback((period, page = 1) => {
        const requestId = ++recentRequestId.current;
        setRecentPeriod(period);
        setRecentLoading(true);
        setRecentError('');
        api.get(`/api/dashboard/gestor/inscricoes?periodo=${encodeURIComponent(period)}&pagina=${page}`)
            .then(({ data }) => {
                if (requestId !== recentRequestId.current) return;
                setRecentEnrollments(data.inscricoes || []);
                setRecentPagination(data.paginacao || { pagina: page, temAnterior: page > 1, temProxima: false });
            })
            .catch(error => { if (requestId === recentRequestId.current) setRecentError(error.message || 'Não foi possível carregar as inscrições.'); })
            .finally(() => { if (requestId === recentRequestId.current) setRecentLoading(false); });
    }, []);
    useEffect(() => {
        if (!selectedStudentId) return undefined;
        let active = true;
        setStudentLoading(true);
        setStudentError('');
        setStudentDetails(null);
        api.get(`/alunos/${selectedStudentId}`)
            .then(({ data }) => { if (active) setStudentDetails(data); })
            .catch(error => { if (active) setStudentError(error.message || 'Não foi possível carregar o aluno.'); })
            .finally(() => { if (active) setStudentLoading(false); });
        return () => { active = false; };
    }, [selectedStudentId, studentRetry]);

    if (error) return <div className="panel empty-state"><p role="alert">{error}</p><button type="button" onClick={load} className="btn btn-secondary mt-3">Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Visão geral</h1><p className="page-description">Acompanhe alunos, turmas, professores e atendimentos em um só lugar.</p></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6">
                <StatCard to="/gestor/alunos" title="Total de Alunos" value={dashboard.stats.totalAlunos ?? 0} loading={loading} icon={<AlunosIcon />} colorClass="primary" delay="100" />
                <StatCard to="/gestor/cursos" title="Turmas Ativas" value={dashboard.stats.cursosAtivos ?? 0} loading={loading} icon={<TurmasIcon />} colorClass="neutral" delay="200" />
                <StatCard to="/gestor/professores" title="Professores" value={dashboard.stats.professores ?? 0} loading={loading} icon={<ProfessoresIcon />} colorClass="primary" delay="300" />
                <StatCard to="/gestor/suporte" title="Chamados pendentes" value={dashboard.stats.ticketsPendentes ?? 0} loading={loading} icon={<SuporteIcon />} colorClass="warning" delay="400" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section className="panel overflow-hidden xl:col-span-2" aria-labelledby="students-by-class-title">
                    <EnrollmentOverviewChart data={dashboard.alunosPorTurma || []} loading={loading} />
                </section>
                <RecentActivities
                    students={recentEnrollments}
                    period={recentPeriod}
                    onPeriodChange={period => loadRecentEnrollments(period, 1)}
                    page={recentPagination.pagina}
                    hasPrevious={recentPagination.temAnterior}
                    hasNext={recentPagination.temProxima}
                    onPageChange={page => loadRecentEnrollments(recentPeriod, page)}
                    loading={loading || recentLoading}
                    error={recentError}
                    onRetry={() => loadRecentEnrollments(recentPeriod, recentPagination.pagina)}
                    timeZone={dashboard.fusoHorario}
                    onSelectStudent={setSelectedStudentId}
                />
            </div>
            <StudentDetailsModal isOpen={Boolean(selectedStudentId)} onClose={() => setSelectedStudentId(null)} student={studentDetails} loading={studentLoading} error={studentError} onRetry={() => setStudentRetry(value => value + 1)} />
        </>
    );
};

export default Dashboard;
