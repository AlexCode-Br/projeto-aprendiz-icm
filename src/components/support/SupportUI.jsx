import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, MessageCircle } from 'lucide-react';

import ChatComposer from './ChatComposer';
import ChatMedia from './ChatMedia';

const dateOf = value => new Date(typeof value==='string'&&/^\d{4}-\d\d-\d\d /.test(value)?`${value.replace(' ','T')}Z`:value);
const timeOf = value => dateOf(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const dayOf = value => {
  const date=dateOf(value),now=new Date();
  if(date.toDateString()===now.toDateString())return 'Hoje';
  now.setDate(now.getDate()-1);
  if(date.toDateString()===now.toDateString())return 'Ontem';
  return date.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
};
const initials = name => (name||'Equipe gestora').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('');
function Avatar({ name }) {
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(name)}</span>;
}

export function ChatContacts({ contacts,selectedId,onSelect,loading }) {
  if(loading&&!contacts.length)return <div className="space-y-3 p-4" role="status" aria-label="Carregando conversas">{[1,2,3].map(id=><div key={id} className="skeleton h-20 rounded-xl"/>)}</div>;
  if(!contacts.length)return <div className="px-6 py-12 text-center text-sm text-text-muted">Nenhuma conversa encontrada.</div>;
  return <ul aria-label="Professores">{contacts.map(item=><li key={item.id}><button type="button" onClick={()=>onSelect(item.id)} aria-current={selectedId===item.id?'true':undefined} className={`flex w-full min-w-0 items-center gap-3 border-b border-border/60 px-4 py-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${selectedId===item.id?'bg-primary/5':'hover:bg-surface-hover'}`}>
    <Avatar name={item.nome}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm text-text-default ${item.nao_lidas?'font-bold':'font-semibold'}`}>{item.nome}</span>{item.ultima_mensagem_em&&<time dateTime={item.ultima_mensagem_em} className={`shrink-0 text-[11px] ${item.nao_lidas?'font-semibold text-primary':'text-text-muted'}`}>{dayOf(item.ultima_mensagem_em)==='Hoje'?timeOf(item.ultima_mensagem_em):dateOf(item.ultima_mensagem_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</time>}</div><div className="mt-1 flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs leading-5 text-text-muted">{item.ultima_mensagem||'Comece uma conversa'}</p>{item.nao_lidas>0&&<span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${item.nao_lidas} mensagens não lidas`}>{item.nao_lidas}</span>}</div></div>
  </button></li>)}</ul>;
}

export function ChatConversation({ contact,detail,role,loading,connected,onBack,onSend,onVisible,drafts }) {
  const id=contact?.id;
  const [hasNew,setHasNew]=useState(false);
  const log=useRef(null);
  const atBottom=useRef(true);
  const scrollIntent=useRef(0);
  const markScrollIntent=()=>{scrollIntent.current=Date.now()+1500;};
  const messages=detail?.messages||[];
  const name=role==='professor'?'Equipe gestora':contact?.nome;
  const scrollDown=()=>{if(log.current){log.current.scrollTop=log.current.scrollHeight;atBottom.current=true;scrollIntent.current=0;setHasNew(false);}};
  useEffect(()=>{
    if(!log.current)return undefined;
    const resize=new ResizeObserver(()=>{const element=log.current;if(!element)return;if(atBottom.current)scrollDown();});resize.observe(log.current);
    return()=>resize.disconnect();
  },[id,loading]);
  useLayoutEffect(()=>{
    if(atBottom.current)scrollDown();
    else if(messages.length)setHasNew(true);
  },[messages.length]);
  useEffect(()=>{
    const element=log.current;if(!element||!detail)return undefined;
    const observer=new IntersectionObserver(entries=>{
      if(document.visibilityState==='hidden'||element.closest('[inert]'))return;
      const visible=entries.filter(entry=>entry.isIntersecting).map(entry=>Number(entry.target.dataset.readCut));
      if(visible.length)void onVisible(Math.max(...visible));
    },{root:element,threshold:1});
    const observe=()=>element.querySelectorAll('[data-read-cut]').forEach(marker=>observer.observe(marker));
    const visibility=()=>{observer.disconnect();if(document.visibilityState==='visible'&&!element.closest('[inert]'))observe();};
    const overlay=new MutationObserver(visibility);
    overlay.observe(document.getElementById('root'),{attributes:true,subtree:true,attributeFilter:['inert']});
    visibility();document.addEventListener('visibilitychange',visibility);
    return()=>{observer.disconnect();overlay.disconnect();document.removeEventListener('visibilitychange',visibility);};
  },[detail,onVisible]);
  if(!contact)return <section className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-muted/50 p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 text-primary"><MessageCircle aria-hidden="true" className="!h-9 !w-9"/></span><h2 className="mt-5 text-lg font-semibold text-text-default">Uma conversa resolve</h2><p className="mt-2 max-w-xs text-sm leading-6 text-text-muted">{role==='professor'?'Preparando sua conversa com a equipe gestora…':'Escolha um professor para ler as mensagens ou iniciar uma conversa.'}</p></section>;
  return <section className="relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`Conversa com ${name}`}>
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-3 py-3 sm:px-5">
      {role==='gestor'&&<button type="button" onClick={onBack} aria-label="Voltar às conversas" className="rounded-full p-2 text-text-muted hover:bg-surface-hover lg:hidden"><ArrowLeft className="!h-5 !w-5"/></button>}
      <Avatar name={name}/><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-text-default">{name}</h2><p className="mt-0.5 text-xs text-text-muted">{contact.active?role==='professor'?'Suporte do Projeto Aprendiz':'Professor':'Professor inativo'}</p></div>
    </header>
    <div ref={log} onWheel={markScrollIntent} onTouchMove={markScrollIntent} onKeyDown={event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))markScrollIntent();}} onPointerDown={event=>{if(event.target===event.currentTarget)markScrollIntent();}} onPointerMove={event=>{if(event.buttons===1)markScrollIntent();}} onScroll={event=>{if(Date.now()>scrollIntent.current)return;const el=event.currentTarget;atBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;if(atBottom.current)setHasNew(false);}} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-muted px-3 py-5 sm:px-6" role="log" aria-live="polite" aria-label="Mensagens">
      {loading&&!detail?<div role="status" className="space-y-4" aria-label="Carregando mensagens"><div className="skeleton h-16 w-2/3 rounded-xl"/><div className="skeleton ml-auto h-20 w-2/3 rounded-xl"/></div>:!detail?<p role="status" className="py-10 text-center text-sm text-text-muted">{connected?'Abrindo conversa…':'Aguardando conexão para carregar as mensagens…'}</p>:!messages.length?<div className="flex h-full flex-col items-center justify-center text-center"><MessageCircle aria-hidden="true" className="!h-8 !w-8 text-text-muted"/><p className="mt-3 text-sm font-semibold text-text-default">Comece por um olá</p><p className="mt-1 max-w-xs text-xs leading-5 text-text-muted">Envie sua primeira mensagem. A conversa ficará salva aqui.</p></div>:messages.map((message,index)=>{
        const outgoing=message.author_role===role;
        const day=dayOf(message.created_at);
        return <React.Fragment key={message.id}>
          {(!index||dayOf(messages[index-1].created_at)!==day)&&<div className="mb-5 mt-2 flex justify-center"><span className="rounded-lg border border-border/50 bg-surface px-3 py-1.5 text-[11px] font-medium text-text-muted shadow-sm">{day}</span></div>}
          <article className={`mb-2 flex ${outgoing?'justify-end':'justify-start'}`} aria-label={`Mensagem de ${message.own?'você':message.author_name}`}>
            <div className={`min-w-24 max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[78%] ${outgoing?'rounded-tr-sm bg-primary/10':'rounded-tl-sm border border-border/60 bg-surface'}`}>
              {message.author_role==='gestor'&&!message.own&&<p className="mb-1 text-[11px] font-semibold text-primary">{message.author_name}</p>}
              <ChatMedia attachments={message.anexos} onReady={()=>{if(atBottom.current)scrollDown();}}/>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-default [overflow-wrap:anywhere]">{message.body}</p>
              <div data-read-cut={message.id} className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-text-muted"><time dateTime={message.created_at} title={dateOf(message.created_at).toLocaleString('pt-BR')}>{timeOf(message.created_at)}</time>{outgoing&&<span title={message.read?'Lida':'Enviada'} aria-label={message.read?'Mensagem lida':'Mensagem enviada'}>{message.read?<CheckCheck aria-hidden="true" className="!h-3.5 !w-3.5 text-sky-600 dark:text-sky-400"/>:<Check aria-hidden="true" className="!h-3.5 !w-3.5"/>}</span>}</div>
            </div>
          </article>
        </React.Fragment>;
      })}
    </div>
    {hasNew&&<button type="button" onClick={scrollDown} className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-primary shadow-md">Novas mensagens ↓</button>}
    {contact.active?<ChatComposer id={id} drafts={drafts} disabled={!detail} onSend={onSend} onSent={scrollDown}/>:<p className="shrink-0 border-t border-border bg-surface p-4 text-sm text-text-muted">O histórico permanece disponível. Este professor está inativo.</p>}
  </section>;
}
