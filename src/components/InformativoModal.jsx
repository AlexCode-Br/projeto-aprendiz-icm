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
    anexos: [],
};

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 3;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/heic', 'image/heif']);

const formatFileSize = bytes => {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const dataUrlByteSize = value => {
    const base64 = String(value || '').split(',')[1] || '';
    const normalized = base64.replace(/\s/g, '');
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(normalized.length * 3 / 4) - padding);
};

const InformativoModal = ({ isOpen, onClose, onSave, informativo }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkError, setLinkError] = useState('');
    const [imageProcessing, setImageProcessing] = useState(false);
    const editorRef = useRef(null);
    const imageInputRef = useRef(null);
    const savedSelectionRef = useRef(null);

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
                anexos: Array.isArray(informativo.anexos) ? informativo.anexos : [],
            };
            setFormData(nextForm);
            if (editorRef.current) editorRef.current.innerHTML = nextForm.conteudo;
        } else {
            setFormData(initialFormState);
            if (editorRef.current) editorRef.current.innerHTML = '';
        }
        setErrors({});
        setLinkDialogOpen(false);
        setLinkUrl('');
        setLinkError('');
        setImageProcessing(false);
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
        if (imageProcessing) return setErrors(prev => ({ ...prev, conteudo: 'Aguarde o processamento da imagem.' }));
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        onSave(formData);
    };

    const syncEditor = () => {
        if (!editorRef.current) return;
        setFormData(prev => ({ ...prev, conteudo: editorRef.current.innerHTML }));
        setErrors(prev => ({ ...prev, conteudo: null }));
    };
    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    };
    const restoreSelection = () => {
        editorRef.current?.focus();
        const selection = window.getSelection();
        if (savedSelectionRef.current && selection) { selection.removeAllRanges(); selection.addRange(savedSelectionRef.current); }
    };
    const format = command => { restoreSelection(); document.execCommand(command, false); syncEditor(); };
    const openLinkDialog = () => { saveSelection(); setLinkUrl(''); setLinkError(''); setLinkDialogOpen(true); };
    const applyLink = event => {
        event.preventDefault();
        const value = linkUrl.trim();
        if (!/^https:\/\//i.test(value)) return setLinkError('Use uma URL HTTPS válida.');
        restoreSelection();
        const selection = window.getSelection();
        if (selection?.toString().trim()) document.execCommand('createLink', false, value);
        else document.execCommand('insertHTML', false, `<a href="${value.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${value}</a>`);
        syncEditor();
        setLinkDialogOpen(false);
    };
    const addImage = event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const extension = file.name.split('.').pop()?.toLowerCase();
        const extensionType = extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : ['heic', 'heif'].includes(extension) ? `image/${extension}` : '';
        const inputType = IMAGE_TYPES.has(file.type) ? file.type : extensionType;
        const isImage = Boolean(inputType);
        if (!isImage) return setErrors(prev => ({ ...prev, conteudo: 'Imagem inválida. Use PNG, JPG/JPEG ou HEIC.' }));
        if ((formData.anexos || []).length >= MAX_ATTACHMENT_COUNT) return setErrors(prev => ({ ...prev, anexos: `Adicione no máximo ${MAX_ATTACHMENT_COUNT} imagens por informativo.` }));
        setImageProcessing(true);
        const reader = new FileReader();
        reader.onerror = () => { setImageProcessing(false); setErrors(prev => ({ ...prev, conteudo: 'Não foi possível ler a imagem.' })); };
        reader.onload = async () => {
            let result = reader.result;
            let outputType = inputType;
            if (file.size > MAX_ATTACHMENT_SIZE && !['image/heic', 'image/heif'].includes(inputType)) {
                try {
                    const image = new Image();
                    image.src = result;
                    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
                    let scale = Math.min(1, Math.sqrt(MAX_ATTACHMENT_SIZE / file.size));
                    let compressed = '';
                    for (let attempt = 0; attempt < 6; attempt += 1) {
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                        let quality = 0.86;
                        compressed = canvas.toDataURL('image/jpeg', quality);
                        while (dataUrlByteSize(compressed) > MAX_ATTACHMENT_SIZE && quality > 0.35) {
                            quality -= 0.1;
                            compressed = canvas.toDataURL('image/jpeg', quality);
                        }
                        if (dataUrlByteSize(compressed) <= MAX_ATTACHMENT_SIZE) break;
                        scale *= 0.72;
                    }
                    result = compressed;
                    outputType = 'image/jpeg';
                } catch { setImageProcessing(false); return setErrors(prev => ({ ...prev, conteudo: 'Não foi possível comprimir esta imagem neste navegador.' })); }
            }
            if (dataUrlByteSize(result) > MAX_ATTACHMENT_SIZE) {
                setImageProcessing(false);
                return setErrors(prev => ({ ...prev, conteudo: ['image/heic', 'image/heif'].includes(inputType)
                    ? 'Imagens HEIC acima de 5 MB não podem ser comprimidas neste navegador. Converta para JPG e tente novamente.'
                    : 'A imagem continua maior que 5 MB após a compressão.' }));
            }
            const outputName = outputType === 'image/jpeg' && !/\.(jpe?g)$/i.test(file.name)
                ? `${file.name.replace(/\.[^.]+$/, '')}.jpg`
                : file.name;
            const attachment = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: outputName, tipo: outputType, tamanho: dataUrlByteSize(result), dataUrl: result };
            setFormData(prev => ({ ...prev, anexos: [...(prev.anexos || []), attachment] }));
            setErrors(prev => ({ ...prev, conteudo: null, anexos: null }));
            setImageProcessing(false);
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
                                    {[['bold','Negrito','B'],['italic','Itálico','I'],['underline','Sublinhado','U']].map(([command,label,icon]) => <button key={command} type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format(command)} className="min-h-9 min-w-9 rounded px-2 font-semibold text-text-default hover:bg-surface-hover" aria-label={label}><span className={command}>{icon}</span></button>)}
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format('insertUnorderedList')} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Lista com marcadores">• Lista</button>
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format('insertOrderedList')} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Lista numerada">1. Lista</button>
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={openLinkDialog} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Inserir link">🔗 Link</button>
                                    <button type="button" onClick={() => imageInputRef.current?.click()} className="min-h-9 rounded px-2 text-sm text-text-default hover:bg-surface-hover" aria-label="Anexar imagem">🖼 Anexar imagem</button>
                                    <input ref={imageInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/heic,image/heif" onChange={addImage} />
                                </div>
                                <div id="info-content" ref={editorRef} contentEditable role="textbox" aria-multiline="true" suppressContentEditableWarning onInput={event => { const value = event.currentTarget.innerHTML; setFormData(prev => ({ ...prev, conteudo: value })); setErrors(prev => ({ ...prev, conteudo: null })); }} aria-invalid={Boolean(errors.conteudo)} className={`form-control announcement-content min-h-40 overflow-y-auto rounded-t-none ${errors.conteudo ? 'border-danger' : ''}`} />
                                <p className="mt-1 text-xs text-text-muted">Anexe imagens PNG, JPG/JPEG ou HEIC (até 5 MB cada). Acima desse limite, PNG/JPG serão comprimidas automaticamente{imageProcessing ? '… processando imagem' : '.'}</p>
                                {formData.anexos?.length > 0 && <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3" aria-label="Anexos adicionados"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Anexos</p><div className="flex flex-wrap gap-2">{formData.anexos.map((attachment, index) => <div key={attachment.id || `${attachment.nome}-${index}`} className="flex max-w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-default"><span aria-hidden="true">🖼️</span><span className="max-w-[14rem] truncate" title={attachment.nome}>{attachment.nome}</span><span className="shrink-0 text-xs text-text-muted">({formatFileSize(attachment.tamanho)})</span><button type="button" onClick={() => { setFormData(prev => ({ ...prev, anexos: prev.anexos.filter((_, itemIndex) => itemIndex !== index) })); setErrors(prev => ({ ...prev, anexos: null })); }} className="ml-1 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-danger" aria-label={`Remover anexo ${attachment.nome}`}>×</button></div>)}</div></div>}
                                {errors.anexos && <p className="text-danger text-xs mt-1">{errors.anexos}</p>}
                                {errors.conteudo && <p className="text-danger text-xs mt-1">{errors.conteudo}</p>}
                        </div>
                        <div className="space-y-3 pt-2">
                            <FormCheckbox name="fixarNoTopo" checked={formData.fixarNoTopo} onChange={handleChange} label="Fixar no topo" />
                        </div>
                    </div>
                    {linkDialogOpen && <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1"><span className="form-label">URL do link</span><input autoFocus type="url" value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setLinkError(''); }} placeholder="https://exemplo.com" className={`form-control ${linkError ? 'border-danger' : ''}`} />{linkError && <span className="mt-1 block text-xs text-danger">{linkError}</span>}</label><button type="button" onClick={applyLink} className="btn btn-primary">Inserir link</button><button type="button" onClick={() => setLinkDialogOpen(false)} className="btn btn-secondary">Cancelar</button></div></div>}
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" disabled={imageProcessing} className="btn btn-primary">{imageProcessing ? 'Processando imagem…' : 'Revisar e publicar'}</button>
                    </div>
                </form>
        </Modal>
    );
};

export default InformativoModal;
