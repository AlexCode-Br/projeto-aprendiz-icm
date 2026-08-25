import React, { useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import EnrollmentOverviewChart from '../../components/charts/EnrollmentOverviewChart.jsx';
import RecentActivities from '../../components/RecentActivities';
import LowFrequencyTable from '../../components/LowFrequencyTable.jsx';
import StudentDetailsModal from '../../components/StudentDetailsModal.jsx';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// Ícones para os StatCards
const AlunosIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const CursosIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v11.494m-9-5.747h18"></path></svg>;
const ProfessoresIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>;
const SuporteIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>;

const Dashboard = () => {
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dashboard, setDashboard] = useState({ stats: {}, inscricoesPorCurso: [], ultimasInscricoes: [], baixaFrequencia: [] });
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        api.get('/api/dashboard/gestor').then(({ data }) => setDashboard(data)).catch(error => showToast(error.message, 'error')).finally(() => setLoading(false));
    }, [showToast]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedStudent(null);
    };

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 fade-in-up">
                <h2 className="text-2xl font-bold text-text-default mb-4 sm:mb-0">Dashboard Geral</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                <StatCard to="/gestor/alunos" title="Total de Alunos" value={loading ? '—' : dashboard.stats.totalAlunos} icon={<AlunosIcon />} colorClass="primary" delay="100" />
                <StatCard to="/gestor/cursos" title="Turmas Ativas" value={loading ? '—' : dashboard.stats.cursosAtivos} icon={<CursosIcon />} colorClass="success" delay="200" />
                <StatCard to="/gestor/professores" title="Professores" value={loading ? '—' : dashboard.stats.professores} icon={<ProfessoresIcon />} colorClass="primary" delay="300" />
                <StatCard to="/gestor/suporte" title="Tickets Pendentes" value={loading ? '—' : dashboard.stats.ticketsPendentes} icon={<SuporteIcon />} colorClass="warning" delay="400" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                <div className="xl:col-span-2 p-4 md:p-6 bg-surface rounded-lg shadow-sm fade-in-up delay-500 border border-border">
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
        </>
    );
};

export default Dashboard;
