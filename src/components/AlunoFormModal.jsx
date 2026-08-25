import React, { useState, useEffect } from 'react';

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

const AlunoFormModal = ({ isOpen, onClose, onSave, aluno }) => {
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
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 opacity-100">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-2xl transform scale-100">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">{aluno ? 'Editar Aluno' : 'Adicionar Novo Aluno'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({ nome: 'Nome Completo', contato: 'E-mail', telefone: 'Telefone (WhatsApp)', igreja: 'Igreja-Bairro' }).map(([key, label]) => (
                                <div key={key}>
                                    <label htmlFor={key} className="block text-sm font-medium text-text-default mb-1">{label}</label>
                                    <input
                                        type={key === 'contato' ? 'email' : 'text'}
                                        name={key}
                                        id={key}
                                        value={formData[key]}
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border rounded-lg bg-surface ${errors[key] ? 'border-danger' : 'border-border'}`}
                                    />
                                    {errors[key] && <p className="text-danger text-xs mt-1">{errors[key]}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             <div>
                                <label htmlFor="classe" className="block text-sm font-medium text-text-default mb-1">Classe</label>
                                <select name="classe" id="classe" value={formData.classe} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg bg-surface ${errors.classe ? 'border-danger' : 'border-border'}`}>
                                    <option value="">Selecione...</option>
                                    <option>Adolescente</option>
                                    <option>Jovem</option>
                                    <option>Senhora</option>
                                    <option>Varão</option>
                                </select>
                                 {errors.classe && <p className="text-danger text-xs mt-1">{errors.classe}</p>}
                            </div>
                            <div>
                                <label htmlFor="curso" className="block text-sm font-medium text-text-default mb-1">Curso de Interesse</label>
                                <select name="curso" id="curso" value={formData.curso} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg bg-surface ${errors.curso ? 'border-danger' : 'border-border'}`}>
                                    <option value="">Selecione...</option>
                                    {allCourses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {errors.curso && <p className="text-danger text-xs mt-1">{errors.curso}</p>}
                            </div>
                            <div>
                                <label htmlFor="local" className="block text-sm font-medium text-text-default mb-1">Local</label>
                                <select name="local" id="local" value={formData.local} onChange={handleChange} disabled={!formData.curso} className={`w-full px-3 py-2 border rounded-lg bg-surface disabled:bg-gray-100 dark:disabled:bg-gray-600 ${errors.local ? 'border-danger' : 'border-border'}`}>
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
                    <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AlunoFormModal;