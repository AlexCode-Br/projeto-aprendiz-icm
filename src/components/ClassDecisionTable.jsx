import React from 'react';

const percentage = value => value == null ? 'Sem dados' : `${value}%`;

const Trend = ({ value }) => {
    if (value == null) return <span className="text-text-muted">Sem comparação</span>;
    if (value === 0) return <span className="text-text-muted">Estável</span>;
    const positive = value > 0;
    return <span className={positive ? 'font-semibold text-success' : 'font-semibold text-danger'}>{positive ? '↑' : '↓'} {Math.abs(value)} p.p.</span>;
};

const Occupancy = ({ students, capacity, occupancy }) => {
    if (capacity == null) return <><span className="block text-text-default">{students} aluno(s)</span><span className="text-xs text-text-muted">Capacidade não definida</span></>;
    const barWidth = Math.min(Math.max(occupancy || 0, 0), 100);
    const barColor = occupancy > 100 ? 'bg-danger' : occupancy >= 85 ? 'bg-warning' : 'bg-primary';
    return <div className="min-w-36">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span>{students} de {capacity}</span><span className={occupancy > 100 ? 'font-semibold text-danger' : 'text-text-muted'}>{occupancy}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label={`Ocupação: ${occupancy}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(occupancy, 100)}>
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
    </div>;
};

export default function ClassDecisionTable({ classes = [], pendingCalls = [], loading = false }) {
    const pendingClassIds = new Set(pendingCalls.map(item => Number(item.classId)));
    return <section className="panel mt-6 overflow-hidden" aria-labelledby="class-decision-title">
        <div className="border-b border-border p-4 md:p-6">
            <h2 id="class-decision-title" className="text-lg font-semibold text-text-default">Frequência e ocupação por turma</h2>
            <p className="mt-1 text-sm text-text-muted">Compare as últimas quatro semanas com as quatro anteriores e identifique onde agir primeiro.</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr><th className="px-6 py-3">Turma</th><th className="px-6 py-3">Professor</th><th className="px-6 py-3">Frequência</th><th className="px-6 py-3">Tendência</th><th className="px-6 py-3">Ocupação</th></tr></thead>
                <tbody className="divide-y divide-border">
                    {loading ? Array.from({ length: 3 }, (_, index) => <tr key={index}><td colSpan="5" className="px-6 py-4"><div className="skeleton h-12 rounded-lg" /></td></tr>) : classes.map(item => <tr key={item.id} className="hover:bg-surface-hover">
                        <td className="px-6 py-4"><strong className="block text-text-default">{item.label}</strong><span className="text-xs text-text-muted">{item.local}</span>{pendingClassIds.has(item.id) && <span className="mt-1.5 block w-fit rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">Chamada pendente</span>}</td>
                        <td className="px-6 py-4 text-text-default">{item.professor}</td>
                        <td className="px-6 py-4"><span className={item.frequenciaAtual != null && item.frequenciaAtual < 75 ? 'font-semibold text-danger' : 'font-semibold text-text-default'}>{percentage(item.frequenciaAtual)}</span>{item.frequenciaAnterior != null && <span className="block text-xs text-text-muted">Anterior: {percentage(item.frequenciaAnterior)}</span>}</td>
                        <td className="px-6 py-4"><Trend value={item.tendencia} /></td>
                        <td className="px-6 py-4"><Occupancy students={item.alunos} capacity={item.capacity} occupancy={item.ocupacao} /></td>
                    </tr>)}
                </tbody>
            </table>
        </div>
        {!loading && classes.length === 0 && <div className="px-6 py-12 text-center"><strong className="block text-text-default">Nenhuma turma ativa neste período</strong><span className="mt-1 block text-sm text-text-muted">Adicione uma turma ao período selecionado para acompanhar frequência e ocupação.</span></div>}
    </section>;
}
