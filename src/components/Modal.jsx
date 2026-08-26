import React, { useEffect, useId, useRef } from 'react';

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
    const titleId = useId();
    const backdropRef = useRef(null);
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();

        const handleKeyDown = event => {
            if (event.key === 'Escape') return onCloseRef.current();
            if (event.key !== 'Tab') return;
            const focusable = [...dialogRef.current.querySelectorAll(focusableSelector)];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousFocus?.focus?.();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div ref={backdropRef} onMouseDown={event => event.target === backdropRef.current && onClose()} className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-[2px]" role="presentation">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full ${maxWidth} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg`}>
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
                    <h2 id={titleId} className="text-lg font-semibold text-text-default sm:text-xl">{title}</h2>
                    <button ref={closeRef} type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Fechar janela">
                        <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-5 sm:p-6">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
