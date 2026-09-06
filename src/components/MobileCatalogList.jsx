import React from 'react';
import { Church, Pencil, Trash2 } from 'lucide-react';
import CourseIcon from './CourseIcon';
import KebabMenu, { KebabMenuItem } from './KebabMenu';

export default function MobileCatalogList({ type, items, onEdit, onDelete }) {
    return <ul className="divide-y divide-border sm:hidden" aria-label={type === 'cursos' ? 'Catálogo de cursos' : 'Catálogo de igrejas'}>
        {items.map(item => <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {type === 'cursos' ? <CourseIcon name={item.nome} className="!h-5 !w-5" /> : <Church aria-hidden="true" className="!h-5 !w-5" />}
                </span>
                <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold leading-5">{item.nome}</h3>
                    <p className="mt-1 text-xs leading-5 text-text-muted">{item.turmas} {item.turmas === 1 ? 'turma' : 'turmas'}{type === 'locais' && <> · {item.professores} {item.professores === 1 ? 'professor' : 'professores'}</>}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.ativo ? 'bg-success/10 text-success' : 'bg-surface-muted text-text-muted'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
            </div>
            <KebabMenu label={`Ações de ${item.nome}`}>
                <KebabMenuItem icon={Pencil} tone="primary" onClick={() => onEdit(item)}>Editar</KebabMenuItem>
                <KebabMenuItem icon={Trash2} tone="danger" onClick={() => onDelete(item)}>Excluir definitivamente</KebabMenuItem>
            </KebabMenu>
        </li>)}
    </ul>;
}
