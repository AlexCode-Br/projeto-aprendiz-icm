import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Pagination from '../../components/Pagination';

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
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-text-default mb-6">Meus Alunos</h1>

             {/* Barra de Busca */}
            <div className="flex justify-start mb-4">
                <input
                    type="text"
                    placeholder="Buscar aluno por nome ou email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full sm:max-w-md px-4 py-2 border rounded-md bg-surface border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>
            
            {/* Tabela de Alunos */}
            <div className="bg-surface rounded-lg shadow overflow-x-auto">
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
                            <tr><td colSpan="4" className="text-center py-4">Carregando...</td></tr>
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
                    <div className="text-center py-10 text-text-muted">Nenhum aluno encontrado.</div>
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