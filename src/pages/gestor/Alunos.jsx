import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// --- Componentes ---
import { Plus, ListFilter, UserPlus, Trash2 } from 'lucide-react';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import AlunoFormModal from '../../components/AlunoFormModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import FormCheckbox from '../../components/FormCheckbox';
import StudentDetailsModal from '../../components/StudentDetailsModal';
import StudentBulkEnrollmentModal from '../../components/StudentBulkEnrollmentModal';
import { PencilIcon, TrashIcon } from '../../components/icons'; // Ícones genéricos
import ProfileAvatar from '../../components/ProfileAvatar';
import MobileStudentList from '../../components/MobileStudentList';
import { STUDENT_CHURCH_SUGGESTIONS, catalogKey } from '../../../shared/catalog-options.mjs';

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
    const [detailsAluno, setDetailsAluno] = useState(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());
    const [isBulkEnrollmentModalOpen, setIsBulkEnrollmentModalOpen] = useState(false);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);

    // Estado de Busca
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ curso: '', church_id: '', classe: '', turma_id: '' });
    const requestSequence = useRef(0);
    const courseOptions = useMemo(() => [...new Set(offerings.map(item => item.nome))].sort((a,b) => a.localeCompare(b)), [offerings]);
    const classOptions = useMemo(() => offerings.filter(item => !filters.curso || item.nome === filters.curso).map(item => ({ value: item.id, label: `${item.nome} — ${item.local}${item.professor ? ` · ${item.professor}` : ''}` })), [offerings, filters.curso]);
    const bulkClassOptions = useMemo(() => offerings.map(item => ({ value: item.id, label: `${item.nome} — ${item.local}${item.professor ? ` · ${item.professor}` : ''}` })), [offerings]);
    const churchOptions = useMemo(() => {
        const registered = new Set(churches.map(item => catalogKey(item.label)));
        const suggestedNames = [...new Map(
            [...STUDENT_CHURCH_SUGGESTIONS, ...offerings.map(item => item.local)]
                .filter(name => name && !['ead', 'remoto'].includes(catalogKey(name)))
                .map(name => [catalogKey(name), name]),
        ).values()];
        return [
            ...churches,
            ...suggestedNames
                .filter(name => !registered.has(catalogKey(name)))
                .map(name => ({ value: name, label: name })),
        ].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
    }, [churches, offerings]);
    const hasFilters = Boolean(searchTerm || Object.values(filters).some(Boolean));
    const visibleStudentIds = alunos.map(aluno => Number(aluno.id));
    const allVisibleSelected = visibleStudentIds.length > 0 && visibleStudentIds.every(id => selectedStudentIds.has(id));
    const someVisibleSelected = visibleStudentIds.some(id => selectedStudentIds.has(id));
    const selectedCount = selectedStudentIds.size;

    const { showToast } = useToast();

    // --- Carregamento de Dados ---
    const fetchAlunos = useCallback(async () => {
        const sequence = ++requestSequence.current;
        setLoading(true);
        try {
            const response = await api.get('/alunos', {
                params: {
                    page: currentPage,
                    limit: itemsPerPage,
                    search: searchTerm,
                    ...filters,
                }
            });
            if (sequence !== requestSequence.current) return;
            setAlunos(response.data.alunos);
            setTotalAlunos(response.data.total);
            setError(null);
        } catch (err) {
            if (sequence !== requestSequence.current) return;
            setError("Não foi possível carregar os alunos.");
            showToast("Erro ao carregar alunos.", 'error');
            console.error(err);
        } finally {
            if (sequence === requestSequence.current) setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm, filters, showToast]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAlunos();
        }, 300);
        return () => { clearTimeout(timer); requestSequence.current += 1; };
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
            await Promise.all([fetchAlunos(), fetchAcademicOptions()]);
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
            setSelectedStudentIds(current => {
                const next = new Set(current);
                next.delete(Number(selectedAluno.id));
                return next;
            });
            await fetchAlunos();
        } catch (error) {
            showToast('Erro ao excluir aluno.', 'error');
            console.error("Erro ao excluir aluno:", error);
        } finally {
            handleCloseModals();
        }
    };

    const toggleStudentSelection = aluno => {
        const id = Number(aluno.id);
        setSelectedStudentIds(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleVisibleStudents = () => {
        setSelectedStudentIds(current => {
            const next = new Set(current);
            if (allVisibleSelected) visibleStudentIds.forEach(id => next.delete(id));
            else visibleStudentIds.forEach(id => next.add(id));
            return next;
        });
    };

    const clearStudentSelection = () => setSelectedStudentIds(new Set());

    const handleBulkEnrollment = async classId => {
        if (!selectedCount) return;
        setBulkSaving(true);
        try {
            const response = await api.post('/api/alunos/bulk/enroll', { student_ids: [...selectedStudentIds], class_id: classId });
            showToast(response.data?.message || 'Alunos adicionados à turma com sucesso!', 'success');
            setIsBulkEnrollmentModalOpen(false);
            clearStudentSelection();
            await Promise.all([fetchAlunos(), fetchAcademicOptions()]);
        } catch (error) {
            showToast(error.response?.data?.message || 'Não foi possível adicionar os alunos à turma.', 'error');
        } finally {
            setBulkSaving(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedCount) return;
        setBulkSaving(true);
        try {
            const response = await api.post('/api/alunos/bulk/anonymize', { student_ids: [...selectedStudentIds] });
            showToast(response.data?.message || 'Alunos excluídos com sucesso!', 'success');
            setIsBulkDeleteModalOpen(false);
            clearStudentSelection();
            await fetchAlunos();
        } catch (error) {
            showToast(error.response?.data?.message || 'Não foi possível excluir os alunos selecionados.', 'error');
        } finally {
            setBulkSaving(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reseta para a primeira página ao buscar
    };
    const changeFilter = (key, value) => {
        setFilters(current => ({ ...current, [key]: value, ...(key === 'curso' ? { turma_id: '' } : {}) }));
        setCurrentPage(1);
    };
    const clearFilters = () => { setSearchTerm(''); setFilters({ curso: '', church_id: '', classe: '', turma_id: '' }); setCurrentPage(1); };

    return (
        <div>
            <div className="page-header"><div><h1 className="page-title">Alunos</h1><p className="page-description">Consulte cadastros e mantenha os dados dos alunos atualizados.</p></div><button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary w-full sm:w-auto"><Plus aria-hidden="true" />Adicionar aluno</button></div>

            {/* Barra de Ações */}
            <section className="panel mb-6 space-y-4 p-4" aria-label="Filtros de alunos">
                <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><ListFilter aria-hidden="true" />Filtros</h2><button type="button" onClick={clearFilters} disabled={!hasFilters} className="btn btn-ghost text-sm disabled:opacity-40">Limpar filtros</button></div>
                <div><label htmlFor="student-search" className="form-label">Buscar aluno</label>
                <SearchInput
                    id="student-search"
                    type="text"
                    placeholder="Nome, e-mail ou telefone..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="form-control"
                />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div><label htmlFor="student-course" className="form-label">Curso</label><FormSelect id="student-course" value={filters.curso} options={courseOptions} onChange={event => changeFilter('curso', event.target.value)} placeholder="Todos os cursos" /></div>
                    <div><label htmlFor="student-class" className="form-label">Turma</label><FormSelect id="student-class" value={filters.turma_id} options={classOptions} onChange={event => changeFilter('turma_id', event.target.value)} placeholder="Todas as turmas" /></div>
                    <div><label htmlFor="student-church" className="form-label">Igreja do aluno</label><FormSelect id="student-church" value={filters.church_id} options={churches} onChange={event => changeFilter('church_id', event.target.value)} placeholder="Todas as igrejas" /></div>
                    <div><label htmlFor="student-group" className="form-label">Classe</label><FormSelect id="student-group" value={filters.classe} options={['Adolescente', 'Jovem', 'Senhora', 'Varão']} onChange={event => changeFilter('classe', event.target.value)} placeholder="Todas as classes" /></div>
                </div>
            </section>

            {selectedCount > 0 && <section className="panel mb-4 flex flex-col gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Ações para alunos selecionados">
                <div>
                    <p className="font-semibold text-text-default" aria-live="polite">{selectedCount} {selectedCount === 1 ? 'aluno selecionado' : 'alunos selecionados'}</p>
                    <button type="button" onClick={clearStudentSelection} disabled={bulkSaving} className="mt-1 text-sm font-medium text-primary hover:underline disabled:opacity-50">Limpar seleção</button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button type="button" onClick={() => setIsBulkEnrollmentModalOpen(true)} disabled={bulkSaving || !bulkClassOptions.length} className="btn btn-secondary"><UserPlus aria-hidden="true" />Adicionar à turma</button>
                    <button type="button" onClick={() => setIsBulkDeleteModalOpen(true)} disabled={bulkSaving} className="btn btn-danger"><Trash2 aria-hidden="true" />Excluir</button>
                </div>
            </section>}

            {/* Tabela de Alunos */}
            <MobileStudentList students={alunos} loading={loading} error={error} onView={setDetailsAluno} onEdit={handleOpenFormModal} onDelete={handleOpenConfirmModal} selectedIds={selectedStudentIds} onToggleSelection={toggleStudentSelection} showAcademicSummary />
            <div className="panel hidden overflow-x-auto sm:block">
                <table className="data-table min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Aluno</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Igreja</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Classe</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-3"><span>Ações</span><FormCheckbox checked={allVisibleSelected} indeterminate={someVisibleSelected && !allVisibleSelected} onChange={toggleVisibleStudents} disabled={loading || !visibleStudentIds.length} aria-label={allVisibleSelected ? 'Desmarcar alunos desta página' : 'Selecionar alunos desta página'} className="items-center" /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            Array.from({ length: 4 }, (_, index) => <tr key={index}><td colSpan="4" className="px-6 py-4"><div className="skeleton h-10 rounded" /></td></tr>)
                        ) : error ? (
                             <tr><td colSpan="4" className="text-center py-4 text-danger">{error}</td></tr>
                        ) : alunos.map((aluno) => (
                            <tr key={aluno.id} className={`hover:bg-border/50 ${selectedStudentIds.has(Number(aluno.id)) ? 'bg-primary/5' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button type="button" onClick={() => setDetailsAluno(aluno)} aria-label={`Ver dados de ${aluno.nome}`} className="flex min-w-0 items-center gap-3 rounded text-left hover:text-primary"><ProfileAvatar name={aluno.nome} src={aluno.foto_url} className="h-10 w-10" /><span className="break-words font-semibold">{aluno.nome}</span></button>
                                </td>
                                <td data-label="Igreja" className="px-6 py-4 text-sm text-text-muted">{aluno.igreja || 'Não informada'}</td>
                                <td data-label="Classe" className="px-6 py-4 text-sm text-text-muted">{aluno.classe || 'Não informada'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end gap-2">
                                        <FormCheckbox checked={selectedStudentIds.has(Number(aluno.id))} onChange={() => toggleStudentSelection(aluno)} aria-label={`${selectedStudentIds.has(Number(aluno.id)) ? 'Remover' : 'Adicionar'} ${aluno.nome} da seleção`} className="items-center p-2" />
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
                churches={churchOptions}
            />
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseModals}
                onConfirm={handleDeleteAluno}
                title="Anonimizar dados do aluno?"
                message={`O cadastro de ${selectedAluno?.nome || 'este aluno'} será removido das turmas e todos os dados pessoais serão apagados de forma irreversível. O histórico acadêmico permanecerá apenas de forma anônima para estatísticas.`}
                confirmLabel="Anonimizar e excluir"
            />
            <StudentBulkEnrollmentModal
                isOpen={isBulkEnrollmentModalOpen}
                onClose={() => !bulkSaving && setIsBulkEnrollmentModalOpen(false)}
                onConfirm={handleBulkEnrollment}
                options={bulkClassOptions}
                selectedCount={selectedCount}
                loading={bulkSaving}
            />
            <ConfirmationModal
                isOpen={isBulkDeleteModalOpen}
                onClose={() => !bulkSaving && setIsBulkDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title={`Anonimizar ${selectedCount} ${selectedCount === 1 ? 'aluno' : 'alunos'}?`}
                message="Os alunos selecionados serão removidos de todas as turmas e seus dados pessoais serão apagados de forma irreversível. O histórico acadêmico permanecerá somente de forma anônima para estatísticas."
                confirmLabel="Anonimizar e excluir selecionados"
                loading={bulkSaving}
            />
            <StudentDetailsModal isOpen={Boolean(detailsAluno)} onClose={() => setDetailsAluno(null)} student={detailsAluno} />
        </div>
    );
};

export default Alunos;
