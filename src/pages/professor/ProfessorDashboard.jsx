import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import {
  FrequenciaIcon,
  AlunosIcon,
  CalendarIcon,
  ChevronRightIcon,
  ArrowUpRightIcon,
} from '../../components/icons/index.jsx';

const ProfessorDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [proximaAula, setProximaAula] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [informativos, setInformativos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, infoRes, dashRes] = await Promise.all([
        api.get('/api/professores/me/alunos?sort=recent'),
        api.get('/api/informativos?limit=3'),
        api.get('/api/dashboard/professor'),
      ]);

      const summary = dashRes.data;
      setStats({
        totalAlunos:      summary.stats.totalAlunos,
        frequenciaMedia:  summary.stats.frequenciaMedia,
      });
      setProximaAula(summary.proximaAula || null);
      setRecentStudents((studRes.data.alunos || []).slice(0, 5));
      setInformativos(
        (infoRes.data || [])
          .sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao))
          .slice(0, 3)
      );
      setError(null);
    } catch (err) {
      setError('Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const firstName = user?.nome?.split(' ')[0] || '';
  const now = new Date();
  const hora = now.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  if (loading) return (
    <div className="flex items-center justify-center py-24" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-text-muted">{error}</p>
      <button type="button" onClick={fetchData} className="btn btn-secondary">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Saudação ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-text-default">
          {saudacao}, {firstName}!
        </h1>
        <p className="mt-0.5 text-sm text-text-muted">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Próxima Aula + CTA ──────────────────────────────────────────────── */}
      {proximaAula ? (
        <section
          aria-label="Próxima aula"
          className="panel border-l-4 border-l-primary p-5"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Próxima aula</p>
                <p className="mt-0.5 text-base font-semibold text-text-default">{proximaAula.descricao}</p>
                {proximaAula.horario && (
                  <p className="mt-0.5 text-sm text-text-muted">{proximaAula.horario}</p>
                )}
              </div>
            </div>
            <Link
              to="/professor/frequencia"
              className="btn btn-primary shrink-0"
            >
              <FrequenciaIcon className="w-4 h-4" aria-hidden="true" />
              Fazer Chamada
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel p-5 text-center">
          <CalendarIcon className="mx-auto w-8 h-8 text-text-muted mb-2" aria-hidden="true" />
          <p className="text-sm text-text-muted">Nenhuma aula programada encontrada.</p>
          <Link to="/professor/frequencia" className="btn btn-secondary mt-3 text-xs">
            Registrar Chamada Manualmente
          </Link>
        </section>
      )}

      {/* ── Quick Stats ──────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/professor/alunos"
            className="panel flex items-center gap-4 p-4 hover:shadow-sm transition-shadow group"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <AlunosIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-text-default tabular-nums">{stats.totalAlunos}</p>
              <p className="text-xs text-text-muted">Meus Alunos</p>
            </div>
            <ChevronRightIcon className="ml-auto w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 shrink-0" />
          </Link>

          <div className="panel flex items-center gap-4 p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stats.frequenciaMedia !== null && stats.frequenciaMedia < 75 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`} aria-hidden="true">
              <FrequenciaIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-text-default tabular-nums">
                {stats.frequenciaMedia !== null ? `${stats.frequenciaMedia}%` : '—'}
              </p>
              <p className="text-xs text-text-muted">Frequência Média</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Últimos Alunos + Informativos ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alunos recentes */}
        <section className="panel overflow-hidden" aria-labelledby="recent-students-title">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="recent-students-title" className="text-sm font-semibold text-text-default">Últimos Alunos</h2>
            <Link to="/professor/alunos" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              Ver Todos <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentStudents.length > 0 ? (
            <ul className="divide-y divide-border">
              {recentStudents.map(student => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/professor/alunos/${student.id}`)}
                    className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {student.nome?.charAt(0)?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-default truncate">{student.nome}</p>
                        <p className="text-xs text-text-muted truncate">{student.email}</p>
                      </div>
                    </div>
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-text-muted">Nenhum aluno encontrado.</p>
          )}
        </section>

        {/* Informativos */}
        <section className="panel overflow-hidden" aria-labelledby="info-title">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="info-title" className="text-sm font-semibold text-text-default">Informativos Recentes</h2>
            <Link to="/professor/informativos" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              Ver Todos <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
          {informativos.length > 0 ? (
            <ul className="divide-y divide-border">
              {informativos.map(info => (
                <li key={info.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-text-default line-clamp-1">{info.titulo}</p>
                  <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{info.conteudo}</p>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    {new Date(info.data_publicacao).toLocaleDateString('pt-BR')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-text-muted">Nenhum informativo disponível.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfessorDashboard;
