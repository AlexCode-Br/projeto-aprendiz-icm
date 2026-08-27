import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InformativoModal from '../../components/InformativoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

import InformativoReadersModal from '../../components/InformativoReadersModal';
import AnnouncementAttachments from '../../components/AnnouncementAttachments';
import AnnouncementAudienceModal from '../../components/AnnouncementAudienceModal';
import useLiveRefresh from '../../hooks/useLiveRefresh';

const Informativos = () => {
    const { showToast } = useToast();
    const [informativos, setInformativos] = useState([]);
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
            if (profResponse) setHasProfessors(professores.some(professor => professor.status === 'Ativo'));
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
                    Criar informativo
                </button>
            </div>

            <div className="panel mb-6 grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                <label className="sr-only" htmlFor="manager-announcement-search">Pesquisar informativos</label>
                <input id="manager-announcement-search" type="search" value={search} onChange={event => setSearch(event.target.value)} className="form-control" placeholder="Pesquisar por título, conteúdo ou anexo..." />
                <label className="sr-only" htmlFor="manager-announcement-status">Filtrar por estado</label>
                <select id="manager-announcement-status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="form-control">
                    <option>Todos</option><option value="Publicado">Publicados</option><option value="Agendado">Agendados</option>
                </select>
                <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success" title="Status e visualizações são sincronizados automaticamente"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40"/><span className="relative inline-flex h-2 w-2 rounded-full bg-success"/></span>Atualização automática</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleInformativos.map(info => (
                    <article key={info.id} className="panel flex flex-col overflow-hidden">
                        <div className="p-4 flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${getCategoryClass(info.categoria)}`}>{info.categoria}</span>
                                <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${info.status === 'Agendado' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200' : 'bg-success/10 text-success'}`}>{info.status}</span>{info.fixado && <span title="Fixado no topo">📌</span>}</span>
                            </div>
                            <h3 className="font-bold text-lg text-text-default">{info.titulo}</h3>
                            <p className="text-sm text-text-muted mt-1">{info.data} às {info.hora}</p>
                            <div className="announcement-content mt-4 max-w-none text-sm text-text-default" dangerouslySetInnerHTML={{ __html: info.conteudo }} />
                            <AnnouncementAttachments attachments={info.anexos} />
                        </div>
                        <div className="p-4 border-t border-border flex justify-between items-center text-xs text-text-muted">
                            <button type="button" onClick={() => handleOpenReadersModal(info)} className="flex items-center space-x-4 hover:opacity-75 transition-opacity" title="Ver quem visualizou">
                                <span>👁️ {info.lido} visualizações</span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <button type="button" onClick={() => handleOpenFormModal(info)} className="min-h-10 rounded-md px-2 text-blue-600 hover:bg-blue-50 hover:underline dark:hover:bg-blue-950/30">Editar</button>
                                <button type="button" onClick={() => handleOpenDeleteConfirm(info)} className="min-h-10 rounded-md px-2 text-danger hover:bg-red-50 hover:underline dark:hover:bg-red-950/30">Excluir</button>
                            </div>
                        </div>
                    </article>
                ))}
                {loading && <div className="panel col-span-full px-6 py-14 text-center text-text-muted" role="status">Carregando informativos...</div>}
                {!loading && !visibleInformativos.length && <div className="panel col-span-full px-6 py-14 text-center text-text-muted">{informativos.length ? 'Nenhum informativo encontrado.' : <><p>Nenhum informativo criado ainda.</p><button type="button" onClick={() => handleOpenFormModal()} className="btn btn-primary mt-4">Criar informativo</button></>}</div>}
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
