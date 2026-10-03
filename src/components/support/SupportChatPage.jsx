import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Search, WifiOff } from 'lucide-react';
import api from '../../services/api';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import { ChatContacts, ChatConversation } from './SupportUI';

export default function SupportChatPage({ role }) {
  const [contacts,setContacts]=useState([]);
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState('');
  const [unreadOnly,setUnreadOnly]=useState(false);
  const [loading,setLoading]=useState(true);
  const [connected,setConnected]=useState(true);
  const selectedRef=useRef(null);
  const revisionRef=useRef(null);
  const readRef=useRef(new Map());
  const totalRef=useRef(null);
  const mounted=useRef(true);
  const requestRef=useRef(0);
  const refreshSequence=useRef(0);
  const detailRef=useRef(null);
  const drafts=useRef(new Map());
  const select=useCallback(id=>{
    selectedRef.current=id;
    revisionRef.current=null;
    detailRef.current=null;
    requestRef.current+=1;
    setSelected(id);
    setDetail(null);
  },[]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestRef.current+=1;};},[]);

  const refresh=useCallback(async()=>{
    const generation=requestRef.current;
    const sequence=++refreshSequence.current;
    try{
      const {data}=await api.get('/api/suporte/conversas');
      if(!mounted.current||generation!==requestRef.current||sequence!==refreshSequence.current)return;
      setContacts(data);
      setConnected(true);
      setLoading(false);
      const total=data.filter(item=>item.nao_lidas>0).length;
      if(totalRef.current!==total){totalRef.current=total;window.dispatchEvent(new Event('support:updated'));}
      if(role==='professor'&&!selectedRef.current&&data[0]){select(data[0].id);return;}
      const id=selectedRef.current;
      const contact=data.find(item=>item.id===id);
      if(!id||!contact)return;
      let current=detailRef.current;
      if(revisionRef.current!==contact.revision||!current){
        const response=await api.get(`/api/suporte/conversas/${id}`);
        if(!mounted.current||id!==selectedRef.current||generation!==requestRef.current||sequence!==refreshSequence.current)return;
        current=response.data;
        detailRef.current=current;
        revisionRef.current=contact.revision;
        setDetail(current);
      }
    }catch{
      if(mounted.current&&generation===requestRef.current&&sequence===refreshSequence.current){setConnected(false);setLoading(false);}
    }
  },[role,select]);
  useEffect(()=>{void refresh();},[refresh,selected]);
  useLiveRefresh(refresh,{intervalMs:2000});

  // A leitura só é enviada depois que a conversa visível foi renderizada.
  const markVisible=useCallback(async cut=>{
    const id=selectedRef.current;
    if(!id||document.visibilityState==='hidden'||document.getElementById('root')?.inert||(readRef.current.get(id)||0)>=cut)return;
    try{
      await api.post(`/api/suporte/conversas/${id}/lido`,{last_message_id:cut});
      readRef.current.set(id,Math.max(readRef.current.get(id)||0,cut));
      window.dispatchEvent(new Event('support:updated'));
      void refresh();
    }catch{ /* A próxima leitura visível tentará novamente. */ }
  },[refresh]);
  const send=async(id,message,clientId,files)=>{
    await api.post(`/api/suporte/conversas/${id}/mensagens`,{mensagem:message,client_message_id:clientId,anexos:files});
    if(selectedRef.current===id)revisionRef.current=null;
    await refresh();
  };
  const filtered=contacts.filter(item=>(!unreadOnly||item.nao_lidas>0)&&item.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const currentContact=contacts.find(item=>item.id===selected);
  return <div className="flex h-full min-h-0 flex-col gap-3">
    <div className="flex shrink-0 items-center justify-between gap-3 px-1">
      <div><h1 className="text-xl font-bold text-text-default sm:text-2xl">Suporte</h1><p className="mt-0.5 text-sm text-text-muted">{role==='gestor'?'Converse diretamente com os professores.':'Converse com a equipe gestora.'}</p></div>
      {!connected&&<span role="status" className="flex items-center gap-1.5 text-xs text-text-muted"><WifiOff className="!h-4 !w-4" aria-hidden="true"/>Reconectando…</span>}
    </div>
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {role==='gestor'&&<aside aria-label="Conversas com professores" className={`${selected?'hidden lg:flex':'flex'} w-full min-w-0 flex-col border-r border-border lg:w-[34%] lg:max-w-96 lg:min-w-72`}>
        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-text-default">Conversas</h2><MessageCircle className="!h-5 !w-5 text-text-muted" aria-hidden="true"/></div>
          <label className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5"><Search className="!h-4 !w-4 shrink-0 text-text-muted" aria-hidden="true"/><span className="sr-only">Buscar professor</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar professor" className="min-w-0 flex-1 bg-transparent text-sm text-text-default outline-none"/></label>
          <div className="flex gap-2" aria-label="Filtrar conversas">{['Todas','Não lidas'].map((label,index)=><button key={label} type="button" aria-pressed={unreadOnly===!!index} onClick={()=>setUnreadOnly(!!index)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${unreadOnly===!!index?'bg-primary/10 text-primary':'bg-surface-muted text-text-muted hover:bg-surface-hover'}`}>{label}</button>)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><ChatContacts contacts={filtered} selectedId={selected} onSelect={select} loading={loading}/></div>
      </aside>}
      <div className={`${role==='gestor'&&!selected?'hidden lg:flex':'flex'} min-h-0 min-w-0 flex-1`}>
        <ChatConversation key={selected||'empty'} drafts={drafts} contact={currentContact} detail={detail} role={role} loading={loading||!!selected&&!detail&&connected} connected={connected} onBack={()=>select(null)} onSend={send} onVisible={markVisible}/>
      </div>
    </div>
  </div>;
}
