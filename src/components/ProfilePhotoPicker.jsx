import React, { useEffect, useRef, useState } from 'react';
import ProfileAvatar from './ProfileAvatar';
import ProfilePhotoCropper from './ProfilePhotoCropper';
import Modal from './Modal';
import { Camera, Trash2 } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export default function ProfilePhotoPicker({ name, currentUrl = '', value, onChange, disabled = false, saving = false }) {
    const inputRef = useRef(null);
    const [error, setError] = useState('');
    const [cacheKey, setCacheKey] = useState(0);
    const [cropSource, setCropSource] = useState('');
    const [viewerOpen, setViewerOpen] = useState(false);
    useEffect(() => { setError(''); setCacheKey(key => key + 1); }, [currentUrl, name]);
    const preview = typeof value === 'string' ? value : value === null ? '' : currentUrl ? `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}preview=${cacheKey}` : '';

    const selectFile = event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!TYPES.has(file.type)) return setError('Use uma imagem PNG, JPG/JPEG ou WEBP.');
        if (file.size > MAX_BYTES) return setError('A foto deve ter no máximo 5 MB.');
        const reader = new FileReader();
        reader.onerror = () => setError('Não foi possível ler esta imagem.');
        reader.onload = () => { setError(''); setCropSource(String(reader.result || '')); };
        reader.readAsDataURL(file);
    };

    return <div className="rounded-xl border border-border bg-surface-muted/30 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {preview ? <button type="button" disabled={saving} onClick={() => setViewerOpen(true)} className="w-fit rounded-full transition-transform hover:scale-105 disabled:cursor-wait" aria-label="Ver foto de perfil ampliada" title="Ver foto">
                <ProfileAvatar name={name} src={preview} className="h-20 w-20" textClassName="text-2xl" />
            </button> : <ProfileAvatar name={name} className="h-20 w-20" textClassName="text-2xl" />}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-default">Foto de perfil</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">PNG, JPG/JPEG ou WEBP · Até 5 MB.<br />A foto será salva automaticamente após confirmar o recorte.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="btn btn-secondary"><Camera aria-hidden="true" />{saving ? 'Salvando foto...' : preview ? 'Trocar foto' : 'Adicionar foto'}</button>
                    {preview && <button type="button" disabled={disabled} onClick={async () => { setError(''); try { await onChange(null); setViewerOpen(false); } catch (cause) { setError(cause.message || 'Não foi possível remover a foto.'); } }} className="icon-button text-danger" aria-label="Remover foto" title="Remover foto"><Trash2 aria-hidden="true" /></button>}
                </div>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} className="hidden" />
                {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
            </div>
        </div>
        {cropSource && <ProfilePhotoCropper key={cropSource} source={cropSource} onClose={() => setCropSource('')} onApply={async dataUrl => { await onChange(dataUrl); setCropSource(''); }} />}
        <Modal isOpen={viewerOpen && Boolean(preview)} onClose={() => setViewerOpen(false)} title="Foto de perfil" maxWidth="max-w-md">
            <img src={preview} alt={`Foto de perfil de ${name}`} className="mx-auto aspect-square max-h-[70dvh] w-full max-w-sm rounded-2xl bg-surface-muted object-contain" />
        </Modal>
    </div>;
}
