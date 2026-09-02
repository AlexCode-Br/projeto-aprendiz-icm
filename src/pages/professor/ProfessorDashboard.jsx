import { Users as StudentsIcon, Megaphone as BellIcon, CalendarDays as CalendarIcon, CalendarCheck2 as CheckCircleIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import ProfileAvatar from '../../components/ProfileAvatar';
import { AuthContext } from '../../contexts/AuthContext';

// --- Ícones SVG (estilo outline, traço consistente) ---







// --- Componente StatCard (identidade visual: vermelho, branco e cinza) ---


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
            setInformativos((Array.isArray(infoResponse.data) ? infoResponse.data : []).sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao)).slice(0, 3));

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
                Olá, {user?.nome?.split(' ')[0] || 'professor'}!
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
                    <div className="p-5 flex flex-wrap gap-3 justify-between items-center border-b border-border">
                        <h3 className="text-lg font-semibold text-text-default">Últimos Alunos Adicionados</h3>
                        <Link to="/professor/alunos" className="text-sm font-semibold text-primary hover:underline flex items-center">
                            Ver Todos <ChevronRightIcon />
                        </Link>
                    </div>
                    <ul className="divide-y divide-border">
                        {recentStudents.length > 0 ? recentStudents.map(student => (
                            <li key={student.id} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                                <div className="flex min-w-0 items-center gap-3"><ProfileAvatar name={student.nome} src={student.foto_url} /><div className="min-w-0">
                                    <p className="truncate font-medium text-text-default">{student.nome}</p>
                                    <p className="truncate text-sm text-text-muted">{student.email || 'E-mail não informado'}</p></div>
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
                               <p className="text-sm text-text-muted mt-1 line-clamp-2">{String(info.conteudo || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')}</p>
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
