import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormCheckbox from './FormCheckbox';
import FormSelect from './FormSelect';
import FormRadio from './FormRadio';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import { cleanText, validateStudent } from '../../shared/validation.mjs';

const initialFormState = {
    nome: '',
    contato: '',
    telefone: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_consent: false,
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
    const [photoChange, setPhotoChange] = useState(undefined);

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
                guardian_name: aluno.guardian_name || '',
                guardian_phone: aluno.guardian_phone || '',
                guardian_consent: Boolean(aluno.guardian_consent_at),
                local: aluno.igreja_id || aluno.local || '',
                instrumento: aluno.instrumento || 'Não',
            });
        } else {
            setFormData(initialFormState);
        }
        setErrors({});
        setPhotoChange(undefined);
        setSaving(false);
    }, [aluno, isOpen, offerings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const normalizedValue = ['telefone', 'guardian_phone'].includes(name) ? formatPhone(value) : value;
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
            await onSave({
                ...formData,
                church_id: formData.local,
                nome: cleanText(formData.nome, 100),
                contato: cleanText(formData.contato, 254),
            }, aluno?.id, photoChange);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={aluno ? 'Editar aluno' : 'Adicionar aluno'} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <ProfilePhotoPicker name={formData.nome} currentUrl={aluno?.foto_url || ''} value={photoChange} onChange={setPhotoChange} disabled={saving} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({ nome: 'Nome completo', contato: 'E-mail (opcional)', telefone: 'Telefone (WhatsApp)' }).map(([key, label]) => (
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
                                    allowCreate
                                    placeholder="Selecione ou digite uma igreja"
                                    formatCreateLabel={inputValue => `Usar “${inputValue}” como igreja`}
                                    noOptionsMessage={() => 'Digite o nome completo da igreja'}
                                    invalid={Boolean(errors.local)}
                                />
                                <p className="mt-1 text-xs text-text-muted">Escolha uma opção ou digite o nome de outra igreja.</p>
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                            </div>
                            {formData.classe === 'Adolescente' && <>
                                <div>
                                    <label htmlFor="guardian_name" className="form-label">Nome do responsável</label>
                                    <input id="guardian_name" name="guardian_name" value={formData.guardian_name} onChange={handleChange} autoComplete="name" maxLength="100" aria-invalid={Boolean(errors.guardian_name)} className={`form-control ${errors.guardian_name ? 'border-danger' : ''}`} />
                                    {errors.guardian_name && <p className="mt-1 text-xs text-danger">{errors.guardian_name}</p>}
                                </div>
                                <div>
                                    <label htmlFor="guardian_phone" className="form-label">Telefone do responsável</label>
                                    <input id="guardian_phone" name="guardian_phone" type="tel" inputMode="tel" value={formData.guardian_phone} onChange={handleChange} autoComplete="tel" maxLength="15" aria-invalid={Boolean(errors.guardian_phone)} className={`form-control ${errors.guardian_phone ? 'border-danger' : ''}`} />
                                    {errors.guardian_phone && <p className="mt-1 text-xs text-danger">{errors.guardian_phone}</p>}
                                </div>
                                <div className="rounded-lg border border-border bg-surface-muted/40 p-4 md:col-span-2">
                                    <FormCheckbox
                                        id="guardian_consent"
                                        name="guardian_consent"
                                        checked={formData.guardian_consent}
                                        onChange={event => {
                                            setFormData(previous => ({ ...previous, guardian_consent: event.target.checked }));
                                            if (errors.guardian_consent) setErrors(previous => ({ ...previous, guardian_consent: null }));
                                        }}
                                        label="Autorização do responsável legal"
                                        description="Confirmo que o responsável autorizou o cadastro e o uso destes dados para a gestão das atividades do projeto."
                                        aria-invalid={Boolean(errors.guardian_consent)}
                                    />
                                    {errors.guardian_consent && <p className="mt-2 text-xs text-danger">{errors.guardian_consent}</p>}
                                </div>
                            </>}
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
