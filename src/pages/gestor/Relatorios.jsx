import React, { useState, useMemo, useEffect } from 'react';
import { exportToPdf } from '../../utils/exportUtils.js';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// --- Componente Reutilizável para Tabela e Paginação ---
const ReportTable = ({ headers, data, itemsPerPage = 5 }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return data.slice(startIndex, startIndex + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    return (
        <div className="mt-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-text-default">
                    <thead className="bg-gray-50 dark:bg-surface/30 text-xs uppercase text-text-muted">
                        <tr>
                            {headers.map(header => <th key={header} className="px-6 py-3">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-border hover:bg-gray-50 dark:hover:bg-gray-50/10">
                                {Object.values(row).map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-6 py-4">{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="p-4 flex justify-between items-center border-t border-border">
                    <span className="text-sm text-text-muted">Página {currentPage} de {totalPages}</span>
                    <div className="flex items-center space-x-1">
                        <button type="button" aria-label="Página anterior" className="icon-button min-h-9 min-w-9" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>&lt;</button>
                        {[...Array(totalPages).keys()].map(i => (
                            <button type="button" aria-label={`Página ${i + 1}`} aria-current={currentPage === i + 1 ? 'page' : undefined} key={i} onClick={() => setCurrentPage(i + 1)} className={`min-h-9 min-w-9 rounded-md ${currentPage === i + 1 ? 'bg-primary font-bold text-white' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}>{i + 1}</button>
                        ))}
                        <button type="button" aria-label="Próxima página" className="icon-button min-h-9 min-w-9" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>&gt;</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Componente Principal ---
const Relatorios = () => {
    const { showToast } = useToast();
    const [options, setOptions] = useState({ cursos: [], locais: [], professores: [] });
    // State para Relatório de Frequência
    const [freqFilters, setFreqFilters] = useState({ curso: '', local: '', professor: '', dataInicio: '', dataFim: '' });
    const [generatedFreqData, setGeneratedFreqData] = useState(null);

    // State para Relatório de Evasão
    const [dropoutFilters, setDropoutFilters] = useState({ curso: '', motivo: '', dataInicio: '', dataFim: '' });
    const [generatedDropoutData, setGeneratedDropoutData] = useState(null);

    useEffect(() => {
        api.get('/api/relatorios/opcoes').then(response => setOptions(response.data)).catch(error => showToast(error.message || 'Erro ao carregar opções dos relatórios.', 'error'));
    }, [showToast]);

    const handleGenerateFrequencyReport = async () => {
        try {
            const response = await api.get('/api/relatorios/frequencia', { params: freqFilters });
            setGeneratedFreqData(response.data);
        } catch (error) { showToast(error.message || 'Erro ao gerar relatório de frequência.', 'error'); }
    };

    const handleGenerateDropoutReport = async () => {
        try {
            const response = await api.get('/api/relatorios/evasao', { params: dropoutFilters });
            const filtered = dropoutFilters.motivo ? response.data.filter(item => item.motivo === dropoutFilters.motivo) : response.data;
            setGeneratedDropoutData(filtered);
        } catch (error) { showToast(error.message || 'Erro ao gerar relatório de evasão.', 'error'); }
    };

    const handleExportFrequency = () => {
        const headers = ["Curso", "Aluno", "Professor", "Igreja", "Frequência (%)"];
        const data = generatedFreqData.map(Object.values);
        exportToPdf("Relatório de Frequência", headers, data);
    };
    
    const handleExportDropout = () => {
        const headers = ["Curso", "Aluno", "Data Inscrição", "Data Evasão", "Motivo"];
        const data = generatedDropoutData.map(Object.values);
        exportToPdf("Relatório de Evasão", headers, data);
    };

    return (
        <>
            <div className="page-header"><div><h1 className="page-title">Relatórios gerenciais</h1><p className="page-description">Gere análises de frequência e evasão usando os dados atualizados da plataforma.</p></div></div>

            {/* Painel de Relatório de Frequência */}
            <section className="panel mb-8">
                <div className="p-4 md:p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Relatório de Frequência</h3>
                    <p className="text-sm text-text-muted mt-1">Filtre para visualizar a frequência dos alunos por período, curso, local ou professor.</p>
                </div>
                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Filtros aqui */}
                    <label><span className="form-label">Curso</span><select value={freqFilters.curso} onChange={event => setFreqFilters({...freqFilters,curso:event.target.value})} className="form-control"><option value="">Todos os cursos</option>{options.cursos.map(c => <option key={c}>{c}</option>)}</select></label>
                    <label><span className="form-label">Igreja</span><select value={freqFilters.local} onChange={event => setFreqFilters({...freqFilters,local:event.target.value})} className="form-control"><option value="">Todas as igrejas</option>{options.locais.map(l => <option key={l}>{l}</option>)}</select></label>
                    <label><span className="form-label">Professor</span><select value={freqFilters.professor} onChange={event => setFreqFilters({...freqFilters,professor:event.target.value})} className="form-control"><option value="">Todos os professores</option>{options.professores.map(p => <option key={p}>{p}</option>)}</select></label>
                    <label><span className="form-label">Data inicial</span><input type="date" value={freqFilters.dataInicio} onChange={event => setFreqFilters({...freqFilters,dataInicio:event.target.value})} className="form-control" /></label>
                    <label><span className="form-label">Data final</span><input type="date" value={freqFilters.dataFim} onChange={event => setFreqFilters({...freqFilters,dataFim:event.target.value})} className="form-control" /></label>
                </div>
                <div className="p-4 md:px-6 flex justify-end items-center border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button type="button" onClick={handleGenerateFrequencyReport} className="btn btn-primary">Gerar relatório</button>
                </div>
                {generatedFreqData && (
                    <div className="p-4 md:p-6 border-t border-border">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold">Resultados</h4>
                            <button type="button" onClick={handleExportFrequency} className="btn btn-secondary">Exportar PDF</button>
                        </div>
                        <ReportTable headers={["Curso", "Aluno", "Professor", "Igreja", "Frequência (%)"]} data={generatedFreqData} />
                    </div>
                )}
            </section>

            {/* Painel de Relatório de Evasão */}
            <section className="panel">
                <div className="p-4 md:p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Relatório de Evasão</h3>
                    <p className="text-sm text-text-muted mt-1">Analise os motivos de evasão dos alunos por período ou curso.</p>
                </div>
                 <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Filtros aqui */}
                    <label><span className="form-label">Curso</span><select value={dropoutFilters.curso} onChange={event => setDropoutFilters({...dropoutFilters,curso:event.target.value})} className="form-control"><option value="">Todos os cursos</option>{options.cursos.map(c => <option key={c}>{c}</option>)}</select></label>
                    <label><span className="form-label">Motivo</span><select value={dropoutFilters.motivo} onChange={event => setDropoutFilters({...dropoutFilters,motivo:event.target.value})} className="form-control"><option value="">Todos os motivos</option><option>Conflito de horários</option><option>Questões pessoais</option></select></label>
                    <label><span className="form-label">Data inicial</span><input type="date" value={dropoutFilters.dataInicio} onChange={event => setDropoutFilters({...dropoutFilters,dataInicio:event.target.value})} className="form-control" /></label>
                    <label><span className="form-label">Data final</span><input type="date" value={dropoutFilters.dataFim} onChange={event => setDropoutFilters({...dropoutFilters,dataFim:event.target.value})} className="form-control" /></label>
                </div>
                <div className="p-4 md:px-6 flex justify-end items-center border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button type="button" onClick={handleGenerateDropoutReport} className="btn btn-primary">Gerar relatório</button>
                </div>
                 {generatedDropoutData && (
                    <div className="p-4 md:p-6 border-t border-border">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold">Resultados</h4>
                            <button type="button" onClick={handleExportDropout} className="btn btn-secondary">Exportar PDF</button>
                        </div>
                        <ReportTable headers={["Curso", "Aluno", "Data Inscrição", "Data Evasão", "Motivo"]} data={generatedDropoutData} />
                    </div>
                )}
            </section>
        </>
    );
};

export default Relatorios;
