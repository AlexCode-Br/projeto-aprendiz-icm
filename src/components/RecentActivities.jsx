import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { formatEnrollmentDate } from '../utils/enrollment-date.js';
import FormSelect from './FormSelect';
import ProfileAvatar from './ProfileAvatar';

const PERIOD_OPTIONS = [
    { value: 'recentes', label: 'Recentes' },
    { value: 'hoje', label: 'Hoje' },
    { value: 'ontem', label: 'Ontem' },
    { value: 'semana', label: 'Esta semana' },
];

const EMPTY_MESSAGES = {
    recentes: 'Nenhuma inscrição recente.',
    hoje: 'Nenhuma inscrição realizada hoje.',
    ontem: 'Nenhuma inscrição realizada ontem.',
    semana: 'Nenhuma inscrição realizada nesta semana.',
};

const RecentActivities = ({ students = [], onSelectStudent, period = 'recentes', onPeriodChange, page = 1, hasPrevious = false, hasNext = false, onPageChange, loading = false, error = '', onRetry, timeZone = 'America/Sao_Paulo' }) => (
    <section className="panel flex h-full min-w-0 flex-col overflow-hidden" aria-labelledby="recent-enrollments-title">
        <header className="border-b border-border px-4 py-5 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="recent-enrollments-title" className="text-base font-semibold text-text-default">Últimas inscrições</h2>
                <div className="flex min-w-0 items-center gap-2">
                    <FormSelect
                        id="recent-enrollments-period"
                        aria-label="Filtrar inscrições por período"
                        className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                        value={period}
                        options={PERIOD_OPTIONS}
                        onChange={event => onPeriodChange(event.target.value)}
                        isClearable={false}
                        isSearchable={false}
                        isDisabled={loading}
                    />
                    <Link to="/gestor/alunos" className="icon-button shrink-0" aria-label="Ver todas as inscrições" title="Ver todas as inscrições">
                        <ArrowUpRight aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </header>

        {loading ? (
            <div className="flex-1 space-y-3 p-4 md:px-6" role="status" aria-label="Carregando inscrições">
                {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-14 rounded-xl" />)}
            </div>
        ) : error ? (
            <div className="empty-state min-h-64 flex-1">
                <p role="alert">{error}</p>
                <button type="button" className="btn btn-secondary mt-2" onClick={onRetry}>Tentar novamente</button>
            </div>
        ) : students.length ? (
            <ul className="flex-1 divide-y divide-border px-2 py-1 md:px-4">
                {students.map(student => {
                    const dateLabel = formatEnrollmentDate(student.enrolled_at, new Date(), timeZone);
                    return (
                        <li key={student.matricula_id}>
                            <button type="button" onClick={() => onSelectStudent(student.id)} aria-label={`Ver dados de ${student.nome}, inscrição ${dateLabel}`} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-200 hover:bg-surface-hover">
                                <ProfileAvatar name={student.nome} src={student.foto_url} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-baseline gap-2">
                                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-default">{student.nome}</p>
                                        <time className="shrink-0 text-[11px] font-medium text-text-muted" dateTime={student.enrolled_at}>{dateLabel}</time>
                                    </div>
                                    <p className="mt-1 truncate text-xs text-text-muted" title={`${student.curso} · ${student.local}`}>{student.curso} · {student.local}</p>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        ) : (
            <div className="empty-state min-h-64 flex-1">
                <strong className="text-text-default">{EMPTY_MESSAGES[period]}</strong>
                <p>As matrículas aparecerão aqui quando forem realizadas.</p>
            </div>
        )}
        <footer className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-3 md:px-6">
            <span className="text-xs text-text-muted">Página {page}</span>
            <nav className="flex items-center gap-1" aria-label="Navegação das inscrições">
                <button type="button" className="icon-button h-9 w-9" onClick={() => onPageChange(page - 1)} disabled={loading || !hasPrevious} aria-label="Página anterior das inscrições">
                    <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="icon-button h-9 w-9" onClick={() => onPageChange(page + 1)} disabled={loading || !hasNext} aria-label="Próxima página das inscrições">
                    <ChevronRight aria-hidden="true" />
                </button>
            </nav>
        </footer>
    </section>
);

export default RecentActivities;
