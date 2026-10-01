import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProfileAvatar from './ProfileAvatar';

export default function ProfilePhotoViewer({ isOpen, onClose, name, src }) {
    const viewerRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const initialDistanceRef = useRef(0);
    const initialScaleRef = useRef(1);
    const [scale, setScale] = useState(1);

    const touchDistance = touches => Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
    );

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const siblings = [...document.body.children]
            .filter(element => element !== viewerRef.current)
            .map(element => ({ element, inert: element.inert }));
        siblings.forEach(({ element }) => { element.inert = true; });
        document.body.style.overflow = 'hidden';
        setScale(1);
        initialDistanceRef.current = 0;
        viewerRef.current?.focus({ preventScroll: true });
        const handleKeyDown = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            onCloseRef.current();
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            siblings.forEach(({ element, inert }) => { element.inert = inert; });
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={viewerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Foto de perfil de ${name || 'aluno'}`}
            aria-describedby="profile-photo-viewer-help"
            tabIndex={-1}
            onMouseDown={event => event.target === event.currentTarget && onClose()}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm focus:outline-none"
        >
            <p id="profile-photo-viewer-help" className="sr-only">Toque fora da foto para fechar. Em telas sensíveis ao toque, use dois dedos para ampliar ou reduzir.</p>
            <div
                onMouseDown={event => event.stopPropagation()}
                onTouchStart={event => {
                    if (event.touches.length !== 2) return;
                    initialDistanceRef.current = touchDistance(event.touches);
                    initialScaleRef.current = scale;
                }}
                onTouchMove={event => {
                    if (event.touches.length !== 2 || !initialDistanceRef.current) return;
                    event.preventDefault();
                    const nextScale = initialScaleRef.current * (touchDistance(event.touches) / initialDistanceRef.current);
                    setScale(Math.min(4, Math.max(1, nextScale)));
                }}
                onTouchEnd={event => {
                    if (event.touches.length < 2) initialDistanceRef.current = 0;
                }}
                onDoubleClick={() => setScale(current => current > 1 ? 1 : 2)}
                className="rounded-full shadow-2xl [touch-action:none] [will-change:transform]"
                style={{ transform: `scale(${scale})` }}
            >
                <ProfileAvatar name={name} src={src} className="h-64 w-64 sm:h-80 sm:w-80" textClassName="text-6xl" />
            </div>
        </div>,
        document.body,
    );
}
