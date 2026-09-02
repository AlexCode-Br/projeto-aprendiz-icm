import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// --- Componentes ---
import { Plus, Church } from 'lucide-react';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import AlunoFormModal from '../../components/AlunoFormModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import CatalogItemModal from '../../components/CatalogItemModal';
import { PencilIcon, TrashIcon } from '../../components/icons'; // Ícones genéricos
import ProfileAvatar from '../../components/ProfileAvatar';

const Alunos = () => {
    // --- Estados ---
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados de Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [totalAlunos, setTotalAlunos] = useState(0);
    const [itemsPerPage] = useState(10);
    const [offerings, setOfferings] = useState([]);
    const [churches, setChurches] = useState([]);

    // Estados dos Modais
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedAluno, setSelectedAluno] = useState(null);
    const [isChurchModalOpen, setIsChurchModalOpen] = useState(false);

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
        const timer = setTimeout(() => {
            fetchAlunos();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchAlunos]);

    const fetchAcademicOptions = useCallback(async () => {
        try {
            const [classesResponse, churchesResponse] = await Promise.all([api.get('/cursos'), api.get('/api/churches')]);
            setOfferings(classesResponse.data.cursos.filter(item => item.status === 'Ativo'));
            setChurches(churchesResponse.data.map(item => ({ value: item.id, label: item.nome })));
        } catch {
            setOfferings([]);
            setChurches([]);
        }
    }, []);

    useEffect(() => {
        fetchAcademicOptions();
    }, [fetchAcademicOptions]);

    const handleSaveChurch = async data => {
        try {
            await api.post('/api/churches', data);
            showToast('Igreja de origem cadastrada com sucesso!', 'success');
            setIsChurchModalOpen(false);
            await fetchAcademicOptions();
        } catch (error) {
            showToast(error.response?.data?.message || error.message || 'Erro ao cadastrar a igreja.', 'error');
            throw error;
        }
    };

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

    const handleSaveAluno = async (formData, alunoId, photoChange) => {
        try {
            let savedId = alunoId;
            if (alunoId) {
                await api.put(`/alunos/${alunoId}`, formData);
            } else {
                const response = await api.post('/alunos', formData);
                savedId = response.data.id;
            }
            let photoFailed = false;
            try {
                if (typeof photoChange === 'string') await api.put(`/api/alunos/${savedId}/foto`, { dataUrl: photoChange });
                else if (photoChange === null) await api.delete(`/api/alunos/${savedId}/foto`);
            } catch {
                photoFailed = true;
            }
            showToast(photoFailed ? 'Aluno salvo, mas não foi possível atualizar a foto.' : alunoId ? 'Aluno atualizado com sucesso!' : 'Aluno adicionado com sucesso!', photoFailed ? 'warning' : 'success', photoFailed ? 6000 : undefined);
            handleCloseModals();
            await fetchAlunos();
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Erro ao salvar aluno.';
            showToast(errorMessage, 'error');
            console.error("Erro ao salvar aluno:", error);
        }
    };

    const handleDeleteAluno = async () => {
        if (!selectedAluno) return;
        try {
            const response = await api.delete(`/alunos/${selectedAluno.id}`);
            showToast(response.data?.message || 'Dados pessoais do aluno anonimizados com sucesso!', 'success');
            await fetchAlunos();
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
            <div className="page-header"><div><h1 className="page-title">Alunos</h1><p className="page-description">Consulte cadastros e mantenha os dados dos alunos atualizados.</p></div></div>

            {/* Barra de Ações */}
            <div className="panel mb-6 flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center">
                <label htmlFor="student-search" className="sr-only">Buscar aluno</label>
                <SearchInput
                    id="student-search"
                    type="text"
                    placeholder="Buscar aluno por nome ou email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="form-control sm:max-w-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => setIsChurchModalOpen(true)} className="btn btn-secondary w-full sm:w-auto"><Church aria-hidden="true" />Nova igreja de origem</button>
                    <button onClick={() => handleOpenFormModal()} className="btn btn-primary w-full sm:w-auto"><Plus aria-hidden="true" />Adicionar aluno</button>
                </div>
            </div>

            {/* Tabela de Alunos */}
            <div className="panel overflow-x-auto">
                <table className="data-table mobile-cards min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Aluno</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Telefone</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            Array.from({ length: 4 }, (_, index) => <tr key={index}><td colSpan="4" className="px-6 py-4"><div className="skeleton h-10 rounded" /></td></tr>)
                        ) : error ? (
                             <tr><td colSpan="4" className="text-center py-4 text-danger">{error}</td></tr>
                        ) : alunos.map((aluno) => (
                            <tr key={aluno.id} className="hover:bg-border/50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex min-w-0 items-center gap-3"><ProfileAvatar name={aluno.nome} src={aluno.foto_url} className="h-10 w-10" /><span className="break-words font-semibold">{aluno.nome}</span></div>
                                </td>
                                <td data-label="E-mail" className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.email || 'Não informado'}</td>
                                <td data-label="Telefone" className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{aluno.telefone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <button type="button" aria-label={`Editar ${aluno.nome}`} onClick={() => handleOpenFormModal(aluno)} className="icon-button text-primary hover:text-primary-dark hover:bg-primary/10">
                                            <PencilIcon />
                                        </button>
                                        <button type="button" aria-label={`Excluir ${aluno.nome}`} onClick={() => handleOpenConfirmModal(aluno)} className="icon-button text-danger hover:text-red-700 hover:bg-danger/10">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {!loading && !error && alunos.length === 0 && (
                    <div className="px-6 py-10 text-center text-text-muted"><strong className="block text-text-default">Nenhum aluno encontrado</strong><span className="mt-1 block text-sm">Limpe a busca ou adicione o primeiro aluno.</span></div>
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
                offerings={offerings}
                churches={churches}
            />
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseModals}
                onConfirm={handleDeleteAluno}
                title="Anonimizar dados do aluno?"
                message={`O cadastro de ${selectedAluno?.nome || 'este aluno'} será removido das turmas e todos os dados pessoais serão apagados de forma irreversível. O histórico acadêmico permanecerá apenas de forma anônima para estatísticas.`}
                confirmLabel="Anonimizar e excluir"
            />
            <CatalogItemModal
                isOpen={isChurchModalOpen}
                onClose={() => setIsChurchModalOpen(false)}
                onSave={handleSaveChurch}
                item={null}
                type="locais"
            />
        </div>
    );
};

export default Alunos;
