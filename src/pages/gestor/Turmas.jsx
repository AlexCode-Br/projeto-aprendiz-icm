import { Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageSkeleton from '../../components/PageSkeleton';
import TurmaCard from '../../components/TurmaCard';
import ClassScheduleList from '../../components/ClassScheduleList';
import SearchInput from '../../components/SearchInput';
import ConfirmationModal from '../../components/ConfirmationModal';
import FormSelect from '../../components/FormSelect';
import Pagination from '../../components/Pagination';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const ITEMS_PER_PAGE = 5;

export default function Turmas() {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [turmas, setTurmas] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocal, setSelectedLocal] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [currentTurma, setCurrentTurma] = useState(null);
    const { showToast } = useToast();

    const fetchTurmas = useCallback(async () => {
        setLoadError('');
        try {
            const { data } = await api.get('/cursos');
            setTurmas(data.cursos || []);
        } catch (error) {
            setLoadError(error.message || 'Erro ao carregar as turmas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchTurmas(); }, [fetchTurmas]);

    const filteredTurmas = useMemo(() => turmas.filter(turma => (
        turma.nome.toLowerCase().includes(searchTerm.toLowerCase())
        && (!selectedLocal || turma.local === selectedLocal)
    )), [turmas, searchTerm, selectedLocal]);
    const filterLocations = useMemo(() => [...new Set(turmas.map(item => item.local).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'pt-BR')), [turmas]);
    const totalPages = Math.max(1, Math.ceil(filteredTurmas.length / ITEMS_PER_PAGE));
    const paginatedTurmas = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTurmas.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTurmas, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedLocal]);
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

    const deleteTurma = async () => {
        try {
            await api.delete(`/cursos/${currentTurma.id}`);
            showToast('Turma excluída com sucesso!', 'success');
            setCurrentTurma(null);
            await fetchTurmas();
        } catch (error) {
            showToast(error.message || 'Erro ao excluir a turma.', 'error');
        }
    };

    if (loading) return <PageSkeleton label="Carregando turmas" />;
    if (loadError) return <div className="panel empty-state"><p role="alert">{loadError}</p><button type="button" className="btn btn-secondary mt-3" onClick={fetchTurmas}>Tentar novamente</button></div>;

    return <>
        <div className="page-header">
            <div><h1 className="page-title">Turmas</h1><p className="page-description">Acompanhe as turmas criadas pelos professores. A gestão pode consultar os dados e excluir uma oferta quando necessário.</p></div>
        </div>

        <section className="panel mb-3 p-4 sm:mb-6 md:p-6" aria-label="Filtros de turmas">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><label htmlFor="course-search" className="form-label">Pesquisar por nome</label><SearchInput id="course-search" placeholder="Nome do curso..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="form-control" /></div>
                <div><label htmlFor="course-location" className="form-label">Filtrar por igreja ou modalidade</label><FormSelect id="course-location" value={selectedLocal} onChange={event => setSelectedLocal(event.target.value)} options={filterLocations} placeholder="Todas as igrejas e modalidades" /></div>
            </div>
        </section>

        <section className="xl:hidden" aria-label="Turmas cadastradas">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-text-muted" role="status">{searchTerm || selectedLocal ? `${filteredTurmas.length} de ${turmas.length} turmas` : `${filteredTurmas.length} ${filteredTurmas.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}`}</p>
                {(searchTerm || selectedLocal) && <button type="button" onClick={() => { setSearchTerm(''); setSelectedLocal(''); }} className="btn btn-ghost px-2 text-xs">Limpar filtros</button>}
            </div>
            <div className="space-y-4">
                {paginatedTurmas.map(turma => <TurmaCard key={turma.id} turma={turma} onDelete={setCurrentTurma} />)}
                {!filteredTurmas.length && <div className="panel empty-state"><strong className="text-text-default">Nenhuma turma encontrada</strong><span>{searchTerm || selectedLocal ? 'Tente outra busca ou limpe os filtros.' : 'As turmas aparecerão quando os professores configurarem suas ofertas.'}</span></div>}
            </div>
        </section>

        <div className="panel hidden overflow-hidden xl:block">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
                <table className="data-table w-full text-left text-sm text-text-default">
                    <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr><th className="px-6 py-3" scope="col">Curso</th><th className="px-6 py-3" scope="col">Igreja / modalidade</th><th className="px-6 py-3" scope="col">Professor</th><th className="px-6 py-3" scope="col">Horário</th><th className="px-6 py-3 text-center" scope="col">Alunos</th><th className="px-6 py-3 text-center" scope="col">Status</th><th className="px-6 py-3 text-center" scope="col">Ações</th></tr></thead>
                    <tbody>
                        {paginatedTurmas.map(turma => <tr key={turma.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                            <td className="px-6 py-4 font-medium">{turma.nome}</td><td className="px-6 py-4">{turma.local}</td><td className="px-6 py-4">{turma.professor}</td>
                            <td className="px-6 py-4 text-xs"><ClassScheduleList course={turma} compact maxVisible={2} /></td><td className="px-6 py-4 text-center">{turma.alunos}</td>
                            <td className="px-6 py-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${turma.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{turma.status}</span></td>
                            <td className="px-6 py-4 text-center"><button type="button" aria-label={`Excluir turma ${turma.nome}`} onClick={() => setCurrentTurma(turma)} className="icon-button text-danger hover:bg-red-100" title="Excluir turma"><Trash2 aria-hidden="true" className="h-5 w-5" /></button></td>
                        </tr>)}
                        {!filteredTurmas.length && <tr><td colSpan="7" className="px-6 py-10 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhuma turma encontrada</strong><span className="mt-1 block">{searchTerm || selectedLocal ? 'Limpe os filtros para ver outras turmas.' : 'As turmas serão criadas pelos professores após o primeiro acesso.'}</span></td></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        <Pagination currentPage={currentPage} totalItems={filteredTurmas.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} compact className="mt-4 rounded-xl border border-border bg-surface" />
        <ConfirmationModal isOpen={Boolean(currentTurma)} onClose={() => setCurrentTurma(null)} onConfirm={deleteTurma} title="Excluir turma definitivamente?" message="Esta ação excluirá a turma, suas matrículas, chamadas e registros de frequência. Os cadastros dos alunos e do professor serão preservados. Esta ação não pode ser desfeita." confirmLabel="Excluir turma" />
    </>;
}
