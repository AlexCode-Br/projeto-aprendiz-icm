import React from 'react';
import Modal from './Modal';

const SummaryCard = ({ label, value }) => (
    <div className="rounded-xl border border-border bg-gray-50 p-4 dark:bg-white/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-text-default">{value}</p>
    </div>
);

const ProfessorDeletionImpactModal = ({ isOpen, onClose, onContinue, impact, loading }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Impacto da exclusão" maxWidth="max-w-3xl">
        {loading ? (
            <p className="py-10 text-center text-sm text-text-muted" role="status">Consultando vínculos do professor...</p>
        ) : impact ? (
            <div className="space-y-6">
                <div>
                    <p className="font-semibold text-text-default">{impact.professor.nome}</p>
                    <p className="mt-1 text-sm text-text-muted">Igreja principal: {impact.professor.localPrincipal}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo dos vínculos">
                    <SummaryCard label="Turmas cadastradas" value={impact.resumo.turmas} />
                    <SummaryCard label="Igrejas" value={impact.resumo.locais} />
                    <SummaryCard label="Alunos vinculados" value={impact.resumo.alunosAtivos} />
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-text-default">Onde este professor está incluído</h3>
                    {impact.turmas.length ? (
                        <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                            {impact.turmas.map(turma => (
                                <article key={turma.id} className="rounded-xl border border-border p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h4 className="font-semibold text-text-default">{turma.curso}</h4>
                                            <p className="mt-1 text-sm text-text-muted">{turma.local} · {turma.horario}</p>
                                        </div>
                                        <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-danger dark:bg-red-950/30">
                                            {turma.alunos} {turma.alunos === 1 ? 'aluno' : 'alunos'} · {turma.ativa ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 rounded-xl border border-border bg-gray-50 p-4 text-sm text-text-muted dark:bg-white/5">Este professor não possui turmas cadastradas.</p>
                    )}
                </div>

                <div className="alert-warning" role="note">
                    Exclusão definitiva: a conta, o perfil, as turmas, {impact.resumo.matriculas} matrícula(s), {impact.resumo.frequencias} registro(s) de frequência, convites, publicações e atendimentos vinculados serão apagados. Os cadastros dos alunos permanecerão, sem vínculo com este professor.
                </div>
            </div>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button type="button" onClick={onContinue} disabled={loading || !impact} className="btn btn-danger">Continuar para exclusão</button>
        </div>
    </Modal>
);

export default ProfessorDeletionImpactModal;
