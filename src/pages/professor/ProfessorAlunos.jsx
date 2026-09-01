import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Pagination from '../../components/Pagination';
import { downloadCsv } from '../../utils/csv.js';

const ProfessorAlunos = () => {
    // --- Estados ---
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [totalAlunos, setTotalAlunos] = useState(0);
    const [itemsPerPage] = useState(10);
    
    // Busca
    const [searchTerm, setSearchTerm] = useState('');
    const [exporting, setExporting] = useState(false);
    const { showToast } = useToast();

    // Carrega os alunos dos cursos do professor
    const fetchAlunos = useCallback(async () => {
        setLoading(true);
        try {
            // A rota do backend /professores/meus-alunos lida com a lógica de
            // buscar todos os alunos dos cursos associados ao professor logado.
            const response = await api.get('/professores/meus-alunos', {
                params: {
                    page: currentPage,
                    limit: itemsPerPage,
                    search: searchTerm,
                }
            });
            setAlunos(response.data.alunos);
            setTotalAlunos(response.data.total);
            setError(null);
        } catch (err) {
            setError("Não foi possível carregar os alunos.");
            showToast("Erro ao carregar seus alunos.", 'error');
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm, showToast]);

    useEffect(() => {
        fetchAlunos();
    }, [fetchAlunos]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reseta para a primeira página ao buscar
    };

    const handleExportStudents = async () => {
        setExporting(true);
        try {
            const firstResponse = await api.get('/api/professores/me/alunos', { params: { page: 1, search: searchTerm } });
            const total = Number(firstResponse.data.total || 0);
            const totalPages = Math.ceil(total / 100);
            const remaining = totalPages > 1
                ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => api.get('/api/professores/me/alunos', { params: { page: index + 2, search: searchTerm } })))
                : [];
            const records = [firstResponse, ...remaining].flatMap(response => response.data.alunos || []);
            if (!records.length) return showToast('Não há alunos para exportar com o filtro atual.', 'warning');
            downloadCsv(`meus_alunos_${new Date().toISOString().slice(0, 10)}.csv`,
                ['Nome', 'E-mail', 'Telefone', 'Igreja', 'Classe', 'Cursos'],
                records.map(aluno => [aluno.nome, aluno.email || '', aluno.telefone || '', aluno.igreja || '', aluno.classe || '', (aluno.curso || []).join(', ')]));
            showToast(`${records.length} aluno(s) exportado(s) em CSV.`, 'success');
        } catch (requestError) {
            showToast(requestError.response?.data?.message || 'Não foi possível exportar seus alunos.', 'error');
        } finally {
            setExporting(false);
        }
    };
    
    return (
        <div>
            <div className="page-header"><div><h1 className="page-title">Meus alunos</h1><p className="page-description">Consulte os alunos vinculados às suas turmas.</p></div></div>

             {/* Barra de Busca */}
            <div className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="professor-student-search" className="sr-only">Buscar aluno</label>
                <input
                    id="professor-student-search"
                    type="text"
                    placeholder="Buscar aluno por nome ou email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="form-control sm:max-w-md"
                />
                <button type="button" onClick={handleExportStudents} disabled={exporting} className="btn btn-secondary">{exporting ? 'Exportando...' : 'Exportar CSV'}</button>
            </div>
            
            {/* Tabela de Alunos */}
            <div className="panel overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Foto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Curso(s)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                         {loading ? (
                            Array.from({ length: 4 }, (_, index) => <tr key={index}><td colSpan="4" className="px-6 py-4"><div className="skeleton h-10 rounded" /></td></tr>)
                        ) : error ? (
                             <tr><td colSpan="4" className="text-center py-4 text-danger">{error}</td></tr>
                        ) : alunos.map((aluno) => (
                            <tr key={aluno.id} className="hover:bg-border/50">
                                <td className="px-6 py-4">
                                    <img className="h-10 w-10 rounded-full object-cover" src={aluno.foto_url || `https://ui-avatars.com/api/?name=${aluno.nome}`} alt={aluno.nome} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-default">{aluno.nome}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.cursos?.map(c => c.nome).join(', ') || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {!loading && !error && alunos.length === 0 && (
                    <div className="px-6 py-10 text-center text-text-muted"><strong className="block text-text-default">Nenhum aluno encontrado</strong><span className="mt-1 block text-sm">Limpe a busca ou peça ao gestor para conferir as matrículas das suas turmas.</span></div>
                )}
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalAlunos}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
};

export default ProfessorAlunos;
