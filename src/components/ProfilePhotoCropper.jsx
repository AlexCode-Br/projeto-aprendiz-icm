import React, { useEffect, useRef, useState } from 'react';
import { Check, Move, RotateCcw, Minus, Plus } from 'lucide-react';
import Modal from './Modal';
import { clamp, getPhotoCrop, movePhotoCrop } from '../../shared/photo-crop.mjs';

export default function ProfilePhotoCropper({ source, onApply, onClose }) {
    const [image, setImage] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const dragRef = useRef(null);

    useEffect(() => {
        let active = true;
        const loaded = new Image();
        loaded.onload = () => {
            if (!active) return;
            if (!loaded.naturalWidth || loaded.naturalWidth * loaded.naturalHeight > 40000000) {
                setError('Esta imagem é grande demais para recortar. Escolha uma foto com até 40 megapixels.');
            } else setImage(loaded);
        };
        loaded.onerror = () => active && setError('Não foi possível abrir esta imagem. Escolha outro arquivo.');
        loaded.src = source;
        return () => { active = false; };
    }, [source]);

    const crop = image ? getPhotoCrop(image.naturalWidth, image.naturalHeight, zoom, position) : null;
    const move = event => {
        if (!dragRef.current || !image) return;
        const { x, y, position: startPosition } = dragRef.current;
        setPosition(movePhotoCrop(image.naturalWidth, image.naturalHeight, zoom, startPosition, event.clientX - x, event.clientY - y, event.currentTarget.clientWidth));
    };
    const keyboardMove = event => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!directions[event.key]) return;
        event.preventDefault();
        const [x, y] = directions[event.key];
        const step = event.shiftKey ? 0.1 : 0.025;
        setPosition(previous => ({ x: clamp(previous.x + x * step, 0, 1), y: clamp(previous.y + y * step, 0, 1) }));
    };
    const apply = async () => {
        if (!image || busy) return;
        setBusy(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 384;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Seu navegador não permitiu recortar a foto.');
            context.imageSmoothingQuality = 'high';
            context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, 384, 384);
            const webp = canvas.toDataURL('image/webp', 0.86);
            const result = webp.startsWith('data:image/webp;base64,') ? webp : canvas.toDataURL('image/png');
            if (!/^data:image\/(?:webp|png);base64,/.test(result)) throw new Error('Não foi possível preparar a foto.');
            await onApply(result);
        } catch (cause) { setError(cause.message || 'Não foi possível recortar a foto. Tente novamente.'); }
        finally { setBusy(false); }
    };

    return <Modal isOpen onClose={() => !busy && onClose()} title="Ajustar foto de perfil" maxWidth="max-w-md">
        <p id="crop-instructions" className="mb-4 text-sm leading-6 text-text-muted">Arraste a foto e ajuste o zoom. A área circular mostra como ela aparecerá no perfil.</p>
        {image ? <>
            <div className="photo-crop-area relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl bg-surface-muted" tabIndex={0} role="group" aria-label="Posição da foto: use as setas do teclado para ajustar" aria-describedby="crop-instructions"
                onKeyDown={keyboardMove}
                onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, position }; }}
                onPointerMove={move} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
                <img src={source} alt="Prévia do recorte" draggable={false} className="pointer-events-none absolute select-none !max-w-none" style={{ width: `${image.naturalWidth / crop.size * 100}%`, height: `${image.naturalHeight / crop.size * 100}%`, left: `${-crop.x / crop.size * 100}%`, top: `${-crop.y / crop.size * 100}%` }} />
                <div className="photo-crop-mask pointer-events-none absolute inset-0 border-2 border-white/90" />
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-text-muted"><Move aria-hidden="true" className="!h-4 !w-4" />Arraste ou use as setas do teclado</p>
            <div className="mt-5 flex items-center gap-3">
                <button type="button" className="icon-button" aria-label="Diminuir zoom" disabled={zoom <= 1} onClick={() => setZoom(value => clamp(value - 0.1, 1, 3))}><Minus aria-hidden="true" /></button>
                <label className="min-w-0 flex-1"><span className="sr-only">Zoom da foto</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="h-6 w-full accent-primary" aria-valuetext={`${Math.round(zoom * 100)}%`} /></label>
                <button type="button" className="icon-button" aria-label="Aumentar zoom" disabled={zoom >= 3} onClick={() => setZoom(value => clamp(value + 0.1, 1, 3))}><Plus aria-hidden="true" /></button>
            </div>
            <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0.5, y: 0.5 }); }} className="btn btn-ghost mx-auto flex"><RotateCcw aria-hidden="true" />Redefinir recorte</button>
        </> : !error && <div className="skeleton mx-auto aspect-square w-full max-w-72" role="status" aria-label="Preparando foto" />}
        {error && <p className="alert-error mt-4" role="alert">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!image || busy} onClick={apply}><Check aria-hidden="true" />{busy ? 'Preparando...' : 'Usar esta foto'}</button>
        </div>
    </Modal>;
}
