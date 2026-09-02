import React from 'react';

export default function FormSwitch({ label, description, checked, onChange, disabled = false }) {
    return <label className={`flex min-h-12 cursor-pointer items-center justify-between gap-5 ${disabled ? 'opacity-50' : ''}`}>
        <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-sm leading-6 text-text-muted">{description}</span></span>
        <span className="relative block h-6 w-11 shrink-0">
            <input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled} className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full border border-border bg-surface-hover transition-colors checked:border-primary checked:bg-primary" />
            <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform peer-checked:translate-x-5" />
        </span>
    </label>;
}
