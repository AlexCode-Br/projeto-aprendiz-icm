import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const CursoModal = ({ isOpen, onClose, onSave, curso, allProfessores = [], allLocais = [], allCursos = [] }) => {
    const [formData, setFormData] = useState({ nome: '', local: '', professor: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (curso) {
            setFormData({
                nome: curso.nome || '',
                local: curso.local || '',
                professor: curso.professor || ''
            });
        } else {
            setFormData({ nome: '', local: '', professor: '' });
        }
        setErrors({});
    }, [curso, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!formData.nome.trim()) newErrors.nome = 'O nome do curso é obrigatório.';
        if (!formData.local) newErrors.local = 'A igreja é obrigatória.';
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="nome" className="form-label">Nome do curso</label>
                            <select
                                name="nome"
                                id="nome"
                                value={formData.nome}
                                onChange={handleChange}
                                aria-invalid={Boolean(errors.nome)}
                                className={`form-control ${errors.nome ? 'border-danger' : ''}`}
                            >
                                <option value="">Selecione um curso</option>
                                {allCursos.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                        </div>
                        <div>
                            <label htmlFor="local" className="form-label">Igreja</label>
                            <select
                                name="local"
                                id="local"
                                value={formData.local}
                                onChange={handleChange}
                                aria-invalid={Boolean(errors.local)}
                                className={`form-control ${errors.local ? 'border-danger' : ''}`}
                            >
                                <option value="">Selecione uma igreja</option>
                                {allLocais.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                            {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor" className="form-label">Professor</label>
                            <select
                                name="professor"
                                id="professor"
                                value={formData.professor}
                                onChange={handleChange}
                                aria-invalid={Boolean(errors.professor)}
                                className={`form-control ${errors.professor ? 'border-danger' : ''}`}
                            >
                                <option value="">Selecione um professor</option>
                                {allProfessores.map(prof => <option key={prof} value={prof}>{prof}</option>)}
                            </select>
                            {errors.professor && <p className="text-danger text-xs mt-1">{errors.professor}</p>}
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
