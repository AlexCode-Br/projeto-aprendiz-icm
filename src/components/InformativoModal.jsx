import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { httpsUrlError, requiredTextError } from '../../shared/validation.mjs';

const initialFormState = {
    titulo: '',
    categoria: '',
    dataAgendamento: '',
    horaAgendamento: '',
    conteudo: '',
    fixarNoTopo: false,
    exigirConfirmacao: false,
    linkAcao: '',
    textoLink: '',
};

const InformativoModal = ({ isOpen, onClose, onSave, informativo }) => {
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
        const titleError = requiredTextError(formData.titulo, 'O título', 3, 120);
        const contentError = requiredTextError(formData.conteudo, 'O conteúdo', 10, 5000);
        if (titleError) newErrors.titulo = titleError;
        if (!formData.categoria) newErrors.categoria = 'A categoria é obrigatória.';
        if (!formData.dataAgendamento) newErrors.dataAgendamento = 'A data é obrigatória.';
        if (!formData.horaAgendamento) newErrors.horaAgendamento = 'A hora é obrigatória.';
        if (contentError) newErrors.conteudo = contentError;
        const urlError = httpsUrlError(formData.linkAcao);
        if (urlError) newErrors.linkAcao = urlError;
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
        <Modal isOpen={isOpen} onClose={onClose} title={informativo ? 'Editar informativo' : 'Criar informativo'} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label htmlFor="info-title" className="form-label">Título</label>
                                <input id="info-title" name="titulo" maxLength="120" value={formData.titulo} onChange={handleChange} aria-invalid={Boolean(errors.titulo)} className={`form-control ${errors.titulo ? 'border-danger' : ''}`} />
                                {errors.titulo && <p className="text-danger text-xs mt-1">{errors.titulo}</p>}
                            </div>
                            <div>
                                <label htmlFor="info-category" className="form-label">Categoria</label>
                                <select id="info-category" name="categoria" value={formData.categoria} onChange={handleChange} aria-invalid={Boolean(errors.categoria)} className={`form-control ${errors.categoria ? 'border-danger' : ''}`}>
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
                                <label htmlFor="info-date" className="form-label">Data de agendamento</label>
                                <input id="info-date" name="dataAgendamento" type="date" value={formData.dataAgendamento} onChange={handleChange} aria-invalid={Boolean(errors.dataAgendamento)} className={`form-control ${errors.dataAgendamento ? 'border-danger' : ''}`} />
                                {errors.dataAgendamento && <p className="text-danger text-xs mt-1">{errors.dataAgendamento}</p>}
                            </div>
                            <div>
                                <label htmlFor="info-time" className="form-label">Hora de agendamento</label>
                                <input id="info-time" name="horaAgendamento" type="time" value={formData.horaAgendamento} onChange={handleChange} aria-invalid={Boolean(errors.horaAgendamento)} className={`form-control ${errors.horaAgendamento ? 'border-danger' : ''}`} />
                                {errors.horaAgendamento && <p className="text-danger text-xs mt-1">{errors.horaAgendamento}</p>}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="info-content" className="form-label">Conteúdo</label>
                            <textarea id="info-content" name="conteudo" maxLength="5000" value={formData.conteudo} onChange={handleChange} rows="5" aria-invalid={Boolean(errors.conteudo)} className={`form-control min-h-32 ${errors.conteudo ? 'border-danger' : ''}`}></textarea>
                            {errors.conteudo && <p className="text-danger text-xs mt-1">{errors.conteudo}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="fixarNoTopo" checked={formData.fixarNoTopo} onChange={handleChange} className="h-4 w-4 accent-primary" /> Fixar no topo</label>
                            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="exigirConfirmacao" checked={formData.exigirConfirmacao} onChange={handleChange} className="h-4 w-4 accent-primary" /> Exigir confirmação de leitura</label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                            <div>
                                <label htmlFor="info-link" className="form-label">Link de ação (opcional)</label>
                                <input id="info-link" name="linkAcao" type="url" placeholder="https://exemplo.com" value={formData.linkAcao} onChange={handleChange} aria-invalid={Boolean(errors.linkAcao)} className={`form-control ${errors.linkAcao ? 'border-danger' : ''}`} />
                                {errors.linkAcao && <p className="text-danger text-xs mt-1">{errors.linkAcao}</p>}
                            </div>
                            <div>
                                <label htmlFor="info-link-label" className="form-label">Texto do link</label>
                                <input id="info-link-label" name="textoLink" maxLength="80" placeholder="Ex.: Inscreva-se aqui" value={formData.textoLink} onChange={handleChange} aria-invalid={Boolean(errors.textoLink)} className={`form-control ${errors.textoLink ? 'border-danger' : ''}`} />
                                {errors.textoLink && <p className="text-danger text-xs mt-1">{errors.textoLink}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary">Revisar e publicar</button>
                    </div>
                </form>
        </Modal>
    );
};

export default InformativoModal;
