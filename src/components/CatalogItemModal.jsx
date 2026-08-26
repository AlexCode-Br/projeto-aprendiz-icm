import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { catalogNameError, cleanText } from '../../shared/validation.mjs';

export default function CatalogItemModal({ isOpen, onClose, onSave, item, type }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const label = type === 'cursos' ? 'curso' : 'local';

    useEffect(() => {
        setName(item?.nome || '');
        setError('');
        setSaving(false);
    }, [item, isOpen]);

    const submit = async event => {
        event.preventDefault();
        const normalized = cleanText(name, 100);
        const validationError = catalogNameError(normalized, label);
        if (validationError) return setError(validationError);
        setSaving(true);
        try { await onSave({ nome: normalized }); } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${item ? 'Editar' : 'Adicionar'} ${label}`}>
            <form onSubmit={submit} noValidate>
                <label htmlFor="catalog-name" className="form-label">Nome do {label}</label>
                <input id="catalog-name" autoFocus maxLength="100" value={name} onChange={event => { setName(event.target.value); setError(''); }} aria-invalid={Boolean(error)} className={`form-control ${error ? 'border-danger' : ''}`} />
                {error && <p className="mt-1 text-xs text-danger">{error}</p>}
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </form>
        </Modal>
    );
}
