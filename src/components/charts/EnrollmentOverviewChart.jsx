import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { enrollmentBarWidth, MAX_VISIBLE_CLASSES, rankEnrollmentClasses } from '../../utils/enrollment-ranking.js';
import FormSelect from '../FormSelect.jsx';

const SORT_OPTIONS = [
    { value: 'most', label: 'Mais alunos' },
    { value: 'least', label: 'Menos alunos' },
    { value: 'az', label: 'A–Z' },
    { value: 'za', label: 'Z–A' },
];

const EnrollmentOverviewChart = ({ data = [], loading = false }) => {
    const [sortBy, setSortBy] = useState('most');

    const classes = useMemo(() => data.map(item => ({ ...item, total: Math.max(0, Number(item.total) || 0) })), [data]);
    const visibleClasses = useMemo(() => rankEnrollmentClasses(classes, sortBy), [classes, sortBy]);

    const largestVisibleTotal = Math.max(0, ...visibleClasses.map(item => item.total));

    return (
        <>
            <header className="flex flex-col gap-4 border-b border-border px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6">
                <div className="min-w-0">
                    <h2 id="students-by-class-title" className="text-lg font-semibold text-text-default">Alunos por turma</h2>
                    <p className="mt-1 text-sm leading-6 text-text-muted">Quantidade de alunos atualmente matriculados em cada turma ativa.</p>
                </div>
                <div className="flex w-full items-center gap-3 md:w-auto md:shrink-0">
                    <FormSelect
                        id="students-by-class-order"
                        aria-label="Ordenar turmas"
                        className="min-w-0 flex-1 md:w-44 md:flex-none"
                        value={sortBy}
                        options={SORT_OPTIONS}
                        onChange={event => setSortBy(event.target.value)}
                        isClearable={false}
                        isSearchable={false}
                    />
                    <Link to="/gestor/cursos" className="shrink-0 text-sm font-semibold text-primary transition-colors hover:text-primary-dark">
                        Ver todas <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </header>

            {loading ? (
                <div className="space-y-5 px-4 py-5 md:px-6" aria-label="Carregando alunos por turma">
                    {Array.from({ length: MAX_VISIBLE_CLASSES }, (_, index) => <div key={index} className="skeleton h-10 rounded-xl" />)}
                </div>
            ) : visibleClasses.length ? (
                <div className="divide-y divide-border px-4 md:px-6">
                    {visibleClasses.map(item => {
                        const width = enrollmentBarWidth(item.total, largestVisibleTotal);
                        return (
                            <article
                                key={item.id}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 py-4 sm:grid-cols-[minmax(9rem,0.9fr)_minmax(10rem,1.7fr)_3rem] sm:gap-x-5"
                                aria-label={`${item.curso}, ${item.local}: ${item.total} ${item.total === 1 ? 'aluno' : 'alunos'}`}
                            >
                                <div className="col-span-2 min-w-0 sm:col-span-1">
                                    <h3 className="truncate text-sm font-semibold text-text-default" title={item.curso}>{item.curso}</h3>
                                    <p className="mt-0.5 truncate text-xs text-text-muted" title={item.local}>{item.local}</p>
                                </div>
                                <div className="h-2 min-w-0 overflow-hidden rounded-full bg-surface-muted sm:col-start-2" aria-hidden="true">
                                    <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${width}%` }} />
                                </div>
                                <strong className="text-right text-sm tabular-nums text-text-default sm:col-start-3">{item.total}</strong>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state min-h-56">
                    <strong className="text-text-default">Nenhuma turma ativa</strong>
                    <p>As turmas aparecerão aqui quando estiverem disponíveis no período atual.</p>
                </div>
            )}

            <footer className="border-t border-border bg-surface-muted/50 px-4 py-3 text-xs text-text-muted md:px-6">
                {loading
                    ? 'Carregando turmas…'
                    : `Mostrando ${visibleClasses.length} de ${classes.length} ${classes.length === 1 ? 'turma' : 'turmas'}`}
            </footer>
        </>
    );
};

export default EnrollmentOverviewChart;
