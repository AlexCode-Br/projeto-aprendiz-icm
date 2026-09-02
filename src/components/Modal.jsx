import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
const openDialogs = [];
let originalOverflow = '';
const syncDialogs = () => {
    openDialogs.forEach((element, index) => { element.inert = index !== openDialogs.length - 1; });
    const app = document.getElementById('root');
    if (app) app.inert = openDialogs.length > 0;
};

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
        if (!openDialogs.length) originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const layer = backdropRef.current;
        openDialogs.push(layer);
        syncDialogs();
        const initialField = dialogRef.current.querySelector('input:not([type="file"]):not([disabled]), textarea:not([disabled])');
        (initialField || closeRef.current)?.focus({ preventScroll: true });

        const handleKeyDown = event => {
            if (event.defaultPrevented || openDialogs.at(-1) !== layer) return;
            if (event.key === 'Escape') { event.preventDefault(); return onCloseRef.current(); }
            if (event.key !== 'Tab') return;
            const focusable = [...dialogRef.current.querySelectorAll(focusableSelector)].filter(element => element.getClientRects().length && !element.closest('[inert]'));
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
            const index = openDialogs.indexOf(layer);
            if (index >= 0) openDialogs.splice(index, 1);
            syncDialogs();
            if (!openDialogs.length) document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div ref={backdropRef} onMouseDown={event => event.target === backdropRef.current && onClose()} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[3px] sm:p-5" role="presentation">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`flex w-full ${maxWidth} max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:max-h-[calc(100dvh-2.5rem)]`}>
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
                    <h2 id={titleId} className="text-lg font-semibold text-text-default sm:text-xl">{title}</h2>
                    <button ref={closeRef} type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Fechar janela">
                        <X aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
            </div>
        </div>, document.body
    );
};

export default Modal;
