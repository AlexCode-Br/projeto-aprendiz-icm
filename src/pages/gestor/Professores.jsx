import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ProfessorFormModal from '../../components/ProfessorFormModal';
import ProfessorDetailsModal from '../../components/ProfessorDetailsModal';
import ProfessorDeletionImpactModal from '../../components/ProfessorDeletionImpactModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import KebabMenu from '../../components/KebabMenu'; // Importando o novo componente
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

// Ícones de Ação
const DetailsIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>;
const EditIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>;
const DeleteIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>;
const InviteIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;

const Professores = () => {
    const { showToast } = useToast();
    const [professores, setProfessores] = useState([]);
    const [coursesList, setCoursesList] = useState([]);
    const [locaisList, setLocaisList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
    const [isImpactModalOpen, setImpactModalOpen] = useState(false);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    const [currentProfessor, setCurrentProfessor] = useState(null);
    const [deletionImpact, setDeletionImpact] = useState(null);
    const [isLoadingImpact, setLoadingImpact] = useState(false);
    const [isDeleting, setDeleting] = useState(false);
    const [resendingProfessorId, setResendingProfessorId] = useState(null);

    const fetchProfessores = useCallback(async () => {
        try {
            const response = await api.get('/professores');
            setProfessores(response.data.professores);
            setCoursesList(response.data.cursos);
            setLocaisList(response.data.locais);
        } catch (error) {
            showToast(error.message || 'Erro ao carregar professores.', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchProfessores(); }, [fetchProfessores]);

    const handleOpenFormModal = (prof = null) => {
        setCurrentProfessor(prof);
        setFormModalOpen(true);
    };

    const handleOpenDetailsModal = (prof) => {
        setCurrentProfessor(prof);
        setDetailsModalOpen(true);
    };
    
    const handleOpenDeleteImpact = async (prof) => {
        setCurrentProfessor(prof);
        setDeletionImpact(null);
        setImpactModalOpen(true);
        setLoadingImpact(true);
        try {
            const response = await api.get(`/professores/${prof.id}/impacto-exclusao`);
            setDeletionImpact(response.data);
        } catch (error) {
            setImpactModalOpen(false);
            showToast(error.message || 'Erro ao consultar os vínculos do professor.', 'error');
        } finally {
            setLoadingImpact(false);
        }
    };

    const handleContinueDelete = () => {
        setImpactModalOpen(false);
        setConfirmModalOpen(true);
    };

    const handleSaveProfessor = async (profData) => {
        try {
            if (currentProfessor) {
                await api.put(`/professores/${currentProfessor.id}`, profData);
                showToast('Professor atualizado com sucesso!', 'success');
            } else {
                const response = await api.post('/professores', profData);
                showToast(response.data.message || 'Professor cadastrado com sucesso!', response.data.inviteSent === false ? 'warning' : 'success', 6000);
            }
            setFormModalOpen(false);
            await fetchProfessores();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o professor.', 'error');
        }
    };

    const handleDeleteProfessor = async () => {
        if (isDeleting) return;
        setDeleting(true);
        try {
            const response = await api.delete(`/professores/${currentProfessor.id}`);
            showToast(response.data.message || 'Professor excluído com sucesso!', response.data.authAccountRemoved === false ? 'warning' : 'success', 6000);
            setConfirmModalOpen(false);
            setDeletionImpact(null);
            await fetchProfessores();
        } catch (error) {
            showToast(error.message || 'Erro ao excluir o professor.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleResendInvite = async (prof) => {
        if (resendingProfessorId) return;
        setResendingProfessorId(prof.id);
        try {
            const response = await api.post(`/professores/${prof.id}/reenviar-convite`, {});
            showToast(response.data.message || 'Convite reenviado com sucesso!', 'success');
            await fetchProfessores();
        } catch (error) {
            showToast(error.message || 'Erro ao reenviar o convite.', 'error', 6000);
        } finally {
            setResendingProfessorId(null);
        }
    };

    const filteredProfessores = useMemo(() => {
        return professores.filter(prof => 
            prof.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (selectedCourse === '' || prof.cursos.includes(selectedCourse)) &&
            (selectedLocal === '' || prof.local === selectedLocal)
        );
    }, [professores, searchTerm, selectedCourse, selectedLocal]);
    
    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Professores</h1><p className="page-description">Gerencie a equipe docente, suas turmas e locais de atuação.</p></div>
                <button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary w-full sm:w-auto">
                    Novo Professor
                </button>
            </div>

            <section className="panel mb-6 p-4" aria-label="Filtros de professores">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label><span className="sr-only">Pesquisar por nome</span><input type="text" placeholder="Pesquisar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-control" /></label>
                    <label><span className="sr-only">Filtrar por curso</span><select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="form-control">
                        <option value="">Todos os Cursos</option>
                        {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select></label>
                     <label><span className="sr-only">Filtrar por local</span><select value={selectedLocal} onChange={e => setSelectedLocal(e.target.value)} className="form-control">
                        <option value="">Todos os Locais</option>
                        {locaisList.map(l => <option key={l} value={l}>{l}</option>)}
                    </select></label>
                </div>
            </section>

            <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-surface/30 text-xs uppercase text-text-muted">
                            <tr>
                                <th className="px-6 py-3">Professor</th>
                                <th className="px-6 py-3">Cursos</th>
                                <th className="px-6 py-3">Local</th>
                                <th className="px-6 py-3">Acesso</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfessores.map(prof => (
                                <tr key={prof.id} className="border-b border-border hover:bg-gray-50 dark:hover:bg-gray-50/10">
                                    <td className="px-6 py-4 font-medium">{prof.nome}</td>
                                    <td className="px-6 py-4">{prof.cursos.join(', ')}</td>
                                    <td className="px-6 py-4">{prof.local}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${prof.acesso === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' : prof.acesso === 'Desativado' ? 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{prof.acesso}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="hidden md:flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Ver detalhes de ${prof.nome}`} onClick={() => handleOpenDetailsModal(prof)} className="icon-button text-gray-500" title="Detalhes"><DetailsIcon/></button>
                                            <button type="button" aria-label={`Editar ${prof.nome}`} onClick={() => handleOpenFormModal(prof)} className="icon-button text-blue-600" title="Editar"><EditIcon/></button>
                                            {prof.acesso !== 'Ativo' && prof.status === 'Ativo' && <button type="button" aria-label={`Reenviar convite para ${prof.nome}`} disabled={resendingProfessorId === prof.id} onClick={() => handleResendInvite(prof)} className="icon-button text-amber-700 dark:text-amber-300" title="Reenviar convite"><InviteIcon/></button>}
                                            {prof.status === 'Ativo' && <button type="button" aria-label={`Excluir ${prof.nome}`} onClick={() => handleOpenDeleteImpact(prof)} className="icon-button text-danger" title="Excluir"><DeleteIcon/></button>}
                                        </div>
                                        <div className="md:hidden">
                                            <KebabMenu>
                                                <button type="button" role="menuitem" onClick={() => handleOpenDetailsModal(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-gray-100 dark:hover:bg-white/10">
                                                    <DetailsIcon /> Detalhes
                                                </button>
                                                <button type="button" role="menuitem" onClick={() => handleOpenFormModal(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-gray-100 dark:hover:bg-white/10">
                                                    <EditIcon /> Editar
                                                </button>
                                                {prof.acesso !== 'Ativo' && prof.status === 'Ativo' && <button type="button" role="menuitem" disabled={resendingProfessorId === prof.id} onClick={() => handleResendInvite(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30">
                                                    <InviteIcon /> Reenviar convite
                                                </button>}
                                                {prof.status === 'Ativo' && <button type="button" role="menuitem" onClick={() => handleOpenDeleteImpact(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-red-50 dark:hover:bg-red-950/30">
                                                    <DeleteIcon /> Excluir
                                                </button>}
                                            </KebabMenu>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredProfessores.length && <tr><td colSpan="5" className="px-6 py-10 text-center text-sm text-text-muted">Nenhum professor encontrado com estes filtros.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <ProfessorFormModal isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)} onSave={handleSaveProfessor} professor={currentProfessor} courses={coursesList} locations={locaisList} />
            <ProfessorDetailsModal isOpen={isDetailsModalOpen} onClose={() => setDetailsModalOpen(false)} professor={currentProfessor} />
            <ProfessorDeletionImpactModal isOpen={isImpactModalOpen} onClose={() => setImpactModalOpen(false)} onContinue={handleContinueDelete} impact={deletionImpact} loading={isLoadingImpact} />
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={handleDeleteProfessor}
                title="Confirmar exclusão do professor?"
                message={deletionImpact ? `${deletionImpact.professor.nome} perderá o acesso e ${deletionImpact.resumo.turmasAtivas} turma(s) serão desativadas. Os ${deletionImpact.resumo.alunosAtivos} aluno(s) e todo o histórico serão preservados.` : 'O acesso será revogado e o histórico será preservado.'}
                confirmLabel="Excluir professor"
                loading={isDeleting}
            />
        </>
    );
};

export default Professores;
