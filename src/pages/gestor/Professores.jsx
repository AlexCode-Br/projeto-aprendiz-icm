import PageSkeleton from '../../components/PageSkeleton';
import { Pencil as EditIcon, Trash2 as DeleteIcon, Mail as InviteIcon } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ProfessorFormModal from '../../components/ProfessorFormModal';
import ProfessorDetailsModal from '../../components/ProfessorDetailsModal';
import ProfessorDeletionImpactModal from '../../components/ProfessorDeletionImpactModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import KebabMenu, { KebabMenuItem } from '../../components/KebabMenu';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { Plus } from 'lucide-react';
import SearchInput from '../../components/SearchInput';
import ProfileAvatar from '../../components/ProfileAvatar';
import Pagination from '../../components/Pagination';
import { STUDENT_CHURCH_SUGGESTIONS, catalogKey } from '../../../shared/catalog-options.mjs';

const ITEMS_PER_PAGE = 5;

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
    const [currentPage, setCurrentPage] = useState(1);
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
    const profileLocations = useMemo(() => [...new Map(
        [...STUDENT_CHURCH_SUGGESTIONS, ...locaisList]
            .filter(local => local && !['ead', 'remoto'].includes(catalogKey(local)))
            .map(local => [catalogKey(local), local]),
    ).values()].sort((left, right) => left.localeCompare(right, 'pt-BR')), [locaisList]);

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
    const totalPages = Math.max(1, Math.ceil(filteredProfessores.length / ITEMS_PER_PAGE));
    const paginatedProfessores = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProfessores.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProfessores, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCourse, selectedLocal]);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

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

            <section className="space-y-3 xl:hidden" aria-label="Professores encontrados">
                {paginatedProfessores.map(prof => <article key={prof.id} className="panel min-w-0 p-3.5" aria-label={prof.nome}>
                    <header className="flex items-center gap-2.5">
                        <button type="button" onClick={() => handleOpenDetailsModal(prof)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left hover:text-primary" aria-label={`Ver detalhes de ${prof.nome}`}>
                            <ProfileAvatar name={prof.nome} src={prof.foto_url} className="h-9 w-9" textClassName="text-xs" />
                            <span className="min-w-0 break-words text-sm font-semibold leading-5">{prof.nome}</span>
                        </button>
                        <KebabMenu label={`Ações de ${prof.nome}`}>
                            <KebabMenuItem icon={EditIcon} tone="primary" onClick={() => handleOpenFormModal(prof)}>Editar cadastro</KebabMenuItem>
                            <KebabMenuItem icon={InviteIcon} tone="warning" disabled={Boolean(resendingProfessorId) || prof.acesso === 'Ativo' || prof.status !== 'Ativo'} onClick={() => handleResendInvite(prof)}>{prof.acesso === 'Ativo' ? 'Acesso já ativo' : 'Reenviar convite'}</KebabMenuItem>
                            <KebabMenuItem icon={DeleteIcon} tone="danger" onClick={() => handleOpenDeleteImpact(prof)}>Excluir professor</KebabMenuItem>
                        </KebabMenu>
                    </header>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-border/70 pt-2.5">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Igreja</p>
                            <p className="mt-0.5 break-words text-sm">{prof.local || 'Não informada'}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${prof.acesso === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' : prof.acesso === 'Desativado' ? 'bg-gray-100 text-text-default dark:bg-white/10 dark:text-gray-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{prof.acesso}</span>
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Cursos</span>
                        {prof.cursos.length ? prof.cursos.map(course => <span key={course} className="badge">{course}</span>) : <span className="text-xs text-text-muted">Nenhum curso</span>}
                    </div>
                </article>)}
                {!filteredProfessores.length && <div className="panel p-6 text-center text-sm text-text-muted">Nenhum professor encontrado com estes filtros.</div>}
            </section>

            <div className="panel hidden overflow-hidden xl:block">
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
                    <table className="data-table w-full text-sm text-left">
                        <thead className="bg-surface-muted text-xs uppercase text-text-muted">
                            <tr>
                                <th className="px-6 py-3">Professor</th>
                                <th className="px-6 py-3">Cursos</th>
                                <th className="px-6 py-3">Acesso</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedProfessores.map(prof => (
                                <tr key={prof.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                    <td className="px-6 py-4 font-medium"><button type="button" onClick={() => handleOpenDetailsModal(prof)} aria-label={`Ver dados de ${prof.nome}`} className="flex min-h-11 min-w-0 items-center gap-3 rounded text-left hover:text-primary"><ProfileAvatar name={prof.nome} src={prof.foto_url} className="h-10 w-10" /><span className="break-words">{prof.nome}</span></button></td>
                                    <td data-label="Cursos" className="px-6 py-4"><span className="inline-flex flex-wrap gap-1">{prof.cursos.map(course => <span key={course} className="badge">{course}</span>)}</span></td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${prof.acesso === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' : prof.acesso === 'Desativado' ? 'bg-gray-100 text-text-default dark:bg-white/10 dark:text-gray-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{prof.acesso}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Editar ${prof.nome}`} onClick={() => handleOpenFormModal(prof)} className="icon-button text-primary" title="Editar"><EditIcon/></button>
                                            <button type="button" aria-label={prof.acesso === 'Ativo' ? `Convite indisponível: ${prof.nome} já tem acesso ativo` : `Reenviar convite para ${prof.nome}`} disabled={Boolean(resendingProfessorId) || prof.acesso === 'Ativo' || prof.status !== 'Ativo'} onClick={() => handleResendInvite(prof)} className="icon-button text-amber-700 dark:text-amber-300" title={prof.acesso === 'Ativo' ? 'O professor já tem acesso ativo' : 'Reenviar convite'}><InviteIcon/></button>
                                            <button type="button" aria-label={`Excluir ${prof.nome}`} onClick={() => handleOpenDeleteImpact(prof)} className="icon-button text-danger" title="Excluir definitivamente"><DeleteIcon/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredProfessores.length && <tr><td colSpan="4" className="px-6 py-10 text-center text-sm text-text-muted">Nenhum professor encontrado com estes filtros.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination currentPage={currentPage} totalItems={filteredProfessores.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} compact className="mt-4 rounded-xl border border-border bg-surface" />

            <ProfessorFormModal isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)} onSave={handleSaveProfessor} professor={currentProfessor} locations={profileLocations} />
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
