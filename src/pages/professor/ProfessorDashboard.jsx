import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';

// --- Ícones SVG (estilo outline, traço consistente) ---
const StudentsIcon = () => <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const BellIcon = () => <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const CalendarIcon = () => <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const CheckCircleIcon = () => <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ChevronRightIcon = () => <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;


// --- Componente StatCard (identidade visual: vermelho, branco e cinza) ---
const StatCard = ({ icon, title, value, accent = 'bg-primary/10 text-primary', to }) => (
    <Link to={to} className="interactive-card grid min-h-32 grid-cols-[1fr,auto] items-center gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="min-w-0">
            <div className="break-words text-2xl font-bold leading-tight text-text-default">{value}</div>
            <div className="mt-1 break-words text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</div>
        </div>
        <div className={`rounded-xl p-3 ${accent}`}>
            {icon}
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

    if (loading) return (
        <div role="status" aria-label="Carregando painel">
            <div className="skeleton h-9 w-72 max-w-full" />
            <div className="skeleton mt-3 h-4 w-96 max-w-full" />
            <div className="mt-8 mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
                {[0, 1, 2, 3].map(i => <div key={i} className="skeleton min-h-32 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="skeleton h-64 rounded-xl" />
                <div className="skeleton h-64 rounded-xl" />
            </div>
        </div>
    );
    if (error) return <div className="panel p-10 text-center"><p className="text-danger" role="alert">{error}</p><button type="button" onClick={fetchData} className="btn btn-secondary mt-4">Tentar novamente</button></div>;

    return (
        <div className="">
            <h1 className="page-title mb-2">
                Olá, Professor(a) {user?.nome?.split(' ')[0] || ''}!
            </h1>
            <p className="page-description mb-8">Aqui está um resumo das suas turmas e atividades.</p>

            {/* Grid de Estatísticas */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
                <StatCard icon={<StudentsIcon />} title="Meus Alunos" value={stats.totalAlunos} accent="bg-primary/10 text-primary" to="/professor/alunos" />
                <StatCard icon={<BellIcon />} title="Avisos/Informativos" value={stats.totalInformativos} accent="bg-gray-500/10 text-text-muted" to="/professor/informativos" />
                <StatCard icon={<CalendarIcon />} title="Próxima Aula" value={stats.proximaAula} accent="bg-primary/10 text-primary" to="/professor/frequencia" />
                <StatCard icon={<CheckCircleIcon />} title="Frequência Média" value={stats.frequenciaMedia} accent="bg-gray-500/10 text-text-muted" to="/professor/frequencia" />
            </div>

            {/* Grid de Alunos Recentes e Informativos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Últimos Alunos Adicionados */}
                <div className="panel overflow-hidden">
                    <div className="p-5 flex justify-between items-center border-b border-border">
                        <h3 className="text-lg font-semibold text-text-default">Últimos Alunos Adicionados</h3>
                        <Link to="/professor/alunos" className="text-sm font-semibold text-primary hover:underline flex items-center">
                            Ver Todos <ChevronRightIcon />
                        </Link>
                    </div>
                    <ul className="divide-y divide-border">
                        {recentStudents.length > 0 ? recentStudents.map(student => (
                            <li key={student.id} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                                <div>
                                    <p className="font-medium text-text-default">{student.nome}</p>
                                    <p className="text-sm text-text-muted">{student.email || 'E-mail não informado'}</p>
                                </div>
                                <span className="text-xs text-text-muted">{new Date(student.created_at).toLocaleDateString()}</span>
                            </li>
                        )) : (
                            <li className="p-5 text-center text-text-muted"><strong className="block text-text-default">Nenhum aluno recente</strong><span className="mt-1 block text-sm">Novas matrículas nas suas turmas aparecerão aqui.</span></li>
                        )}
                    </ul>
                </div>

                {/* Avisos e Informativos */}
                <div className="panel overflow-hidden">
                    <div className="p-5 flex justify-between items-center border-b border-border">
                        <h3 className="text-lg font-semibold text-text-default">Avisos e Informativos</h3>
                        <Link to="/professor/informativos" className="text-sm font-semibold text-primary hover:underline flex items-center">
                            Ver Todos <ChevronRightIcon />
                        </Link>
                    </div>
                    <ul className="divide-y divide-border">
                       {informativos.length > 0 ? informativos.map(info => (
                           <li key={info.id} className="p-4 hover:bg-surface-hover transition-colors">
                               <p className="font-semibold text-text-default">{info.titulo}</p>
                               <p className="text-sm text-text-muted mt-1 line-clamp-2">{info.conteudo}</p>
                               <p className="text-xs text-text-muted mt-2">{new Date(info.data_publicacao).toLocaleDateString()}</p>
                           </li>
                       )) : (
                           <li className="p-5 text-center text-text-muted"><strong className="block text-text-default">Nenhum informativo recente</strong><span className="mt-1 block text-sm">Os próximos avisos da gestão aparecerão aqui.</span></li>
                       )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ProfessorDashboard;
