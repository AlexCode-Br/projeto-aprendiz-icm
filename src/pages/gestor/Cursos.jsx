import React, { useState, useMemo, useEffect, useCallback } from 'react';
import CursoModal from '../../components/CursoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const allLocais = ['Pituba', 'Brotas', 'Lauro de Freitas', 'Boca do Rio', 'Alto de Coutos', 'Remoto'];

const Cursos = () => {
    const { showToast } = useToast();
    const [cursos, setCursos] = useState([]);
    const [professoresDisponiveis, setProfessoresDisponiveis] = useState([]);
    const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [isCursoModalOpen, setIsCursoModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [currentCurso, setCurrentCurso] = useState(null);

    const fetchCursos = useCallback(async () => {
        try {
            const response = await api.get('/cursos');
            setCursos(response.data.cursos);
            setProfessoresDisponiveis(response.data.professores);
            setLocaisDisponiveis(response.data.locais);
        } catch (error) {
            showToast(error.message || 'Erro ao carregar os cursos.', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchCursos(); }, [fetchCursos]);

    const handleOpenCursoModal = (curso = null) => {
        setCurrentCurso(curso);
        setIsCursoModalOpen(true);
    };

    const handleCloseCursoModal = () => {
        setIsCursoModalOpen(false);
        setCurrentCurso(null);
    };

    const handleOpenConfirmModal = (curso) => {
        setCurrentCurso(curso);
        setIsConfirmModalOpen(true);
    };

    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setCurrentCurso(null);
    };

    const handleSaveCurso = async (cursoData) => {
        try {
            if (currentCurso) {
                await api.put(`/cursos/${currentCurso.id}`, cursoData);
                showToast('Curso atualizado com sucesso!', 'success');
            } else {
                await api.post('/cursos', cursoData);
                showToast('Curso adicionado com sucesso!', 'success');
            }
            handleCloseCursoModal();
            await fetchCursos();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o curso.', 'error');
        }
    };

    const handleDeleteCurso = async () => {
        try {
            await api.delete(`/cursos/${currentCurso.id}`);
            showToast('Turma desativada com sucesso!', 'success');
            handleCloseConfirmModal();
            await fetchCursos();
        } catch (error) {
            showToast(error.message || 'Erro ao desativar a turma.', 'error');
        }
    };

    const filteredCursos = useMemo(() => {
        return cursos.filter(curso => {
            const matchesSearch = curso.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLocal = selectedLocal === '' || curso.local === selectedLocal;
            return matchesSearch && matchesLocal;
        });
    }, [cursos, searchTerm, selectedLocal]);

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h2 className="text-2xl font-bold text-text-default mb-4 sm:mb-0">Gerenciamento de Cursos</h2>
                <button onClick={() => handleOpenCursoModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    Novo Curso
                </button>
            </div>

            <div className="p-4 md:p-6 bg-surface rounded-lg shadow-sm border border-border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-text-muted">Pesquisar por Nome</label>
                        <input
                            type="text"
                            placeholder="Nome do curso..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-surface"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-text-muted">Filtrar por Local</label>
                        <select
                            value={selectedLocal}
                            onChange={(e) => setSelectedLocal(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-surface"
                        >
                            <option value="">Todos os Locais</option>
                            {locaisDisponiveis.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-lg shadow-sm overflow-hidden border border-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-text-default">
                        <thead className="bg-gray-50 dark:bg-surface/30 text-xs uppercase text-text-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3">Curso</th>
                                <th scope="col" className="px-6 py-3">Local</th>
                                <th scope="col" className="px-6 py-3">Professor</th>
                                <th scope="col" className="px-6 py-3 text-center">Alunos</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCursos.map(curso => (
                                <tr key={curso.id} className="border-b border-border hover:bg-gray-50 dark:hover:bg-gray-50/10">
                                    <td className="px-6 py-4 font-medium">{curso.nome}</td>
                                    <td className="px-6 py-4">{curso.local}</td>
                                    <td className="px-6 py-4">{curso.professor}</td>
                                    <td className="px-6 py-4 text-center">{curso.alunos}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${curso.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {curso.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={() => handleOpenCursoModal(curso)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-full" title="Editar">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            <button onClick={() => handleOpenConfirmModal(curso)} className="p-2 text-danger hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full" title="Excluir">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <CursoModal
                isOpen={isCursoModalOpen}
                onClose={handleCloseCursoModal}
                onSave={handleSaveCurso}
                curso={currentCurso}
                allProfessores={professoresDisponiveis}
                allLocais={locaisDisponiveis}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleDeleteCurso}
                title="Confirmar exclusão?"
                message="Esta ação não poderá ser desfeita."
            />
        </>
    );
};

export default Cursos;
