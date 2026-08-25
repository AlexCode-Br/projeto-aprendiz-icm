import React, { useState, useEffect } from 'react';

const CursoModal = ({ isOpen, onClose, onSave, curso, allProfessores, allLocais }) => {
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
        if (!formData.local) newErrors.local = 'O local é obrigatório.';
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
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 opacity-100">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-lg transform scale-100">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">{modalTitle}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-4 md:p-6 space-y-4">
                        <div>
                            <label htmlFor="nome" className="block text-sm font-medium text-text-default mb-1">Nome do Curso</label>
                            <input
                                type="text"
                                name="nome"
                                id="nome"
                                value={formData.nome}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg transition bg-surface ${errors.nome ? 'border-danger' : 'border-border focus:border-primary'}`}
                            />
                            {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                        </div>
                        <div>
                            <label htmlFor="local" className="block text-sm font-medium text-text-default mb-1">Local</label>
                            <select
                                name="local"
                                id="local"
                                value={formData.local}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg transition bg-surface ${errors.local ? 'border-danger' : 'border-border focus:border-primary'}`}
                            >
                                <option value="">Selecione um local</option>
                                {allLocais.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                            {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                        </div>
                        <div>
                            <label htmlFor="professor" className="block text-sm font-medium text-text-default mb-1">Professor</label>
                            <select
                                name="professor"
                                id="professor"
                                value={formData.professor}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg transition bg-surface ${errors.professor ? 'border-danger' : 'border-border focus:border-primary'}`}
                            >
                                <option value="">Selecione um professor</option>
                                {allProfessores.map(prof => <option key={prof} value={prof}>{prof}</option>)}
                            </select>
                            {errors.professor && <p className="text-danger text-xs mt-1">{errors.professor}</p>}
                        </div>
                    </div>
                    <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30 rounded-b-lg">
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors">
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CursoModal;