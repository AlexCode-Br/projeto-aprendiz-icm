import React from 'react';
import ClassScheduleList from './ClassScheduleList';
import CourseIcon from './CourseIcon';
import { CalendarClock, CirclePause, MapPin, Pencil, UserRound, Users } from 'lucide-react';

export default function TurmaCard({ curso, onEdit, onDeactivate }) {
    const alunos = Number(curso.alunos) || 0;
    const active = curso.status === 'Ativo';
    const titleId = `turma-card-${curso.id}`;

    return (
        <article className="panel min-w-0 overflow-hidden" aria-labelledby={titleId}>
            <header className="flex items-start gap-3 p-4 pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
                    <CourseIcon name={curso.nome} className="!h-5 !w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 id={titleId} className="break-words text-base font-semibold leading-6">{curso.nome}</h3>
                    <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-text-muted">
                        <MapPin aria-hidden="true" className="mt-0.5 !h-4 !w-4 shrink-0" />
                        <span className="min-w-0 break-words"><span className="sr-only">Igreja: </span>{curso.local}</span>
                    </p>
                </div>
                <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {active ? 'Ativa' : 'Inativa'}
                </span>
            </header>

            <dl className="grid grid-cols-2 gap-4 p-4">
                <div className="min-w-0">
                    <dt className="flex items-center gap-1.5 text-xs text-text-muted"><UserRound aria-hidden="true" className="!h-4 !w-4" />Professor</dt>
                    <dd className="mt-1.5 break-words text-sm leading-5">{curso.professor || 'A definir'}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="flex items-center gap-1.5 text-xs text-text-muted"><CalendarClock aria-hidden="true" className="!h-4 !w-4" />Horário</dt>
                    <dd className="mt-1.5 break-words text-sm leading-5"><ClassScheduleList course={curso} /></dd>
                </div>
            </dl>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-4 py-2.5">
                <p className="flex items-center gap-2 text-sm text-text-muted">
                    <Users aria-hidden="true" className="!h-4 !w-4 shrink-0" />
                    <span><strong className="font-semibold tabular-nums text-text-default">{alunos}</strong> {alunos === 1 ? 'aluno' : 'alunos'}</span>
                </p>
                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => onEdit(curso)} className="btn btn-secondary gap-2 px-3 text-primary" aria-label={`Editar turma de ${curso.nome} em ${curso.local}`}>
                        <Pencil aria-hidden="true" className="!h-4 !w-4" />Editar
                    </button>
                    <button type="button" onClick={() => onDeactivate(curso)} className="icon-button border border-border bg-surface text-danger" aria-label={`Desativar turma de ${curso.nome} em ${curso.local}`} title="Desativar turma">
                        <CirclePause aria-hidden="true" className="!h-5 !w-5" />
                    </button>
                </div>
            </footer>
        </article>
    );
}
