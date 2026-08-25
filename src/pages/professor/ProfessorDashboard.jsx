import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';

// --- Ícones SVG ---
const StudentsIcon = () => <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const BellIcon = () => <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>;
const CalendarIcon = () => <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>;
const CheckCircleIcon = () => <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const ChevronRightIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>;


// --- Componente StatCard ---
const StatCard = ({ icon, title, value, color, to }) => (
    <Link to={to} className={`stat-card flex items-center p-5 rounded-xl shadow-lg text-white transition-transform transform hover:-translate-y-1 ${color}`}>
        <div className="mr-5 p-4 bg-white/20 rounded-full">
            {icon}
        </div>
        <div>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm uppercase font-semibold tracking-wider">{title}</div>
        </div>
    </Link>
);


const ProfessorDashboard = () => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState({
        totalAlunos: 0,
        totalInformativos: 0,
        proximaAula: 'A definir',
        frequenciaMedia: 'Sem aulas',
    });
    const [recentStudents, setRecentStudents] = useState([]);
    const [informativos, setInformativos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [studentResponse, infoResponse, dashboardResponse] = await Promise.all([
                api.get('/api/professores/me/alunos'),
                api.get('/api/informativos?limit=3'),
                api.get('/api/dashboard/professor')
            ]);
            
            const studentData = studentResponse.data.alunos || [];
            
            const summary = dashboardResponse.data;
            setStats({
                totalAlunos: summary.stats.totalAlunos,
                totalInformativos: summary.stats.informativos,
                proximaAula: summary.proximaAula?.descricao || 'A definir',
                frequenciaMedia: summary.stats.frequenciaMedia === null ? 'Sem aulas' : `${summary.stats.frequenciaMedia}%`,
            });

            setRecentStudents(studentData.slice(0, 5));
            setInformativos(infoResponse.data.sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao)).slice(0, 3));
            
            setError(null);
        } catch (err) {
            setError("Falha ao carregar os dados do dashboard.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    if (loading) return <div className="text-center p-10 text-text-muted">Carregando dashboard...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        <div className="fade-in-up">
            <h2 className="text-2xl md:text-3xl font-bold text-text-default mb-2">
                Olá, Professor(a) {user?.nome.split(' ')[0]}!
            </h2>
            <p className="text-text-muted mb-8">Aqui está um resumo das suas atividades.</p>

            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard icon={<StudentsIcon />} title="Meus Alunos" value={stats.totalAlunos} color="bg-gradient-to-br from-blue-500 to-blue-600" to="/professor/alunos" />
                <StatCard icon={<BellIcon />} title="Avisos/Informativos" value={stats.totalInformativos} color="bg-gradient-to-br from-yellow-500 to-yellow-600" to="/professor/informativos" />
                <StatCard icon={<CalendarIcon />} title="Próxima Aula" value={stats.proximaAula} color="bg-gradient-to-br from-red-500 to-red-600" to="/professor/frequencia" />
                <StatCard icon={<CheckCircleIcon />} title="Frequência Média" value={stats.frequenciaMedia} color="bg-gradient-to-br from-green-500 to-green-600" to="/professor/frequencia" />
            </div>

            {/* Grid de Alunos Recentes e Informativos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Últimos Alunos Adicionados */}
                <div className="bg-surface rounded-lg shadow-sm border border-border">
                    <div className="p-5 flex justify-between items-center border-b border-border">
                        <h3 className="text-lg font-semibold text-text-default">Últimos Alunos Adicionados</h3>
                        <Link to="/professor/alunos" className="text-sm font-semibold text-primary hover:underline flex items-center">
                            Ver Todos <ChevronRightIcon />
                        </Link>
                    </div>
                    <ul className="divide-y divide-border">
                        {recentStudents.length > 0 ? recentStudents.map(student => (
                            <li key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-50/10">
                                <div>
                                    <p className="font-medium text-text-default">{student.nome}</p>
                                    <p className="text-sm text-text-muted">{student.email}</p>
                                </div>
                                <span className="text-xs text-text-muted">{new Date(student.created_at).toLocaleDateString()}</span>
                            </li>
                        )) : (
                            <li className="p-4 text-center text-text-muted">Nenhum aluno recente.</li>
                        )}
                    </ul>
                </div>
                
                {/* Avisos e Informativos */}
                <div className="bg-surface rounded-lg shadow-sm border border-border">
                    <div className="p-5 flex justify-between items-center border-b border-border">
                        <h3 className="text-lg font-semibold text-text-default">Avisos e Informativos</h3>
                        <Link to="/professor/informativos" className="text-sm font-semibold text-primary hover:underline flex items-center">
                            Ver Todos <ChevronRightIcon />
                        </Link>
                    </div>
                    <ul className="divide-y divide-border">
                       {informativos.length > 0 ? informativos.map(info => (
                           <li key={info.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-50/10">
                               <p className="font-semibold text-text-default">{info.titulo}</p>
                               <p className="text-sm text-text-muted mt-1 line-clamp-2">{info.conteudo}</p>
                               <p className="text-xs text-text-muted mt-2">{new Date(info.data_publicacao).toLocaleDateString()}</p>
                           </li>
                       )) : (
                           <li className="p-4 text-center text-text-muted">Nenhum informativo recente.</li>
                       )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ProfessorDashboard;
