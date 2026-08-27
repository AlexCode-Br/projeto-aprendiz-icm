import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import LowFrequencyTable from '../../components/LowFrequencyTable.jsx';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import {
  AlunosIcon,
  TurmasIcon,
  ProfessoresIcon,
  SuporteIcon,
  AlertIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
} from '../../components/icons/index.jsx';

const GestorDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({ stats: {}, inscricoesPorCurso: [], ultimasInscricoes: [], baixaFrequencia: [] });
  const [radar, setRadar] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      try {
        const [dashRes, radarRes] = await Promise.all([
          api.get('/api/dashboard'),
          api.get('/api/radar'),
        ]);
        setDashboard(dashRes.data);
        setRadar(radarRes.data.radar || []);
      } catch (err) {
        showToast(err.message || 'Erro ao carregar dashboard', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [showToast]);

  const handleSelectStudent = (s) => navigate(`/gestor/alunos/${s.id}`);
  const s = dashboard.stats;

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          to="/gestor/alunos"
          title="Alunos Ativos"
          value={loading ? '…' : s.alunosAtivos}
          icon={AlunosIcon}
          colorClass="primary"
          delay="100"
        />
        <StatCard
          to="/gestor/cursos"
          title="Turmas Ativas"
          value={loading ? '…' : s.cursosAtivos}
          icon={TurmasIcon}
          colorClass="success"
          delay="200"
        />
        <StatCard
          to="/gestor/professores"
          title="Professores"
          value={loading ? '…' : s.professores}
          icon={ProfessoresIcon}
          colorClass="info"
          delay="300"
        />
        <StatCard
          to="/gestor/suporte"
          title="Suporte Pendente"
          value={loading ? '…' : s.ticketsPendentes}
          icon={SuporteIcon}
          colorClass={s.ticketsPendentes > 0 ? 'warning' : 'primary'}
          delay="400"
        />
      </div>

      {/* ── Radar de Permanência ──────────────────────────────────────────── */}
      {!loading && (
        <section aria-labelledby="radar-title">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertIcon className="w-5 h-5 text-danger" aria-hidden="true" />
              <h2 id="radar-title" className="text-base font-semibold text-text-default">
                Radar de Permanência
              </h2>
              {radar.length > 0 && (
                <span className="badge badge-danger ml-1">{radar.length}</span>
              )}
            </div>
            <Link to="/gestor/alunos" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Ver todos os alunos <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          {radar.length === 0 ? (
            <div className="panel flex items-center gap-3 p-4 text-sm text-text-muted">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10" aria-hidden="true">
                <span className="text-success text-base">✓</span>
              </span>
              Nenhum aluno em situação de risco detectado no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {radar.map(alerta => (
                <button
                  key={`${alerta.student_id}-${alerta.class_id}`}
                  type="button"
                  onClick={() => navigate(`/gestor/alunos/${alerta.student_id}`)}
                  className="group text-left panel p-4 border-l-4 border-l-danger hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-text-default leading-tight">{alerta.student_name}</p>
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                  </div>
                  <p className="text-xs text-text-muted mb-3">{alerta.class_name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {alerta.reasons.map((r, i) => (
                      <span key={i} className="badge badge-danger">{r}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Baixa Frequência (tabela de alunos em risco de frequência) ────── */}
      {!loading && (
        <section aria-labelledby="lowfreq-title">
          <LowFrequencyTable students={dashboard.baixaFrequencia} onSelectStudent={handleSelectStudent} />
        </section>
      )}
    </div>
  );
};

export default GestorDashboard;
