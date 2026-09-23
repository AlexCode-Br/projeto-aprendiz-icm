import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import FormCheckbox from './FormCheckbox';

const normalizeIds=value=>[...new Set((Array.isArray(value)?value:[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

const AnnouncementAudienceModal=({isOpen,onClose,onConfirm,options={},loading=false,initialAudience,confirmLabel='Publicar informativo',submittingLabel='Publicando…'})=>{
  const [selected,setSelected]=useState([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false);
  const classes=useMemo(()=>Array.isArray(options.turmas)?options.turmas:[],[options.turmas]);
  const filtered=useMemo(()=>{
    const query=normalizeSearch(search);
    return classes.filter(item=>!query||normalizeSearch(`${item.curso} ${item.local} ${item.professor} ${item.label||''}`).includes(query));
  },[classes,search]);

  useEffect(()=>{
    if(!isOpen)return;
    setSelected(normalizeIds(initialAudience?.turmas));
    setSearch('');setError('');setSubmitting(false);
  },[initialAudience,isOpen]);

  const toggle=id=>{
    const value=Number(id);
    setSelected(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
    setError('');
  };
  const submit=async event=>{
    event.preventDefault();
    if(submitting)return;
    if(!selected.length){setError('Selecione ao menos uma turma.');return;}
    setSubmitting(true);
    try{await onConfirm({todos:false,professores:[],cursos:[],turmas:normalizeIds(selected)});}
    finally{setSubmitting(false);}
  };

  return <Modal isOpen={isOpen} onClose={onClose} title="Escolher turmas" maxWidth="max-w-2xl">
    <form onSubmit={submit} noValidate>
      <p className="text-sm text-text-muted">O informativo aparecerá para os professores responsáveis e para os alunos matriculados nas turmas selecionadas.</p>
      <section className="mt-5 rounded-xl border border-border bg-surface-muted p-4" aria-labelledby="announcement-classes-label">
        <div className="flex items-center justify-between gap-3"><h3 id="announcement-classes-label" className="text-sm font-semibold">Turmas ofertadas</h3><span className="text-xs text-text-muted">{selected.length} selecionada(s)</span></div>
        <label htmlFor="announcement-class-search" className="sr-only">Pesquisar turma</label>
        <input id="announcement-class-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar curso, local ou professor..." className="form-control mt-3"/>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
          {loading&&<div className="space-y-2" role="status" aria-label="Carregando turmas">{[1,2,3].map(item=><div key={item} className="skeleton h-14 rounded-md"/>)}</div>}
          {!loading&&!classes.length&&<p className="py-4 text-sm text-text-muted"><strong className="block text-text-default">Nenhuma turma ativa</strong>Crie uma turma antes de publicar um informativo.</p>}
          {!loading&&classes.length>0&&!filtered.length&&<p className="py-4 text-sm text-text-muted"><strong className="block text-text-default">Nenhuma turma encontrada</strong>Limpe a pesquisa para ver todas.</p>}
          {!loading&&filtered.map(item=>{
            const id=Number(item.id);
            const custom=item.label&&item.label!==item.curso&&item.label!==`${item.curso} — ${item.local}`;
            return <FormCheckbox key={id} id={`announcement-class-${id}`} checked={selected.includes(id)} onChange={()=>toggle(id)} label={<span><strong className="block">{item.curso}{custom?` — ${item.label}`:''}</strong><span className="block text-xs font-normal text-text-muted">{item.local} · {item.professor}</span></span>} className="min-h-14 items-center rounded-lg px-2 py-2 hover:bg-surface-hover"/>;
          })}
        </div>
      </section>
      {error&&<p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        <div className="mt-6 flex border-t border-border pt-5 sm:justify-end"><button type="submit" disabled={loading||submitting||!classes.length} className="btn btn-primary">{loading?'Carregando…':submitting?submittingLabel:confirmLabel}</button></div>
    </form>
  </Modal>;
};

export default AnnouncementAudienceModal;
