import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import CourseIcon from './CourseIcon';
import { MonitorPlay } from 'lucide-react';
import { catalogKey } from '../../shared/catalog-options.mjs';
import { catalogNameError, cleanText } from '../../shared/validation.mjs';

const TurmaModal = ({ isOpen, onClose, onSave, turma, allProfessores = [], allLocais = [], allCursos = [] }) => {
    const [formData, setFormData] = useState({ nome: '', local: '', professor: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (turma) {
            setFormData({
                nome: turma.nome || '',
                local: turma.local || '',
                professor: turma.professor || '',
            });
        } else {
            setFormData({ nome: '', local: '', professor: '' });
        }
        setErrors({});
    }, [turma, isOpen]);

    const validate = () => {
        const newErrors = {};
        const courseError = catalogNameError(formData.nome, 'curso');
        const locationError = catalogNameError(formData.local, 'local ou modalidade');
        if (courseError) newErrors.nome = courseError;
        if (locationError) newErrors.local = locationError;
        if (!formData.professor) newErrors.professor = 'O professor é obrigatório.';
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        onSave({
            nome: cleanText(formData.nome, 100),
            local: cleanText(formData.local, 100),
            professor: formData.professor,
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    if (!isOpen) return null;

    const modalTitle = turma ? 'Editar turma' : 'Adicionar turma';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="nome" className="form-label">Curso ofertado</label>
                            <FormSelect
                                name="nome"
                                id="nome"
                                allowCreate
                                value={formData.nome}
                                onChange={handleChange}
                                options={allCursos}
                                placeholder="Selecione ou digite um curso"
                                invalid={Boolean(errors.nome)}
                                formatCreateLabel={value => `Usar “${cleanText(value, 100)}”`}
                                isValidNewOption={value => !catalogNameError(value, 'curso') && !allCursos.some(option => catalogKey(option) === catalogKey(value))}
                                formatOptionLabel={option => <span className="flex items-center gap-2"><CourseIcon name={option.value} className="!h-5 !w-5 shrink-0" /><span>{option.label}</span></span>}
                            />
                            <p className="mt-1 text-xs text-text-muted">Escolha uma opção ou digite um curso que ainda não aparece na lista.</p>
                            {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                        </div>
                        <div>
                            <label htmlFor="local" className="form-label">Igreja ou modalidade</label>
                            <FormSelect
                                name="local"
                                id="local"
                                allowCreate
                                value={formData.local}
                                onChange={handleChange}
                                options={allLocais}
                                placeholder="Selecione uma igreja ou EAD"
                                invalid={Boolean(errors.local)}
                                formatCreateLabel={value => `Usar “${cleanText(value, 100)}”`}
                                isValidNewOption={value => !catalogNameError(value, 'local ou modalidade') && !allLocais.some(option => catalogKey(option) === catalogKey(value))}
                                formatOptionLabel={option => <span className="flex items-center gap-2">{catalogKey(option.value) === 'ead' && <MonitorPlay aria-hidden="true" className="!h-5 !w-5 shrink-0" />}<span>{option.label}</span></span>}
                            />
                            <p className="mt-1 text-xs text-text-muted">Para aulas remotas, selecione <strong>EAD</strong>.</p>
                            {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor" className="form-label">Professor</label>
                            <FormSelect
                                name="professor"
                                id="professor"
                                value={formData.professor}
                                onChange={handleChange}
                                options={allProfessores}
                                placeholder="Selecione um professor"
                                invalid={Boolean(errors.professor)}
                            />
                            {errors.professor && <p className="text-danger text-xs mt-1">{errors.professor}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex border-t border-border pt-5 sm:justify-end">
                        <button type="submit" className="btn btn-primary">
                            Salvar
                        </button>
                    </div>
                </form>
        </Modal>
    );
};

export default TurmaModal;
