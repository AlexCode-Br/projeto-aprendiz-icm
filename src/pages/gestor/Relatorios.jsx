import { Download, ChartNoAxesCombined, LoaderCircle } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { exportToPdf } from '../../utils/exportUtils.js';
import FormSelect from '../../components/FormSelect';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ReportTable = ({ headers, data, itemsPerPage = 5 }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = useMemo(() => data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [data, currentPage, itemsPerPage]);

    useEffect(() => { setCurrentPage(1); }, [data]);

    if (data.length === 0) {
        return <div className="mt-4 rounded-lg border border-dashed border-border px-6 py-10 text-center text-text-muted"><strong className="block text-text-default">Nenhum registro encontrado</strong><span className="mt-1 block text-sm">Ajuste os filtros e gere o relatório novamente.</span></div>;
    }

    return (
        <div className="mt-4">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
                <table className="data-table w-full text-left text-sm text-text-default">
                    <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr>{headers.map(header => <th key={header} className="px-6 py-3">{header}</th>)}</tr></thead>
                    <tbody>{paginatedData.map((row, rowIndex) => <tr key={`${currentPage}-${rowIndex}`} className="border-b border-border transition-colors hover:bg-surface-hover">{Object.values(row).map((cell, cellIndex) => <td key={cellIndex} className="px-6 py-4">{cell}</td>)}</tr>)}</tbody>
                </table>
            </div>
            {totalPages > 1 && <div className="flex items-center justify-between border-t border-border p-4">
                <span className="text-sm text-text-muted">Página {currentPage} de {totalPages}</span>
                <div className="flex items-center space-x-1">
                    <button type="button" aria-label="Página anterior" className="icon-button min-h-9 min-w-9" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft aria-hidden="true" /></button>
                    <button type="button" aria-label="Próxima página" className="icon-button min-h-9 min-w-9" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}><ChevronRight aria-hidden="true" /></button>
                </div>
            </div>}
        </div>
    );
};

const Relatorios = () => {
    const { showToast } = useToast();
    const [options, setOptions] = useState({ cursos: [] });
    const [filters, setFilters] = useState({ curso: '', motivo: '', dataInicio: '', dataFim: '' });
    const [data, setData] = useState(null);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        api.get('/api/relatorios/opcoes')
            .then(response => setOptions(response.data))
            .catch(error => showToast(error.message || 'Erro ao carregar opções dos relatórios.', 'error'));
    }, [showToast]);

    const generateReport = async () => {
        if (generating) return;
        if (filters.dataInicio && filters.dataFim && filters.dataFim < filters.dataInicio) return showToast('A data final não pode ser anterior à inicial.', 'warning');
        setGenerating(true);
        try {
            const response = await api.get('/api/relatorios/evasao', { params: filters });
            setData(response.data);
        } catch (error) {
            showToast(error.message || 'Erro ao gerar relatório de evasão.', 'error');
        } finally { setGenerating(false); }
    };

    const exportReport = () => {
        const headers = ['Curso', 'Aluno', 'Data Inscrição', 'Data Evasão', 'Categoria', 'Motivo'];
        exportToPdf('Relatório de Evasão', headers, data.map(Object.values));
    };

    return (
        <>
            <div className="page-header"><div><h1 className="page-title">Relatórios gerenciais</h1><p className="page-description">Consulte dados administrativos de evasão. A frequência é restrita aos professores.</p></div></div>
            <section className="panel">
                <div className="border-b border-border p-4 md:p-6">
                    <h2 className="text-lg font-semibold text-text-default">Relatório de Evasão</h2>
                    <p className="mt-1 text-sm text-text-muted">Analise os motivos de evasão por data ou curso.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-6 lg:grid-cols-3">
                    <div><label htmlFor="report-course" className="form-label">Curso</label><FormSelect id="report-course" value={filters.curso} onChange={event => setFilters({ ...filters, curso: event.target.value })} options={options.cursos || []} placeholder="Todos os cursos" /></div>
                    <div><label htmlFor="report-reason" className="form-label">Motivo</label><FormSelect id="report-reason" value={filters.motivo} onChange={event => setFilters({ ...filters, motivo: event.target.value })} options={[{ value: 'mudanca', label: 'Mudança' }, { value: 'desinteresse', label: 'Desinteresse' }, { value: 'horario', label: 'Conflito de horário' }, { value: 'saude', label: 'Saúde' }, { value: 'familia', label: 'Questões familiares' }, { value: 'outro', label: 'Outro' }]} placeholder="Todas as categorias" /></div>
                    <label><span className="form-label">Data inicial</span><input type="date" value={filters.dataInicio} onChange={event => setFilters({ ...filters, dataInicio: event.target.value })} className="form-control" /></label>
                    <label><span className="form-label">Data final</span><input type="date" min={filters.dataInicio || undefined} value={filters.dataFim} onChange={event => setFilters({ ...filters, dataFim: event.target.value })} className="form-control" /></label>
                </div>
                <div className="flex justify-end border-t border-border bg-surface-muted p-4 md:px-6"><button type="button" onClick={generateReport} disabled={generating} className="btn btn-primary">{generating ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ChartNoAxesCombined aria-hidden="true" />}{generating ? 'Gerando...' : 'Gerar relatório'}</button></div>
                {data && <div className="border-t border-border p-4 md:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Resultados</h3>{data.length > 0 && <button type="button" onClick={exportReport} className="btn btn-secondary"><Download aria-hidden="true" />Exportar PDF</button>}</div>
                    <ReportTable headers={['Curso', 'Aluno', 'Data Inscrição', 'Data Evasão', 'Categoria', 'Motivo']} data={data} />
                </div>}
            </section>
        </>
    );
};

export default Relatorios;
