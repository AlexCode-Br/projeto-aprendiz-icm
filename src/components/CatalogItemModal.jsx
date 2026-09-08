import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import CourseIcon from './CourseIcon';
import { Church } from 'lucide-react';
import { catalogNameError, cleanText } from '../../shared/validation.mjs';
import { catalogKey, catalogSuggestions } from '../../shared/catalog-options.mjs';

export default function CatalogItemModal({ isOpen, onClose, onSave, item, type, existingItems = [] }) {
    const [name, setName] = useState('');
    const [inputName, setInputName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const label = type === 'cursos' ? 'curso' : 'igreja';
    // Keep the item being edited selectable while disabling names that belong
    // to other records. This lets create and edit share the same searchable
    // catalogue without presenting the current value as unavailable.
    const options = catalogSuggestions(type, existingItems.filter(existing => existing.id !== item?.id));
    const alreadyRegistered = value => existingItems.some(existing => existing.id !== item?.id && catalogKey(existing.nome) === catalogKey(value));
    const close = () => { if (!saving) onClose(); };

    useEffect(() => {
        setName(item?.nome || '');
        setInputName('');
        setError('');
        setSaving(false);
    }, [item, isOpen, type]);

    const submit = async event => {
        event.preventDefault();
        if (saving) return;
        const normalized = cleanText(inputName || name, 101);
        const validationError = catalogNameError(normalized, label);
        if (normalized.length > 100) return setError('Use no máximo 100 caracteres.');
        if (validationError) return setError(validationError);
        if (alreadyRegistered(normalized)) return setError(`Este nome já está cadastrado. Localize-o no catálogo para editar.`);
        setName(normalized);
        setInputName('');
        setSaving(true);
        try { await onSave({ nome: normalized }); }
        catch (error) { setError(error.message || 'Não foi possível salvar. Tente novamente.'); }
        finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title={`${item ? 'Editar' : 'Adicionar'} ${label}`}>
            <form onSubmit={submit} noValidate>
                <label htmlFor="catalog-name" className="form-label">Nome {type === 'cursos' ? 'do curso' : 'da igreja'}</label>
                <FormSelect id="catalog-name" allowCreate value={name} inputValue={inputName} options={options} isDisabled={saving} invalid={Boolean(error)}
                    placeholder="Selecione ou digite um novo nome..." aria-describedby={`catalog-help${error ? ' catalog-error' : ''}`}
                    onInputChange={(value, meta) => { if (meta.action === 'input-change') { setInputName(value); setError(''); } }}
                    onChange={event => { setName(event.target.value); setInputName(''); setError(''); }}
                    formatCreateLabel={value => `Usar “${cleanText(value, 100)}”`}
                    isValidNewOption={value => value.trim().length <= 100 && !catalogNameError(value, label) && !alreadyRegistered(value) && !options.some(option => catalogKey(option.value) === catalogKey(value))}
                    noOptionsMessage={() => alreadyRegistered(inputName) ? 'Este nome já está cadastrado.' : 'Digite um nome válido para adicionar.'}
                    formatOptionLabel={option => <span className="flex min-w-0 items-center gap-2">
                        {type === 'cursos' ? <CourseIcon name={option.value} className="!h-5 !w-5 shrink-0" /> : <Church aria-hidden="true" className="!h-5 !w-5 shrink-0" />}
                        <span className="min-w-0 break-words">{option.label}{option.isDisabled && <span className="block text-xs">Já cadastrado</span>}</span>
                    </span>}
                />
                <p id="catalog-help" className="mt-2 text-xs leading-5 text-text-muted">Escolha uma sugestão ou digite um novo nome. As opções marcadas como “Já cadastrado” pertencem a outro item do catálogo.</p>
                {error && <p id="catalog-error" role="alert" className="mt-2 text-xs text-danger">{error}</p>}
                <div className="mt-6 flex border-t border-border pt-5 sm:justify-end">
                    <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </form>
        </Modal>
    );
}
