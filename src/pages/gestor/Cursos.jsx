import PageSkeleton from '../../components/PageSkeleton';
import { CirclePause, Pencil, Plus } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import TurmaCard from '../../components/TurmaCard';
import ClassScheduleList from '../../components/ClassScheduleList';
import SearchInput from '../../components/SearchInput';
import CursoModal from '../../components/CursoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { CHURCH_SUGGESTIONS, COURSE_SUGGESTIONS, catalogKey } from '../../../shared/catalog-options.mjs';

const mergeCatalogNames = (...groups) => [...new Map(groups.flat().filter(Boolean).map(name => [catalogKey(name), name])).values()]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));

const Cursos = () => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const { showToast } = useToast();
    const [cursos, setCursos] = useState([]);
    const [professoresDisponiveis, setProfessoresDisponiveis] = useState([]);
    const [catalogos, setCatalogos] = useState({ cursos: [], locais: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [isCursoModalOpen, setIsCursoModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [currentCurso, setCurrentCurso] = useState(null);

    const fetchCursos = useCallback(async () => {
        setLoadError('');
        try {
            const [classesResponse, catalogsResponse] = await Promise.all([api.get('/cursos'), api.get('/api/catalogos')]);
            setCursos(classesResponse.data.cursos);
            setProfessoresDisponiveis(classesResponse.data.professores);
            setCatalogos(catalogsResponse.data);
        } catch (error) {
            setLoadError(error.message || 'Erro ao carregar as turmas.');
            showToast(error.message || 'Erro ao carregar as turmas.', 'error');
        } finally { setLoading(false); }
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
                showToast('Turma atualizada com sucesso!', 'success');
            } else {
                await api.post('/cursos', cursoData);
                showToast('Turma adicionada com sucesso!', 'success');
            }
            handleCloseCursoModal();
            await fetchCursos();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar a turma.', 'error');
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

    const courseOptions = useMemo(() => mergeCatalogNames(
        COURSE_SUGGESTIONS,
        catalogos.cursos.filter(item => item.ativo).map(item => item.nome),
        cursos.map(item => item.nome),
    ), [catalogos.cursos, cursos]);
    const locationOptions = useMemo(() => mergeCatalogNames(
        CHURCH_SUGGESTIONS,
        catalogos.locais.filter(item => item.ativo).map(item => item.nome),
        cursos.map(item => item.local),
    ), [catalogos.locais, cursos]);
    const filterLocations = useMemo(() => mergeCatalogNames(cursos.map(item => item.local)), [cursos]);

    if (loading) return <PageSkeleton label="Carregando turmas" />;
    if (loadError) return <div className="panel empty-state"><p role="alert">{loadError}</p><button type="button" className="btn btn-secondary mt-3" onClick={fetchCursos}>Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Turmas</h1><p className="page-description">Cadastre e acompanhe as turmas por curso, igreja ou modalidade e professor.</p></div>
                <button type="button" onClick={() => handleOpenCursoModal()} className="btn btn-primary w-full sm:w-auto"><Plus aria-hidden="true" />Adicionar turma</button>
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
                            ? `${filteredCursos.length} de ${cursos.length} turmas`
                            : `${filteredCursos.length} ${filteredCursos.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}`}
                    </p>
                    {(searchTerm || selectedLocal) && <button type="button" onClick={() => { setSearchTerm(''); setSelectedLocal(''); }} className="btn btn-ghost px-2 text-xs">Limpar filtros</button>}
                </div>
                <div className="space-y-4">
                    {filteredCursos.map(curso => <TurmaCard key={curso.id} curso={curso} onEdit={handleOpenCursoModal} onDeactivate={handleOpenConfirmModal} />)}
                    {!filteredCursos.length && <div className="panel empty-state"><strong className="text-text-default">Nenhuma turma encontrada</strong><span>{searchTerm || selectedLocal ? 'Tente outra busca ou limpe os filtros.' : 'Use “Adicionar” para montar a primeira turma.'}</span></div>}
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
                            {filteredCursos.map(curso => (
                                <tr key={curso.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                    <td data-label="Curso" className="px-6 py-4 font-medium">{curso.nome}</td>
                                    <td data-label="Igreja / modalidade" className="px-6 py-4">{curso.local}</td>
                                    <td data-label="Professor" className="px-6 py-4">{curso.professor}</td>
                                    <td data-label="Horário" className="px-6 py-4 text-xs">
                                        <ClassScheduleList course={curso} />
                                    </td>
                                    <td data-label="Alunos" className="px-6 py-4 text-center">{curso.alunos}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${curso.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {curso.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Editar ${curso.nome}`} onClick={() => handleOpenCursoModal(curso)} className="icon-button text-primary hover:bg-primary/10" title="Editar">
                                                <Pencil aria-hidden="true" className="w-5 h-5" />
                                            </button>
                                            <button type="button" aria-label={`Desativar turma ${curso.nome}`} onClick={() => handleOpenConfirmModal(curso)} className="icon-button text-danger hover:bg-red-100 dark:hover:bg-red-500/20" title="Desativar turma">
                                                <CirclePause aria-hidden="true" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredCursos.length && <tr><td colSpan="7" className="px-6 py-10 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhuma turma encontrada</strong><span className="mt-1 block">Limpe os filtros ou use “Adicionar” para montar uma nova turma.</span></td></tr>}
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
                allLocais={locationOptions}
                allCursos={courseOptions}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleDeleteCurso}
                title="Desativar turma?"
                message="A turma deixará de aparecer como ativa. Você poderá manter o histórico já registrado."
                confirmLabel="Desativar"
            />
        </>
    );
};

export default Cursos;
