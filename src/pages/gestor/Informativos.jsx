import FormSelect from '../../components/FormSelect';
import SearchInput from '../../components/SearchInput';
import { Eye, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InformativoModal from '../../components/InformativoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

import InformativoReadersModal from '../../components/InformativoReadersModal';
import AnnouncementAttachments from '../../components/AnnouncementAttachments';
import AnnouncementAudienceModal from '../../components/AnnouncementAudienceModal';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import KebabMenu, { KebabMenuItem } from '../../components/KebabMenu';

const Informativos = () => {
    const { showToast } = useToast();
    const [informativos, setInformativos] = useState([]);
    const [professores, setProfessores] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [isSendConfirmModalOpen, setSendConfirmModalOpen] = useState(false);
    const [audienceOptions, setAudienceOptions] = useState({ professores: [], cursos: [] });
    const [audienceLoading, setAudienceLoading] = useState(false);
    const [isReadersModalOpen, setReadersModalOpen] = useState(false);
    const [currentInformativo, setCurrentInformativo] = useState(null);
    const [formDataToSave, setFormDataToSave] = useState(null);
    const [hasProfessors, setHasProfessors] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');

    const fetchInformativos = useCallback(async ({ silent = false, refreshProfessors = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const [infoResponse, profResponse] = await Promise.all([
                api.get('/api/informativos'),
                refreshProfessors ? api.get('/professores') : Promise.resolve(null)
            ]);
            setInformativos(Array.isArray(infoResponse.data) ? infoResponse.data : []);
            const professores = Array.isArray(profResponse?.data?.professores)
                ? profResponse.data.professores
                : [];
            if (profResponse) {
                setProfessores(professores);
                setHasProfessors(professores.some(professor => professor.status === 'Ativo'));
            }
        } catch (error) {
            if (silent) throw error;
            showToast(error.message || 'Erro ao carregar dados.', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { void fetchInformativos({ refreshProfessors: true }); }, [fetchInformativos]);

    const refreshLive = useCallback(() => fetchInformativos({ silent: true }), [fetchInformativos]);
    useLiveRefresh(refreshLive, { intervalMs: 15000, eventName: 'announcements:updated' });

    useEffect(() => {
        const nextPublication = informativos
            .filter(info => info.status === 'Agendado')
            .map(info => new Date(info.data_publicacao).getTime())
            .filter(timestamp => Number.isFinite(timestamp) && timestamp > Date.now())
            .sort((first, second) => first - second)[0];
        if (!nextPublication) return undefined;
        const timeout = window.setTimeout(() => void refreshLive(), Math.min(Math.max(nextPublication - Date.now() + 750, 250), 2147483000));
        return () => window.clearTimeout(timeout);
    }, [informativos, refreshLive]);

    const handleOpenFormModal = (info = null) => {
        if (!info && !hasProfessors) {
            showToast('Cadastre ao menos um professor antes de criar informativos.', 'warning');
            return;
        }
        setFormDataToSave(null);
        setCurrentInformativo(info);
        setFormModalOpen(true);
    };

    const handleOpenReadersModal = (info) => {
        setCurrentInformativo(info);
        setReadersModalOpen(true);
    };

    const handleOpenDeleteConfirm = (info) => {
        setCurrentInformativo(info);
        setDeleteConfirmModalOpen(true);
    };

    const handleSaveAndOpenConfirm = (formData) => {
        setFormDataToSave({
            ...formData,
            destinatarios: formData.destinatarios || currentInformativo?.destinatarios || { todos: true, professores: [], cursos: [] },
        });
        setFormModalOpen(false); // Fecha o form
        setSendConfirmModalOpen(true); // Abre a confirmação de envio
        setAudienceLoading(true);
        api.get('/api/informativos/destinatarios')
            .then(response => setAudienceOptions({ professores: response.data?.professores || [], cursos: response.data?.cursos || [] }))
            .catch(error => showToast(error.message || 'Não foi possível carregar os destinatários.', 'error'))
            .finally(() => setAudienceLoading(false));
    };

    const handleCloseAudience = () => {
        setSendConfirmModalOpen(false);
        if (formDataToSave) setFormModalOpen(true);
    };

    const handleConfirmSend = async (destinatarios) => {
        try {
            const payload = { ...formDataToSave, destinatarios };
            if (currentInformativo) {
                await api.put(`/api/informativos/${currentInformativo.id}`, payload);
                showToast('Informativo atualizado com sucesso!', 'success');
            } else {
                await api.post('/api/informativos', payload);
                showToast('Informativo criado e publicado com sucesso!', 'success');
            }
            setSendConfirmModalOpen(false);
            setCurrentInformativo(null);
            setFormDataToSave(null);
            await fetchInformativos({ silent: true });
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o informativo.', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/api/informativos/${currentInformativo.id}`);
            showToast('Informativo removido com sucesso!', 'success');
            setDeleteConfirmModalOpen(false);
            setCurrentInformativo(null);
            await fetchInformativos({ silent: true });
        } catch (error) {
            showToast(error.message || 'Erro ao remover o informativo.', 'error');
        }
    };

    const getCategoryClass = (cat) => ({
        'Geral': 'bg-blue-100 text-blue-800',
        'Inscrições': 'bg-green-100 text-green-800',
        'Eventos': 'bg-purple-100 text-purple-800',
        'Urgente': 'bg-red-100 text-red-800',
    }[cat] || 'bg-gray-100 text-gray-800');

    const visibleInformativos = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('pt-BR');
        return informativos.filter(info => {
            if (statusFilter !== 'Todos' && info.status !== statusFilter) return false;
            const searchable = `${info.titulo} ${String(info.conteudo || '').replace(/<[^>]+>/g, ' ')} ${info.anexos?.map(item => item.nome).join(' ') || ''}`.toLocaleLowerCase('pt-BR');
            return !term || searchable.includes(term);
        });
    }, [informativos, search, statusFilter]);

    return (
        <>
            <div className="page-header">
                <div><h1 className="page-title">Informativos</h1><p className="page-description">Publique comunicados e acompanhe quem visualizou.</p></div>
                <button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary w-full sm:w-auto">
                    <Plus aria-hidden="true" />Criar informativo
                </button>
            </div>

            <div className="panel mb-6 grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                <label className="sr-only" htmlFor="manager-announcement-search">Pesquisar informativos</label>
                <SearchInput id="manager-announcement-search" value={search} onChange={event => setSearch(event.target.value)} className="form-control" placeholder="Pesquisar por título, conteúdo ou anexo..." />
                <label className="sr-only" htmlFor="manager-announcement-status">Filtrar por estado</label>
                <FormSelect id="manager-announcement-status" value={statusFilter} isClearable={false} isSearchable={false} onChange={event => setStatusFilter(event.target.value)} options={[{ value: 'Todos', label: 'Todos os informativos' }, { value: 'Publicado', label: 'Publicados' }, { value: 'Agendado', label: 'Agendados' }]} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {visibleInformativos.map(info => (
                    <article key={info.id} className="panel flex flex-col overflow-hidden">
                        <div className="p-5 flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${getCategoryClass(info.categoria)}`}>{info.categoria}</span>
                                <div className="flex items-center gap-1"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${info.status === 'Agendado' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200' : 'bg-success/10 text-success'}`}>{info.status}</span>{info.fixado && <span title="Fixado no topo"><Pin aria-hidden="true" className="text-primary !h-4 !w-4" /></span>}
                                    <div className="md:hidden"><KebabMenu label={`Ações do informativo ${info.titulo}`}>
                                        <KebabMenuItem icon={Pencil} tone="primary" onClick={() => handleOpenFormModal(info)}>Editar informativo</KebabMenuItem>
                                        <KebabMenuItem icon={Trash2} tone="danger" onClick={() => handleOpenDeleteConfirm(info)}>Excluir informativo</KebabMenuItem>
                                    </KebabMenu></div>
                                </div>
                            </div>
                            <h3 className="break-words font-bold text-lg text-text-default">{info.titulo}</h3>
                            <p className="text-sm text-text-muted mt-1">{info.data} às {info.hora}</p>
                            <div className="announcement-content mt-4 max-w-none text-sm text-text-default" dangerouslySetInnerHTML={{ __html: info.conteudo }} />
                            <AnnouncementAttachments attachments={info.anexos} />
                        </div>
                        <div className="px-4 py-3 border-t border-border flex flex-wrap gap-2 justify-between items-center text-xs text-text-muted">
                            <button type="button" onClick={() => handleOpenReadersModal(info)} className="flex items-center space-x-4 hover:opacity-75 transition-opacity" title="Ver quem visualizou">
                                <span className="inline-flex items-center gap-1.5"><Eye aria-hidden="true" className="!h-4 !w-4" />{info.lido} visualizações</span>
                            </button>
                            <div className="hidden items-center space-x-2 md:flex">
                                <button type="button" onClick={() => handleOpenFormModal(info)} className="min-h-10 rounded-md px-2 text-primary hover:bg-primary/10">Editar</button>
                                <button type="button" onClick={() => handleOpenDeleteConfirm(info)} className="min-h-10 rounded-md px-2 text-danger hover:bg-red-50 hover:underline dark:hover:bg-red-950/30">Excluir</button>
                            </div>
                        </div>
                    </article>
                ))}
                {loading && Array.from({length:3},(_,index)=><div key={index} className="panel p-5" role="status" aria-label="Carregando informativo"><div className="skeleton h-5 w-24"/><div className="skeleton mt-4 h-7 w-3/4"/><div className="skeleton mt-4 h-20 rounded-lg"/></div>)}
                {!loading && !visibleInformativos.length && <div className="panel col-span-full px-6 py-14 text-center text-text-muted">{informativos.length ? <><strong className="block text-text-default">Nenhum informativo encontrado</strong><span className="mt-1 block text-sm">Limpe a busca ou altere os filtros para ver outros avisos.</span></> : <><strong className="block text-text-default">Nenhum informativo criado ainda</strong><span className="mt-1 block text-sm">Crie o primeiro aviso para manter os professores informados.</span><button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary mt-4">Criar informativo</button></>}</div>}
            </div>

            <InformativoModal
                isOpen={isFormModalOpen}
                onClose={() => { setFormModalOpen(false); setFormDataToSave(null); }}
                onSave={handleSaveAndOpenConfirm}
                informativo={currentInformativo}
                draft={formDataToSave}
            />

            <AnnouncementAudienceModal
                isOpen={isSendConfirmModalOpen}
                onClose={handleCloseAudience}
                onConfirm={handleConfirmSend}
                options={audienceOptions}
                loading={audienceLoading}
                initialAudience={formDataToSave?.destinatarios}
            />

            <InformativoReadersModal
                isOpen={isReadersModalOpen}
                onClose={() => setReadersModalOpen(false)}
                informativo={currentInformativo}
                professores={professores}
            />

            <ConfirmationModal
                isOpen={isDeleteConfirmModalOpen}
                onClose={() => setDeleteConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Confirmar Exclusão?"
                message="Este informativo será permanentemente removido. Esta ação não pode ser desfeita."
            />
        </>
    );
};

export default Informativos;
