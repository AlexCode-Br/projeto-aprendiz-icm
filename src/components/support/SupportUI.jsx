import { CircleCheck, MessagesSquare, ArrowLeft, Send } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ContactLink from '../ContactLink';

const statusClasses = {
  Aberto: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200',
  'Em atendimento': 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100',
  Resolvido: 'border-border bg-surface-muted text-text-muted',
};

export function SupportStatusBadge({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status] || statusClasses.Aberto}`}>{status}</span>;
}

export function formatSupportDate(value, includeDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today-target)/86400000);
  const time = date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if (!includeDate && dayDifference===0) return `Hoje, ${time}`;
  if (!includeDate && dayDifference===1) return `Ontem, ${time}`;
  return date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',', ',');
}

export function SupportTicketList({ tickets, selectedId, onSelect, loading, emptyMessage, role }) {
  if (loading && !tickets.length) return <div className="space-y-3 p-4" role="status" aria-label="Carregando chamados">{[1,2,3].map(item=><div key={item} className="skeleton h-28 rounded-xl" />)}</div>;
  if (!tickets.length) return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><span className="mb-3 text-3xl" aria-hidden="true"><CircleCheck aria-hidden="true" className="!h-8 !w-8" /></span><p className="font-semibold text-text-default">{emptyMessage}</p><p className="mt-1 text-sm leading-6 text-text-muted">Os chamados aparecerão aqui quando houver atividade.</p></div>;
  return <div className="divide-y divide-border" role="list" aria-label="Lista de chamados">
    {tickets.map(ticket=>{
      const isSelected=Number(selectedId)===Number(ticket.id);
      return <div key={ticket.id} role="listitem"><button type="button" onClick={()=>onSelect(ticket.id)} aria-current={isSelected?'true':undefined} className={`relative w-full px-4 py-4 text-left transition-colors sm:px-5 ${isSelected?'bg-primary/10':'hover:bg-surface-hover'}`}>
        {ticket.nao_lidas>0&&<span className="absolute right-4 top-4 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-white" aria-label={`${ticket.nao_lidas} mensagem(ns) não lida(s)`}>{ticket.nao_lidas}</span>}
        <div className="flex items-center gap-2 pr-9">
          <span className="font-mono text-xs text-text-muted">#{ticket.id}</span>
          <span className="text-xs font-semibold text-primary">{ticket.categoria || 'Outro'}</span>
        </div>
        {role==='gestor'&&<p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-primary">{ticket.nome}</p>}
        <p className="mt-1 line-clamp-2 font-semibold leading-5 text-text-default">{ticket.assunto}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{ticket.ultima_mensagem || 'Chamado sem mensagem.'}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SupportStatusBadge status={ticket.status}/>
          <span className="text-xs text-text-muted">{formatSupportDate(ticket.ultima_mensagem_em)}</span>
        </div>
        {ticket.aguardando&&<p className="mt-2 text-xs font-medium text-text-muted">Aguardando {ticket.aguardando}</p>}
      </button></div>;
    })}
  </div>;
}

export function SupportConversation({ detail, currentUserId, currentRole, loading, error, onRetry, onBack, onSend, sending, actions }) {
  const [draft,setDraft]=useState('');
  const [clientMessageId,setClientMessageId]=useState('');
  const sendingRef=useRef(false);
  const logRef=useRef(null);
  const stickToBottomRef=useRef(true);
  const lastTicketRef=useRef(null);
  const ticket=detail?.ticket;
  const timeline=useMemo(()=>{
    const messages=(detail?.messages||[]).map(item=>({...item,kind:'message'}));
    const events=(detail?.events||[]).map(item=>({...item,kind:'event'}));
    return [...messages,...events].sort((left,right)=>{
      const dateDifference=new Date(left.created_at)-new Date(right.created_at);
      if(dateDifference)return dateDifference;
      if(left.kind!==right.kind)return left.kind==='message'?-1:1;
      return left.id-right.id;
    });
  },[detail]);

  useEffect(() => {
    if (lastTicketRef.current !== ticket?.id) stickToBottomRef.current = true;
    lastTicketRef.current = ticket?.id;
    if (stickToBottomRef.current && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [timeline.length, ticket?.id]);
  useEffect(()=>{setDraft('');setClientMessageId('');},[ticket?.id]);

  const submit=async event=>{
    event.preventDefault();
    const message=draft.trim();
    if (!message||sending||sendingRef.current) return;
    const requestId=clientMessageId||crypto.randomUUID();
    setClientMessageId(requestId);
    sendingRef.current=true;
    try{
      await onSend(message,requestId);
      setDraft('');
      setClientMessageId('');
    }catch{
      // O texto e o identificador são preservados para uma tentativa idempotente.
    }finally{
      sendingRef.current=false;
    }
  };

  if (loading) return <section className="min-h-[36rem] space-y-4 bg-surface p-6" role="status" aria-label="Carregando conversa"><div className="skeleton h-20 w-3/4 rounded-xl"/><div className="skeleton ml-auto h-20 w-2/3 rounded-xl"/><div className="skeleton h-28 w-full rounded-xl"/></section>;
  if (error) return <section className="flex min-h-[36rem] flex-col items-center justify-center bg-surface p-6 text-center"><p className="text-sm text-danger" role="alert">{error}</p><button type="button" onClick={onRetry} className="btn btn-secondary mt-4">Tentar novamente</button></section>;
  if (!ticket) return <section className="flex min-h-[36rem] flex-col items-center justify-center bg-surface p-8 text-center"><span className="text-4xl text-text-muted" aria-hidden="true"><MessagesSquare aria-hidden="true" className="!h-10 !w-10" /></span><h2 className="mt-4 text-lg font-semibold text-text-default">Selecione um chamado</h2><p className="mt-2 max-w-sm text-sm leading-6 text-text-muted">Escolha um item da lista para visualizar todo o histórico e continuar o atendimento.</p></section>;

  const managerBlocked=currentRole==='gestor'&&ticket.status==='Resolvido';
  return <section className="flex min-h-[36rem] flex-col bg-surface" aria-labelledby="support-conversation-title">
    <header className="border-b border-border bg-surface px-4 py-4 sm:px-6">
      <button type="button" onClick={onBack} className="btn btn-ghost mb-3 px-2 lg:hidden" aria-label="Voltar para a lista de chamados"><ArrowLeft aria-hidden="true" />Voltar</button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Chamado #{ticket.id} · {ticket.categoria || 'Outro'}</p>
        <SupportStatusBadge status={ticket.status} />
      </div>
      <h2 id="support-conversation-title" className="mt-3 break-words text-xl font-semibold leading-7 text-text-default">{ticket.assunto}</h2>
      {currentRole === 'gestor' && <p className="mt-2 break-words text-sm text-text-muted">{ticket.nome}</p>}
      <details className="mt-3 text-xs text-text-muted">
        <summary className="w-fit cursor-pointer rounded py-1 font-medium hover:text-text-default">Detalhes do chamado</summary>
        <div className="mt-2 grid gap-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2">
          <p><span className="font-semibold text-text-default">Aberto em</span><br />{formatSupportDate(ticket.data_abertura, true)}</p>
          <p><span className="font-semibold text-text-default">Mensagens</span><br />{detail?.messages?.length || 0}</p>
          {currentRole === 'gestor' && <p className="sm:col-span-2"><span className="font-semibold text-text-default">E-mail do professor</span><br /><ContactLink type="email" value={ticket.contato} /></p>}
        </div>
      </details>
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions}</div>}
    </header>

    <div ref={logRef} onScroll={event => { const element = event.currentTarget; stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="max-h-[34rem] flex-1 space-y-4 overflow-y-auto bg-surface-muted/60 px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-label="Histórico do chamado">
      {timeline.map(item=>{
        if(item.kind==='event')return <div key={`event-${item.id}`} className="flex justify-center"><p className="rounded-full border border-border bg-surface px-3 py-1.5 text-center text-xs text-text-muted">{item.actor_name||'Equipe'} alterou o status de {item.from_status||'—'} para {item.to_status} · {formatSupportDate(item.created_at)}</p></div>;
        const own=Number(item.author_user_id)===Number(currentUserId);
        const author=own?'Você':item.author_role==='gestor'?'Gestor':`Professor ${item.author_name}`;
        return <article key={`message-${item.id}`} className={`flex ${own?'justify-end':'justify-start'}`}>
          <div className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[76%] ${own?'border-primary/20 bg-primary/10':'border-border bg-surface'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="text-xs font-bold text-text-default">{author}</p><time className="text-xs text-text-muted" dateTime={item.created_at}>{formatSupportDate(item.created_at)}</time></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-default">{item.body}</p>
          </div>
        </article>;
      })}
    </div>

    <form onSubmit={submit} className="border-t border-border p-4 sm:p-5">
      {managerBlocked?<div className="alert-warning">Este chamado está resolvido. Altere o status para “Em atendimento” antes de enviar uma nova resposta.</div>:<>
        {currentRole==='professor'&&ticket.status==='Resolvido'&&<p className="mb-2 text-xs text-text-muted">Uma nova mensagem reabrirá automaticamente este chamado.</p>}
        <label htmlFor={`support-message-${ticket.id}`} className="sr-only">Digite sua mensagem</label>
        <textarea id={`support-message-${ticket.id}`} value={draft} onChange={event=>{setDraft(event.target.value);setClientMessageId('');}} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')event.currentTarget.form?.requestSubmit();}} rows="3" maxLength="4000" placeholder="Digite sua mensagem..." className="form-control min-h-24 resize-y" disabled={sending}/>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-text-muted">Use Ctrl + Enter para enviar · {draft.length}/4000</p><button type="submit" disabled={sending||draft.trim().length<2} className="btn btn-primary w-full sm:w-auto"><Send aria-hidden="true" />{sending?'Enviando...':'Enviar mensagem'}</button></div>
      </>}
    </form>
  </section>;
}
