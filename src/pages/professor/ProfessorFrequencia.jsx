import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import FormSelect from '../../components/FormSelect';
import { FrequenciaIcon, CalendarIcon } from '../../components/icons/index.jsx';

const statusClasses = {
  presente:    { active: 'bg-success text-white border-success', idle: 'border-border text-text-muted hover:border-success/50 hover:text-success' },
  ausente:     { active: 'bg-danger text-white border-danger',   idle: 'border-border text-text-muted hover:border-danger/50 hover:text-danger' },
  justificado: { active: 'bg-warning text-white border-warning', idle: 'border-border text-text-muted hover:border-warning/50 hover:text-warning' },
};

const statusLabels = {
  presente:    'Presente',
  ausente:     'Falta',
  justificado: 'Justificado',
};

const ProfessorFrequencia = () => {
  const { showToast } = useToast();
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [dataAula, setDataAula] = useState(new Date().toISOString().split('T')[0]);
  const [alunos, setAlunos] = useState([]);
  const [frequencias, setFrequencias] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingAlunos, setLoadingAlunos] = useState(false);

  useEffect(() => {
    api.get('/professores/meus-cursos')
      .then(r => setCursos(r.data.map(c => ({ value: c.id, label: c.nome }))))
      .catch(() => showToast('Erro ao carregar seus cursos.', 'error'));
  }, [showToast]);

  const fetchAlunosEFrequencia = useCallback(async () => {
    if (!selectedCurso || !dataAula) { setAlunos([]); return; }
    setLoadingAlunos(true);
    try {
      const r = await api.get('/frequencia', { params: { curso_id: selectedCurso.value, data: dataAula } });
      setAlunos(r.data);
      setFrequencias(r.data.reduce((acc, a) => ({ ...acc, [a.id]: a.status || '' }), {}));
    } catch {
      showToast('Erro ao carregar alunos.', 'error');
      setAlunos([]);
    } finally {
      setLoadingAlunos(false);
    }
  }, [selectedCurso, dataAula, showToast]);

  useEffect(() => { fetchAlunosEFrequencia(); }, [fetchAlunosEFrequencia]);

  const handleChange = (alunoId, status) => setFrequencias(p => ({ ...p, [alunoId]: status }));

  const handleSalvar = async () => {
    if (!selectedCurso || alunos.length === 0) {
      showToast('Selecione um curso primeiro.', 'warning');
      return;
    }
    if (Object.values(frequencias).some(s => !s)) {
      showToast('Preencha a frequência de todos os alunos.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await api.post('/frequencia', {
        curso_id: selectedCurso.value,
        data_aula: dataAula,
        frequencias: Object.entries(frequencias).map(([id, status]) => ({ aluno_id: parseInt(id), status })),
      });
      showToast('Frequência salva com sucesso!', 'success');
      fetchAlunosEFrequencia();
    } catch {
      showToast('Erro ao salvar frequência.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalPresentes  = Object.values(frequencias).filter(s => s === 'presente').length;
  const totalFaltas     = Object.values(frequencias).filter(s => s === 'ausente').length;
  const totalJustif     = Object.values(frequencias).filter(s => s === 'justificado').length;
  const totalPreenchidos = totalPresentes + totalFaltas + totalJustif;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Lançamento de Frequência</h1>
        <p className="page-description">Selecione a turma e a data para registrar a chamada.</p>
      </div>

      {/* ── Selectors ───────────────────────────────────────────────────────── */}
      <div className="panel p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="curso-select" className="form-label">
              Turma
            </label>
            <FormSelect
              id="curso-select"
              options={cursos}
              value={selectedCurso?.value}
              onChange={(e) => setSelectedCurso(cursos.find(c => String(c.value) === String(e.target.value)) || null)}
              placeholder="Selecione uma turma…"
            />
          </div>
          <div>
            <label htmlFor="date-select" className="form-label flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
              Data da Aula
            </label>
            <input
              id="date-select"
              type="date"
              value={dataAula}
              onChange={e => setDataAula(e.target.value)}
              className="form-control"
            />
          </div>
        </div>
      </div>

      {/* ── Summary bar (if alunos loaded) ──────────────────────────────────── */}
      {!loadingAlunos && alunos.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-text-muted">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</span>
          <span className="text-success font-medium">{totalPresentes} presente{totalPresentes !== 1 ? 's' : ''}</span>
          <span className="text-danger font-medium">{totalFaltas} falta{totalFaltas !== 1 ? 's' : ''}</span>
          {totalJustif > 0 && <span className="text-warning font-medium">{totalJustif} justificado{totalJustif !== 1 ? 's' : ''}</span>}
          {totalPreenchidos < alunos.length && (
            <span className="text-text-muted">· {alunos.length - totalPreenchidos} pendente{alunos.length - totalPreenchidos !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* ── Student list ────────────────────────────────────────────────────── */}
      {loadingAlunos ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-4 animate-pulse">
              <div className="h-5 w-1/3 rounded bg-surface-hover mb-3" />
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((__, j) => <div key={j} className="h-10 rounded bg-surface-hover" />)}
              </div>
            </div>
          ))}
        </div>
      ) : !selectedCurso ? (
        <div className="panel flex flex-col items-center py-14 px-6 text-center gap-3">
          <FrequenciaIcon className="w-8 h-8 text-text-muted" aria-hidden="true" />
          <p className="text-sm font-medium text-text-default">Selecione uma turma para começar</p>
          <p className="text-xs text-text-muted">A lista de alunos carregará automaticamente.</p>
        </div>
      ) : alunos.length === 0 ? (
        <div className="panel flex flex-col items-center py-14 px-6 text-center gap-2">
          <p className="text-sm font-medium text-text-default">Nenhum aluno matriculado nesta turma.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alunos.map((aluno) => (
            <div
              key={aluno.id}
              className="panel flex flex-col sm:flex-row sm:items-center gap-3 p-4"
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-3 sm:w-1/3 min-w-0">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
                  aria-hidden="true"
                >
                  {aluno.nome?.charAt(0)?.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-text-default truncate">{aluno.nome}</span>
              </div>

              {/* Status buttons */}
              <div
                className="grid grid-cols-3 gap-2 flex-1"
                role="group"
                aria-label={`Frequência de ${aluno.nome}`}
              >
                {(['presente', 'ausente', 'justificado']).map(status => {
                  const active = frequencias[aluno.id] === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleChange(aluno.id, status)}
                      className={[
                        'rounded-lg border py-2.5 text-sm font-semibold transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        active ? statusClasses[status].active : statusClasses[status].idle,
                      ].join(' ')}
                    >
                      {statusLabels[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Save button ─────────────────────────────────────────────────────── */}
      {alunos.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={loading || totalPreenchidos < alunos.length}
            className="btn btn-primary btn-lg shadow-md"
          >
            {loading ? 'Salvando…' : `Salvar Chamada (${totalPreenchidos}/${alunos.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfessorFrequencia;
