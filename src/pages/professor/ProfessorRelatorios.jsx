import { Download as DownloadIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { exportToPdf } from '../../utils/exportUtils.js';
import FormSelect from '../../components/FormSelect';
import FormRadio from '../../components/FormRadio';
import { downloadCsv } from '../../utils/csv.js';

// --- Ícones SVG ---


const ProfessorRelatorios = () => {
    // Estado para os filtros do formulário
    const [reportType, setReportType] = useState('frequencia_turma');
    const [format, setFormat] = useState('pdf');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState([]);

    // Estado para controle de UI
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const fetchClasses = useCallback(async () => {
        try {
            const response = await api.get('/professores/meus-cursos');
            setClasses(response.data || []);
        } catch (err) {
            console.error("Falha ao carregar as turmas", err);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const handleGenerateReport = async () => {
        if (isGenerating) return;
        if (startDate && endDate && endDate < startDate) return setError('A data final não pode ser anterior à inicial.');
        setIsGenerating(true);
        setError('');
        try {
            const response = await api.get('/api/relatorios/frequencia', {
                params: { dataInicio: startDate, dataFim: endDate, curso_id: classId }
            });
            const rows = response.data;
            if (rows.length === 0) {
                 setError('Nenhum dado encontrado para o filtro selecionado.');
                 setIsGenerating(false);
                 return;
            }
            const filename = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
            if (format === 'pdf') {
                exportToPdf('Relatório da Turma', ['Curso','Aluno','Professor','Igreja','Frequência'], rows.map(row => [row.curso,row.aluno,row.professor,row.local,row.frequencia]));
            } else {
                downloadCsv(filename, ['Curso','Aluno','Professor','Igreja','Frequência'], rows.map(row => [row.curso,row.aluno,row.professor,row.local,row.frequencia]));
            }

        } catch (err) {
            setError("Ocorreu um erro ao gerar o relatório. Tente novamente.");
            console.error("Erro ao gerar relatório:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Meus relatórios</h1>
                    <p className="page-description">Gere relatórios de frequência das suas turmas com dados registrados no sistema.</p>
                </div>
            </div>

            <section className="panel overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Gerar Novo Relatório</h3>
                </div>
                <div className="p-6 space-y-6">
                    {/* Tipo de Relatório e Turma */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="report-type" className="form-label">Tipo de relatório</label>
                            <FormSelect
                                id="report-type"
                                isClearable={false}
                                value={reportType}
                                onChange={e => setReportType(e.target.value)}
                                options={[{ value: 'frequencia_turma', label: 'Frequência da Turma' }]}
                            />
                        </div>
                        <div>
                            <label htmlFor="class-id" className="form-label">Turma / Curso</label>
                            <FormSelect
                                id="class-id"
                                value={classId}
                                onChange={e => setClassId(e.target.value)}
                                options={classes.map(c => ({ value: c.id, label: `${c.nome} - ${c.local}` }))}
                                placeholder="Todas as minhas turmas"
                            />
                        </div>
                    </div>

                    {/* Período */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-date" className="form-label">Data de início</label>
                            <input
                                type="date"
                                id="start-date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="form-control"
                            />
                        </div>
                        <div>
                            <label htmlFor="end-date" className="form-label">Data de fim</label>
                            <input
                                type="date"
                                id="end-date"
                                min={startDate || undefined}
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="form-control"
                            />
                        </div>
                    </div>

                    {/* Formato */}
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Formato de Saída</label>
                        <div className="flex gap-6">
                            <FormRadio name="format" value="pdf" checked={format === 'pdf'} onChange={e => setFormat(e.target.value)} label="PDF" className="items-center" />
                            <FormRadio name="format" value="csv" checked={format === 'csv'} onChange={e => setFormat(e.target.value)} label="CSV" className="items-center" />
                        </div>
                    </div>
                </div>

                {error && <div className="alert-error mx-6 mb-6" role="alert">{error}</div>}

                <div className="px-6 py-4 border-t border-border bg-surface-muted flex items-center justify-end">
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        className="btn btn-primary"
                    >
                        <DownloadIcon />
                        <span>{isGenerating ? 'Gerando...' : 'Gerar e Baixar'}</span>
                    </button>
                </div>
            </section>
        </div>
    );
};

export default ProfessorRelatorios;
