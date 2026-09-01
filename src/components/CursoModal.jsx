import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import { validateClassDetails } from '../../shared/validation.mjs';

const emptyForm = { nome: '', local: '', professor: '', label: '', weekday: '', start_time: '', capacity: '' };

const CursoModal = ({ isOpen, onClose, onSave, curso, allProfessores = [], allLocais = [], allCursos = [] }) => {
    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (curso) {
            setFormData({
                nome: curso.nome || '',
                local: curso.local || '',
                professor: curso.professor || '',
                label: curso.label || '',
                weekday: curso.weekday || '',
                start_time: curso.start_time || '',
                capacity: curso.capacity ?? '',
            });
        } else {
            setFormData(emptyForm);
        }
        setErrors({});
    }, [curso, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!formData.nome.trim()) newErrors.nome = 'O nome do curso é obrigatório.';
        if (!formData.local) newErrors.local = 'A igreja é obrigatória.';
        if (!formData.professor) newErrors.professor = 'O professor é obrigatório.';
        Object.assign(newErrors, validateClassDetails(formData));
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        onSave(formData);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    if (!isOpen) return null;

    const modalTitle = curso ? 'Editar Curso' : 'Adicionar Novo Curso';

    const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="nome" className="form-label">Nome do curso</label>
                            <FormSelect
                                name="nome"
                                id="nome"
                                value={formData.nome}
                                onChange={handleChange}
                                options={allCursos}
                                placeholder="Selecione um curso"
                                invalid={Boolean(errors.nome)}
                            />
                            {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                        </div>
                        <div>
                            <label htmlFor="local" className="form-label">Igreja</label>
                            <FormSelect
                                name="local"
                                id="local"
                                value={formData.local}
                                onChange={handleChange}
                                options={allLocais}
                                placeholder="Selecione uma igreja"
                                invalid={Boolean(errors.local)}
                            />
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
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="label" className="form-label">Identificação da turma (opcional)</label>
                                <input id="label" name="label" value={formData.label} onChange={handleChange} maxLength="100" placeholder="Ex.: Turma B" aria-invalid={Boolean(errors.label)} className={`form-control ${errors.label ? 'border-danger' : ''}`} />
                                {errors.label && <p className="text-danger text-xs mt-1">{errors.label}</p>}
                            </div>
                            <div>
                                <label htmlFor="capacity" className="form-label">Capacidade (opcional)</label>
                                <input id="capacity" name="capacity" type="number" min="1" max="500" value={formData.capacity} onChange={handleChange} placeholder="Sem limite" aria-invalid={Boolean(errors.capacity)} className={`form-control ${errors.capacity ? 'border-danger' : ''}`} />
                                {errors.capacity && <p className="text-danger text-xs mt-1">{errors.capacity}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="weekday" className="form-label">Dia da semana</label>
                                <FormSelect
                                    name="weekday"
                                    id="weekday"
                                    value={formData.weekday}
                                    onChange={handleChange}
                                    options={weekdays}
                                    placeholder="A definir"
                                    invalid={Boolean(errors.weekday)}
                                />
                                {errors.weekday && <p className="text-danger text-xs mt-1">{errors.weekday}</p>}
                            </div>
                            <div>
                                <label htmlFor="start_time" className="form-label">Horário</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    id="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    aria-invalid={Boolean(errors.start_time)}
                                    className={`form-control ${errors.start_time ? 'border-danger' : ''}`}
                                />
                                {errors.start_time && <p className="text-danger text-xs mt-1">{errors.start_time}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary">
                            Salvar
                        </button>
                    </div>
                </form>
        </Modal>
    );
};

export default CursoModal;
