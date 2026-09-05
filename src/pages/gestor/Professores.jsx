import PageSkeleton from '../../components/PageSkeleton';
import { Eye as DetailsIcon, Pencil as EditIcon, Trash2 as DeleteIcon, Mail as InviteIcon } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ProfessorFormModal from '../../components/ProfessorFormModal';
import ProfessorDetailsModal from '../../components/ProfessorDetailsModal';
import ProfessorDeletionImpactModal from '../../components/ProfessorDeletionImpactModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import KebabMenu from '../../components/KebabMenu'; // Importando o novo componente
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { Plus } from 'lucide-react';
import SearchInput from '../../components/SearchInput';
import ProfileAvatar from '../../components/ProfileAvatar';

// Ícones de Ação





const Professores = () => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
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
    const [deletionContext, setDeletionContext] = useState(null);
    const [isLoadingImpact, setLoadingImpact] = useState(false);
    const [isDeleting, setDeleting] = useState(false);
    const [resendingProfessorId, setResendingProfessorId] = useState(null);
    const impactRequestRef = useRef(0);
    const deletionImpact = deletionContext?.impact || null;

    const fetchProfessores = useCallback(async () => {
        setLoadError('');
        try {
            const response = await api.get('/professores');
            setProfessores(response.data.professores);
            setCoursesList(response.data.cursos);
            setLocaisList(response.data.locais);
        } catch (error) {
            setLoadError(error.message || 'Erro ao carregar professores.');
            showToast(error.message || 'Erro ao carregar professores.', 'error');
        } finally { setLoading(false); }
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
        const requestId = ++impactRequestRef.current;
        setDeletionContext({ professor: prof, impact: null });
        setImpactModalOpen(true);
        setLoadingImpact(true);
        try {
            const response = await api.get(`/professores/${prof.id}/impacto-exclusao`);
            if (requestId !== impactRequestRef.current) return;
            if (Number(response.data?.professor?.id) !== Number(prof.id)) {
                throw new Error('A consulta retornou dados de outro professor. Tente novamente.');
            }
            setDeletionContext(current => Number(current?.professor?.id) === Number(prof.id)
                ? { ...current, impact: response.data }
                : current);
        } catch (error) {
            if (requestId !== impactRequestRef.current) return;
            setImpactModalOpen(false);
            setDeletionContext(null);
            showToast(error.message || 'Erro ao consultar os vínculos do professor.', 'error');
        } finally {
            if (requestId === impactRequestRef.current) setLoadingImpact(false);
        }
    };

    const handleCloseDeleteImpact = () => {
        impactRequestRef.current += 1;
        setImpactModalOpen(false);
        setLoadingImpact(false);
        setDeletionContext(null);
    };

    const handleContinueDelete = () => {
        if (isLoadingImpact || !deletionContext?.impact || Number(deletionContext.professor?.id) !== Number(deletionContext.impact.professor?.id)) return;
        impactRequestRef.current += 1;
        setImpactModalOpen(false);
        setConfirmModalOpen(true);
    };

    const handleCloseDeleteConfirm = () => {
        setConfirmModalOpen(false);
        setDeletionContext(null);
    };

    const handleSaveProfessor = async (profData, photoChange) => {
        try {
            let savedId = currentProfessor?.id;
            let response;
            if (currentProfessor) {
                await api.put(`/professores/${currentProfessor.id}`, profData);
            } else {
                response = await api.post('/professores', profData);
                savedId = response.data.id;
            }
            let photoFailed = false;
            try {
                if (typeof photoChange === 'string') await api.put(`/api/professores/${savedId}/foto`, { dataUrl: photoChange });
                else if (photoChange === null) await api.delete(`/api/professores/${savedId}/foto`);
            } catch { photoFailed = true; }
            const defaultMessage = currentProfessor ? 'Professor atualizado com sucesso!' : response?.data?.message || 'Professor cadastrado com sucesso!';
            showToast(photoFailed ? `${defaultMessage} A foto não pôde ser atualizada.` : defaultMessage, photoFailed || response?.data?.inviteSent === false ? 'warning' : 'success', 6000);
            setFormModalOpen(false);
            await fetchProfessores();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o professor.', 'error');
        }
    };

    const handleDeleteProfessor = async () => {
        if (isDeleting) return;
        const professorId = deletionContext?.professor?.id;
        if (!professorId || Number(professorId) !== Number(deletionContext?.impact?.professor?.id)) return;
        setDeleting(true);
        try {
            const response = await api.delete(`/professores/${professorId}`);
            showToast(response.data.message || 'Professor excluído definitivamente!', 'success', 6000);
            setConfirmModalOpen(false);
            setDeletionContext(null);
            await fetchProfessores();
        } catch (error) {
            showToast(error.message || 'Erro ao excluir o professor.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleResendInvite = async (prof) => {
        if (resendingProfessorId || prof.acesso === 'Ativo' || prof.status !== 'Ativo') return;
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

    if (loading) return <PageSkeleton label="Carregando professores" />;
    if (loadError) return <div className="panel empty-state"><p role="alert">{loadError}</p><button type="button" className="btn btn-secondary mt-3" onClick={fetchProfessores}>Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Professores</h1><p className="page-description">Gerencie a equipe docente, suas turmas e locais de atuação.</p></div>
                <button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary w-full sm:w-auto">
                    <Plus aria-hidden="true" />Novo professor
                </button>
            </div>

            <section className="panel mb-6 p-4" aria-label="Filtros de professores">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="teacher-search" className="form-label">Pesquisar por nome</label>
                        <SearchInput id="teacher-search" placeholder="Pesquisar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-control" />
                    </div>
                    <div>
                        <label htmlFor="teacher-course" className="form-label">Curso</label>
                        <FormSelect
                            id="teacher-course"
                            value={selectedCourse}
                            onChange={e => setSelectedCourse(e.target.value)}
                            options={coursesList}
                            placeholder="Todos os Cursos"
                        />
                    </div>
                    <div>
                        <label htmlFor="teacher-church" className="form-label">Igreja</label>
                        <FormSelect
                            id="teacher-church"
                            value={selectedLocal}
                            onChange={e => setSelectedLocal(e.target.value)}
                            options={locaisList}
                            placeholder="Todas as Igrejas"
                        />
                    </div>
                </div>
            </section>

            <div className="panel overflow-hidden">
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
                    <table className="data-table mobile-cards record-cards w-full text-sm text-left">
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
                                    <td className="px-6 py-4 font-medium"><div className="flex items-center gap-3"><ProfileAvatar name={prof.nome} src={prof.foto_url} className="h-10 w-10" /><span>{prof.nome}</span></div></td>
                                    <td data-label="Cursos" className="px-6 py-4"><span className="inline-flex flex-wrap gap-1">{prof.cursos.map(course => <span key={course} className="badge">{course}</span>)}</span></td>
                                    <td data-label="Igreja" className="px-6 py-4">{prof.local}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${prof.acesso === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' : prof.acesso === 'Desativado' ? 'bg-gray-100 text-text-default dark:bg-white/10 dark:text-gray-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{prof.acesso}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="hidden md:flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Ver detalhes de ${prof.nome}`} onClick={() => handleOpenDetailsModal(prof)} className="icon-button text-text-muted" title="Detalhes"><DetailsIcon/></button>
                                            <button type="button" aria-label={`Editar ${prof.nome}`} onClick={() => handleOpenFormModal(prof)} className="icon-button text-primary" title="Editar"><EditIcon/></button>
                                            <button type="button" aria-label={prof.acesso === 'Ativo' ? `Convite indisponível: ${prof.nome} já tem acesso ativo` : `Reenviar convite para ${prof.nome}`} disabled={Boolean(resendingProfessorId) || prof.acesso === 'Ativo' || prof.status !== 'Ativo'} onClick={() => handleResendInvite(prof)} className="icon-button text-amber-700 dark:text-amber-300" title={prof.acesso === 'Ativo' ? 'O professor já tem acesso ativo' : 'Reenviar convite'}><InviteIcon/></button>
                                            <button type="button" aria-label={`Excluir ${prof.nome}`} onClick={() => handleOpenDeleteImpact(prof)} className="icon-button text-danger" title="Excluir definitivamente"><DeleteIcon/></button>
                                        </div>
                                        <div className="md:hidden">
                                            <KebabMenu label={`Ações de ${prof.nome}`}>
                                                <button type="button" role="menuitem" onClick={() => handleOpenDetailsModal(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-surface-hover transition-colors">
                                                    <DetailsIcon /> Detalhes
                                                </button>
                                                <button type="button" role="menuitem" onClick={() => handleOpenFormModal(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-default hover:bg-surface-hover transition-colors">
                                                    <EditIcon /> Editar
                                                </button>
                                                <button type="button" role="menuitem" disabled={Boolean(resendingProfessorId) || prof.acesso === 'Ativo' || prof.status !== 'Ativo'} onClick={() => handleResendInvite(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-40 dark:text-amber-200 dark:hover:bg-amber-950/30">
                                                    <InviteIcon /> {prof.acesso === 'Ativo' ? 'Acesso já ativo' : 'Reenviar convite'}
                                                </button>
                                                <button type="button" role="menuitem" onClick={() => handleOpenDeleteImpact(prof)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-red-50 dark:hover:bg-red-950/30">
                                                    <DeleteIcon /> Excluir
                                                </button>
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
            <ProfessorDeletionImpactModal isOpen={isImpactModalOpen} onClose={handleCloseDeleteImpact} onContinue={handleContinueDelete} impact={deletionImpact} loading={isLoadingImpact} />
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseDeleteConfirm}
                onConfirm={handleDeleteProfessor}
                title="Confirmar exclusão do professor?"
                message={deletionImpact ? `Esta ação é irreversível. ${deletionImpact.professor.nome}, sua conta, ${deletionImpact.resumo.turmas} turma(s), matrículas, convites e demais dados vinculados serão apagados definitivamente. Os cadastros dos alunos permanecerão sem esse vínculo.` : 'Esta ação apagará definitivamente a conta e todos os dados vinculados ao professor.'}
                confirmLabel="Excluir definitivamente"
                loading={isDeleting}
            />
        </>
    );
};

export default Professores;
