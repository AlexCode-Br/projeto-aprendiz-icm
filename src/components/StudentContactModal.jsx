import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import { cleanText, validateStudentContact } from '../../shared/validation.mjs';

const outcomes = [
    { value: 'contatado', label: 'Contato realizado' },
    { value: 'sem_resposta', label: 'Sem resposta' },
    { value: 'retorno_agendado', label: 'Retorno agendado' },
    { value: 'outro', label: 'Outro resultado' },
];

export default function StudentContactModal({ student, isOpen, onClose, onSave }) {
    const [form, setForm] = useState({ note: '', outcome: '' });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm({ note: '', outcome: '' });
        setErrors({});
        setSaving(false);
    }, [student, isOpen]);

    const submit = async event => {
        event.preventDefault();
        const values = { note: cleanText(form.note, 1000), outcome: form.outcome };
        const validationErrors = validateStudentContact(values);
        if (Object.keys(validationErrors).length) return setErrors(validationErrors);
        setSaving(true);
        try { await onSave(values); } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Registrar contato${student ? ` — ${student.nome}` : ''}`}>
            <form onSubmit={submit} noValidate>
                {student?.ultimoContato && <div className="mb-5 rounded-lg border border-border bg-surface-muted p-3 text-sm"><strong className="block text-text-default">Último contato</strong><span className="mt-1 block text-text-muted">{new Date(student.ultimoContato.contactedAt).toLocaleString('pt-BR')} · {student.ultimoContato.registeredBy}</span><p className="mt-2 text-text-default">{student.ultimoContato.note}</p></div>}
                <div>
                    <label htmlFor="contact-outcome" className="form-label">Resultado</label>
                    <FormSelect id="contact-outcome" name="outcome" options={outcomes} value={form.outcome} onChange={event => { setForm(current => ({ ...current, outcome: event.target.value })); setErrors(current => ({ ...current, outcome: null })); }} placeholder="Selecione o resultado" invalid={Boolean(errors.outcome)} />
                    {errors.outcome && <p className="mt-1 text-xs text-danger">{errors.outcome}</p>}
                </div>
                <div className="mt-4">
                    <label htmlFor="contact-note" className="form-label">Registro do contato</label>
                    <textarea id="contact-note" value={form.note} onChange={event => { setForm(current => ({ ...current, note: event.target.value })); setErrors(current => ({ ...current, note: null })); }} maxLength="1000" rows="5" placeholder="Ex.: Conversei com o responsável, que informou..." aria-invalid={Boolean(errors.note)} className={`form-control resize-y ${errors.note ? 'border-danger' : ''}`} />
                    <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-danger">{errors.note || ''}</span><span className="text-text-muted">{form.note.length}/1000</span></div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Registrando...' : 'Registrar contato'}</button>
                </div>
            </form>
        </Modal>
    );
}
