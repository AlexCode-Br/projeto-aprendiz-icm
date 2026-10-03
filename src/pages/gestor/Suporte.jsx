import FormSelect from '../../components/FormSelect';
import SearchInput from '../../components/SearchInput';
import { Trash2, RefreshCw, ArrowUpRight } from 'lucide-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import { SupportConversation, SupportTicketList } from '../../components/support/SupportUI';
import Pagination from '../../components/Pagination';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import api from '../../services/api';
import { SUPPORT_STATUSES } from '../../../shared/validation.mjs';

const filters = ['Todos','Abertos','Em atendimento','Resolvidos','Não lidos'];
const ITEMS_PER_PAGE = 12;
const isSameTicket = (left,right) => left != null && right != null && String(left) === String(right);

const Suporte = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [tickets,setTickets]=useState([]);
  const [selectedId,setSelectedId]=useState(null);
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [currentPage,setCurrentPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState('');
  const [detailError,setDetailError]=useState('');
  const [sending,setSending]=useState(false);
  const [updating,setUpdating]=useState(false);
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleteTargetId,setDeleteTargetId]=useState(null);
  const [deleting,setDeleting]=useState(false);
  const selectedIdRef=useRef(null);
  const detailRequestRef=useRef(0);

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
    if(!ticketId||!isSameTicket(selectedIdRef.current,ticketId))return;
    const requestId=++detailRequestRef.current;
    if(!silent)setDetailLoading(true);
    try{
      const response=await api.get(`/api/suporte/${ticketId}`);
      if(requestId!==detailRequestRef.current||!isSameTicket(selectedIdRef.current,ticketId))return;
      setDetail(response.data);
      setDetailError('');
      const lastMessageId=response.data.messages.at(-1)?.id;
      await api.post(`/api/suporte/${ticketId}/lido`,lastMessageId?{last_message_id:lastMessageId}:{});
      if(requestId!==detailRequestRef.current||!isSameTicket(selectedIdRef.current,ticketId))return;
      setTickets(current=>current.map(ticket=>Number(ticket.id)===Number(ticketId)?{...ticket,nao_lidas:0}:ticket));
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){
      if(requestId!==detailRequestRef.current||!isSameTicket(selectedIdRef.current,ticketId))return;
      setDetailError(requestError.response?.status===404?'Este chamado não está mais disponível.':'Não foi possível atualizar esta conversa.');
      if(!silent)showToast(requestError.message||'Erro ao abrir chamado.','error');
    }finally{
      if(requestId===detailRequestRef.current&&isSameTicket(selectedIdRef.current,ticketId))setDetailLoading(false);
    }
  },[showToast]);

  useEffect(()=>{const timer=setTimeout(()=>fetchTickets(),250);return()=>clearTimeout(timer);},[fetchTickets]);
  useEffect(()=>{setCurrentPage(1);},[search,filter]);
  useEffect(()=>()=>{selectedIdRef.current=null;detailRequestRef.current+=1;},[]);
  useLiveRefresh(()=>{
    const ticketId=selectedIdRef.current;
    return Promise.all([fetchTickets({silent:true}),ticketId?fetchDetail(ticketId,{silent:true}):Promise.resolve()]);
  },{intervalMs:15000});

  const openTicket=async ticketId=>{
    selectedIdRef.current=ticketId;
    detailRequestRef.current+=1;
    setSelectedId(ticketId);
    setDetail(null);
    setDetailError('');
    await fetchDetail(ticketId);
  };

  const closeTicket=()=>{
    selectedIdRef.current=null;
    detailRequestRef.current+=1;
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  };

  const sendReply=async(ticketId,message,clientMessageId)=>{
    if(!ticketId)return;
    setSending(true);
    try{
      await api.post(`/api/suporte/${ticketId}/responder`,{mensagem:message,client_message_id:clientMessageId});
      await Promise.all([
        isSameTicket(selectedIdRef.current,ticketId)?fetchDetail(ticketId,{silent:true}):Promise.resolve(),
        fetchTickets({silent:true}),
      ]);
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){
      showToast(requestError.message||'Não foi possível enviar a resposta. O texto foi preservado.','error');
      throw requestError;
    }finally{setSending(false);}
  };

  const updateTicket=async(ticketId,value)=>{
    if(!ticketId||updating)return;
    setUpdating(true);
    try{
      await api.put(`/api/suporte/${ticketId}/status`,{status:value});
      await Promise.all([
        isSameTicket(selectedIdRef.current,ticketId)?fetchDetail(ticketId,{silent:true}):Promise.resolve(),
        fetchTickets({silent:true}),
      ]);
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){showToast(requestError.message||'Não foi possível atualizar o chamado.','error');}
    finally{setUpdating(false);}
  };

  const deleteTicket=async()=>{
    const ticketId=deleteTargetId;
    if(!ticketId||deleting)return;
    setDeleting(true);
    try{
      await api.delete(`/api/suporte/${ticketId}`);
      setDeleteOpen(false);setDeleteTargetId(null);
      if(isSameTicket(selectedIdRef.current,ticketId))closeTicket();
      await fetchTickets({silent:true});
      window.dispatchEvent(new Event('support:updated'));
      showToast('Chamado apagado definitivamente.','success');
    }catch(requestError){showToast(requestError.message||'Não foi possível apagar o chamado.','error');}
    finally{setDeleting(false);}
  };

  const totalPages=Math.max(1,Math.ceil(tickets.length/ITEMS_PER_PAGE));
  const paginatedTickets=useMemo(()=>{
    const start=(currentPage-1)*ITEMS_PER_PAGE;
    return tickets.slice(start,start+ITEMS_PER_PAGE);
  },[tickets,currentPage]);
  useEffect(()=>{if(currentPage>totalPages)setCurrentPage(totalPages);},[currentPage,totalPages]);

  const actions=detail?.ticket?<>
    <label className="sr-only" htmlFor="support-status">Status do chamado</label>
    <FormSelect id="support-status" className="w-44" value={detail.ticket.status} isDisabled={updating} isClearable={false} isSearchable={false} onChange={event => updateTicket(detail.ticket.id,event.target.value)} options={SUPPORT_STATUSES} />
    <button type="button" disabled={updating} onClick={()=>{setDeleteTargetId(detail.ticket.id);setDeleteOpen(true);}} className="icon-button hover:!bg-danger/10 hover:!text-danger" aria-label="Apagar chamado" title="Apagar chamado"><Trash2 aria-hidden="true" className="!h-4 !w-4" /></button>
  </>:null;

  return <div className="flex h-full min-h-[30rem] flex-col gap-4">
    <div className={`${selectedId?'hidden lg:flex':'flex'} shrink-0 items-center justify-between gap-3`}>
      <div className="min-w-0"><h1 className="page-title">Central de Suporte</h1><p className="mt-1 text-sm text-text-muted">Uma caixa de entrada para atender os professores.</p></div>
      <button type="button" onClick={()=>fetchTickets()} disabled={loading} className="btn btn-secondary px-3" aria-label="Atualizar chamados"><RefreshCw aria-hidden="true" className={`!h-4 !w-4 ${loading?'animate-spin':''}`}/><span className="hidden sm:inline">Atualizar</span></button>
    </div>

    {error&&<div className="alert-error flex shrink-0 items-center justify-between gap-3" role="alert"><span>{error}</span><button type="button" onClick={()=>fetchTickets()} className="font-semibold underline">Tentar novamente</button></div>}

    <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.65fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className={`${selectedId?'hidden lg:flex':'flex'} min-h-0 min-w-0 flex-col border-border lg:border-r`} aria-label="Chamados">
        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <SearchInput value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar chamados..." aria-label="Buscar por professor, assunto, conteúdo ou número" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-default">Chamados<span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs tabular-nums text-text-muted" aria-label={`${tickets.length} resultados`}>{tickets.length}</span></h2>
            <label className="min-w-0 max-w-40 flex-1"><span className="sr-only">Filtrar chamados</span><select aria-label="Filtrar chamados" value={filter} onChange={event=>setFilter(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-text-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{filters.map(value=><option key={value}>{value}</option>)}</select></label>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><SupportTicketList tickets={paginatedTickets} selectedId={selectedId} onSelect={openTicket} loading={loading} emptyMessage={filter==='Não lidos'?'Nenhum chamado não lido.':'Nenhum chamado encontrado.'} role="gestor" inbox /></div>
        {!loading&&<div className="shrink-0 border-t border-border">{totalPages>1?<Pagination currentPage={currentPage} totalItems={tickets.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} className="border-t-0" compact />:<p className="px-4 py-3 text-xs text-text-muted">{tickets.length} {tickets.length===1?'chamado':'chamados'} · Atenção e atividade recente</p>}</div>}
      </aside>
      <div className={`${selectedId?'flex':'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>
        <SupportConversation key={selectedId||'empty'} detail={detail} currentUserId={user?.id} currentRole="gestor" loading={detailLoading} error={detailError} onRetry={()=>fetchDetail(selectedIdRef.current)} onBack={closeTicket} onSend={sendReply} sending={sending} actions={actions} inbox emptyAction={paginatedTickets[0]&&!loading?<button type="button" onClick={()=>openTicket(paginatedTickets[0].id)} className="btn btn-secondary">Abrir próximo chamado<ArrowUpRight aria-hidden="true" className="!h-4 !w-4"/></button>:null}/>
      </div>
    </div>
    <Modal isOpen={deleteOpen} onClose={()=>{if(!deleting){setDeleteOpen(false);setDeleteTargetId(null);}}} title="Apagar chamado?" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-muted">Esta ação apagará permanentemente o chamado, todas as mensagens e o histórico de status. Professores não têm acesso a esta ação.</p>
        <div className="flex border-t border-border pt-5 sm:justify-end"><button type="button" className="btn btn-danger" disabled={deleting} onClick={deleteTicket}>{deleting?'Apagando...':'Apagar definitivamente'}</button></div>
      </div>
    </Modal>
  </div>;
};

export default Suporte;
