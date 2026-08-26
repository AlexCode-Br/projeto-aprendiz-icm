import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import FormCheckbox from './FormCheckbox';
import { requiredTextError } from '../../shared/validation.mjs';

const initialFormState = {
    titulo: '',
    categoria: '',
    dataAgendamento: '',
    horaAgendamento: '',
    conteudo: '',
    fixarNoTopo: false,
};

const InformativoModal = ({ isOpen, onClose, onSave, informativo }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const editorRef = useRef(null);

    useEffect(() => {
        if (informativo) {
            const nextForm = {
                titulo: informativo.titulo || '',
                categoria: informativo.categoria || '',
                // Formata a data para o input type="date" (YYYY-MM-DD)
                dataAgendamento: informativo.data ? new Date(informativo.data.split('/').reverse().join('-')).toISOString().split('T')[0] : '',
                horaAgendamento: informativo.hora || '',
                conteudo: informativo.conteudo || '',
                fixarNoTopo: informativo.fixado || false,
                
            };
            setFormData(nextForm);
            if (editorRef.current) editorRef.current.innerHTML = nextForm.conteudo;
        } else {
            setFormData(initialFormState);
            if (editorRef.current) editorRef.current.innerHTML = '';
        }
        setErrors({});
    }, [informativo, isOpen]);

    const validate = () => {
        const newErrors = {};
        const titleError = requiredTextError(formData.titulo, 'O título', 3, 120);
        const contentError = requiredTextError(formData.conteudo.replace(/<[^>]+>/g, ' '), 'O conteúdo', 10, 5000);
        if (titleError) newErrors.titulo = titleError;
        if (!formData.categoria) newErrors.categoria = 'A categoria é obrigatória.';
        if (!formData.dataAgendamento) newErrors.dataAgendamento = 'A data é obrigatória.';
        if (!formData.horaAgendamento) newErrors.horaAgendamento = 'A hora é obrigatória.';
        const scheduled = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}:00`);
        if (formData.dataAgendamento && formData.horaAgendamento && scheduled.getTime() < Date.now()) newErrors.dataAgendamento = 'A data e hora devem ser futuras.';
        if (contentError) newErrors.conteudo = contentError;
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
        onSave(formData);
    };

    const format = command => { document.execCommand(command, false); editorRef.current?.focus(); };
    const addLink = () => {
        const url = window.prompt('Cole uma URL HTTPS para inserir no texto:');
        if (url && /^https:\/\//i.test(url)) document.execCommand('createLink', false, url);
        editorRef.current?.focus();
    };
    const addImage = event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png','image/jpeg','image/heic','image/heif'].includes(file.type)) return setErrors(prev => ({ ...prev, conteudo: 'Imagem inválida. Use PNG, JPG/JPEG ou HEIC.' }));
        const maxSize = 5 * 1024 * 1024;
        const reader = new FileReader();
        reader.onerror = () => setErrors(prev => ({ ...prev, conteudo: 'Não foi possível ler a imagem.' }));
        reader.onload = async () => {
            let result = reader.result;
            if (file.size > maxSize && file.type !== 'image/heic' && file.type !== 'image/heif') {
                try {
                    const image = new Image();
                    image.src = result;
                    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
                    const scale = Math.min(1, Math.sqrt(maxSize / file.size));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                    let quality = 0.86;
                    result = canvas.toDataURL('image/jpeg', quality);
                    while (result.length > maxSize * 1.37 && quality > 0.35) { quality -= 0.1; result = canvas.toDataURL('image/jpeg', quality); }
                } catch { return setErrors(prev => ({ ...prev, conteudo: 'Não foi possível comprimir esta imagem.' })); }
            }
            if (result.length > maxSize * 1.37) return setErrors(prev => ({ ...prev, conteudo: 'A imagem continua maior que 5 MB após a compressão.' }));
            document.execCommand('insertImage', false, result); editorRef.current?.focus();
        };
        reader.readAsDataURL(file);
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
                                <FormSelect
                                    id="info-category"
                                    name="categoria"
                                    value={formData.categoria}
                                    onChange={handleChange}
                                    options={['Geral', 'Inscrições', 'Eventos', 'Urgente']}
                                    invalid={Boolean(errors.categoria)}
                                />
                                {errors.categoria && <p className="text-danger text-xs mt-1">{errors.categoria}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="info-date" className="form-label">Data de agendamento</label>
                                <input id="info-date" name="dataAgendamento" type="date" min={new Date().toISOString().slice(0, 10)} value={formData.dataAgendamento} onChange={handleChange} aria-invalid={Boolean(errors.dataAgendamento)} className={`form-control ${errors.dataAgendamento ? 'border-danger' : ''}`} />
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
                                <div className="mb-2 flex flex-wrap items-center gap-1 rounded-t-lg border border-border bg-surface-muted p-2" role="toolbar" aria-label="Formatação do conteúdo">
                                    {[['bold','Negrito','B'],['italic','Itálico','I'],['underline','Sublinhado','U']].map(([command,label,icon]) => <button key={command} type="button" onClick={() => format(command)} className="min-h-9 min-w-9 rounded px-2 font-semibold text-text-default hover:bg-surface-hover" aria-label={label}><span className={command}>{icon}</span></button>)}
                                    <button type="button" onClick={() => format('insertUnorderedList')} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Lista com marcadores">• Lista</button>
                                    <button type="button" onClick={addLink} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Inserir link">🔗 Link</button>
                                    <label className="min-h-9 cursor-pointer rounded px-2 py-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Adicionar imagem">🖼 Imagem<input type="file" className="sr-only" accept="image/png,image/jpeg,image/heic,image/heif" onChange={addImage} /></label>
                                </div>
                                <div id="info-content" ref={editorRef} contentEditable role="textbox" aria-multiline="true" suppressContentEditableWarning onInput={event => { const value = event.currentTarget.innerHTML; setFormData(prev => ({ ...prev, conteudo: value })); setErrors(prev => ({ ...prev, conteudo: null })); }} aria-invalid={Boolean(errors.conteudo)} className={`form-control min-h-40 overflow-y-auto rounded-t-none ${errors.conteudo ? 'border-danger' : ''}`} />
                                <p className="mt-1 text-xs text-text-muted">Formatação e imagens PNG, JPG/JPEG ou HEIC. Imagens acima de 5 MB serão comprimidas automaticamente.</p>
                                {errors.conteudo && <p className="text-danger text-xs mt-1">{errors.conteudo}</p>}
                        </div>
                        <div className="space-y-3 pt-2">
                            <FormCheckbox name="fixarNoTopo" checked={formData.fixarNoTopo} onChange={handleChange} label="Fixar no topo" />
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
