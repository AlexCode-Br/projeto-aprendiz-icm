import React, { useState, useEffect } from 'react';
import Modal from './Modal';

// Dados mockados para os selects
const cursosPorLocal = {
    'Violão I': ['Pituba', 'Lauro de Freitas', 'Guarani'],
    'Teclado': ['Brotas', 'Guarani'],
    'Bateria': ['Lauro de Freitas', 'Vista Alegre (Remoto)'],
    'Canto Coral': ['Pituba'],
    'Violino': ['Brotas', 'Boca do Rio'],
    'Flauta Transversal': ['Boca do Rio'],
    'Contrabaixo': ['Alto de Coutos'],
    'Violão II': ['Pituba'],
    'Teoria Musical': ['Remoto'],
    'Saxofone': ['Brotas'],
};
const allCourses = Object.keys(cursosPorLocal);

const initialFormState = {
    nome: '',
    contato: '',
    telefone: '',
    igreja: '',
    classe: '',
    curso: '',
    local: '',
    instrumento: 'Não',
};

const AlunoFormModal = ({ isOpen, onClose, onSave, aluno }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [availableLocais, setAvailableLocais] = useState([]);

    useEffect(() => {
        if (aluno) {
            setFormData({
                nome: aluno.nome || '',
                contato: aluno.contato || '',
                telefone: aluno.telefone || '',
                igreja: aluno.igreja || '',
                classe: aluno.classe || '',
                curso: Array.isArray(aluno.curso) ? aluno.curso[0] : (aluno.curso || ''), // Assume o primeiro curso para edição
                local: aluno.local || '',
                instrumento: aluno.instrumento || 'Não',
            });
            // Popula locais ao editar
            const cursoSelecionado = Array.isArray(aluno.curso) ? aluno.curso[0] : aluno.curso;
            if (cursoSelecionado && cursosPorLocal[cursoSelecionado]) {
                setAvailableLocais(cursosPorLocal[cursoSelecionado]);
            }
        } else {
            setFormData(initialFormState);
            setAvailableLocais([]);
        }
        setErrors({});
    }, [aluno, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'curso') {
            setAvailableLocais(cursosPorLocal[value] || []);
            setFormData(prev => ({ ...prev, local: '' })); // Reseta o local ao mudar o curso
        }

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nome.trim()) newErrors.nome = 'O nome é obrigatório.';
        if (!formData.contato.trim()) newErrors.contato = 'O e-mail é obrigatório.';
        else if (!/\S+@\S+\.\S+/.test(formData.contato)) newErrors.contato = 'E-mail inválido.';
        if (!formData.telefone.trim()) newErrors.telefone = 'O telefone é obrigatório.';
        if (!formData.igreja.trim()) newErrors.igreja = 'A igreja é obrigatória.';
        if (!formData.classe) newErrors.classe = 'A classe é obrigatória.';
        if (!formData.curso) newErrors.curso = 'O curso é obrigatório.';
        if (!formData.local) newErrors.local = 'O local é obrigatório.';
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        // No protótipo, o curso é um array, então ajustamos aqui
        onSave({ ...formData, curso: [formData.curso] });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={aluno ? 'Editar aluno' : 'Adicionar aluno'} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({ nome: 'Nome Completo', contato: 'E-mail', telefone: 'Telefone (WhatsApp)', igreja: 'Igreja-Bairro' }).map(([key, label]) => (
                                <div key={key}>
                                    <label htmlFor={key} className="form-label">{label}</label>
                                    <input
                                        type={key === 'contato' ? 'email' : 'text'}
                                        name={key}
                                        id={key}
                                        value={formData[key]}
                                        onChange={handleChange}
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
                                <select name="classe" id="classe" value={formData.classe} onChange={handleChange} aria-invalid={Boolean(errors.classe)} className={`form-control ${errors.classe ? 'border-danger' : ''}`}>
                                    <option value="">Selecione...</option>
                                    <option>Adolescente</option>
                                    <option>Jovem</option>
                                    <option>Senhora</option>
                                    <option>Varão</option>
                                </select>
                                 {errors.classe && <p className="text-danger text-xs mt-1">{errors.classe}</p>}
                            </div>
                            <div>
                                <label htmlFor="curso" className="form-label">Curso de interesse</label>
                                <select name="curso" id="curso" value={formData.curso} onChange={handleChange} aria-invalid={Boolean(errors.curso)} className={`form-control ${errors.curso ? 'border-danger' : ''}`}>
                                    <option value="">Selecione...</option>
                                    {allCourses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {errors.curso && <p className="text-danger text-xs mt-1">{errors.curso}</p>}
                            </div>
                            <div>
                                <label htmlFor="local" className="form-label">Local</label>
                                <select name="local" id="local" value={formData.local} onChange={handleChange} disabled={!formData.curso} aria-invalid={Boolean(errors.local)} className={`form-control disabled:bg-gray-100 dark:disabled:bg-gray-600 ${errors.local ? 'border-danger' : ''}`}>
                                    <option value="">Selecione...</option>
                                    {availableLocais.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                </select>
                                {errors.local && <p className="text-danger text-xs mt-1">{errors.local}</p>}
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-default mb-1">Possui instrumento?</label>
                            <div className="flex items-center space-x-4 mt-2">
                                <label className="flex items-center"><input type="radio" name="instrumento" value="Sim" checked={formData.instrumento === 'Sim'} onChange={handleChange} className="mr-2" /> Sim</label>
                                <label className="flex items-center"><input type="radio" name="instrumento" value="Não" checked={formData.instrumento === 'Não'} onChange={handleChange} className="mr-2" /> Não</label>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary">Salvar alterações</button>
                    </div>
                </form>
        </Modal>
    );
};

export default AlunoFormModal;
