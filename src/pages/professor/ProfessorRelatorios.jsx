import React, { useState } from 'react';
import api from '../../services/api';
import { exportToPdf } from '../../utils/exportUtils.js';

// --- Ícones SVG ---
const DownloadIcon = () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>;

const ProfessorRelatorios = () => {
    // Estado para os filtros do formulário
    const [reportType, setReportType] = useState('frequencia_turma');
    const [format, setFormat] = useState('pdf');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Estado para controle de UI
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    // Função para tratar o download do arquivo
    const handleDownload = (data, filename, format) => {
        const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
        const blob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    const handleGenerateReport = async () => {
        setIsGenerating(true);
        setError('');
        try {
            const response = await api.get('/api/relatorios/frequencia', {
                params: { dataInicio: startDate, dataFim: endDate }
            });
            const rows = response.data;
            const filename = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
            if (format === 'pdf') {
                exportToPdf('Relatório da Turma', ['Curso','Aluno','Professor','Igreja','Frequência'], rows.map(Object.values));
            } else {
                const csv = ['Curso;Aluno;Professor;Igreja;Frequência', ...rows.map(row => Object.values(row).join(';'))].join('\n');
                handleDownload(csv, filename, 'csv');
            }

        } catch (err) {
            setError("Ocorreu um erro ao gerar o relatório. Tente novamente.");
            console.error("Erro ao gerar relatório:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fade-in-up">
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
                    {/* Tipo de Relatório */}
                    <div>
                        <label htmlFor="report-type" className="form-label">Tipo de relatório</label>
                        <select 
                            id="report-type" 
                            value={reportType} 
                            onChange={e => setReportType(e.target.value)} 
                            className="form-control"
                        >
                            <option value="frequencia_turma">Frequência da Turma</option>
                        </select>
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
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="form-control"
                            />
                        </div>
                    </div>

                    {/* Formato */}
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Formato de Saída</label>
                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="format" value="pdf" checked={format === 'pdf'} onChange={e => setFormat(e.target.value)} className="form-radio text-primary focus:ring-primary/50"/>
                                <span className="text-text-default">PDF</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={e => setFormat(e.target.value)} className="form-radio text-primary focus:ring-primary/50" />
                                <span className="text-text-default">CSV</span>
                            </label>
                        </div>
                    </div>
                </div>

                {error && <div className="alert-error mx-6 mb-6" role="alert">{error}</div>}

                <div className="px-6 py-4 border-t border-border bg-gray-50 dark:bg-surface/30 flex items-center justify-end">
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
