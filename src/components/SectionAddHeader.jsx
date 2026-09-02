import React from 'react';
import { Plus } from 'lucide-react';

export default function SectionAddHeader({ title, titleId, description, onAdd, addLabel, className = '' }) {
    return (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${className}`}>
            <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-text-muted">{description}</p>
            </div>
            <button type="button" onClick={onAdd} aria-label={addLabel} className="btn btn-primary w-full sm:w-auto">
                <Plus aria-hidden="true" />Adicionar
            </button>
        </div>
    );
}
