import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneIcon,
  CalendarIcon,
  AlertIcon,
  PlusIcon,
} from '../../components/icons/index.jsx';

/* ── Timeline event helpers ─────────────────────────────────────────────── */
const EVENT_STYLES = {
  enrollment_start: { dot: 'bg-success', label: 'Matrícula Iniciada' },
  enrollment_end:   { dot: 'bg-danger',  label: 'Matrícula Encerrada' },
  followup:         { dot: 'bg-warning', label: 'Acompanhamento' },
  attendance_p:     { dot: 'bg-primary', label: 'Presença' },
  attendance_a:     { dot: 'bg-danger',  label: 'Falta' },
  attendance_j:     { dot: 'bg-warning', label: 'Justificado' },
};

function getEventStyle(event) {
  if (event.type === 'enrollment_start') return EVENT_STYLES.enrollment_start;
  if (event.type === 'enrollment_end')   return EVENT_STYLES.enrollment_end;
  if (event.type === 'followup')         return EVENT_STYLES.followup;
  if (event.data?.status === 'presente') return EVENT_STYLES.attendance_p;
  if (event.data?.status === 'justificado') return EVENT_STYLES.attendance_j;
  return EVENT_STYLES.attendance_a;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── AlunoPerfil Component ───────────────────────────────────────────────── */
const AlunoPerfil = ({ readonly = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followupModal, setFollowupModal] = useState(false);
  const [endModal, setEndModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [followupForm, setFollowupForm] = useState({ reason: '', contact_type: '', outcome: '', notes: '' });
  const [endReason, setEndReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    api.get(`/api/alunos/${id}/360`)
      .then(r => { setData(r.data); })
      .catch(err => {
        showToast(err.message || 'Erro ao carregar perfil.', 'error');
        navigate(readonly ? '/professor/alunos' : '/gestor/alunos');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, readonly, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFollowup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/api/alunos/${id}/acompanhamentos`, { ...followupForm, class_id: selectedClassId });
      showToast('Acompanhamento registrado!', 'success');
      setFollowupModal(false);
      setFollowupForm({ reason: '', contact_type: '', outcome: '', notes: '' });
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao registrar.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndEnrollment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/api/alunos/${id}/encerrar-matricula`, { class_id: selectedClassId, reason: endReason });
      showToast('Matrícula encerrada.', 'success');
      setEndModal(false);
      setEndReason('');
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao encerrar.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );

  if (!data) return null;

  const { student, enrollments, followups, attendance } = data;
  const activeEnrollments   = enrollments.filter(e => e.status === 'ativa');
  const inactiveEnrollments = enrollments.filter(e => e.status !== 'ativa');

  const timeline = [
    ...enrollments.map(e => ({ type: 'enrollment_start', date: e.started_at, data: e })),
    ...inactiveEnrollments.map(e => ({ type: 'enrollment_end', date: e.ended_at, data: e })),
    ...followups.map(f => ({ type: 'followup', date: f.created_at, data: f })),
    ...attendance.map(a => ({ type: 'attendance', date: a.class_date, data: a })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="icon-btn mt-0.5 shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-text-default">{student.name}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {student.email}
            {student.phone && <> · {student.phone}</>}
          </p>
        </div>

        {!readonly && activeEnrollments.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedClassId(activeEnrollments[0].class_id);
                setFollowupModal(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Registrar Contato
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Identity */}
          <section className="panel p-4" aria-labelledby="identity-title">
            <h2 id="identity-title" className="text-sm font-semibold text-text-default mb-3">Dados Pessoais</h2>
            <dl className="space-y-2">
              {[
                { label: 'Faixa Etária',      value: student.age_group },
                { label: 'Igreja/Local',       value: student.church },
                { label: 'Possui Instrumento', value: student.has_instrument != null ? (student.has_instrument ? 'Sim' : 'Não') : null },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between gap-2 text-sm">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="font-medium text-text-default text-right">{value}</dd>
                </div>
              ) : null)}
            </dl>
          </section>

          {/* Active Enrollments */}
          <section className="panel p-4" aria-labelledby="enrollment-title">
            <h2 id="enrollment-title" className="text-sm font-semibold text-text-default mb-3">
              Matrículas Ativas
              {activeEnrollments.length > 0 && (
                <span className="badge badge-success ml-2">{activeEnrollments.length}</span>
              )}
            </h2>
            {activeEnrollments.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhuma matrícula ativa.</p>
            ) : (
              <ul className="space-y-3">
                {activeEnrollments.map(e => (
                  <li key={e.id} className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                    <div className="font-medium text-text-default">{e.class_name}</div>
                    <div className="text-xs text-text-muted mt-0.5">Prof. {e.professor_name}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      Desde {formatDate(e.started_at)}
                    </div>
                    {!readonly && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => { setSelectedClassId(e.class_id); setFollowupModal(true); }}
                          className="btn btn-secondary btn-sm flex-1"
                        >
                          <PhoneIcon className="w-3 h-3" />
                          Contato
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedClassId(e.class_id); setEndModal(true); }}
                          className="btn btn-sm border border-danger/30 text-danger hover:bg-danger-bg"
                        >
                          Encerrar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Past Enrollments */}
          {inactiveEnrollments.length > 0 && (
            <section className="panel p-4" aria-labelledby="past-enrollment-title">
              <h2 id="past-enrollment-title" className="text-sm font-semibold text-text-default mb-3 text-text-muted">
                Histórico de Matrículas
              </h2>
              <ul className="space-y-2">
                {inactiveEnrollments.map(e => (
                  <li key={e.id} className="text-xs text-text-muted border-l-2 border-border pl-2">
                    <div className="font-medium text-text-secondary">{e.class_name}</div>
                    <div>{formatDate(e.started_at)} → {formatDate(e.ended_at)}</div>
                    {e.end_reason && <div className="mt-0.5 italic">{e.end_reason}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Right column — Timeline ──────────────────────────────────────── */}
        <section className="md:col-span-2 panel p-5" aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="text-sm font-semibold text-text-default mb-5">
            Linha do Tempo
            <span className="text-xs font-normal text-text-muted ml-2">(últimos 40 eventos)</span>
          </h2>

          {timeline.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center">
              <CalendarIcon className="w-8 h-8 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-muted">Nenhum evento registrado ainda.</p>
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-5">
              {timeline.map((event, i) => {
                const style = getEventStyle(event);
                return (
                  <li key={i} className="relative ml-5">
                    {/* Dot */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface ${style.dot}`}
                    />

                    {/* Date */}
                    <time className="text-[11px] text-text-muted" dateTime={event.date}>
                      {formatDate(event.date)}
                    </time>

                    {/* Content */}
                    <div className="mt-1 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm">
                      {event.type === 'enrollment_start' && (
                        <p>
                          <span className="font-semibold text-success">Matrícula:</span>{' '}
                          {event.data.class_name} — Prof. {event.data.professor_name}
                        </p>
                      )}
                      {event.type === 'enrollment_end' && (
                        <p>
                          <span className="font-semibold text-danger">Encerramento:</span>{' '}
                          {event.data.class_name}
                          {event.data.end_reason && (
                            <span className="text-text-muted text-xs ml-1">· {event.data.end_reason}</span>
                          )}
                        </p>
                      )}
                      {event.type === 'followup' && (
                        <div>
                          <p>
                            <span className="font-semibold text-warning">Acompanhamento:</span>{' '}
                            {event.data.reason}
                          </p>
                          {event.data.contact_type && (
                            <p className="text-xs text-text-muted mt-0.5">
                              Via {event.data.contact_type}
                              {event.data.created_by_name && <> · {event.data.created_by_name}</>}
                            </p>
                          )}
                          {event.data.outcome && (
                            <p className="text-xs mt-1">Resultado: {event.data.outcome}</p>
                          )}
                          {event.data.notes && (
                            <p className="text-xs text-text-muted italic mt-1">"{event.data.notes}"</p>
                          )}
                        </div>
                      )}
                      {event.type === 'attendance' && (
                        <p>
                          <span className="text-text-muted text-xs">{event.data.class_name} — </span>
                          <span className={
                            event.data.status === 'ausente'     ? 'font-semibold text-danger' :
                            event.data.status === 'justificado' ? 'font-semibold text-warning' :
                            'font-semibold text-success'
                          }>
                            {event.data.status === 'presente' ? 'Presente' :
                             event.data.status === 'ausente'  ? 'Falta' : 'Justificado'}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* ── Followup Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={followupModal}
        onClose={() => setFollowupModal(false)}
        title="Registrar Contato / Acompanhamento"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleFollowup} className="space-y-4">
          {activeEnrollments.length > 1 && (
            <div>
              <label className="form-label">Turma</label>
              <select
                className="form-control"
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {activeEnrollments.map(e => (
                  <option key={e.class_id} value={e.class_id}>{e.class_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Motivo do Contato</label>
            <select className="form-control" required value={followupForm.reason} onChange={e => setFollowupForm(f => ({ ...f, reason: e.target.value }))}>
              <option value="">Selecione…</option>
              <option>Faltas Consecutivas</option>
              <option>Baixa Frequência</option>
              <option>Evasão</option>
              <option>Desempenho</option>
              <option>Outro</option>
            </select>
          </div>
          <div>
            <label className="form-label">Canal de Contato</label>
            <select className="form-control" required value={followupForm.contact_type} onChange={e => setFollowupForm(f => ({ ...f, contact_type: e.target.value }))}>
              <option value="">Selecione…</option>
              <option>WhatsApp</option>
              <option>Ligação Telefônica</option>
              <option>Presencial</option>
              <option>E-mail</option>
            </select>
          </div>
          <div>
            <label className="form-label">Resultado <span className="font-normal text-text-muted">(opcional)</span></label>
            <input type="text" className="form-control" placeholder="Ex: Prometeu retornar na próxima aula" value={followupForm.outcome} onChange={e => setFollowupForm(f => ({ ...f, outcome: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Observações <span className="font-normal text-text-muted">(opcional)</span></label>
            <textarea className="form-control" rows={3} value={followupForm.notes} onChange={e => setFollowupForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setFollowupModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── End Enrollment Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={endModal}
        onClose={() => setEndModal(false)}
        title="Encerrar Matrícula"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleEndEnrollment} className="space-y-4">
          {activeEnrollments.length > 1 && (
            <div>
              <label className="form-label">Turma</label>
              <select className="form-control" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} required>
                <option value="">Selecione…</option>
                {activeEnrollments.map(e => <option key={e.class_id} value={e.class_id}>{e.class_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Motivo do Encerramento</label>
            <select className="form-control" required value={endReason} onChange={e => setEndReason(e.target.value)}>
              <option value="">Selecione…</option>
              <option>Conclusão do Módulo</option>
              <option>Desistência Declarada</option>
              <option>Transferência de Turma</option>
              <option>Abandono (Evasão não justificada)</option>
              <option>Incompatibilidade de Horário</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="alert-warning rounded-lg p-3 text-xs">
            Esta ação encerrará a matrícula. O histórico será preservado.
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn btn-secondary" onClick={() => setEndModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Processando…' : 'Confirmar Encerramento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AlunoPerfil;
