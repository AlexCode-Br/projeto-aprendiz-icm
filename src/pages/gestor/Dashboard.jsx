import React, { useCallback, useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import EnrollmentOverviewChart from '../../components/charts/EnrollmentOverviewChart.jsx';
import RecentActivities from '../../components/RecentActivities';
import LowFrequencyTable from '../../components/LowFrequencyTable.jsx';
import StudentDetailsModal from '../../components/StudentDetailsModal.jsx';
import AtRiskStudentsTable from '../../components/AtRiskStudentsTable.jsx';
import StudentContactModal from '../../components/StudentContactModal.jsx';
import ClassDecisionTable from '../../components/ClassDecisionTable.jsx';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const MatriculasIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);
const EvasoesIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h8.25m0 0-3-3m3 3-3 3" />
    </svg>
);
const FrequenciaIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4.5-4.5 3.75 3.75L18 6m0 0h-4.5M18 6v4.5M5.25 19.5h13.5" />
    </svg>
);
const ChamadaIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.25H6.75A2.25 2.25 0 004.5 7.5v11.25A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H15M9 5.25A2.25 2.25 0 0111.25 3h1.5A2.25 2.25 0 0115 5.25M9 5.25A2.25 2.25 0 0011.25 7.5h1.5A2.25 2.25 0 0015 5.25m-6 7.5 1.5 1.5 3.75-3.75" />
    </svg>
);
const RiscoIcon = () => (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.865-1.5 3.03-1.5 3.896 0l7.355 12.746zM12 16.5h.008v.008H12V16.5z" /></svg>
);

const Dashboard = () => {
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contactStudent, setContactStudent] = useState(null);
    const [dashboard, setDashboard] = useState({ stats: {}, inscricoesPorCurso: [], ultimasInscricoes: [], baixaFrequencia: [], alunosRisco: [], chamadasPendentes: [] });
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try { const { data } = await api.get('/api/dashboard/gestor'); setDashboard(data); }
        catch (error) { showToast(error.message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedStudent(null);
    };

    const handleSaveContact = async values => {
        if (!contactStudent) return;
        try {
            await api.post(`/api/alunos/${contactStudent.id}/contatos`, values);
            showToast('Contato registrado com sucesso!', 'success');
            setContactStudent(null);
            await fetchDashboard();
        } catch (error) {
            showToast(error.response?.data?.message || error.message || 'Erro ao registrar o contato.', 'error');
            throw error;
        }
    };

    const enrollmentStats = dashboard.stats.novasMatriculas || {};
    const frequencyStats = dashboard.stats.frequencia || {};
    const enrollmentDetail = enrollmentStats.anterior == null ? null : enrollmentStats.anterior === 0
        ? (enrollmentStats.atual ? 'Nenhuma nos 30 dias anteriores' : 'Sem movimento nos dois períodos')
        : `${enrollmentStats.anterior} no período anterior · ${enrollmentStats.variacaoPercentual >= 0 ? '+' : ''}${enrollmentStats.variacaoPercentual}%`;
    const frequencyDetail = frequencyStats.anterior == null
        ? 'Sem base nas quatro semanas anteriores'
        : `Anterior: ${frequencyStats.anterior}% · ${frequencyStats.tendencia >= 0 ? '+' : ''}${frequencyStats.tendencia} p.p.`;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Visão geral</h1><p className="page-description">Acompanhe inscrições, turmas, equipe e frequência em um só lugar.</p></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-5">
                <StatCard to="/gestor/alunos" title="Novas matrículas (30 dias)" value={enrollmentStats.atual ?? 0} detail={enrollmentDetail} loading={loading} icon={<MatriculasIcon />} colorClass="primary" delay="100" />
                <StatCard to="/gestor/relatorios" title="Evasões no período" value={dashboard.stats.evasoes ?? 0} detail="Período letivo selecionado" loading={loading} icon={<EvasoesIcon />} colorClass={dashboard.stats.evasoes ? 'warning' : 'neutral'} delay="200" />
                <StatCard to="/gestor/relatorios" title="Frequência (4 semanas)" value={frequencyStats.atual == null ? 'Sem dados' : `${frequencyStats.atual}%`} detail={frequencyDetail} loading={loading} icon={<FrequenciaIcon />} colorClass={frequencyStats.atual != null && frequencyStats.atual < 75 ? 'warning' : 'primary'} delay="300" />
                <StatCard to="/gestor/cursos" title="Chamadas pendentes" value={dashboard.stats.chamadasPendentes ?? 0} detail="Aulas passadas sem registro" loading={loading} icon={<ChamadaIcon />} colorClass={dashboard.stats.chamadasPendentes ? 'warning' : 'neutral'} delay="400" />
                <StatCard to="#alunos-em-risco" title="Alunos em risco" value={dashboard.stats.alunosRisco ?? 0} detail="Duas ou mais faltas seguidas" loading={loading} icon={<RiscoIcon />} colorClass={dashboard.stats.alunosRisco ? 'warning' : 'neutral'} delay="500" />
            </div>

            <ClassDecisionTable classes={dashboard.stats.turmas} pendingCalls={dashboard.chamadasPendentes} loading={loading} />

            <div id="alunos-em-risco"><AtRiskStudentsTable students={dashboard.alunosRisco} loading={loading} onRegisterContact={setContactStudent} /></div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                <div className="panel p-4 md:p-6 xl:col-span-2">
                    <h3 className="text-lg font-semibold text-text-default">Total de Inscrições por Curso</h3>
                    <div className="mt-4" style={{ position: 'relative', height: '40vh', minHeight: '320px' }}>
                        <EnrollmentOverviewChart data={dashboard.inscricoesPorCurso} />
                    </div>
                </div>
                <RecentActivities students={dashboard.ultimasInscricoes} />
            </div>

            <LowFrequencyTable students={dashboard.baixaFrequencia} onSelectStudent={handleSelectStudent} />

            <StudentDetailsModal
                student={selectedStudent}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
            <StudentContactModal student={contactStudent} isOpen={Boolean(contactStudent)} onClose={() => setContactStudent(null)} onSave={handleSaveContact} />
        </>
    );
};

export default Dashboard;
