import React, { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';

export function KebabMenuItem({ icon: Icon, children, tone = 'default', ...props }) {
    const tones = {
        default: 'text-text-default hover:bg-surface-hover',
        primary: 'text-primary hover:bg-primary/10',
        warning: 'text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30',
        danger: 'text-danger hover:bg-red-50 dark:hover:bg-red-950/30',
    };
    return <button type="button" role="menuitem" className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone] || tones.default}`} {...props}>
        {Icon && <Icon aria-hidden="true" className="!h-4 !w-4 shrink-0" />}
        <span className="min-w-0 flex-1">{children}</span>
    </button>;
}

export default function KebabMenu({ children, label = 'Abrir menu de ações', buttonClassName = '' }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const id = useId();
    useLayoutEffect(() => {
        if (!open) return;
        const anchor = buttonRef.current.getBoundingClientRect();
        const height = menuRef.current.offsetHeight;
        setPosition({ left: Math.max(12, Math.min(anchor.right - 208, window.innerWidth - 220)), top: anchor.bottom + height + 12 > window.innerHeight ? Math.max(12, anchor.top - height - 4) : anchor.bottom + 4 });
        menuRef.current.querySelector('button:not([disabled]),a')?.focus();
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const outside = event => { if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false); };
        const reposition = () => setOpen(false);
        const scroll = event => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', reposition);
        document.addEventListener('scroll', scroll, true);
        return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); document.removeEventListener('scroll', scroll, true); };
    }, [open]);
    const keyDown = event => {
        if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
        if (event.key === 'Tab') setOpen(false);
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = [...menuRef.current.querySelectorAll('button:not([disabled]),a')];
        const index = items.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
    };
    return <>
        <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)} className={`icon-button shrink-0 text-text-muted hover:text-text-default ${buttonClassName}`}><EllipsisVertical aria-hidden="true" /></button>
        {open && createPortal(<div ref={menuRef} id={id} role="menu" aria-label="Ações do registro" onKeyDown={keyDown} onClick={event => { if (event.target.closest('button:not([disabled]),a')) setOpen(false); }} className="fixed z-[60] w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg" style={position}>{children}</div>, document.body)}
    </>;
}
