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
    curso: '',
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

const AlunoFormModal = ({ isOpen, onClose, onSave, aluno, offerings = [] }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [availableLocais, setAvailableLocais] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (aluno) {
            setFormData({
                nome: aluno.nome || '',
                contato: aluno.contato || '',
                telefone: aluno.telefone || '',
                classe: aluno.classe || '',
                curso: Array.isArray(aluno.curso) ? aluno.curso[0] : (aluno.curso || ''), // Assume o primeiro curso para edição
                local: aluno.local || '',
                instrumento: aluno.instrumento || 'Não',
            });
            const cursoSelecionado = Array.isArray(aluno.curso) ? aluno.curso[0] : aluno.curso;
            setAvailableLocais([...new Set(offerings.filter(item => item.nome === cursoSelecionado).map(item => item.local))]);
        } else {
            setFormData(initialFormState);
            setAvailableLocais([]);
        }
        setErrors({});
        setSaving(false);
    }, [aluno, isOpen, offerings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const normalizedValue = name === 'telefone' ? formatPhone(value) : value;
        setFormData(prev => ({ ...prev, [name]: normalizedValue }));

        if (name === 'curso') {
            setAvailableLocais([...new Set(offerings.filter(item => item.nome === value).map(item => item.local))]);
            setFormData(prev => ({ ...prev, local: '' }));
            setErrors(prev => ({ ...prev, curso: null, local: null }));
        }

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = validateStudent(formData);
        if (formData.curso && formData.local && !offerings.some(item => item.nome === formData.curso && item.local === formData.local)) {
            newErrors.local = 'Selecione uma igreja disponível para este curso.';
        }
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
            await onSave({ ...formData, nome: cleanText(formData.nome, 100), contato: cleanText(formData.contato, 254), curso: [formData.curso] }, aluno?.id);
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                <label htmlFor="curso" className="form-label">Curso de interesse</label>
                                <FormSelect
                                    name="curso"
                                    id="curso"
                                    value={formData.curso}
                                    onChange={handleChange}
                                    options={[...new Set(offerings.map(item => item.nome))]}
                                    invalid={Boolean(errors.curso)}
                                />
                                {errors.curso && <p className="text-danger text-xs mt-1">{errors.curso}</p>}
                            </div>
                            <div>
                                <label htmlFor="local" className="form-label">Igreja da turma</label>
                                <FormSelect
                                    name="local"
                                    id="local"
                                    value={formData.local}
                                    onChange={handleChange}
                                    isDisabled={!formData.curso}
                                    options={availableLocais}
                                    invalid={Boolean(errors.local)}
                                />
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
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
