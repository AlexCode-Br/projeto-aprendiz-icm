import PageSkeleton from '../../components/PageSkeleton';
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TurmaCard from '../../components/TurmaCard';
import ClassScheduleList from '../../components/ClassScheduleList';
import SearchInput from '../../components/SearchInput';
import TurmaModal from '../../components/TurmaModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import CourseCommunity from '../../components/CourseCommunity';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { CHURCH_SUGGESTIONS, COURSE_SUGGESTIONS, catalogKey } from '../../../shared/catalog-options.mjs';

const mergeCatalogNames = (...groups) => [...new Map(groups.flat().filter(Boolean).map(name => [catalogKey(name), name])).values()]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
const ITEMS_PER_PAGE = 5;

const Turmas = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const { showToast } = useToast();
    const [turmas, setTurmas] = useState([]);
    const [professoresDisponiveis, setProfessoresDisponiveis] = useState([]);
    const [catalogos, setCatalogos] = useState({ cursos: [], locais: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isTurmaModalOpen, setIsTurmaModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [currentTurma, setCurrentTurma] = useState(null);

    const fetchTurmas = useCallback(async () => {
        setLoadError('');
        try {
            const [classesResponse, catalogsResponse] = await Promise.all([api.get('/cursos'), api.get('/api/catalogos')]);
            setTurmas(classesResponse.data.cursos);
            setProfessoresDisponiveis(classesResponse.data.professores);
            setCatalogos(catalogsResponse.data);
        } catch (error) {
            setLoadError(error.message || 'Erro ao carregar as turmas.');
            showToast(error.message || 'Erro ao carregar as turmas.', 'error');
        } finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchTurmas(); }, [fetchTurmas]);

    const handleOpenTurmaModal = (turma = null) => {
        setCurrentTurma(turma);
        setIsTurmaModalOpen(true);
    };

    const handleCloseTurmaModal = () => {
        setIsTurmaModalOpen(false);
        setCurrentTurma(null);
    };

    const handleOpenConfirmModal = (turma) => {
        setCurrentTurma(turma);
        setIsConfirmModalOpen(true);
    };

    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setCurrentTurma(null);
    };

    const handleSaveTurma = async (turmaData) => {
        try {
            if (currentTurma) {
                await api.put(`/cursos/${currentTurma.id}`, turmaData);
                showToast('Turma atualizada com sucesso!', 'success');
            } else {
                await api.post('/cursos', turmaData);
                showToast('Turma adicionada com sucesso!', 'success');
            }
            handleCloseTurmaModal();
            await fetchTurmas();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar a turma.', 'error');
        }
    };

    const handleDeleteTurma = async () => {
        try {
            await api.delete(`/cursos/${currentTurma.id}`);
            showToast('Turma excluída com sucesso!', 'success');
            handleCloseConfirmModal();
            await fetchTurmas();
        } catch (error) {
            showToast(error.message || 'Erro ao excluir a turma.', 'error');
        }
    };

    const filteredTurmas = useMemo(() => {
        return turmas.filter(turma => {
            const matchesSearch = turma.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLocal = selectedLocal === '' || turma.local === selectedLocal;
            return matchesSearch && matchesLocal;
        });
    }, [turmas, searchTerm, selectedLocal]);
    const totalPages = Math.max(1, Math.ceil(filteredTurmas.length / ITEMS_PER_PAGE));
    const paginatedTurmas = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTurmas.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTurmas, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedLocal]);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const courseOptions = useMemo(() => mergeCatalogNames(
        COURSE_SUGGESTIONS,
        catalogos.cursos.filter(item => item.ativo).map(item => item.nome),
        turmas.map(item => item.nome),
    ), [catalogos.cursos, turmas]);
    const locationOptions = useMemo(() => mergeCatalogNames(
        CHURCH_SUGGESTIONS,
        catalogos.locais.filter(item => item.ativo).map(item => item.nome),
        turmas.map(item => item.local),
    ), [catalogos.locais, turmas]);
    const filterLocations = useMemo(() => mergeCatalogNames(turmas.map(item => item.local)), [turmas]);
    const wallClassId = Number(searchParams.get('turma')) || 0;
    const wallClass = useMemo(() => turmas.find(item => Number(item.id) === wallClassId) || null, [turmas, wallClassId]);
    const openWall = turma => setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.set('turma', String(turma.id));
        return next;
    });
    const closeWall = () => setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('turma');
        return next;
    });

    if (loading) return <PageSkeleton label="Carregando turmas" />;
    if (loadError) return <div className="panel empty-state"><p role="alert">{loadError}</p><button type="button" className="btn btn-secondary mt-3" onClick={fetchTurmas}>Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Turmas</h1><p className="page-description">Cadastre e acompanhe as turmas por curso, igreja ou modalidade e professor.</p></div>
                <button type="button" onClick={() => handleOpenTurmaModal()} className="btn btn-primary w-full sm:w-auto"><Plus aria-hidden="true" />Adicionar turma</button>
            </div>

            <section className="panel mb-3 p-4 sm:mb-6 md:p-6" aria-label="Filtros de turmas">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="course-search" className="form-label">Pesquisar por nome</label>
                        <SearchInput
                            id="course-search"
                            type="text"
                            placeholder="Nome do curso..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="form-control"
                        />
                    </div>
                    <div>
                        <label htmlFor="course-location" className="form-label">Filtrar por igreja ou modalidade</label>
                        <FormSelect
                            id="course-location"
                            value={selectedLocal}
                            onChange={(e) => setSelectedLocal(e.target.value)}
                            options={filterLocations}
                            placeholder="Todas as igrejas e modalidades"
                        />
                    </div>
                </div>
            </section>

            <section className="sm:hidden" aria-label="Turmas cadastradas">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-text-muted" role="status">
                        {searchTerm || selectedLocal
                            ? `${filteredTurmas.length} de ${turmas.length} turmas`
                            : `${filteredTurmas.length} ${filteredTurmas.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}`}
                    </p>
                    {(searchTerm || selectedLocal) && <button type="button" onClick={() => { setSearchTerm(''); setSelectedLocal(''); }} className="btn btn-ghost px-2 text-xs">Limpar filtros</button>}
                </div>
                <div className="space-y-4">
                    {paginatedTurmas.map(turma => <TurmaCard key={turma.id} turma={turma} onViewWall={openWall} onEdit={handleOpenTurmaModal} onDelete={handleOpenConfirmModal} />)}
                    {!filteredTurmas.length && <div className="panel empty-state"><strong className="text-text-default">Nenhuma turma encontrada</strong><span>{searchTerm || selectedLocal ? 'Tente outra busca ou limpe os filtros.' : 'Use “Adicionar” para montar a primeira turma.'}</span></div>}
                </div>
            </section>

            <div className="panel hidden overflow-hidden sm:block">
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
                    <table className="data-table w-full text-sm text-left text-text-default">
                        <thead className="bg-surface-muted text-xs uppercase text-text-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3">Curso</th>
                                <th scope="col" className="px-6 py-3">Igreja / modalidade</th>
                                <th scope="col" className="px-6 py-3">Professor</th>
                                <th scope="col" className="px-6 py-3">Horário</th>
                                <th scope="col" className="px-6 py-3 text-center">Alunos</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTurmas.map(turma => (
                                <tr key={turma.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                    <td data-label="Curso" className="px-6 py-4 font-medium">{turma.nome}</td>
                                    <td data-label="Igreja / modalidade" className="px-6 py-4">{turma.local}</td>
                                    <td data-label="Professor" className="px-6 py-4">{turma.professor}</td>
                                    <td data-label="Horário" className="px-6 py-4 text-xs">
                                        <ClassScheduleList course={turma} />
                                    </td>
                                    <td data-label="Alunos" className="px-6 py-4 text-center">{turma.alunos}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${turma.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {turma.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Ver mural de ${turma.nome}`} onClick={() => openWall(turma)} className="icon-button text-primary hover:bg-primary/10" title="Ver mural">
                                                <MessageSquareText aria-hidden="true" className="w-5 h-5" />
                                            </button>
                                            <button type="button" aria-label={`Editar ${turma.nome}`} onClick={() => handleOpenTurmaModal(turma)} className="icon-button text-primary hover:bg-primary/10" title="Editar">
                                                <Pencil aria-hidden="true" className="w-5 h-5" />
                                            </button>
                                            <button type="button" aria-label={`Excluir turma ${turma.nome}`} onClick={() => handleOpenConfirmModal(turma)} className="icon-button text-danger hover:bg-red-100 dark:hover:bg-red-500/20" title="Excluir turma">
                                                <Trash2 aria-hidden="true" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredTurmas.length && <tr><td colSpan="7" className="px-6 py-10 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhuma turma encontrada</strong><span className="mt-1 block">Limpe os filtros ou use “Adicionar” para montar uma nova turma.</span></td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination currentPage={currentPage} totalItems={filteredTurmas.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} compact className="mt-4 rounded-xl border border-border bg-surface" />

            <Modal isOpen={Boolean(wallClass)} onClose={closeWall} title={wallClass ? `Mural da turma — ${wallClass.nome}` : 'Mural da turma'} maxWidth="max-w-5xl">
                {wallClass && <CourseCommunity course={wallClass} />}
            </Modal>

            <TurmaModal
                isOpen={isTurmaModalOpen}
                onClose={handleCloseTurmaModal}
                onSave={handleSaveTurma}
                turma={currentTurma}
                allProfessores={professoresDisponiveis}
                allLocais={locationOptions}
                allCursos={courseOptions}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleDeleteTurma}
                title="Excluir turma definitivamente?"
                message="Esta ação excluirá a turma, suas matrículas, chamadas e registros de frequência. Os cadastros dos alunos e do professor serão preservados. Esta ação não pode ser desfeita."
                confirmLabel="Excluir turma"
            />
        </>
    );
};

export default Turmas;
