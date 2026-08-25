import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

// Mock data
const allCoursesList = ["Violão I", "Teclado", "Bateria", "Canto Coral", "Violino", "Flauta Transversal", "Saxofone", "Contrabaixo", "Violão II", "Teoria Musical"];

const initialFormState = {
    nome: '',
    contato: '',
    telefone: '',
    local: '',
    cursos: [],
};

const ProfessorFormModal = ({ isOpen, onClose, onSave, professor }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [courseInput, setCourseInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRef = useRef(null);

    useEffect(() => {
        if (professor) {
            setFormData({
                nome: professor.nome || '',
                contato: professor.contato || '',
                telefone: professor.telefone || '',
                local: professor.local || '',
                cursos: professor.cursos || [],
            });
        } else {
            setFormData(initialFormState);
        }
        setErrors({});
        setIsSubmitting(false);
    }, [professor, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };
    
    const handleCourseInputChange = (e) => {
        const value = e.target.value;
        setCourseInput(value);
        if (value) {
            const filtered = allCoursesList.filter(
                course => !formData.cursos.includes(course) && course.toLowerCase().includes(value.toLowerCase())
            );
            setSuggestions(filtered);
            setIsSuggestionsVisible(true);
        } else {
            setSuggestions([]);
            setIsSuggestionsVisible(false);
        }
    };

    const addCourse = (course) => {
        setFormData(prev => ({ ...prev, cursos: [...prev.cursos, course] }));
        setCourseInput('');
        setSuggestions([]);
        setIsSuggestionsVisible(false);
        inputRef.current?.focus();
    };

    const removeCourse = (courseToRemove) => {
        setFormData(prev => ({
            ...prev,
            cursos: prev.cursos.filter(course => course !== courseToRemove),
        }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nome.trim()) newErrors.nome = 'O nome é obrigatório.';
        if (!formData.contato.trim()) newErrors.contato = 'O e-mail é obrigatório.';
        if (!formData.telefone.trim()) newErrors.telefone = 'O telefone é obrigatório.';
        if (!formData.local.trim()) newErrors.local = 'O local é obrigatório.';
        if (formData.cursos.length === 0) newErrors.cursos = 'Pelo menos um curso deve ser selecionado.';
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setIsSubmitting(true);
        try {
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={professor ? 'Editar professor' : 'Adicionar professor'}>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="professor-nome" className="form-label">Nome completo</label>
                                <input id="professor-nome" name="nome" value={formData.nome} onChange={handleChange} aria-invalid={Boolean(errors.nome)} className={`form-control ${errors.nome ? 'border-danger' : ''}`} />
                                {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                            </div>
                            <div>
                                <label htmlFor="professor-email" className="form-label">E-mail</label>
                                <input id="professor-email" name="contato" type="email" value={formData.contato} onChange={handleChange} aria-invalid={Boolean(errors.contato)} className={`form-control ${errors.contato ? 'border-danger' : ''}`} />
                                {errors.contato && <p className="text-danger text-xs mt-1">{errors.contato}</p>}
                            </div>
                            <div>
                                <label htmlFor="professor-telefone" className="form-label">Telefone</label>
                                <input id="professor-telefone" name="telefone" value={formData.telefone} onChange={handleChange} aria-invalid={Boolean(errors.telefone)} className={`form-control ${errors.telefone ? 'border-danger' : ''}`} />
                                {errors.telefone && <p className="text-danger text-xs mt-1">{errors.telefone}</p>}
                            </div>
                             <div>
                                <label htmlFor="professor-local" className="form-label">Local principal</label>
                                <input id="professor-local" name="local" value={formData.local} onChange={handleChange} aria-invalid={Boolean(errors.local)} className={`form-control ${errors.local ? 'border-danger' : ''}`} />
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                            </div>
                        </div>
                        <div className="relative">
                            <label htmlFor="professor-cursos" className="form-label">Cursos</label>
                            <div className={`course-input-container w-full border rounded-lg flex flex-wrap items-center p-2 gap-2 ${errors.cursos ? 'border-danger' : 'border-border'}`}>
                                {formData.cursos.map(course => (
                                    <span key={course} className="course-tag bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center">
                                        {course}
                                        <button type="button" aria-label={`Remover ${course}`} onClick={() => removeCourse(course)} className="ml-1 rounded-full px-1 text-white hover:bg-white/20">&times;</button>
                                    </span>
                                ))}
                                <input
                                    ref={inputRef}
                                    id="professor-cursos"
                                    type="text"
                                    value={courseInput}
                                    onChange={handleCourseInputChange}
                                    onFocus={() => setIsSuggestionsVisible(true)}
                                    onBlur={() => setTimeout(() => setIsSuggestionsVisible(false), 150)}
                                    className="flex-grow bg-transparent focus:outline-none"
                                    placeholder="Digite para adicionar um curso"
                                />
                            </div>
                             {isSuggestionsVisible && suggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white dark:bg-surface border border-border mt-1 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {suggestions.map(suggestion => (
                                        <li key={suggestion} onMouseDown={() => addCourse(suggestion)} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {errors.cursos && <p className="text-danger text-xs mt-1">{errors.cursos}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
        </Modal>
    );
};

export default ProfessorFormModal;
