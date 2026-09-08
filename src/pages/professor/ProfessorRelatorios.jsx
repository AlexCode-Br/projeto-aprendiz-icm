import {
    BarChart3,
    CalendarDays,
    ClipboardCheck,
    Download as DownloadIcon,
    Eye,
    FileText,
    UsersRound,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { createAttendanceReportPdf } from '../../utils/exportUtils.js';
import FormSelect from '../../components/FormSelect';
import FormRadio from '../../components/FormRadio';
import Modal from '../../components/Modal';
import { createCsvFile } from '../../utils/csv.js';
import { buildAttendanceReportCsv } from '../../utils/attendanceReportCsv.js';
import projectLogoUrl from '../../assets/projeto-aprendiz-logo.png';

const formatDate = value => {
    if (!value) return '';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
};

const frequencyText = value => Number.isFinite(value) ? `${value}%` : 'Sem chamadas';
const attendanceMark = (student, callId) => ({ presente: 'P', ausente: 'F', justificado: 'J' })[(student.frequencias || []).find(item => Number(item.chamadaId) === Number(callId))?.status] || '-';
const attendanceColor = mark => mark === 'P' ? 'text-green-700' : mark === 'F' ? 'text-primary' : mark === 'J' ? 'text-amber-700' : 'text-gray-400';

const classTitle = course => {
    const label = String(course.turma || '').trim().replace(/[‐‑‒–—―]/g, '-');
    const name = String(course.curso || '').trim();
    if (!label) return name;
    return label.toLocaleLowerCase('pt-BR').startsWith(name.toLocaleLowerCase('pt-BR')) ? label : `${name} - ${label}`;
};

const scheduleText = schedules => {
    if (!schedules?.length) return 'Horário a definir';
    const weekdays = { domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado' };
    return schedules.map(item => `${weekdays[item.weekday] || item.weekday} às ${String(item.start_time || '').slice(0, 5)}`).join(' | ');
};

const AttendanceReportPreview = ({ report }) => {
    const metadata = report.metadata || {};
    const summary = report.resumo || {};
    const filters = metadata.filtros || {};
    const period = filters.dataInicio || filters.dataFim
        ? `${filters.dataInicio ? formatDate(filters.dataInicio) : 'início do período'} a ${filters.dataFim ? formatDate(filters.dataFim) : 'hoje'}`
        : 'Todo o período letivo';
    return (
        <article className="mx-auto w-full max-w-[52rem] overflow-hidden rounded-sm border-t-4 border-primary bg-white text-gray-900 shadow-sm">
            <header className="px-5 pb-5 pt-4 sm:px-8">
                <div className="flex items-center justify-between gap-6 border-b border-gray-200 pb-4">
                    <img src="/departamento-louvor-logo.png" alt="Departamento de Louvor" className="h-auto w-36 object-contain sm:w-44" />
                    <img src={projectLogoUrl} alt="Projeto Aprendiz" className="h-auto w-28 object-contain sm:w-36" />
                </div>
                <h3 className="mt-5 text-xl font-bold sm:text-2xl">Relatório de frequência</h3>
                <p className="mt-1 text-xs text-gray-500 sm:text-sm">Acompanhamento das chamadas e da participação dos alunos</p>
                <dl className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 text-xs sm:grid-cols-3">
                    <div><dt className="font-semibold uppercase tracking-wide text-gray-500">Professor</dt><dd className="mt-1 font-semibold text-gray-900">{metadata.professor?.nome || 'Professor'}</dd></div>
                    <div><dt className="font-semibold uppercase tracking-wide text-gray-500">Período do relatório</dt><dd className="mt-1 font-semibold text-gray-900">{period}</dd></div>
                    <div><dt className="font-semibold uppercase tracking-wide text-gray-500">Período letivo</dt><dd className="mt-1 font-semibold text-gray-900">{metadata.periodoLetivo?.nome || 'Atual'}</dd></div>
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                        ['Turmas', summary.turmas ?? 0], ['Alunos', summary.alunos ?? 0],
                        ['Chamadas', summary.chamadas ?? 0], ['Frequência geral', frequencyText(summary.frequencia)],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-gray-200 p-3">
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                            <dd className="mt-1 text-lg font-bold text-gray-900">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-3 text-[11px] leading-5 text-gray-500">A frequência considera presenças e ausências justificadas como participação.</p>
            </header>

            <div className="space-y-7 px-5 pb-8 sm:px-8">
                {report.turmas.map(course => (
                    <section key={course.id}>
                        <div className="rounded-xl border-l-4 border-primary bg-gray-50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h4 className="font-bold">{classTitle(course)}</h4>
                                    <p className="mt-1 text-xs text-gray-500">{course.local} | {scheduleText(course.horarios)}</p>
                                    <p className="mt-2 text-xs text-gray-600">{course.resumo.alunos} aluno(s) | {course.resumo.chamadas} chamada(s)</p>
                                </div>
                                <div className="sm:text-right">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Frequência da turma</span>
                                    <strong className={`mt-1 block text-lg ${Number.isFinite(course.resumo.frequencia) ? 'text-green-700' : 'text-gray-500'}`}>{frequencyText(course.resumo.frequencia)}</strong>
                                </div>
                            </div>
                        </div>

                        {course.chamadas.length > 0 && (
                            <>
                                <div className="mb-2 mt-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <h5 className="text-sm font-bold">Mapa de chamadas por aluno</h5>
                                    <p className="text-[10px] text-gray-500">P = presente | F = falta | J = justificada | - = sem registro</p>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full min-w-max text-xs">
                                        <thead className="bg-primary text-white">
                                            <tr>
                                                <th className="sticky left-0 min-w-40 bg-primary px-3 py-2.5 text-left">Aluno</th>
                                                {[...course.chamadas].sort((left, right) => String(left.data).localeCompare(String(right.data))).map(call => <th key={call.id} className="min-w-14 px-3 py-2.5">{formatDate(call.data).slice(0, 5)}</th>)}
                                                <th className="min-w-20 px-3 py-2.5">Freq.</th>
                                            </tr>
                                        </thead>
                                        <tbody>{course.alunos.map(student => (
                                            <tr key={student.id} className="border-t border-gray-200 text-center even:bg-gray-50">
                                                <td className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium even:bg-gray-50">{student.nome}</td>
                                                {[...course.chamadas].sort((left, right) => String(left.data).localeCompare(String(right.data))).map(call => {
                                                    const mark = attendanceMark(student, call.id);
                                                    return <td key={call.id} className={`px-3 py-2.5 font-bold ${attendanceColor(mark)}`}>{mark}</td>;
                                                })}
                                                <td className={`px-3 py-2.5 font-bold ${!Number.isFinite(student.frequencia) ? 'text-gray-500' : student.frequencia < 75 ? 'text-primary' : 'text-green-700'}`}>{frequencyText(student.frequencia)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <h5 className="mb-2 mt-4 text-sm font-bold">Resumo individual</h5>
                        {course.alunos.length ? (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full min-w-[38rem] text-left text-xs">
                                    <thead className="bg-primary text-white"><tr><th className="px-3 py-2.5">Aluno</th><th className="px-3 py-2.5 text-center">Chamadas</th><th className="px-3 py-2.5 text-center">Pres.</th><th className="px-3 py-2.5 text-center">Faltas</th><th className="px-3 py-2.5 text-center">Justif.</th><th className="px-3 py-2.5 text-center">Frequência</th></tr></thead>
                                    <tbody>{course.alunos.map(student => (
                                        <tr key={student.id} className="border-t border-gray-200 even:bg-gray-50">
                                            <td className="px-3 py-2.5 font-medium">{student.nome}</td><td className="px-3 py-2.5 text-center">{student.chamadas}</td><td className="px-3 py-2.5 text-center">{student.presentes}</td><td className="px-3 py-2.5 text-center">{student.ausentes}</td><td className="px-3 py-2.5 text-center">{student.justificados}</td><td className={`px-3 py-2.5 text-center font-bold ${!Number.isFinite(student.frequencia) ? 'text-gray-500' : student.frequencia < 75 ? 'text-primary' : 'text-green-700'}`}>{frequencyText(student.frequencia)}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        ) : <p className="rounded-lg bg-gray-50 p-4 text-xs text-gray-500">Esta turma ainda não possui alunos ativos.</p>}

                        <h5 className="mb-2 mt-4 text-sm font-bold">Chamadas realizadas</h5>
                        {course.chamadas.length ? (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full min-w-[32rem] text-xs">
                                    <thead className="bg-gray-600 text-white"><tr><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5">Registros</th><th className="px-3 py-2.5">Presentes</th><th className="px-3 py-2.5">Faltas</th><th className="px-3 py-2.5">Justificadas</th></tr></thead>
                                    <tbody>{course.chamadas.map(call => <tr key={call.id} className="border-t border-gray-200 text-center even:bg-gray-50"><td className="px-3 py-2.5">{formatDate(call.data)}</td><td className="px-3 py-2.5">{call.registros}</td><td className="px-3 py-2.5">{call.presentes}</td><td className="px-3 py-2.5">{call.ausentes}</td><td className="px-3 py-2.5">{call.justificados}</td></tr>)}</tbody>
                                </table>
                            </div>
                        ) : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Nenhuma chamada foi registrada para esta turma no período selecionado.</p>}
                    </section>
                ))}
            </div>
        </article>
    );
};

const CsvReportPreview = ({ preview }) => {
    const previewRows = preview.rows.slice(0, 12);
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Período exportado</p>
                    <p className="mt-1 text-sm font-semibold text-text-default">{preview.period}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Linhas da planilha</p>
                    <p className="mt-1 text-sm font-semibold text-text-default">{preview.rows.length} registro(s)</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Dias de chamada</p>
                    <p className="mt-1 text-sm font-semibold text-text-default">{preview.callDates.length} data(s)</p>
                </div>
            </div>
            <p className="text-xs leading-5 text-text-muted">{preview.legend}. As células vazias indicam que a turma não teve chamada naquela data.</p>
            <div className="max-h-[50dvh] overflow-auto rounded-xl border border-border">
                <table className="min-w-max text-xs">
                    <thead className="sticky top-0 z-10 bg-primary text-white">
                        <tr>{preview.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">{header}</th>)}</tr>
                    </thead>
                    <tbody>
                        {previewRows.map((row, rowIndex) => (
                            <tr key={rowIndex} className={`border-t border-border ${row[0] === 'Resumo da turma' ? 'bg-primary/5 font-semibold' : 'even:bg-surface-muted'}`}>
                                {row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-3 py-2.5 text-text-default">{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {preview.rows.length > previewRows.length && <p className="text-center text-xs text-text-muted">Prévia das primeiras {previewRows.length} linhas. O arquivo baixado contém todos os registros.</p>}
        </div>
    );
};

const ProfessorRelatorios = () => {
    const [format, setFormat] = useState('pdf');
    const [periodMode, setPeriodMode] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [pdfPreview, setPdfPreview] = useState(null);
    const [csvPreview, setCsvPreview] = useState(null);

    const fetchClasses = useCallback(async () => {
        try {
            const response = await api.get('/professores/meus-cursos');
            setClasses(response.data || []);
        } catch (err) {
            console.error('Falha ao carregar as turmas', err);
            setError('Não foi possível carregar suas turmas. Atualize a página e tente novamente.');
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    useEffect(() => () => {
        if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    }, [pdfPreview]);

    useEffect(() => () => {
        if (csvPreview?.url) URL.revokeObjectURL(csvPreview.url);
    }, [csvPreview]);

    const handleGenerateReport = async () => {
        if (isGenerating) return;
        if (periodMode === 'custom' && startDate && endDate && endDate < startDate) {
            setError('A data final não pode ser anterior à inicial.');
            return;
        }
        setIsGenerating(true);
        setError('');
        try {
            const response = await api.get('/api/relatorios/frequencia', {
                params: {
                    dataInicio: periodMode === 'custom' ? startDate : '',
                    dataFim: periodMode === 'custom' ? endDate : '',
                    curso_id: classId,
                    detalhado: 1,
                },
            });
            const report = response.data;
            if (!report?.turmas?.length) {
                setError('Nenhuma turma foi encontrada para o filtro selecionado.');
                return;
            }

            if (format === 'pdf') {
                const generated = await createAttendanceReportPdf(report);
                setPdfPreview({
                    url: URL.createObjectURL(generated.blob),
                    fileName: generated.fileName,
                    summary: report.resumo,
                    report,
                });
            } else {
                const generated = buildAttendanceReportCsv(report);
                const file = createCsvFile(generated.fileName, generated.headers, generated.rows);
                setCsvPreview({
                    ...generated,
                    url: URL.createObjectURL(file.blob),
                    fileName: file.fileName,
                    summary: report.resumo,
                });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Ocorreu um erro ao gerar o relatório. Tente novamente.');
            console.error('Erro ao gerar relatório:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Meus relatórios</h1>
                    <p className="page-description">Analise as chamadas, a participação dos alunos e a frequência de cada turma em um documento completo.</p>
                </div>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="panel overflow-hidden">
                    <div className="flex items-start gap-3 border-b border-border px-5 py-5 sm:px-6">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <FileText aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-text-default">Preparar relatório de frequência</h2>
                            <p className="mt-1 text-sm leading-5 text-text-muted">Escolha uma turma ou consolide todas as turmas sob sua responsabilidade.</p>
                        </div>
                    </div>

                    <div className="space-y-6 p-5 sm:p-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="report-type" className="form-label">Tipo de relatório</label>
                                <FormSelect
                                    id="report-type"
                                    isClearable={false}
                                    isSearchable={false}
                                    value="frequencia_turma"
                                    onChange={() => {}}
                                    options={[{ value: 'frequencia_turma', label: 'Frequência e chamadas' }]}
                                />
                            </div>
                            <div>
                                <label htmlFor="class-id" className="form-label">Turma</label>
                                <FormSelect
                                    id="class-id"
                                    value={classId}
                                    onChange={event => setClassId(event.target.value)}
                                    options={classes.map(course => ({ value: course.id, label: `${course.nome} - ${course.local}` }))}
                                    placeholder="Todas as minhas turmas"
                                    noOptionsMessage={() => 'Nenhuma turma vinculada'}
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-surface-muted/70 p-4 sm:p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h3 className="text-sm font-semibold text-text-default">Período das chamadas</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FormRadio
                                    name="period-mode"
                                    value="all"
                                    checked={periodMode === 'all'}
                                    onChange={event => setPeriodMode(event.target.value)}
                                    label="Todo o período letivo"
                                    description="Inclui todas as chamadas registradas"
                                    className={`rounded-xl border bg-surface p-4 transition-colors ${periodMode === 'all' ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:bg-surface-hover'}`}
                                />
                                <FormRadio
                                    name="period-mode"
                                    value="custom"
                                    checked={periodMode === 'custom'}
                                    onChange={event => setPeriodMode(event.target.value)}
                                    label="Período personalizado"
                                    description="Escolha uma data inicial e final"
                                    className={`rounded-xl border bg-surface p-4 transition-colors ${periodMode === 'custom' ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:bg-surface-hover'}`}
                                />
                            </div>
                            {periodMode === 'custom' && (
                                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="start-date" className="form-label">Data de início</label>
                                        <input type="date" id="start-date" value={startDate} onChange={event => setStartDate(event.target.value)} className="form-control" />
                                    </div>
                                    <div>
                                        <label htmlFor="end-date" className="form-label">Data de fim</label>
                                        <input type="date" id="end-date" min={startDate || undefined} value={endDate} onChange={event => setEndDate(event.target.value)} className="form-control" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <fieldset>
                            <legend className="form-label">Formato de saída</legend>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FormRadio
                                    name="format"
                                    value="pdf"
                                    checked={format === 'pdf'}
                                    onChange={event => setFormat(event.target.value)}
                                    label="PDF completo"
                                    description="Pronto para visualizar e imprimir"
                                    className={`rounded-xl border p-4 transition-colors ${format === 'pdf' ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-hover'}`}
                                />
                                <FormRadio
                                    name="format"
                                    value="csv"
                                    checked={format === 'csv'}
                                    onChange={event => setFormat(event.target.value)}
                                    label="Planilha CSV"
                                    description="Para filtrar e analisar os dados"
                                    className={`rounded-xl border p-4 transition-colors ${format === 'csv' ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-hover'}`}
                                />
                            </div>
                        </fieldset>
                    </div>

                    {error && <div className="alert-error mx-5 mb-5 sm:mx-6 sm:mb-6" role="alert">{error}</div>}

                    <div className="flex items-center justify-end border-t border-border bg-surface-muted px-5 py-4 sm:px-6">
                        <button type="button" onClick={handleGenerateReport} disabled={isGenerating || !classes.length} className="btn btn-primary w-full sm:w-auto">
                            {format === 'pdf' ? <Eye aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
                            <span>{isGenerating ? 'Preparando relatório...' : format === 'pdf' ? 'Gerar e visualizar PDF' : 'Gerar e visualizar CSV'}</span>
                        </button>
                    </div>
                </section>

                <aside className="panel p-5 xl:sticky xl:top-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <BarChart3 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h2 className="font-semibold text-text-default">O relatório mostrará</h2>
                    </div>
                    <div className="mt-5 space-y-4">
                        <div className="flex gap-3">
                            <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-medium text-text-default">Resumo por turma</p>
                                <p className="mt-1 text-xs leading-5 text-text-muted">Curso, igreja ou modalidade, horários, alunos e frequência média.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-medium text-text-default">Folha de chamada escolar</p>
                                <p className="mt-1 text-xs leading-5 text-text-muted">Cada aluno cruzado com os dias de aula, além do percentual individual.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-medium text-text-default">Histórico das chamadas</p>
                                <p className="mt-1 text-xs leading-5 text-text-muted">Cada data registrada com os totais da chamada.</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 rounded-xl bg-surface-muted p-3 text-xs leading-5 text-text-muted">
                        As ausências justificadas contam como participação no cálculo, seguindo a regra atual do sistema.
                    </div>
                </aside>
            </div>

            <Modal
                isOpen={Boolean(pdfPreview)}
                onClose={() => setPdfPreview(null)}
                title="Prévia do relatório"
                maxWidth="max-w-6xl"
                footer={pdfPreview && (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-text-muted">
                            {pdfPreview.summary?.turmas ?? 0} turma(s), {pdfPreview.summary?.alunos ?? 0} aluno(s) e {pdfPreview.summary?.chamadas ?? 0} chamada(s)
                        </p>
                        <div className="flex">
                            <a className="btn btn-primary flex-1 sm:flex-none" href={pdfPreview.url} download={pdfPreview.fileName}>
                                <DownloadIcon aria-hidden="true" />
                                Baixar PDF
                            </a>
                        </div>
                    </div>
                )}
            >
                {pdfPreview && (
                    <div className="max-h-[66dvh] overflow-y-auto rounded-xl bg-surface-muted p-2 sm:p-4">
                        <AttendanceReportPreview report={pdfPreview.report} />
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={Boolean(csvPreview)}
                onClose={() => setCsvPreview(null)}
                title="Prévia da planilha CSV"
                maxWidth="max-w-7xl"
                footer={csvPreview && (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-text-muted">
                            {csvPreview.summary?.turmas ?? 0} turma(s), {csvPreview.summary?.alunos ?? 0} aluno(s) e {csvPreview.summary?.chamadas ?? 0} chamada(s)
                        </p>
                        <div className="flex">
                            <a className="btn btn-primary flex-1 sm:flex-none" href={csvPreview.url} download={csvPreview.fileName}>
                                <DownloadIcon aria-hidden="true" />
                                Baixar CSV
                            </a>
                        </div>
                    </div>
                )}
            >
                {csvPreview && <CsvReportPreview preview={csvPreview} />}
            </Modal>
        </div>
    );
};

export default ProfessorRelatorios;
