import React, { useState, useMemo, useEffect, useCallback } from 'react';
import CursoModal from '../../components/CursoModal';
import CatalogItemModal from '../../components/CatalogItemModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const Cursos = () => {
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
        try {
            const [classesResponse, catalogsResponse] = await Promise.all([api.get('/cursos'), api.get('/api/catalogos')]);
            setCursos(classesResponse.data.cursos);
            setProfessoresDisponiveis(classesResponse.data.professores);
            setCatalogos(catalogsResponse.data);
            setLocaisDisponiveis(catalogsResponse.data.locais.filter(item => item.ativo).map(item => item.nome));
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

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Cursos e igrejas</h1><p className="page-description">Gerencie os catálogos e monte as turmas usando apenas opções aprovadas.</p></div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                {['cursos', 'locais'].map(type => (
                    <section key={type} className="panel overflow-hidden" aria-labelledby={`${type}-catalog-title`}>
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div><h2 id={`${type}-catalog-title`} className="font-semibold">{type === 'cursos' ? 'Catálogo de cursos' : 'Igrejas'}</h2><p className="text-sm text-text-muted">{type === 'cursos' ? 'Opções disponíveis para professores e turmas.' : 'Igrejas que podem receber professores e turmas.'}</p></div>
                            <button type="button" onClick={() => setCatalogModal({ open: true, type, item: null })} className="btn btn-secondary">Adicionar</button>
                        </div>
                        <div className="max-h-80 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3 text-center">Vínculos</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
                                <tbody>{catalogos[type].map(item => <tr key={item.id} className="border-t border-border">
                                    <td className="px-5 py-3 font-medium">{item.nome}</td>
                                    <td className="px-5 py-3 text-center">{item.turmas}{type === 'locais' ? ` turma(s) · ${item.professores} professor(es)` : ' turma(s)'}</td>
                                    <td className="px-5 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.ativo ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted dark:bg-white/10'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                    <td className="px-5 py-3 text-right"><button type="button" onClick={() => setCatalogModal({ open: true, type, item })} className="icon-button text-primary" aria-label={`Editar ${item.nome}`}>✎</button><button type="button" onClick={() => setCatalogToDelete({ type, item })} className="icon-button text-danger" aria-label={`Excluir definitivamente ${item.nome}`}>×</button></td>
                                </tr>)}</tbody>
                            </table>
                            {!catalogos[type].length && <div className="p-8 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhum cadastro encontrado</strong><span className="mt-1 block">Use “Adicionar” para criar a primeira opção deste catálogo.</span></div>}
                        </div>
                    </section>
                ))}
            </div>

            <div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Turmas</h2><p className="text-sm text-text-muted">Combine um curso, uma igreja e um professor.</p></div><button type="button" onClick={() => handleOpenCursoModal()} className="btn btn-primary">Adicionar</button></div>

            <section className="panel mb-6 p-4 md:p-6" aria-label="Filtros de cursos">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="course-search" className="form-label">Pesquisar por nome</label>
                        <input
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

            <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-text-default">
                        <thead className="bg-surface-muted text-xs uppercase text-text-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3">Curso</th>
                                <th scope="col" className="px-6 py-3">Igreja</th>
                                <th scope="col" className="px-6 py-3">Professor</th>
                                <th scope="col" className="px-6 py-3">Horário</th>
                                <th scope="col" className="px-6 py-3 text-center">Ocupação</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCursos.map(curso => (
                                <tr key={curso.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                    <td className="px-6 py-4 font-medium">{curso.nome}{curso.label && curso.label !== `${curso.nome} — ${curso.local}` && <span className="mt-1 block text-xs font-normal text-text-muted">{curso.label}</span>}</td>
                                    <td className="px-6 py-4">{curso.local}</td>
                                    <td className="px-6 py-4">{curso.professor}</td>
                                    <td className="px-6 py-4 text-xs">
                                        {curso.weekday ? `${curso.weekday} às ${curso.start_time || '--:--'}` : 'A definir'}
                                    </td>
                                    <td className="px-6 py-4 text-center">{curso.capacity ? `${curso.alunos} / ${curso.capacity}` : `${curso.alunos} / sem limite`}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${curso.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {curso.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button type="button" aria-label={`Editar ${curso.nome}`} onClick={() => handleOpenCursoModal(curso)} className="icon-button text-primary hover:bg-primary/10" title="Editar">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            <button type="button" aria-label={`Excluir ${curso.nome}`} onClick={() => handleOpenConfirmModal(curso)} className="icon-button text-danger hover:bg-red-100 dark:hover:bg-red-500/20" title="Excluir">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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

            <CatalogItemModal isOpen={catalogModal.open} onClose={() => setCatalogModal({ open: false, type: 'cursos', item: null })} onSave={handleSaveCatalog} item={catalogModal.item} type={catalogModal.type} />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleDeleteCurso}
                title="Desativar curso?"
                message="O curso deixará de aparecer como ativo. Você poderá manter o histórico já registrado."
                confirmLabel="Desativar"
            />
            <ConfirmationModal
                isOpen={Boolean(catalogToDelete)}
                onClose={() => setCatalogToDelete(null)}
                onConfirm={handleDeleteCatalog}
                title={`Excluir definitivamente ${catalogToDelete?.type === 'cursos' ? 'curso' : 'igreja'}?`}
                message={catalogToDelete ? `Esta ação é irreversível. “${catalogToDelete.item.nome}”, ${catalogToDelete.item.turmas} turma(s), ${catalogToDelete.item.matriculas} matrícula(s) e ${catalogToDelete.item.frequencias} frequência(s) vinculadas serão apagadas. Os alunos e professores permanecerão cadastrados.` : ''}
                confirmLabel="Excluir definitivamente"
                loading={isDeletingCatalog}
            />
        </>
    );
};

export default Cursos;
