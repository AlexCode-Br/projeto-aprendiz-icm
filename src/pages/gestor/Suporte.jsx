import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import { SupportConversation, SupportTicketList } from '../../components/support/SupportUI';
import api from '../../services/api';
import { SUPPORT_STATUSES } from '../../../shared/validation.mjs';

const filters = ['Todos','Abertos','Em atendimento','Resolvidos','Não lidos'];

const Suporte = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [tickets,setTickets]=useState([]);
  const [selectedId,setSelectedId]=useState(null);
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState('');
  const [detailError,setDetailError]=useState('');
  const [sending,setSending]=useState(false);
  const [updating,setUpdating]=useState(false);
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleting,setDeleting]=useState(false);

  const query=useMemo(()=>({
    search:search.trim()||undefined,
    status:filter==='Abertos'?'Aberto':filter==='Em atendimento'?'Em atendimento':filter==='Resolvidos'?'Resolvido':undefined,
    unread:filter==='Não lidos'?'1':undefined,
  }),[search,filter]);

  const fetchTickets=useCallback(async({silent=false}={})=>{
    if(!silent)setLoading(true);
    try{
      const response=await api.get('/api/suporte',{params:query});
      setTickets(response.data);
      setError('');
    }catch(requestError){
      setError('Não foi possível carregar os chamados.');
      if(!silent)showToast(requestError.message||'Erro ao carregar chamados.','error');
    }finally{if(!silent)setLoading(false);}
  },[query,showToast]);

  const fetchDetail=useCallback(async(ticketId,{silent=false}={})=>{
    if(!ticketId)return;
    if(!silent)setDetailLoading(true);
    try{
      const response=await api.get(`/api/suporte/${ticketId}`);
      setDetail(response.data);
      setDetailError('');
      const lastMessageId=response.data.messages.at(-1)?.id;
      await api.post(`/api/suporte/${ticketId}/lido`,lastMessageId?{last_message_id:lastMessageId}:{});
      setTickets(current=>current.map(ticket=>Number(ticket.id)===Number(ticketId)?{...ticket,nao_lidas:0}:ticket));
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){
      setDetailError(requestError.response?.status===404?'Este chamado não está mais disponível.':'Não foi possível atualizar esta conversa.');
      if(!silent)showToast(requestError.message||'Erro ao abrir chamado.','error');
    }finally{if(!silent)setDetailLoading(false);}
  },[showToast]);

  useEffect(()=>{const timer=setTimeout(()=>fetchTickets(),250);return()=>clearTimeout(timer);},[fetchTickets]);
  useEffect(()=>{
    const refresh=()=>{fetchTickets({silent:true});if(selectedId)fetchDetail(selectedId,{silent:true});};
    const interval=setInterval(refresh,15000);
    window.addEventListener('focus',refresh);
    return()=>{clearInterval(interval);window.removeEventListener('focus',refresh);};
  },[fetchTickets,fetchDetail,selectedId]);

  const openTicket=async ticketId=>{setSelectedId(ticketId);setDetail(null);await fetchDetail(ticketId);};

  const sendReply=async(message,clientMessageId)=>{
    setSending(true);
    try{
      await api.post(`/api/suporte/${selectedId}/responder`,{mensagem:message,client_message_id:clientMessageId});
      await Promise.all([fetchDetail(selectedId,{silent:true}),fetchTickets({silent:true})]);
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){
      showToast(requestError.message||'Não foi possível enviar a resposta. O texto foi preservado.','error');
      throw requestError;
    }finally{setSending(false);}
  };

  const updateTicket=async(value)=>{
    if(!selectedId||updating)return;
    setUpdating(true);
    try{
      await api.put(`/api/suporte/${selectedId}/status`,{status:value});
      await Promise.all([fetchDetail(selectedId,{silent:true}),fetchTickets({silent:true})]);
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){showToast(requestError.message||'Não foi possível atualizar o chamado.','error');}
    finally{setUpdating(false);}
  };

  const deleteTicket=async()=>{
    if(!selectedId||deleting)return;
    setDeleting(true);
    try{
      await api.delete(`/api/suporte/${selectedId}`);
      setDeleteOpen(false);setSelectedId(null);setDetail(null);
      await fetchTickets({silent:true});
      window.dispatchEvent(new Event('support:updated'));
      showToast('Chamado apagado definitivamente.','success');
    }catch(requestError){showToast(requestError.message||'Não foi possível apagar o chamado.','error');}
    finally{setDeleting(false);}
  };

  const counts=useMemo(()=>({
    total:tickets.length,
    unread:tickets.filter(ticket=>ticket.nao_lidas>0).length,
    waiting:tickets.filter(ticket=>ticket.aguardando==='Gestor'&&ticket.status!=='Resolvido').length,
  }),[tickets]);

  const actions=detail?.ticket?<>
    <label className="sr-only" htmlFor="support-status">Status do chamado</label>
    <select id="support-status" className="form-control min-h-9 w-auto py-1.5 text-xs" value={detail.ticket.status} disabled={updating} onChange={event=>updateTicket(event.target.value)}>{SUPPORT_STATUSES.map(value=><option key={value}>{value}</option>)}</select>
    <button type="button" onClick={()=>setDeleteOpen(true)} className="btn btn-secondary min-h-9 border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10" aria-label="Apagar chamado">Apagar chamado</button>
  </>:null;

  return <>
    <div className="page-header">
      <div><h1 className="page-title">Central de Suporte</h1><p className="page-description">Atenda solicitações dos professores com histórico completo e acompanhamento de leitura.</p></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Na lista',counts.total],['Não lidos',counts.unread],['Aguardando',counts.waiting]].map(([label,value])=><div key={label} className="rounded-xl border border-border bg-surface px-3 py-2"><strong className="block text-lg text-text-default">{value}</strong><span className="text-[0.68rem] uppercase tracking-wide text-text-muted">{label}</span></div>)}
      </div>
    </div>

    <section className="panel mb-4 p-3 sm:p-4" aria-label="Busca e filtros de chamados">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="flex-1"><span className="sr-only">Buscar chamados</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar por professor, assunto, conteúdo ou número..." className="form-control"/></label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar chamados">
          {filters.map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${filter===value?'bg-primary text-white':'border border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>{value}</button>)}
        </div>
      </div>
    </section>

    {error&&<div className="alert-error mb-4 flex items-center justify-between gap-3" role="alert"><span>{error}</span><button type="button" onClick={()=>fetchTickets()} className="font-semibold underline">Tentar novamente</button></div>}

    <div className="panel grid min-h-[38rem] overflow-hidden lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.7fr)]">
      <aside className={`${selectedId?'hidden lg:block':'block'} border-r-0 border-border lg:border-r`} aria-label="Chamados">
        <div className="border-b border-border px-5 py-4"><h2 className="font-bold text-text-default">Chamados</h2><p className="mt-1 text-xs text-text-muted">Ordenados por atenção necessária e atividade recente.</p></div>
        <div className="max-h-[42rem] overflow-y-auto"><SupportTicketList tickets={tickets} selectedId={selectedId} onSelect={openTicket} loading={loading} emptyMessage={filter==='Não lidos'?'Nenhum chamado não lido.':'Nenhum chamado encontrado.'} role="gestor"/></div>
      </aside>
      <div className={`${selectedId?'block':'hidden lg:block'}`}>
        <SupportConversation detail={detail} currentUserId={user?.id} currentRole="gestor" loading={detailLoading} error={detailError} onRetry={()=>fetchDetail(selectedId)} onBack={()=>setSelectedId(null)} onSend={sendReply} sending={sending} actions={actions}/>
      </div>
    </div>
    <Modal isOpen={deleteOpen} onClose={()=>{if(!deleting)setDeleteOpen(false);}} title="Apagar chamado?" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-muted">Esta ação apagará permanentemente o chamado, todas as mensagens e o histórico de status. Professores não têm acesso a esta ação.</p>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" disabled={deleting} onClick={()=>setDeleteOpen(false)}>Cancelar</button><button type="button" className="btn btn-danger" disabled={deleting} onClick={deleteTicket}>{deleting?'Apagando...':'Apagar definitivamente'}</button></div>
      </div>
    </Modal>
  </>;
};

export default Suporte;
