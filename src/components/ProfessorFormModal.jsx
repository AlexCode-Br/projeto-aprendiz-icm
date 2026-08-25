import React, { useState, useEffect, useRef } from 'react';

// Mock data
const allCoursesList = ["Violão I", "Teclado", "Bateria", "Canto Coral", "Violino", "Flauta Transversal", "Saxofone", "Contrabaixo", "Violão II", "Teoria Musical"];

const ProfessorFormModal = ({ isOpen, onClose, onSave, professor }) => {
    const initialFormState = {
        nome: '',
        contato: '',
        telefone: '',
        local: '',
        cursos: [],
    };

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [courseInput, setCourseInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);

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

    const handleSubmit = (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        onSave(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">{professor ? 'Editar Professor' : 'Adicionar Novo Professor'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default">&times;</button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-4 md:p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Nome Completo</label>
                                <input name="nome" value={formData.nome} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg ${errors.nome ? 'border-danger' : 'border-border'}`} />
                                {errors.nome && <p className="text-danger text-xs mt-1">{errors.nome}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">E-mail</label>
                                <input name="contato" type="email" value={formData.contato} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg ${errors.contato ? 'border-danger' : 'border-border'}`} />
                                {errors.contato && <p className="text-danger text-xs mt-1">{errors.contato}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Telefone</label>
                                <input name="telefone" value={formData.telefone} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg ${errors.telefone ? 'border-danger' : 'border-border'}`} />
                                {errors.telefone && <p className="text-danger text-xs mt-1">{errors.telefone}</p>}
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Local Principal</label>
                                <input name="local" value={formData.local} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg ${errors.local ? 'border-danger' : 'border-border'}`} />
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-text-default mb-1">Cursos</label>
                            <div className={`course-input-container w-full border rounded-lg flex flex-wrap items-center p-2 gap-2 ${errors.cursos ? 'border-danger' : 'border-border'}`}>
                                {formData.cursos.map(course => (
                                    <span key={course} className="course-tag bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center">
                                        {course}
                                        <button type="button" onClick={() => removeCourse(course)} className="ml-2 text-white hover:text-gray-200">&times;</button>
                                    </span>
                                ))}
                                <input
                                    ref={inputRef}
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
                    <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfessorFormModal;