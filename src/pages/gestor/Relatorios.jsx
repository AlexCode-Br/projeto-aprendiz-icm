import React, { useState, useMemo, useEffect } from 'react';
import { exportToPdf } from '../../utils/exportUtils.js';
import api from '../../services/api';

// --- Dados Mockados (extraídos do protótipo) ---
const frequencyReportData = [
    { curso: 'Violão I', aluno: 'João Pereira', professor: 'João Silva', local: 'Pituba', frequencia: '95%' },
    { curso: 'Violão I', aluno: 'Ricardo Alves', professor: 'João Silva', local: 'Pituba', frequencia: '68%' },
    { curso: 'Teclado', aluno: 'Ana Beatriz', professor: 'Maria Oliveira', local: 'Brotas', frequencia: '88%' },
    { curso: 'Bateria', aluno: 'Pedro Almeida', professor: 'Carlos Souza', local: 'Lauro de Freitas', frequencia: '92%' },
    { curso: 'Canto Coral', aluno: 'Maria Clara', professor: 'Ana Costa', local: 'Pituba', frequencia: '100%' },
    // Adicione mais dados conforme necessário para testar a paginação
];

const dropoutReportData = [
    { curso: 'Violino', aluno: 'Lucas Guimarães', dataInscricao: '01/02/2025', dataEvasao: '15/05/2025', motivo: 'Mudança de cidade' },
    { curso: 'Saxofone', aluno: 'Fernando Mendes', dataInscricao: '10/02/2025', dataEvasao: '22/04/2025', motivo: 'Conflito de horários' },
    { curso: 'Contrabaixo', aluno: 'Gustavo Rocha', dataInscricao: '15/01/2025', dataEvasao: '30/03/2025', motivo: 'Questões pessoais' },
];

const allCourses = ['Violão I', 'Teclado', 'Bateria', 'Canto Coral', 'Violino', 'Saxofone', 'Contrabaixo'];
const allLocais = ['Pituba', 'Brotas', 'Lauro de Freitas', 'Remoto'];
const allProfessores = ['João Silva', 'Maria Oliveira', 'Carlos Souza', 'Ana Costa', 'Pedro Santos'];

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
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>&lt;</button>
                        {[...Array(totalPages).keys()].map(i => (
                            <button key={i} onClick={() => setCurrentPage(i + 1)} className={currentPage === i + 1 ? 'font-bold' : ''}>{i + 1}</button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>&gt;</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Componente Principal ---
const Relatorios = () => {
    const [options, setOptions] = useState({ cursos: [], locais: [], professores: [] });
    // State para Relatório de Frequência
    const [freqFilters, setFreqFilters] = useState({ curso: '', local: '', professor: '', dataInicio: '', dataFim: '' });
    const [generatedFreqData, setGeneratedFreqData] = useState(null);

    // State para Relatório de Evasão
    const [dropoutFilters, setDropoutFilters] = useState({ curso: '', motivo: '', dataInicio: '', dataFim: '' });
    const [generatedDropoutData, setGeneratedDropoutData] = useState(null);

    useEffect(() => {
        api.get('/api/relatorios/opcoes').then(response => setOptions(response.data)).catch(console.error);
    }, []);

    const handleGenerateFrequencyReport = async () => {
        const response = await api.get('/api/relatorios/frequencia', { params: freqFilters });
        setGeneratedFreqData(response.data);
    };

    const handleGenerateDropoutReport = async () => {
        const response = await api.get('/api/relatorios/evasao', { params: dropoutFilters });
        const filtered = dropoutFilters.motivo ? response.data.filter(item => item.motivo === dropoutFilters.motivo) : response.data;
        setGeneratedDropoutData(filtered);
    };

    const handleExportFrequency = () => {
        const headers = ["Curso", "Aluno", "Professor", "Local", "Frequência (%)"];
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
            <h2 className="text-2xl font-bold text-text-default mb-6">Relatórios Gerenciais</h2>

            {/* Painel de Relatório de Frequência */}
            <div className="bg-surface rounded-lg shadow-sm border border-border mb-8">
                <div className="p-4 md:p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Relatório de Frequência</h3>
                    <p className="text-sm text-text-muted mt-1">Filtre para visualizar a frequência dos alunos por período, curso, local ou professor.</p>
                </div>
                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Filtros aqui */}
                    <select value={freqFilters.curso} onChange={event => setFreqFilters({...freqFilters,curso:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface"><option value="">Todos os Cursos</option>{options.cursos.map(c => <option key={c}>{c}</option>)}</select>
                    <select value={freqFilters.local} onChange={event => setFreqFilters({...freqFilters,local:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface"><option value="">Todos os Locais</option>{options.locais.map(l => <option key={l}>{l}</option>)}</select>
                    <select value={freqFilters.professor} onChange={event => setFreqFilters({...freqFilters,professor:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface"><option value="">Todos os Professores</option>{options.professores.map(p => <option key={p}>{p}</option>)}</select>
                    <input type="date" value={freqFilters.dataInicio} onChange={event => setFreqFilters({...freqFilters,dataInicio:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface" />
                    <input type="date" value={freqFilters.dataFim} onChange={event => setFreqFilters({...freqFilters,dataFim:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface" />
                </div>
                <div className="p-4 md:px-6 flex justify-end items-center border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button onClick={handleGenerateFrequencyReport} className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">Gerar</button>
                </div>
                {generatedFreqData && (
                    <div className="p-4 md:p-6 border-t border-border">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold">Resultados</h4>
                            <button onClick={handleExportFrequency} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Exportar</button>
                        </div>
                        <ReportTable headers={["Curso", "Aluno", "Professor", "Local", "Frequência (%)"]} data={generatedFreqData} />
                    </div>
                )}
            </div>

            {/* Painel de Relatório de Evasão */}
            <div className="bg-surface rounded-lg shadow-sm border border-border">
                <div className="p-4 md:p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Relatório de Evasão</h3>
                    <p className="text-sm text-text-muted mt-1">Analise os motivos de evasão dos alunos por período ou curso.</p>
                </div>
                 <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Filtros aqui */}
                    <select value={dropoutFilters.curso} onChange={event => setDropoutFilters({...dropoutFilters,curso:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface"><option value="">Todos os Cursos</option>{options.cursos.map(c => <option key={c}>{c}</option>)}</select>
                    <select value={dropoutFilters.motivo} onChange={event => setDropoutFilters({...dropoutFilters,motivo:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface"><option value="">Todos os Motivos</option><option>Conflito de horários</option><option>Questões pessoais</option></select>
                     <input type="date" value={dropoutFilters.dataInicio} onChange={event => setDropoutFilters({...dropoutFilters,dataInicio:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface" />
                    <input type="date" value={dropoutFilters.dataFim} onChange={event => setDropoutFilters({...dropoutFilters,dataFim:event.target.value})} className="w-full px-3 py-2 border border-border rounded-lg bg-surface" />
                </div>
                <div className="p-4 md:px-6 flex justify-end items-center border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button onClick={handleGenerateDropoutReport} className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">Gerar</button>
                </div>
                 {generatedDropoutData && (
                    <div className="p-4 md:p-6 border-t border-border">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold">Resultados</h4>
                            <button onClick={handleExportDropout} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Exportar</button>
                        </div>
                        <ReportTable headers={["Curso", "Aluno", "Data Inscrição", "Data Evasão", "Motivo"]} data={generatedDropoutData} />
                    </div>
                )}
            </div>
        </>
    );
};

export default Relatorios;
