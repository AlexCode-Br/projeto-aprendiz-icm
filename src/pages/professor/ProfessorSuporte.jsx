import FormSelect from '../../components/FormSelect';
import { Plus } from 'lucide-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import { SupportConversation, SupportTicketList } from '../../components/support/SupportUI';
import api from '../../services/api';
import { SUPPORT_CATEGORIES, validateSupportTicket } from '../../../shared/validation.mjs';

const NewTicketModal=({isOpen,onClose,onCreated})=>{
  const {showToast}=useToast();
  const [form,setForm]=useState({assunto:'',categoria:'',mensagem:''});
  const [errors,setErrors]=useState({});
  const [sending,setSending]=useState(false);
  const [clientMessageId,setClientMessageId]=useState('');
  const sendingRef=useRef(false);

  useEffect(()=>{if(isOpen){setForm({assunto:'',categoria:'',mensagem:''});setErrors({});setClientMessageId('');}},[isOpen]);
  const update=(field,value)=>{setForm(current=>({...current,[field]:value}));setErrors(current=>({...current,[field]:''}));setClientMessageId('');};
  const submit=async event=>{
    event.preventDefault();
    const nextErrors=validateSupportTicket(form);setErrors(nextErrors);
    if(Object.keys(nextErrors).length||sendingRef.current)return;
    const requestId=clientMessageId||crypto.randomUUID();setClientMessageId(requestId);sendingRef.current=true;setSending(true);
    try{
      const response=await api.post('/api/suporte',{...form,client_message_id:requestId});
      await onCreated(response.data.id);
    }catch(requestError){
      const fieldErrors=requestError.response?.data?.errors;if(fieldErrors)setErrors(fieldErrors);
      showToast(requestError.message||'Não foi possível abrir o chamado. Seus dados foram preservados.','error');
    }finally{sendingRef.current=false;setSending(false);}
  };

  return <Modal isOpen={isOpen} onClose={()=>{if(!sending)onClose();}} title="Novo chamado" maxWidth="max-w-xl">
    <form onSubmit={submit} noValidate>
      <p className="mb-5 text-sm leading-6 text-text-muted">Descreva uma solicitação específica. A equipe responderá e todo o histórico ficará disponível nesta área.</p>
      <div className="space-y-4">
        <div><label htmlFor="support-subject" className="form-label">Assunto</label><input id="support-subject" value={form.assunto} onChange={event=>update('assunto',event.target.value)} maxLength="120" className={`form-control ${errors.assunto?'border-danger':''}`} aria-invalid={Boolean(errors.assunto)} aria-describedby={errors.assunto?'support-subject-error':undefined} placeholder="Ex.: Dificuldade para registrar frequência"/>{errors.assunto&&<p id="support-subject-error" className="mt-1 text-xs text-danger">{errors.assunto}</p>}</div>
        <div><label htmlFor="support-category" className="form-label">Categoria</label><FormSelect id="support-category" value={form.categoria} onChange={event=>update('categoria',event.target.value)} invalid={Boolean(errors.categoria)} aria-describedby={errors.categoria?'support-category-error':undefined} options={SUPPORT_CATEGORIES} />{errors.categoria&&<p id="support-category-error" className="mt-1 text-xs text-danger">{errors.categoria}</p>}</div>
        <div><label htmlFor="support-initial-message" className="form-label">Como podemos ajudar?</label><textarea id="support-initial-message" value={form.mensagem} onChange={event=>update('mensagem',event.target.value)} rows="6" maxLength="4000" className={`form-control min-h-36 ${errors.mensagem?'border-danger':''}`} aria-invalid={Boolean(errors.mensagem)} aria-describedby={errors.mensagem?'support-message-error':undefined} placeholder="Explique o que aconteceu, o que você esperava e, se possível, quando o problema ocorreu."/>{errors.mensagem&&<p id="support-message-error" className="mt-1 text-xs text-danger">{errors.mensagem}</p>}<p className="mt-1 text-right text-xs text-text-muted">{form.mensagem.length}/4000</p></div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={sending} className="btn btn-secondary">Cancelar</button><button type="submit" disabled={sending} className="btn btn-primary">{sending?'Enviando...':'Criar chamado'}</button></div>
    </form>
  </Modal>;
};

const ProfessorSuporte=()=>{
  const {user}=useContext(AuthContext);
  const {showToast}=useToast();
  const [tickets,setTickets]=useState([]);
  const [selectedId,setSelectedId]=useState(null);
  const [detail,setDetail]=useState(null);
  const [filter,setFilter]=useState('Todos');
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState('');
  const [detailError,setDetailError]=useState('');
  const [sending,setSending]=useState(false);
  const [newTicketOpen,setNewTicketOpen]=useState(false);

  const query=useMemo(()=>({status:filter==='Ativos'?undefined:filter==='Resolvidos'?'Resolvido':undefined,unread:filter==='Não lidos'?'1':undefined}),[filter]);
  const fetchTickets=useCallback(async({silent=false}={})=>{
    if(!silent)setLoading(true);
    try{
      const response=await api.get('/api/suporte',{params:query});
      const visible=filter==='Ativos'?response.data.filter(ticket=>ticket.status!=='Resolvido'):response.data;
      setTickets(visible);setError('');
    }catch(requestError){setError('Não foi possível carregar seus chamados.');if(!silent)showToast(requestError.message||'Erro ao carregar chamados.','error');}
    finally{if(!silent)setLoading(false);}
  },[filter,query,showToast]);

  const fetchDetail=useCallback(async(ticketId,{silent=false}={})=>{
    if(!ticketId)return;if(!silent)setDetailLoading(true);
    try{
      const response=await api.get(`/api/suporte/${ticketId}`);setDetail(response.data);setDetailError('');
      const lastMessageId=response.data.messages.at(-1)?.id;
      await api.post(`/api/suporte/${ticketId}/lido`,lastMessageId?{last_message_id:lastMessageId}:{});
      setTickets(current=>current.map(ticket=>Number(ticket.id)===Number(ticketId)?{...ticket,nao_lidas:0}:ticket));
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){setDetailError(requestError.response?.status===404?'Este chamado não está disponível.':'Não foi possível atualizar esta conversa.');if(!silent)showToast(requestError.message||'Erro ao abrir chamado.','error');}
    finally{if(!silent)setDetailLoading(false);}
  },[showToast]);

  useEffect(()=>{fetchTickets();},[fetchTickets]);
  useEffect(()=>{
    const refresh=()=>{fetchTickets({silent:true});if(selectedId)fetchDetail(selectedId,{silent:true});};
    const interval=setInterval(refresh,15000);window.addEventListener('focus',refresh);
    return()=>{clearInterval(interval);window.removeEventListener('focus',refresh);};
  },[fetchTickets,fetchDetail,selectedId]);

  const openTicket=async ticketId=>{setSelectedId(ticketId);setDetail(null);await fetchDetail(ticketId);};
  const sendReply=async(message,clientMessageId)=>{
    setSending(true);
    try{
      await api.post(`/api/suporte/${selectedId}/responder`,{mensagem:message,client_message_id:clientMessageId});
      await Promise.all([fetchDetail(selectedId,{silent:true}),fetchTickets({silent:true})]);
      window.dispatchEvent(new Event('support:updated'));
    }catch(requestError){showToast(requestError.message||'Não foi possível enviar. O texto foi preservado.','error');throw requestError;}
    finally{setSending(false);}
  };
  const created=async ticketId=>{setNewTicketOpen(false);await fetchTickets({silent:true});await openTicket(ticketId);window.dispatchEvent(new Event('support:updated'));showToast('Chamado criado com sucesso.','success');};

  return <>
    <div className="page-header"><div><h1 className="page-title">Suporte</h1><p className="page-description">Crie chamados, converse com a equipe gestora e acompanhe cada solicitação até a resolução.</p></div><button type="button" onClick={()=>setNewTicketOpen(true)} className="btn btn-primary w-full sm:w-auto"><Plus aria-hidden="true" />Novo chamado</button></div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar seus chamados">{['Todos','Ativos','Resolvidos','Não lidos'].map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-xs font-semibold ${filter===value?'bg-primary text-white':'border border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>{value}</button>)}</div>
    {error&&<div className="alert-error mb-4 flex items-center justify-between gap-3" role="alert"><span>{error}</span><button type="button" onClick={()=>fetchTickets()} className="font-semibold underline">Tentar novamente</button></div>}
    <div className="panel grid min-h-[38rem] overflow-hidden lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.7fr)]">
      <aside className={`${selectedId?'hidden lg:block':'block'} border-r-0 border-border lg:border-r`} aria-label="Meus chamados"><div className="border-b border-border px-5 py-4"><h2 className="font-bold text-text-default">Meus chamados</h2><p className="mt-1 text-xs text-text-muted">Respostas novas aparecem primeiro.</p></div><div className="max-h-[42rem] overflow-y-auto"><SupportTicketList tickets={tickets} selectedId={selectedId} onSelect={openTicket} loading={loading} emptyMessage={filter==='Não lidos'?'Você não possui respostas não lidas.':'Você ainda não possui chamados.'} role="professor"/></div>{!loading&&!tickets.length&&filter!=='Não lidos'&&<div className="border-t border-border p-4"><button type="button" onClick={()=>setNewTicketOpen(true)} className="btn btn-primary w-full">Criar primeiro chamado</button></div>}</aside>
      <div className={`${selectedId?'block':'hidden lg:block'}`}><SupportConversation detail={detail} currentUserId={user?.id} currentRole="professor" loading={detailLoading} error={detailError} onRetry={()=>fetchDetail(selectedId)} onBack={()=>setSelectedId(null)} onSend={sendReply} sending={sending}/></div>
    </div>
    <NewTicketModal isOpen={newTicketOpen} onClose={()=>setNewTicketOpen(false)} onCreated={created}/>
  </>;
};

export default ProfessorSuporte;
