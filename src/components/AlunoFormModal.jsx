import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import FormRadio from './FormRadio';
import { cleanText, validateStudent } from '../../shared/validation.mjs';

const initialFormState = {
    nome: '',
    contato: '',
    telefone: '',
    classe: '',
    turmas: [],
    local: '',
    instrumento: 'Não',
};

const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const AlunoFormModal = ({ isOpen, onClose, onSave, aluno, offerings = [], churches = [] }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const offeringOptions = React.useMemo(() => offerings.map(item => ({
        value: item.id,
        label: `${item.nome} — ${item.local}${item.professor ? ` · ${item.professor}` : ''}`,
        courseName: item.nome,
    })), [offerings]);

    useEffect(() => {
        if (aluno) {
            setFormData({
                nome: aluno.nome || '',
                contato: aluno.contato || '',
                telefone: aluno.telefone || '',
                classe: aluno.classe || '',
                turmas: Array.isArray(aluno.turmas) ? aluno.turmas.slice(0, 3).map(item => item.id) : [],
                local: aluno.igreja || aluno.local || '',
                instrumento: aluno.instrumento || 'Não',
            });
        } else {
            setFormData(initialFormState);
        }
        setErrors({});
        setSaving(false);
    }, [aluno, isOpen, offerings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const normalizedValue = name === 'telefone' ? formatPhone(value) : value;
        setFormData(prev => ({ ...prev, [name]: normalizedValue }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        if (name === 'turmas' && errors.curso) {
            setErrors(prev => ({ ...prev, curso: null }));
        }
    };

    const validate = () => {
        const newErrors = validateStudent(formData);
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setSaving(true);
        try {
            await onSave({ ...formData, nome: cleanText(formData.nome, 100), contato: cleanText(formData.contato, 254) }, aluno?.id);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={aluno ? 'Editar aluno' : 'Adicionar aluno'} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({ nome: 'Nome completo', contato: 'E-mail', telefone: 'Telefone (WhatsApp)' }).map(([key, label]) => (
                                <div key={key}>
                                    <label htmlFor={key} className="form-label">{label}</label>
                                    <input
                                        type={key === 'contato' ? 'email' : key === 'telefone' ? 'tel' : 'text'}
                                        name={key}
                                        id={key}
                                        value={formData[key]}
                                        onChange={handleChange}
                                        autoComplete={key === 'nome' ? 'name' : key === 'contato' ? 'email' : 'tel'}
                                        inputMode={key === 'telefone' ? 'tel' : undefined}
                                        maxLength={key === 'contato' ? 254 : key === 'telefone' ? 15 : 100}
                                        aria-invalid={Boolean(errors[key])}
                                        className={`form-control ${errors[key] ? 'border-danger' : ''}`}
                                    />
                                    {errors[key] && <p className="text-danger text-xs mt-1">{errors[key]}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="classe" className="form-label">Classe</label>
                                <FormSelect
                                    name="classe"
                                    id="classe"
                                    value={formData.classe}
                                    onChange={handleChange}
                                    options={['Adolescente', 'Jovem', 'Senhora', 'Varão']}
                                    invalid={Boolean(errors.classe)}
                                />
                                 {errors.classe && <p className="text-danger text-xs mt-1">{errors.classe}</p>}
                            </div>
                            <div>
                                <label htmlFor="local" className="form-label">Igreja</label>
                                <FormSelect
                                    name="local"
                                    id="local"
                                    value={formData.local}
                                    onChange={handleChange}
                                    options={churches}
                                    invalid={Boolean(errors.local)}
                                />
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="curso" className="form-label">Cursos de interesse</label>
                                <FormSelect
                                    name="turmas"
                                    id="curso"
                                    value={formData.turmas}
                                    onChange={handleChange}
                                    options={offeringOptions}
                                    isMulti
                                    isClearable
                                    closeMenuOnSelect={false}
                                    isOptionDisabled={option => {
                                        if (formData.turmas.includes(option.value)) return false;
                                        if (formData.turmas.length >= 3) return true;
                                        const selectedCourseNames = formData.turmas
                                            .map(classId => offeringOptions.find(item => item.value === classId)?.courseName)
                                            .filter(Boolean);
                                        return selectedCourseNames.includes(option.courseName);
                                    }}
                                    invalid={Boolean(errors.curso)}
                                />
                                <p className="mt-1 text-xs text-text-muted">Selecione até 3 cursos. Cada curso aparecerá como uma tag.</p>
                                {errors.curso && <p className="text-danger text-xs mt-1">{errors.curso}</p>}
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-default mb-1">Possui instrumento?</label>
                            <div className="flex items-center space-x-6 mt-2">
                                <FormRadio name="instrumento" value="Sim" checked={formData.instrumento === 'Sim'} onChange={handleChange} label="Sim" className="items-center" />
                                <FormRadio name="instrumento" value="Não" checked={formData.instrumento === 'Não'} onChange={handleChange} label="Não" className="items-center" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : aluno ? 'Salvar alterações' : 'Adicionar aluno'}</button>
                    </div>
                </form>
        </Modal>
    );
};

export default AlunoFormModal;
