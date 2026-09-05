import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import FormCheckbox from './FormCheckbox';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import { cleanText, hasValidationErrors, normalizeEmail, phoneDigits, validateProfessor } from '../../shared/validation.mjs';

const initialFormState = { nome: '', contato: '', telefone: '', local: '', cursos: [] };

const formatPhone = value => {
    const digits = phoneDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const ProfessorFormModal = ({ isOpen, onClose, onSave, professor, courses = [], locations = [] }) => {
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
            cursos: (professor.cursos || []).filter(course => courses.includes(course)),
        } : initialFormState);
        setErrors({});
        setPhotoChange(undefined);
        setIsSubmitting(false);
    }, [professor, isOpen, courses]);

    const update = (name, value) => {
        setFormData(previous => ({ ...previous, [name]: value }));
        if (errors[name]) setErrors(previous => ({ ...previous, [name]: '' }));
    };

    const toggleCourse = course => update('cursos', formData.cursos.includes(course)
        ? formData.cursos.filter(item => item !== course)
        : [...formData.cursos, course]);

    const handleSubmit = async event => {
        event.preventDefault();
        if (isSubmitting) return;
        const normalized = { ...formData, nome: cleanText(formData.nome, 100), contato: normalizeEmail(formData.contato), telefone: formatPhone(formData.telefone) };
        const validationErrors = validateProfessor(normalized);
        if (!locations.includes(normalized.local)) validationErrors.local = 'Selecione uma igreja cadastrada.';
        if (normalized.cursos.some(course => !courses.includes(course))) validationErrors.cursos = 'Selecione somente cursos cadastrados.';
        if (hasValidationErrors(validationErrors)) return setErrors(validationErrors);
        setIsSubmitting(true);
        try { await onSave(normalized, photoChange); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    const catalogsReady = courses.length > 0 && locations.length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={professor ? 'Editar professor' : 'Adicionar professor'} maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} noValidate>
                {!catalogsReady && <div className="alert-warning mb-4" role="alert">Não há cursos e igrejas disponíveis nas turmas atuais. Cadastre ou ajuste uma turma antes de adicionar professores.</div>}
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
                                placeholder="Selecione uma igreja"
                                invalid={Boolean(errors.local)}
                            />
                            {errors.local && <p className="mt-1 text-xs text-danger">{errors.local}</p>}
                        </div>
                    </div>
                    <fieldset>
                        <legend className="form-label">Cursos que o professor ministrará</legend>
                        <div className={`grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 ${errors.cursos ? 'border-danger' : 'border-border'}`}>
                            {courses.map(course => (
                                <div key={course} className="rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <FormCheckbox
                                        checked={formData.cursos.includes(course)}
                                        onChange={() => toggleCourse(course)}
                                        label={course}
                                        className="py-2 px-3 min-h-11 items-center"
                                    />
                                </div>
                            ))}
                            {!courses.length && <p className="col-span-full py-4 text-center text-sm text-text-muted">Nenhum curso ativo cadastrado.</p>}
                        </div>
                        {errors.cursos && <p className="mt-1 text-xs text-danger">{errors.cursos}</p>}
                    </fieldset>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" disabled={isSubmitting || !catalogsReady} className="btn btn-primary">{isSubmitting ? 'Salvando...' : professor ? 'Salvar alterações' : 'Salvar e enviar convite'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default ProfessorFormModal;
