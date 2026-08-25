import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// --- Componentes ---
import Pagination from '../../components/Pagination';
import AlunoFormModal from '../../components/AlunoFormModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { PencilIcon, TrashIcon } from '../../components/icons'; // Ícones genéricos

const Alunos = () => {
    // --- Estados ---
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados de Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [totalAlunos, setTotalAlunos] = useState(0);
    const [itemsPerPage] = useState(10);

    // Estados dos Modais
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedAluno, setSelectedAluno] = useState(null);

    // Estado de Busca
    const [searchTerm, setSearchTerm] = useState('');

    const { showToast } = useToast();

    // --- Carregamento de Dados ---
    const fetchAlunos = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/alunos', {
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
            showToast("Erro ao carregar alunos.", 'error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm, showToast]);

    useEffect(() => {
        fetchAlunos();
    }, [fetchAlunos]);
    
    // --- Handlers de Ações ---
    const handleOpenFormModal = (aluno = null) => {
        setSelectedAluno(aluno);
        setIsFormModalOpen(true);
    };

    const handleOpenConfirmModal = (aluno) => {
        setSelectedAluno(aluno);
        setIsConfirmModalOpen(true);
    };

    const handleCloseModals = () => {
        setIsFormModalOpen(false);
        setIsConfirmModalOpen(false);
        setSelectedAluno(null);
    };

    const handleSaveAluno = async (formData, alunoId) => {
        try {
            if (alunoId) {
                // Atualização
                await api.put(`/alunos/${alunoId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Aluno atualizado com sucesso!', 'success');
            } else {
                // Criação
                await api.post('/alunos', formData, {
                     headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Aluno adicionado com sucesso!', 'success');
            }
            fetchAlunos(); // Recarrega a lista
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Erro ao salvar aluno.';
            showToast(errorMessage, 'error');
            console.error("Erro ao salvar aluno:", error);
        } finally {
            handleCloseModals();
        }
    };

    const handleDeleteAluno = async () => {
        if (!selectedAluno) return;
        try {
            await api.delete(`/alunos/${selectedAluno.id}`);
            showToast('Aluno excluído com sucesso!', 'success');
            fetchAlunos(); // Recarrega a lista
        } catch (error) {
            showToast('Erro ao excluir aluno.', 'error');
            console.error("Erro ao excluir aluno:", error);
        } finally {
            handleCloseModals();
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reseta para a primeira página ao buscar
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-text-default mb-6">Gestão de Alunos</h1>

            {/* Barra de Ações */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <input
                    type="text"
                    placeholder="Buscar aluno por nome ou email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full sm:max-w-xs px-4 py-2 border rounded-md bg-surface border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                    onClick={() => handleOpenFormModal()}
                    className="w-full sm:w-auto px-4 py-2 text-white bg-primary rounded-md hover:bg-primary-dark transition-colors duration-200"
                >
                    Adicionar Aluno
                </button>
            </div>

            {/* Tabela de Alunos */}
            <div className="bg-surface rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Foto</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Nome</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Telefone</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-4">Carregando...</td></tr>
                        ) : error ? (
                             <tr><td colSpan="5" className="text-center py-4 text-danger">{error}</td></tr>
                        ) : alunos.map((aluno) => (
                            <tr key={aluno.id} className="hover:bg-border/50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <img className="h-10 w-10 rounded-full object-cover" src={aluno.foto_url || `https://ui-avatars.com/api/?name=${aluno.nome}&background=random`} alt={aluno.nome} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-default">{aluno.nome}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.telefone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenFormModal(aluno)} className="text-primary hover:text-primary-dark p-1 rounded-full hover:bg-primary/10">
                                            <PencilIcon />
                                        </button>
                                        <button onClick={() => handleOpenConfirmModal(aluno)} className="text-danger hover:text-red-700 p-1 rounded-full hover:bg-danger/10">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {!loading && !error && alunos.length === 0 && (
                    <div className="text-center py-10 text-text-muted">Nenhum aluno encontrado.</div>
                )}
            </div>

            {/* Paginação */}
            <Pagination
                currentPage={currentPage}
                totalItems={totalAlunos}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            {/* Modais */}
            <AlunoFormModal
                isOpen={isFormModalOpen}
                onClose={handleCloseModals}
                onSave={handleSaveAluno}
                aluno={selectedAluno}
            />
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseModals}
                onConfirm={handleDeleteAluno}
                title="Confirmar Exclusão"
                message={`Tem certeza de que deseja excluir o aluno ${selectedAluno?.nome}? Esta ação não pode ser desfeita.`}
            />
        </div>
    );
};

export default Alunos;