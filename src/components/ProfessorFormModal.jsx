import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import { cleanText, catalogNameError, hasValidationErrors, normalizeEmail, phoneDigits, validateProfessor } from '../../shared/validation.mjs';
import { catalogKey } from '../../shared/catalog-options.mjs';

const initialFormState = { nome: '', contato: '', telefone: '', local: '' };
const professorFormId = 'professor-form';

const formatPhone = value => {
    const digits = phoneDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const ProfessorFormModal = ({ isOpen, onClose, onSave, professor, locations = [] }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [photoChange, setPhotoChange] = useState(undefined);

    useEffect(() => {
        setFormData(professor ? {
            nome: professor.nome || '',
            contato: professor.contato || '',
            telefone: professor.telefone || '',
            local: professor.local || '',
        } : initialFormState);
        setErrors({});
        setPhotoChange(undefined);
        setIsSubmitting(false);
    }, [professor, isOpen]);

    const update = (name, value) => {
        setFormData(previous => ({ ...previous, [name]: value }));
        if (errors[name]) setErrors(previous => ({ ...previous, [name]: '' }));
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (isSubmitting) return;
        const normalized = { ...formData, nome: cleanText(formData.nome, 100), contato: normalizeEmail(formData.contato), telefone: formatPhone(formData.telefone) };
        const validationErrors = validateProfessor(normalized);
        const locationError = catalogNameError(normalized.local, 'igreja');
        if (locationError) validationErrors.local = locationError;
        if (['ead', 'remoto'].includes(catalogKey(normalized.local))) validationErrors.local = 'Selecione uma igreja física.';
        if (hasValidationErrors(validationErrors)) return setErrors(validationErrors);
        setIsSubmitting(true);
        try { await onSave(normalized, photoChange); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    const footer = (
        <div className="flex sm:justify-end">
            <button type="submit" form={professorFormId} disabled={isSubmitting} className="btn btn-primary">{isSubmitting ? 'Salvando...' : professor ? 'Salvar alterações' : 'Salvar e enviar convite'}</button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={professor ? 'Editar professor' : 'Adicionar professor'} footer={footer} maxWidth="max-w-2xl">
            <form id={professorFormId} onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                    <ProfilePhotoPicker name={formData.nome} currentUrl={professor?.foto_url || ''} value={photoChange} onChange={setPhotoChange} disabled={isSubmitting} />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label htmlFor="professor-nome" className="form-label">Nome completo</label>
                            <input id="professor-nome" name="nome" autoComplete="name" maxLength="100" value={formData.nome} onChange={event => update('nome', event.target.value)} aria-invalid={Boolean(errors.nome)} className={`form-control ${errors.nome ? 'border-danger' : ''}`} />
                            {errors.nome && <p className="mt-1 text-xs text-danger">{errors.nome}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor-email" className="form-label">E-mail</label>
                            <input id="professor-email" name="contato" type="email" autoComplete="email" inputMode="email" maxLength="254" value={formData.contato} onChange={event => update('contato', event.target.value)} aria-invalid={Boolean(errors.contato)} className={`form-control ${errors.contato ? 'border-danger' : ''}`} />
                            {errors.contato && <p className="mt-1 text-xs text-danger">{errors.contato}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor-telefone" className="form-label">Telefone com DDD</label>
                            <input id="professor-telefone" name="telefone" type="tel" autoComplete="tel" inputMode="tel" maxLength="15" placeholder="(71) 99999-9999" value={formData.telefone} onChange={event => update('telefone', formatPhone(event.target.value))} aria-invalid={Boolean(errors.telefone)} className={`form-control ${errors.telefone ? 'border-danger' : ''}`} />
                            {errors.telefone && <p className="mt-1 text-xs text-danger">{errors.telefone}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor-local" className="form-label">Igreja principal</label>
                            <FormSelect
                                id="professor-local"
                                name="local"
                                value={formData.local}
                                onChange={event => update('local', event.target.value)}
                                options={locations}
                                allowCreate
                                placeholder="Selecione ou digite uma igreja"
                                formatCreateLabel={inputValue => `Usar “${inputValue}” como igreja`}
                                noOptionsMessage={() => 'Digite o nome completo da igreja'}
                                invalid={Boolean(errors.local)}
                            />
                            <p className="mt-1 text-xs text-text-muted">Escolha uma opção ou digite o nome de outra igreja.</p>
                            {errors.local && <p className="mt-1 text-xs text-danger">{errors.local}</p>}
                        </div>
                    </div>
                    <p className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3 text-sm text-text-muted">Os cursos e as turmas deste professor são definidos exclusivamente na página <strong className="text-text-default">Turmas</strong>.</p>
                </div>
            </form>
        </Modal>
    );
};

export default ProfessorFormModal;
