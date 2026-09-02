import PageSkeleton from '../../components/PageSkeleton';
import { Pencil, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CirclePause } from 'lucide-react';
import SectionAddHeader from '../../components/SectionAddHeader';
import TurmaCard from '../../components/TurmaCard';
import ClassScheduleList from '../../components/ClassScheduleList';
import SearchInput from '../../components/SearchInput';
import CursoModal from '../../components/CursoModal';
import CatalogItemModal from '../../components/CatalogItemModal';
import MobileCatalogList from '../../components/MobileCatalogList';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const Cursos = () => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const { showToast } = useToast();
    const [cursos, setCursos] = useState([]);
    const [professoresDisponiveis, setProfessoresDisponiveis] = useState([]);
    const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);
    const [catalogos, setCatalogos] = useState({ cursos: [], locais: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [isCursoModalOpen, setIsCursoModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [currentCurso, setCurrentCurso] = useState(null);
    const [catalogModal, setCatalogModal] = useState({ open: false, type: 'cursos', item: null });
    const [catalogToDelete, setCatalogToDelete] = useState(null);
    const [isDeletingCatalog, setDeletingCatalog] = useState(false);

    const fetchCursos = useCallback(async () => {
        setLoadError('');
        try {
            const [classesResponse, catalogsResponse] = await Promise.all([api.get('/cursos'), api.get('/api/catalogos')]);
            setCursos(classesResponse.data.cursos);
            setProfessoresDisponiveis(classesResponse.data.professores);
            setCatalogos(catalogsResponse.data);
            setLocaisDisponiveis(catalogsResponse.data.locais.filter(item => item.ativo).map(item => item.nome));
        } catch (error) {
            setLoadError(error.message || 'Erro ao carregar os cursos.');
            showToast(error.message || 'Erro ao carregar os cursos.', 'error');
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

    const handleSaveCatalog = async data => {
        const { type, item } = catalogModal;
        try {
            if (item) await api.put(`/api/catalogos/${type}/${item.id}`, data);
            else await api.post(`/api/catalogos/${type}`, data);
            showToast(type === 'cursos' ? 'Curso salvo com sucesso!' : 'Igreja salva com sucesso!', 'success');
            setCatalogModal({ open: false, type: 'cursos', item: null });
            await fetchCursos();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o cadastro.', 'error');
            throw error;
        }
    };

    const handleDeleteCatalog = async () => {
        if (!catalogToDelete) return;
        setDeletingCatalog(true);
        try {
            const response = await api.delete(`/api/catalogos/${catalogToDelete.type}/${catalogToDelete.item.id}`);
            showToast(response.data.message || `${catalogToDelete.type === 'cursos' ? 'Curso' : 'Igreja'} excluído definitivamente!`, 'success');
            setCatalogToDelete(null);
            await fetchCursos();
        } catch (error) {
            showToast(error.message || 'Não foi possível excluir o cadastro.', 'error');
        } finally {
            setDeletingCatalog(false);
        }
    };

    const filteredCursos = useMemo(() => {
        return cursos.filter(curso => {
            const matchesSearch = curso.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLocal = selectedLocal === '' || curso.local === selectedLocal;
            return matchesSearch && matchesLocal;
        });
    }, [cursos, searchTerm, selectedLocal]);

    if (loading) return <PageSkeleton label="Carregando cursos" />;
    if (loadError) return <div className="panel empty-state"><p role="alert">{loadError}</p><button type="button" className="btn btn-secondary mt-3" onClick={fetchCursos}>Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Cursos e igrejas</h1><p className="page-description">Gerencie os catálogos e monte as turmas usando apenas opções aprovadas.</p></div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                {['cursos', 'locais'].map(type => (
                    <section key={type} className="panel overflow-hidden" aria-labelledby={`${type}-catalog-title`}>
                        <SectionAddHeader
                            title={type === 'cursos' ? 'Catálogo de cursos' : 'Igrejas'}
                            titleId={`${type}-catalog-title`}
                            description={type === 'cursos' ? 'Opções disponíveis para professores e turmas.' : 'Igrejas que podem receber professores e turmas.'}
                            addLabel={type === 'cursos' ? 'Adicionar curso' : 'Adicionar igreja'}
                            onAdd={() => setCatalogModal({ open: true, type, item: null })}
                            className="border-b border-border px-5 py-4 xl:min-h-[104px]"
                        />
                        <MobileCatalogList type={type} items={catalogos[type]} onEdit={item => setCatalogModal({ open: true, type, item })} onDelete={item => setCatalogToDelete({ type, item })} />
                        <div className="hidden max-h-80 overflow-auto sm:block">
                            <table className="data-table w-full text-left text-sm">
                                <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3 text-center">Vínculos</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
                                <tbody>{catalogos[type].map(item => <tr key={item.id} className="border-t border-border">
                                    <td className="px-5 py-3 font-medium">{item.nome}</td>
                                    <td className="px-5 py-3 text-center">{item.turmas}{type === 'locais' ? ` turma(s) · ${item.professores} professor(es)` : ' turma(s)'}</td>
                                    <td className="px-5 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.ativo ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted dark:bg-white/10'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                    <td className="px-5 py-3 text-right"><button type="button" onClick={() => setCatalogModal({ open: true, type, item })} className="icon-button text-primary" aria-label={`Editar ${item.nome}`}><Pencil aria-hidden="true" /></button><button type="button" onClick={() => setCatalogToDelete({ type, item })} className="icon-button text-danger" aria-label={`Excluir definitivamente ${item.nome}`}><Trash2 aria-hidden="true" /></button></td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                        {!catalogos[type].length && <div className="p-8 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhum cadastro encontrado</strong><span className="mt-1 block">Use “Adicionar” para criar a primeira opção deste catálogo.</span></div>}
                    </section>
                ))}
            </div>

            <SectionAddHeader
                title="Turmas"
                description="Combine um curso, uma igreja e um professor."
                addLabel="Adicionar turma"
                onAdd={() => handleOpenCursoModal()}
                className="mb-3"
            />

            <section className="panel mb-3 p-4 sm:mb-6 md:p-6" aria-label="Filtros de cursos">
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
                        <label htmlFor="course-location" className="form-label">Filtrar por igreja</label>
                        <FormSelect
                            id="course-location"
                            value={selectedLocal}
                            onChange={(e) => setSelectedLocal(e.target.value)}
                            options={locaisDisponiveis}
                            placeholder="Todas as Igrejas"
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
                                <th scope="col" className="px-6 py-3">Igreja</th>
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
                                    <td data-label="Igreja" className="px-6 py-4">{curso.local}</td>
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
                allLocais={locaisDisponiveis}
                allCursos={catalogos.cursos.filter(item => item.ativo).map(item => item.nome)}
            />

            <CatalogItemModal isOpen={catalogModal.open} onClose={() => setCatalogModal({ open: false, type: 'cursos', item: null })} onSave={handleSaveCatalog} item={catalogModal.item} type={catalogModal.type} existingItems={catalogos[catalogModal.type]} />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleDeleteCurso}
                title="Desativar turma?"
                message="A turma deixará de aparecer como ativa. Você poderá manter o histórico já registrado."
                confirmLabel="Desativar"
            />
            <ConfirmationModal
                isOpen={Boolean(catalogToDelete)}
                onClose={() => setCatalogToDelete(null)}
                onConfirm={handleDeleteCatalog}
                title={`Excluir definitivamente ${catalogToDelete?.type === 'cursos' ? 'curso' : 'igreja'}?`}
                message={catalogToDelete ? `Esta ação é irreversível. “${catalogToDelete.item.nome}”, ${catalogToDelete.item.turmas} turma(s) e ${catalogToDelete.item.matriculas} matrícula(s) vinculadas serão apagadas. Os alunos e professores permanecerão cadastrados.` : ''}
                confirmLabel="Excluir definitivamente"
                loading={isDeletingCatalog}
            />
        </>
    );
};

export default Cursos;
