import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ProfessorFormModal from '../../components/ProfessorFormModal';
import ProfessorDetailsModal from '../../components/ProfessorDetailsModal';
import ProfessorDeletionImpactModal from '../../components/ProfessorDeletionImpactModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import KebabMenu from '../../components/KebabMenu';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { EyeIcon, PencilIcon, TrashIcon, PlusIcon, SearchIcon } from '../../components/icons/index.jsx';

const InviteIcon = () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;


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
            showToast(response.data.message || 'Professor excluído definitivamente!', 'success', 6000);
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                    <h1 className="page-title">Professores</h1>
                    <p className="page-description">Gerencie a equipe docente, suas turmas e locais de atuação.</p>
                </div>
                <button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary shrink-0">
                    <PlusIcon className="w-4 h-4" />
                    Novo Professor
                </button>
            </div>

            <div className="panel mb-5 p-4" role="search">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                        <input type="text" placeholder="Buscar por nome…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-control pl-9" aria-label="Buscar professor" />
                    </div>
                    <div>
                        <label className="sr-only">Filtrar por curso</label>
                        <FormSelect value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} options={coursesList} placeholder="Todos os Cursos" />
                    </div>
                    <div>
                        <label className="sr-only">Filtrar por igreja</label>
                        <FormSelect value={selectedLocal} onChange={e => setSelectedLocal(e.target.value)} options={locaisList} placeholder="Todas as Igrejas" />
                    </div>
                </div>
            </div>

            <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface-muted text-xs uppercase text-text-muted">
                            <tr>
                                <th className="px-6 py-3">Professor</th>
                                <th className="px-6 py-3">Cursos</th>
                                <th className="px-6 py-3">Igreja</th>
                                <th className="px-6 py-3">Acesso</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfessores.map(prof => (
                                <tr key={prof.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                    <td className="px-4 py-3 font-medium">{prof.nome}</td>
                                    <td className="px-4 py-3 text-text-muted text-sm">{prof.cursos.join(', ')}</td>
                                    <td className="px-4 py-3 text-text-muted text-sm">{prof.local}</td>
                                    <td className="px-4 py-3">
                                        <span className={`badge ${prof.acesso === 'Ativo' ? 'badge-success' : prof.acesso === 'Desativado' ? 'badge-neutral' : 'badge-warning'}`}>{prof.acesso}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="hidden md:flex items-center justify-center gap-1">
                                            <button type="button" aria-label={`Ver detalhes de ${prof.nome}`} onClick={() => handleOpenDetailsModal(prof)} className="icon-btn" title="Detalhes"><EyeIcon className="w-4 h-4"/></button>
                                            <button type="button" aria-label={`Editar ${prof.nome}`} onClick={() => handleOpenFormModal(prof)} className="icon-btn" title="Editar"><PencilIcon className="w-4 h-4"/></button>
                                            {prof.acesso !== 'Ativo' && prof.status === 'Ativo' && <button type="button" aria-label={`Reenviar convite para ${prof.nome}`} disabled={resendingProfessorId === prof.id} onClick={() => handleResendInvite(prof)} className="icon-btn" title="Reenviar convite"><InviteIcon/></button>}
                                            <button type="button" aria-label={`Excluir ${prof.nome}`} onClick={() => handleOpenDeleteImpact(prof)} className="icon-btn icon-btn-danger" title="Excluir definitivamente"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                        <div className="md:hidden">
                                            <KebabMenu>
                                                <button type="button" role="menuitem" onClick={() => handleOpenDetailsModal(prof)} className="flex min-h-10 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-surface-hover transition-colors"><EyeIcon className="w-4 h-4" /> Detalhes</button>
                                                <button type="button" role="menuitem" onClick={() => handleOpenFormModal(prof)} className="flex min-h-10 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-surface-hover transition-colors"><PencilIcon className="w-4 h-4" /> Editar</button>
                                                {prof.acesso !== 'Ativo' && prof.status === 'Ativo' && <button type="button" role="menuitem" disabled={resendingProfessorId === prof.id} onClick={() => handleResendInvite(prof)} className="flex min-h-10 w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-surface-hover transition-colors"><InviteIcon /> Reenviar convite</button>}
                                                <button type="button" role="menuitem" onClick={() => handleOpenDeleteImpact(prof)} className="flex min-h-10 w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-danger-bg transition-colors"><TrashIcon className="w-4 h-4" /> Excluir</button>
                                            </KebabMenu>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredProfessores.length && <tr><td colSpan="5" className="px-6 py-12 text-center text-sm text-text-muted">Nenhum professor encontrado com estes filtros.</td></tr>}
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
                message={deletionImpact ? `Esta ação é irreversível. ${deletionImpact.professor.nome}, sua conta, ${deletionImpact.resumo.turmas} turma(s), matrículas, frequências, convites e demais dados vinculados serão apagados definitivamente. Os cadastros dos alunos permanecerão sem esse vínculo.` : 'Esta ação apagará definitivamente a conta e todos os dados vinculados ao professor.'}
                confirmLabel="Excluir definitivamente"
                loading={isDeleting}
            />
        </>
    );
};

export default Professores;
