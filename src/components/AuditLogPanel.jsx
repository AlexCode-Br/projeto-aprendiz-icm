import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const ACTION_LABELS = {
    login: 'Acesso realizado',
    logout: 'Sessão encerrada',
    profile_updated: 'Perfil atualizado',
    password_changed: 'Senha alterada',
    password_reset: 'Senha redefinida',
    student_created: 'Aluno cadastrado',
    student_updated: 'Aluno atualizado',
    student_anonymized: 'Aluno anonimizado',
    student_contact_registered: 'Contato com aluno registrado',
    professor_created: 'Professor cadastrado',
    professor_updated: 'Professor atualizado',
    professor_permanently_deleted: 'Professor excluído',
    attendance_saved: 'Chamada registrada',
    announcement_created: 'Informativo criado',
    announcement_updated: 'Informativo atualizado',
    announcement_deleted: 'Informativo excluído',
    ticket_created: 'Chamado criado',
    ticket_replied: 'Mensagem enviada no suporte',
    ticket_status_changed: 'Status de chamado alterado',
    ticket_deleted: 'Chamado excluído',
    school_year_created: 'Período letivo criado',
    school_year_created_and_activated: 'Período letivo criado e ativado',
    school_year_activated: 'Período letivo ativado',
    school_year_updated: 'Período letivo atualizado',
};

function actionLabel(action) {
    const key = String(action || '').split(':')[0];
    return ACTION_LABELS[key] || key.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function formattedDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Data indisponível';
    return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AuditLogPanel() {
    const [state, setState] = useState({ entries: [], total: 0 });
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const limit = 10;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/api/audit-log', { params: { page, limit } });
            setState({ entries: data.entries || [], total: Number(data.total || 0) });
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Não foi possível carregar o histórico de segurança.');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(state.total / limit));

    return <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
            <div>
                <h3 className="text-lg font-semibold text-text-default">Histórico de segurança</h3>
                <p className="mt-1 text-sm text-text-muted">Acompanhe as ações administrativas registradas pelo sistema.</p>
            </div>
            <button type="button" onClick={load} disabled={loading} className="btn btn-secondary self-start sm:self-auto">Atualizar histórico</button>
        </div>
        {loading ? <div className="space-y-3 p-5 md:p-7" aria-label="Carregando histórico">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-12 rounded-lg" />)}
        </div> : error ? <div className="p-8 text-center">
            <strong className="block text-danger">Histórico indisponível</strong>
            <p className="mt-1 text-sm text-text-muted">{error}</p>
            <button type="button" onClick={load} className="btn btn-secondary mt-4">Tentar novamente</button>
        </div> : state.entries.length === 0 ? <div className="p-10 text-center text-text-muted">
            <strong className="block text-text-default">Nenhuma ação registrada ainda</strong>
            <span className="mt-1 block text-sm">As próximas ações administrativas aparecerão aqui.</span>
        </div> : <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface-muted/40"><tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted md:px-7">Data e hora</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Responsável</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted md:px-7">Ação</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">{state.entries.map(entry => <tr key={entry.id} className="hover:bg-surface-hover">
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-text-muted md:px-7"><time dateTime={entry.createdAt}>{formattedDate(entry.createdAt)}</time></td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-text-default">{entry.actor}</td>
                        <td className="px-5 py-4 text-sm text-text-default md:px-7">{actionLabel(entry.action)}</td>
                    </tr>)}</tbody>
                </table>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 text-sm md:px-7">
                <span className="text-text-muted">Página {page} de {totalPages} · {state.total} registro(s)</span>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="btn btn-secondary">Anterior</button>
                    <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="btn btn-secondary">Próxima</button>
                </div>
            </div>
        </>}
    </section>;
}
