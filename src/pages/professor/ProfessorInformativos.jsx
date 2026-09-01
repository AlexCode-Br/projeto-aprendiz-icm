import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import AnnouncementDetailModal from '../../components/AnnouncementDetailModal';
import useLiveRefresh from '../../hooks/useLiveRefresh';

const plainText = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const ProfessorInformativos = () => {
    const [informativos, setInformativos] = useState([]);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('todos');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInformativos = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get('/api/informativos');
            const nextInformativos = Array.isArray(response.data) ? response.data : [];
            setInformativos(nextInformativos);
            setSelected(current => current ? nextInformativos.find(item => item.id === current.id) || null : current);
            setError(null);
        } catch (err) {
            if (silent) throw err;
            setError('Falha ao carregar os informativos. Tente novamente mais tarde.');
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchInformativos(); }, [fetchInformativos]);
    const refreshLive = useCallback(() => fetchInformativos({ silent: true }), [fetchInformativos]);
    useLiveRefresh(refreshLive, { intervalMs: 15000, eventName: 'announcements:updated' });

    const openAnnouncement = async info => {
        setSelected(info);
        if (info.hasRead) return;
        try {
            await api.post(`/api/informativos/${info.id}/lida`);
            setInformativos(current => current.map(item => item.id === info.id ? { ...item, hasRead: true } : item));
            setSelected(current => current?.id === info.id ? { ...current, hasRead: true } : current);
            window.dispatchEvent(new Event('announcements:updated'));
        } catch (markError) {
            console.error('Não foi possível registrar a visualização:', markError);
        }
    };

    const visible = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('pt-BR');
        return informativos.filter(info => {
            if (filter === 'nao-lidos' && info.hasRead) return false;
            if (filter === 'lidos' && !info.hasRead) return false;
            if (filter === 'fixados' && !info.fixado) return false;
            return !term || `${info.titulo} ${plainText(info.conteudo)} ${info.categoria}`.toLocaleLowerCase('pt-BR').includes(term);
        });
    }, [filter, informativos, search]);

    const unread = informativos.filter(info => !info.hasRead).length;

    if (loading) return <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Carregando informativos">{[1,2,3].map(item=><div key={item} className="panel p-5"><div className="skeleton h-5 w-24"/><div className="skeleton mt-4 h-7 w-3/4"/><div className="skeleton mt-4 h-20 rounded-lg"/></div>)}</div>;
    if (error) return <div className="panel p-10 text-center"><p className="text-danger" role="alert">{error}</p><button type="button" onClick={() => void fetchInformativos()} className="btn btn-secondary mt-4">Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Informativos e avisos</h1>
                    <p className="page-description">Fique por dentro das últimas novidades e comunicados{unread ? ` · ${unread} não ${unread === 1 ? 'lido' : 'lidos'}` : ''}.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success"/>Sincronizado ao vivo</span>
            </div>

            <div className="panel mb-6 grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="sr-only" htmlFor="announcement-search">Pesquisar informativos</label>
                <input id="announcement-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar por título ou conteúdo..." className="form-control" />
                <div className="flex flex-wrap gap-2" aria-label="Filtrar informativos">
                    {[['todos','Todos'],['nao-lidos','Não lidos'],['lidos','Lidos'],['fixados','Fixados']].map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`btn ${filter === value ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>)}
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visible.map(info => (
                    <article key={info.id} className={`panel flex min-w-0 flex-col p-5 sm:p-6 ${!info.hasRead ? 'border-l-4 border-l-primary' : ''}`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase text-primary">{info.tipo}</span>
                            <span className="flex items-center gap-2">
                                {!info.hasRead && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Novo</span>}
                                {info.fixado && <span title="Fixado">📌</span>}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold text-text-default">{info.titulo}</h2>
                        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-text-muted">{plainText(info.conteudo)}</p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                            <span className="text-xs text-text-muted">{new Date(info.data_publicacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' })}{info.anexos?.length ? ` · ${info.anexos.length} anexo${info.anexos.length === 1 ? '' : 's'}` : ''}</span>
                            <button type="button" onClick={() => openAnnouncement(info)} className="btn btn-secondary">Abrir informativo</button>
                        </div>
                    </article>
                ))}
                {!visible.length && <div className="panel col-span-full px-6 py-14 text-center text-text-muted"><strong className="block text-text-default">{informativos.length ? 'Nenhum informativo encontrado' : 'Nenhum informativo disponível'}</strong><span className="mt-1 block text-sm">{informativos.length ? 'Limpe a busca ou altere os filtros.' : 'Os avisos enviados para você aparecerão aqui.'}</span></div>}
            </div>

            <AnnouncementDetailModal isOpen={Boolean(selected)} onClose={() => setSelected(null)} announcement={selected} />
        </>
    );
};

export default ProfessorInformativos;
