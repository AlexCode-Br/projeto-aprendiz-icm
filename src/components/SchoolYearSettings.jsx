import React, { useEffect, useMemo, useState } from 'react';
import FormCheckbox from './FormCheckbox';
import api from '../services/api';
import { useSchoolYear } from '../contexts/SchoolYearContext';
import { useToast } from '../contexts/ToastContext';
import { hasValidationErrors, validateSchoolYear } from '../../shared/validation.mjs';

const emptyForm = { label: '', startDate: '', endDate: '', ativar: false };
const formatDate = value => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Datas pendentes';

export default function SchoolYearSettings() {
    const { periods, selectedPeriod, loading, refresh } = useSchoolYear();
    const { showToast } = useToast();
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const editing = useMemo(() => periods.find(period => period.id === editingId) || null, [editingId, periods]);

    const edit = period => {
        if (period.closed) return;
        setEditingId(period.id);
        setForm({ label: period.datesConfirmed ? period.label : '', startDate: period.startDate, endDate: period.endDate, ativar: false });
    };

    useEffect(() => {
        if (!editingId && selectedPeriod && !selectedPeriod.closed) edit(selectedPeriod);
    }, [editingId, selectedPeriod]);

    const startNew = () => { setEditingId(null); setForm(emptyForm); };

    const save = async event => {
        event.preventDefault();
        const errors = validateSchoolYear({ label: form.label, start_date: form.startDate, end_date: form.endDate });
        if (hasValidationErrors(errors)) return showToast(Object.values(errors).find(Boolean), 'warning');
        setSaving(true);
        try {
            const payload = { label: form.label, startDate: form.startDate, endDate: form.endDate, ativar: form.ativar };
            const response = editingId
                ? await api.put(`/api/school-years/${editingId}`, payload)
                : await api.post('/api/school-years', payload);
            const preferredId = form.ativar ? (response.data.id || editingId) : undefined;
            await refresh(preferredId);
            showToast(response.data.message || 'Período letivo salvo.', 'success');
            startNew();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 md:p-7">
            <div><h2 className="text-lg font-semibold text-text-default">Períodos letivos</h2><p className="mt-1 text-sm text-text-muted">As turmas, matrículas, chamadas e relatórios são organizados pelo intervalo selecionado.</p></div>
            <button type="button" onClick={startNew} className="btn btn-secondary">Novo período</button>
        </div>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
            <div className="border-b border-border p-5 xl:border-b-0 xl:border-r md:p-7">
                {loading ? <div className="space-y-3"><div className="skeleton h-16 rounded-lg" /><div className="skeleton h-16 rounded-lg" /></div> : (
                    <div className="space-y-3">
                        {periods.map(period => <div key={period.id} className={`rounded-xl border p-4 ${period.id === selectedPeriod?.id ? 'border-primary/50 bg-primary/5' : 'border-border bg-surface-muted/40'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-text-default">{period.label}</strong>{period.active && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Atual</span>}{period.closed && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">Histórico</span>}</div><p className="mt-1 text-xs text-text-muted">{period.datesConfirmed ? `${formatDate(period.startDate)} a ${formatDate(period.endDate)}` : 'Defina as datas reais antes de encerrar este período.'}</p></div>
                                {!period.closed && <button type="button" onClick={() => edit(period)} className="btn btn-ghost shrink-0">Editar</button>}
                            </div>
                        </div>)}
                        {!periods.length && <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-medium text-text-default">Nenhum período configurado</p><p className="mt-1 text-sm text-text-muted">Crie o primeiro período para organizar as turmas.</p></div>}
                    </div>
                )}
            </div>
            <form onSubmit={save} className="p-5 md:p-7">
                <h3 className="font-semibold text-text-default">{editing ? `Editar ${editing.label}` : 'Criar período letivo'}</h3>
                {editing && !editing.datesConfirmed && <p className="mt-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm text-text-default">Os dados antigos estão vinculados a este período provisório. Informe aqui o nome e as datas reais.</p>}
                <div className="mt-5 space-y-4">
                    <label className="block"><span className="form-label">Nome do período</span><input required maxLength="40" placeholder="Ex.: 2026/2027" value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} className="form-control" /></label>
                    <div className="grid gap-4 sm:grid-cols-2"><label><span className="form-label">Data inicial</span><input required type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className="form-control" /></label><label><span className="form-label">Data final</span><input required type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} className="form-control" /></label></div>
                    {(!editing || !editing.active) && <FormCheckbox checked={form.ativar} onChange={event => setForm({ ...form, ativar: event.target.checked })} label="Ativar ao salvar" description="O período atual será encerrado e ficará somente para consulta." />}
                </div>
                <div className="mt-6 flex justify-end"><button disabled={saving} className="submit-btn disabled:opacity-60">{saving ? 'Salvando...' : editing ? 'Salvar período' : 'Criar período'}</button></div>
            </form>
        </div>
    </section>;
}
