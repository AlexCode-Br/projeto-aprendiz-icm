import React, { useState, useEffect } from 'react';

const InformativoModal = ({ isOpen, onClose, onSave, informativo }) => {
    const initialFormState = {
        titulo: '',
        categoria: '',
        dataAgendamento: '',
        horaAgendamento: '',
        conteudo: '',
        fixarNoTopo: false,
        exigirConfirmacao: false,
        linkAcao: '',
        textoLink: ''
    };

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (informativo) {
            setFormData({
                titulo: informativo.titulo || '',
                categoria: informativo.categoria || '',
                // Formata a data para o input type="date" (YYYY-MM-DD)
                dataAgendamento: informativo.data ? new Date(informativo.data.split('/').reverse().join('-')).toISOString().split('T')[0] : '',
                horaAgendamento: informativo.hora || '',
                conteudo: informativo.conteudo || '',
                fixarNoTopo: informativo.fixado || false,
                exigirConfirmacao: informativo.confirmacao || false,
                linkAcao: informativo.linkUrl || '',
                textoLink: informativo.linkTexto || ''
            });
        } else {
            setFormData(initialFormState);
        }
        setErrors({});
    }, [informativo, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!formData.titulo.trim()) newErrors.titulo = 'O título é obrigatório.';
        if (!formData.categoria) newErrors.categoria = 'A categoria é obrigatória.';
        if (!formData.dataAgendamento) newErrors.dataAgendamento = 'A data é obrigatória.';
        if (!formData.horaAgendamento) newErrors.horaAgendamento = 'A hora é obrigatória.';
        if (!formData.conteudo.trim()) newErrors.conteudo = 'O conteúdo é obrigatório.';
        if (formData.linkAcao && !formData.textoLink) newErrors.textoLink = 'O texto para o link é obrigatório.';
        if (formData.textoLink && !formData.linkAcao) newErrors.linkAcao = 'A URL do link é obrigatória.';

        return newErrors;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        // A função onSave (que abre o modal de confirmação) é chamada com os dados
        onSave(formData); 
    };
    
    if (!isOpen) return null;

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-2xl transform">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">{informativo ? 'Editar Informativo' : 'Criar Novo Informativo'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-text-default mb-1">Título</label>
                                <input name="titulo" value={formData.titulo} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.titulo ? 'border-danger' : 'border-border'}`} />
                                {errors.titulo && <p className="text-danger text-xs mt-1">{errors.titulo}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Categoria</label>
                                <select name="categoria" value={formData.categoria} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.categoria ? 'border-danger' : 'border-border'}`}>
                                    <option value="">Selecione...</option>
                                    <option>Geral</option>
                                    <option>Inscrições</option>
                                    <option>Eventos</option>
                                    <option>Urgente</option>
                                </select>
                                {errors.categoria && <p className="text-danger text-xs mt-1">{errors.categoria}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Data de Agendamento</label>
                                <input name="dataAgendamento" type="date" value={formData.dataAgendamento} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.dataAgendamento ? 'border-danger' : 'border-border'}`} />
                                {errors.dataAgendamento && <p className="text-danger text-xs mt-1">{errors.dataAgendamento}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Hora de Agendamento</label>
                                <input name="horaAgendamento" type="time" value={formData.horaAgendamento} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.horaAgendamento ? 'border-danger' : 'border-border'}`} />
                                {errors.horaAgendamento && <p className="text-danger text-xs mt-1">{errors.horaAgendamento}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-default mb-1">Conteúdo</label>
                            <textarea name="conteudo" value={formData.conteudo} onChange={handleChange} rows="5" className={`w-full p-2 border rounded-lg ${errors.conteudo ? 'border-danger' : 'border-border'}`}></textarea>
                            {errors.conteudo && <p className="text-danger text-xs mt-1">{errors.conteudo}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2"><input type="checkbox" name="fixarNoTopo" checked={formData.fixarNoTopo} onChange={handleChange} /> Fixar no topo</label>
                            <label className="flex items-center gap-2"><input type="checkbox" name="exigirConfirmacao" checked={formData.exigirConfirmacao} onChange={handleChange} /> Exigir confirmação de leitura</label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Link de Ação (Opcional)</label>
                                <input name="linkAcao" placeholder="https://exemplo.com" value={formData.linkAcao} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.linkAcao ? 'border-danger' : 'border-border'}`} />
                                {errors.linkAcao && <p className="text-danger text-xs mt-1">{errors.linkAcao}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Texto do Link</label>
                                <input name="textoLink" placeholder="Ex: Inscreva-se aqui" value={formData.textoLink} onChange={handleChange} className={`w-full p-2 border rounded-lg ${errors.textoLink ? 'border-danger' : 'border-border'}`} />
                                {errors.textoLink && <p className="text-danger text-xs mt-1">{errors.textoLink}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">Salvar e Enviar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InformativoModal;