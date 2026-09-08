import { Bold, Italic, Underline, List, ListOrdered, Link2, Paperclip, FileText, X } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    destinatarios: { todos: true, professores: [], cursos: [] },
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
const FILE_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);
const EXTENSION_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

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

const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const todayForInput = () => {
    const parts = Object.fromEntries(new globalThis.Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const initialFormatState = {
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
    link: false,
};

const InformativoModal = ({ isOpen, onClose, onSave, informativo, draft }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkText, setLinkText] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkError, setLinkError] = useState('');
    const [fileProcessing, setFileProcessing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [formatState, setFormatState] = useState(initialFormatState);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const savedSelectionRef = useRef(null);

    useEffect(() => {
        if (draft) {
            const nextForm = {
                ...initialFormState,
                ...draft,
                anexos: Array.isArray(draft.anexos) ? draft.anexos : [],
                destinatarios: draft.destinatarios || { todos: true, professores: [], cursos: [] },
            };
            setFormData(nextForm);
            if (editorRef.current) editorRef.current.innerHTML = nextForm.conteudo;
        } else if (informativo) {
            const nextForm = {
                titulo: informativo.titulo || '',
                categoria: informativo.categoria || '',
                dataAgendamento: informativo.data ? informativo.data.split('/').reverse().join('-') : '',
                horaAgendamento: informativo.hora || '',
                conteudo: informativo.conteudo || '',
                fixarNoTopo: informativo.fixado || false,
                anexos: Array.isArray(informativo.anexos) ? informativo.anexos : [],
                destinatarios: informativo.destinatarios || { todos: true, professores: [], cursos: [] },
            };
            setFormData(nextForm);
            if (editorRef.current) editorRef.current.innerHTML = nextForm.conteudo;
        } else {
            setFormData(initialFormState);
            if (editorRef.current) editorRef.current.innerHTML = '';
        }
        setErrors({});
        setLinkDialogOpen(false);
        setLinkText('');
        setLinkUrl('');
        setLinkError('');
        setFileProcessing(false);
        setDragActive(false);
        setUploadMessage('');
        setFormatState(initialFormatState);
        savedSelectionRef.current = null;
    }, [draft, informativo, isOpen]);

    const updateFormatState = useCallback(() => {
        const editor = editorRef.current;
        const selection = window.getSelection?.();
        if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
        savedSelectionRef.current = selection.getRangeAt(0).cloneRange();

        const commandState = command => {
            try {
                return document.queryCommandState(command);
            } catch {
                return false;
            }
        };
        const anchorElement = selection.anchorNode?.nodeType === 1
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;

        setFormatState({
            bold: commandState('bold'),
            italic: commandState('italic'),
            underline: commandState('underline'),
            unorderedList: commandState('insertUnorderedList'),
            orderedList: commandState('insertOrderedList'),
            link: Boolean(anchorElement?.closest('a')),
        });
    }, []);

    useEffect(() => {
        document.addEventListener('selectionchange', updateFormatState);
        return () => document.removeEventListener('selectionchange', updateFormatState);
    }, [updateFormatState]);

    const validate = () => {
        const newErrors = {};
        const titleError = requiredTextError(formData.titulo, 'O título', 3, 120);
        const contentError = requiredTextError(formData.conteudo.replace(/<[^>]+>/g, ' '), 'O conteúdo', 10, 5000);
        if (titleError) newErrors.titulo = titleError;
        if (!formData.categoria) newErrors.categoria = 'A categoria é obrigatória.';
        if (!formData.dataAgendamento) newErrors.dataAgendamento = 'A data é obrigatória.';
        if (!formData.horaAgendamento) newErrors.horaAgendamento = 'A hora é obrigatória.';
        const scheduled = new Date(`${formData.dataAgendamento}T${formData.horaAgendamento}:00`);
        const unchangedPublishedSchedule = informativo?.status === 'Publicado'
            && formData.dataAgendamento === informativo.data?.split('/').reverse().join('-')
            && formData.horaAgendamento === informativo.hora;
        if (formData.dataAgendamento && formData.horaAgendamento && scheduled.getTime() < Date.now() && !unchangedPublishedSchedule) newErrors.dataAgendamento = 'A data e hora devem ser futuras.';
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
        if (fileProcessing) return setErrors(prev => ({ ...prev, anexos: 'Aguarde o processamento dos arquivos.' }));
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
    const hasEditorSelection = () => {
        const selection = window.getSelection();
        return Boolean(selection?.rangeCount && editorRef.current?.contains(selection.anchorNode));
    };
    const restoreSelection = () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const selection = window.getSelection();
        if (!selection) return;
        const savedRange = savedSelectionRef.current;
        const savedContainer = savedRange?.commonAncestorContainer;
        const savedRangeIsValid = savedContainer && (savedContainer === editor || editor.contains(savedContainer));
        selection.removeAllRanges();
        if (savedRangeIsValid) {
            selection.addRange(savedRange);
            return;
        }
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.addRange(range);
        savedSelectionRef.current = range.cloneRange();
    };
    const format = command => {
        // Manter a seleção viva preserva os estados de digitação aplicados por
        // execCommand, permitindo combinar B + I + U antes ou durante a escrita.
        if (!hasEditorSelection()) restoreSelection();
        document.execCommand(command, false);
        saveSelection();
        syncEditor();
        updateFormatState();
    };
    const openLinkDialog = () => {
        saveSelection();
        const selection = window.getSelection();
        setLinkText(selection?.toString().trim() || '');
        setLinkUrl('');
        setLinkError('');
        setLinkDialogOpen(true);
    };
    const applyLink = event => {
        event.preventDefault();
        const rawUrl = linkUrl.trim();
        if (!rawUrl) return setLinkError('Informe o endereço do link.');
        const value = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        let parsedUrl;
        try {
            parsedUrl = new URL(value);
        } catch {
            return setLinkError('Informe uma URL válida, como google.com.');
        }
        if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) return setLinkError('Use uma URL HTTPS válida.');
        restoreSelection();
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        const displayText = linkText.trim() || selectedText || parsedUrl.hostname.replace(/^www\./i, '') || value;
        const anchor = `<a href="${escapeHtml(parsedUrl.toString())}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayText)}</a>`;
        document.execCommand('insertHTML', false, anchor);
        syncEditor();
        updateFormatState();
        setLinkDialogOpen(false);
        setLinkText('');
        setLinkUrl('');
    };
    const readAsDataUrl = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });

    const compressImage = async (file, dataUrl, inputType) => {
        if (file.size <= MAX_IMAGE_SIZE) return { dataUrl, mime: inputType, name: file.name };
        if (['image/heic', 'image/heif'].includes(inputType)) throw new Error('Imagens HEIC/HEIF acima de 5 MB não podem ser comprimidas neste navegador. Converta para JPG e tente novamente.');
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Não foi possível abrir a imagem para compressão.'));
            image.src = dataUrl;
        });
        let scale = Math.min(1, Math.sqrt(MAX_IMAGE_SIZE / file.size));
        let compressed = '';
        for (let attempt = 0; attempt < 7; attempt += 1) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Este navegador não conseguiu preparar a imagem para compressão.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            let quality = 0.88;
            compressed = canvas.toDataURL('image/jpeg', quality);
            while (dataUrlByteSize(compressed) > MAX_IMAGE_SIZE && quality > 0.35) {
                quality -= 0.08;
                compressed = canvas.toDataURL('image/jpeg', quality);
            }
            if (dataUrlByteSize(compressed) <= MAX_IMAGE_SIZE) break;
            scale *= 0.72;
        }
        if (dataUrlByteSize(compressed) > MAX_IMAGE_SIZE) throw new Error('A imagem continua maior que 5 MB após a compressão.');
        return { dataUrl: compressed, mime: 'image/jpeg', name: `${file.name.replace(/\.[^.]+$/, '')}.jpg` };
    };

    const addFiles = async selectedFiles => {
        const files = [...(selectedFiles || [])];
        if (!files.length) return;
        const current = formData.anexos || [];
        if (current.length + files.length > MAX_ATTACHMENT_COUNT) return setErrors(prev => ({ ...prev, anexos: `Adicione no máximo ${MAX_ATTACHMENT_COUNT} arquivos por informativo.` }));
        setFileProcessing(true);
        setUploadMessage(`Processando ${files.length === 1 ? 'arquivo' : `${files.length} arquivos`}…`);
        try {
            const additions = [];
            for (const file of files) {
                const extension = file.name.split('.').pop()?.toLowerCase() || '';
                const extensionType = EXTENSION_MIME[extension] || '';
                const inputType = FILE_TYPES.has(file.type) ? file.type : extensionType;
                if (!inputType || extensionType !== inputType) throw new Error(`“${file.name}” não é PNG, JPG/JPEG, WEBP, HEIC/HEIF ou PDF válido.`);
                if (inputType === 'application/pdf' && file.size > MAX_PDF_SIZE) throw new Error(`“${file.name}” excede o limite de 10 MB para PDF.`);
                const duplicate = [...current, ...additions].some(item => item.nome === file.name && Number(item.tamanho) === file.size);
                if (duplicate) throw new Error(`“${file.name}” já foi adicionado.`);
                const rawDataUrl = await readAsDataUrl(file);
                const processed = IMAGE_TYPES.has(inputType) ? await compressImage(file, rawDataUrl, inputType) : { dataUrl: rawDataUrl, mime: inputType, name: file.name };
                additions.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: processed.name, tipo: processed.mime, tamanho: dataUrlByteSize(processed.dataUrl), dataUrl: processed.dataUrl });
            }
            const totalSize = [...current, ...additions].reduce((sum, item) => sum + Number(item.tamanho || 0), 0);
            if (totalSize > MAX_TOTAL_SIZE) throw new Error('O total dos anexos deve ter no máximo 20 MB.');
            setFormData(prev => ({ ...prev, anexos: [...(prev.anexos || []), ...additions] }));
            setErrors(prev => ({ ...prev, anexos: null }));
            setUploadMessage(`${additions.length === 1 ? 'Arquivo anexado' : 'Arquivos anexados'} com sucesso.`);
        } catch (error) {
            setErrors(prev => ({ ...prev, anexos: error.message || 'Não foi possível processar o arquivo.' }));
            setUploadMessage('');
        } finally {
            setFileProcessing(false);
        }
    };

    const handleFileInput = event => {
        // FileList acompanha o valor do input. Copiá-lo antes de limpar permite
        // selecionar novamente o mesmo arquivo sem esvaziar a seleção atual.
        const files = Array.from(event.currentTarget.files || []);
        event.currentTarget.value = '';
        void addFiles(files);
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
                                <input id="info-date" name="dataAgendamento" type="date" min={informativo?.status === 'Publicado' ? undefined : todayForInput()} value={formData.dataAgendamento} onChange={handleChange} aria-invalid={Boolean(errors.dataAgendamento)} className={`form-control ${errors.dataAgendamento ? 'border-danger' : ''}`} />
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
                                <div className="editor-toolbar" role="toolbar" aria-label="Formatação do conteúdo">
                                    {[['bold','Negrito',Bold],['italic','Itálico',Italic],['underline','Sublinhado',Underline]].map(([command,label,icon]) => {
                                        const active = formatState[command];
                                        return <button key={command} type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format(command)} className="editor-tool" title={label} aria-label={label} aria-pressed={active}>{React.createElement(icon, { 'aria-hidden': true })}</button>;
                                    })}
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format('insertUnorderedList')} className="editor-tool" aria-label="Lista com marcadores" aria-pressed={formatState.unorderedList} title="Lista com marcadores"><List aria-hidden="true" /><span className="sr-only sm:not-sr-only">Lista</span></button>
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={() => format('insertOrderedList')} className="editor-tool" aria-label="Lista numerada" aria-pressed={formatState.orderedList} title="Lista numerada"><ListOrdered aria-hidden="true" /><span className="sr-only sm:not-sr-only">Lista</span></button>
                                    <button type="button" onMouseDown={event => { event.preventDefault(); saveSelection(); }} onClick={openLinkDialog} className="editor-tool" aria-label="Inserir link" aria-pressed={formatState.link} title="Inserir ou editar link"><Link2 aria-hidden="true" />Link</button>
                                </div>
                                <div id="info-content" ref={editorRef} contentEditable role="textbox" aria-label="Conteúdo do informativo" aria-multiline="true" suppressContentEditableWarning onInput={event => { const value = event.currentTarget.innerHTML; setFormData(prev => ({ ...prev, conteudo: value })); setErrors(prev => ({ ...prev, conteudo: null })); updateFormatState(); }} onFocus={updateFormatState} onBlur={saveSelection} onKeyUp={updateFormatState} onMouseUp={updateFormatState} onSelect={updateFormatState} aria-invalid={Boolean(errors.conteudo)} className={`form-control announcement-content min-h-40 overflow-y-auto rounded-t-none ${errors.conteudo ? 'border-danger' : ''}`} />
                                <div className="mt-4">
                                    <p className="form-label">Anexos</p>
                                    <button
                                        type="button"
                                        disabled={fileProcessing}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragEnter={event => { event.preventDefault(); setDragActive(true); }}
                                        onDragOver={event => event.preventDefault()}
                                        onDragLeave={() => setDragActive(false)}
                                        onDrop={event => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); }}
                                        className={`flex min-h-24 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-surface-muted hover:bg-surface-hover'}`}
                                    >
                                        <span className="font-semibold text-text-default flex items-center gap-2"><Paperclip aria-hidden="true" />Adicionar arquivos</span>
                                        <span className="mt-1 text-xs text-text-muted">Arraste aqui ou selecione até 5 arquivos</span>
                                    </button>
                                    <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.pdf" onChange={handleFileInput} />
                                    <p className="mt-1 text-xs text-text-muted">PNG, JPG/JPEG, WEBP ou HEIC/HEIF: até 5 MB. PDF: até 10 MB. Total: 20 MB. Imagens maiores serão comprimidas quando o navegador permitir.</p>
                                    {fileProcessing && <p className="mt-2 text-sm text-text-muted" role="status">Processando arquivos…</p>}
                                    {!fileProcessing && uploadMessage && <p className="mt-2 text-sm text-success" role="status">{uploadMessage}</p>}
                                </div>
                                {formData.anexos?.length > 0 && <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-muted p-3" aria-label="Anexos adicionados">{formData.anexos.map((attachment, index) => {
                                    const isImage = String(attachment.tipo || '').startsWith('image/');
                                    const previewUrl = attachment.dataUrl || attachment.url;
                                    return <div key={attachment.id || `${attachment.nome}-${index}`} className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-surface p-2 text-sm text-text-default">
                                        {isImage && previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" className="shrink-0"><img src={previewUrl} alt="" className="h-12 w-12 rounded object-cover" /></a> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-muted text-xl" aria-hidden="true"><FileText aria-hidden="true" /></span>}
                                        <span className="min-w-0 flex-1"><span className="block truncate font-medium" title={attachment.nome}>{attachment.nome}</span><span className="text-xs text-text-muted">{isImage ? 'Imagem' : 'Documento PDF'} · {formatFileSize(attachment.tamanho)}</span></span>
                                        <button type="button" onClick={() => { setFormData(prev => ({ ...prev, anexos: prev.anexos.filter((_, itemIndex) => itemIndex !== index) })); setErrors(prev => ({ ...prev, anexos: null })); setUploadMessage(''); }} className="shrink-0 rounded p-2 text-text-muted hover:bg-surface-hover hover:text-danger" aria-label={`Remover anexo ${attachment.nome}`}><X aria-hidden="true" /></button>
                                    </div>;
                                })}</div>}
                                {errors.anexos && <p className="text-danger text-xs mt-1" role="alert">{errors.anexos}</p>}
                                {errors.conteudo && <p className="text-danger text-xs mt-1">{errors.conteudo}</p>}
                        </div>
                        <div className="space-y-3 pt-2">
                            <FormCheckbox name="fixarNoTopo" checked={formData.fixarNoTopo} onChange={handleChange} label="Fixar no topo" />
                        </div>
                    </div>
                    {linkDialogOpen && <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3"><div className="grid gap-3 sm:grid-cols-2"><label><span className="form-label">Texto do link</span><input autoFocus type="text" value={linkText} onChange={event => { setLinkText(event.target.value); setLinkError(''); }} placeholder="Texto visível (opcional)" className={`form-control ${linkError ? 'border-danger' : ''}`} /></label><label><span className="form-label">Link</span><input type="text" value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setLinkError(''); }} placeholder="google.com" className={`form-control ${linkError ? 'border-danger' : ''}`} /></label></div><p className="mt-2 text-xs text-text-muted">Você pode digitar google.com; o endereço será convertido para HTTPS automaticamente.</p>{linkError && <p className="mt-2 text-xs text-danger">{linkError}</p>}<div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={applyLink} className="btn btn-primary">Aplicar</button><button type="button" onClick={() => setLinkDialogOpen(false)} className="btn btn-secondary">Cancelar</button></div></div>}
                    <div className="mt-6 flex border-t border-border pt-5 sm:justify-end">
                        <button type="submit" disabled={fileProcessing} className="btn btn-primary">{fileProcessing ? 'Processando arquivos…' : 'Revisar e publicar'}</button>
                    </div>
                </form>
        </Modal>
    );
};

export default InformativoModal;
