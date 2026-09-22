import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck, FileText, Pencil, Pin, Trash2 } from 'lucide-react';
import Modal from './Modal';
import Pagination from './Pagination';
import FormSelect from './FormSelect';
import AnnouncementAttachmentPicker from './AnnouncementAttachmentPicker';
import ConfirmationModal from './ConfirmationModal';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

const categories=['Aviso','Material de aula','Alteração de horário','Evento ou ensaio','Atividade'];
const emptyForm=()=>({titulo:'',categoria:'Aviso',conteudo:'',fixarNoTopo:false,solicitarConfirmacao:false,anexos:[]});
const plainText=value=>String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

export default function CourseAnnouncementsModal({course,onClose}){
  const [items,setItems]=useState([]),[form,setForm]=useState(emptyForm),[editingId,setEditingId]=useState(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[page,setPage]=useState(1),[deleting,setDeleting]=useState(null);
  const {showToast}=useToast();
  const load=useCallback(async()=>{
    setLoading(true);
    try{const {data}=await api.get(`/api/professores/me/turmas/${course.id}/mural`);setItems(data.items);setError('');}
    catch(reason){setError(reason.message);}
    finally{setLoading(false);}
  },[course.id]);
  useEffect(()=>{void load();},[load]);
  const setField=(name,value)=>setForm(current=>({...current,[name]:value}));
  const reset=()=>{setForm(emptyForm());setEditingId(null);setError('');};
  const edit=item=>{
    setEditingId(item.id);
    setForm({titulo:item.titulo,categoria:item.categoria,conteudo:plainText(item.conteudo),fixarNoTopo:item.fixado,solicitarConfirmacao:item.requerConfirmacao,anexos:item.anexos||[]});
    setError('');
  };
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const path=`/api/professores/me/turmas/${course.id}/mural${editingId?`/${editingId}`:''}`;
      const response=editingId?await api.put(path,form):await api.post(path,form);
      showToast(response.data.message,'success');reset();setPage(1);await load();
    }catch(reason){setError(reason.message);}
    finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!deleting)return;
    setBusy(true);setError('');
    try{
      const {data}=await api.delete(`/api/professores/me/turmas/${course.id}/mural/${deleting.id}`);
      showToast(data.message,'success');if(editingId===deleting.id)reset();setDeleting(null);await load();
    }catch(reason){setError(reason.message);setDeleting(null);}
    finally{setBusy(false);}
  };
  return <>
    <Modal isOpen onClose={onClose} title={`Mural da turma — ${course.nome}`} maxWidth="max-w-4xl">
      <p className="mb-5 text-sm text-text-muted">Publique avisos, materiais e atividades para os alunos de {course.nome} — {course.local}. Eles serão notificados automaticamente.</p>
      {error&&<p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <form className="rounded-2xl border border-border bg-surface-muted p-4 sm:p-5" onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{editingId?'Editar publicação':'Nova publicação'}</h3>{editingId&&<button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={reset}>Cancelar edição</button>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="form-label">Título</span><input className="form-control" value={form.titulo} onChange={event=>setField('titulo',event.target.value)} required minLength={3} maxLength={120}/></label>
          <label className="block"><span className="form-label">Categoria</span><FormSelect value={form.categoria} options={categories} isClearable={false} isSearchable={false} onChange={event=>setField('categoria',event.target.value)}/></label>
        </div>
        <label className="mt-4 block"><span className="form-label">Mensagem para a turma</span><textarea className="form-control min-h-32" value={form.conteudo} onChange={event=>setField('conteudo',event.target.value)} required minLength={10} maxLength={5000}/></label>
        <div className="mt-4"><AnnouncementAttachmentPicker value={form.anexos} onChange={value=>setField('anexos',value)} disabled={busy}/></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={form.fixarNoTopo} onChange={event=>setField('fixarNoTopo',event.target.checked)}/><span><strong className="block text-sm">Fixar no topo</strong><span className="text-xs text-text-muted">Mantém esta publicação em destaque.</span></span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={form.solicitarConfirmacao} onChange={event=>setField('solicitarConfirmacao',event.target.checked)}/><span><strong className="block text-sm">Solicitar confirmação de leitura</strong><span className="text-xs text-text-muted">O aluno precisará confirmar que leu.</span></span></label>
        </div>
        <button className="btn btn-primary mt-5 w-full" disabled={busy}>{busy?'Salvando…':editingId?'Salvar alterações':'Publicar no mural'}</button>
      </form>
      <section className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Publicações da turma</h3><p className="text-xs text-text-muted">Acompanhe o alcance das mensagens que exigem confirmação.</p></div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">{items.length}</span></div>
        {loading?<p className="py-8 text-center text-sm text-text-muted">Carregando mural…</p>:items.length?<ul className="mt-3 space-y-3">{items.slice((page-1)*5,page*5).map(item=><li className="rounded-xl border border-border p-4" key={item.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{item.categoria}</span>{item.fixado&&<span className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted"><Pin className="h-3.5 w-3.5" aria-hidden="true"/>Fixado</span>}</div><h4 className="mt-2 break-words font-semibold">{item.titulo}</h4></div><div className="flex shrink-0 gap-1"><button type="button" className="icon-button" onClick={()=>edit(item)} aria-label={`Editar ${item.titulo}`}><Pencil className="h-4 w-4" aria-hidden="true"/></button><button type="button" className="icon-button text-danger" onClick={()=>setDeleting(item)} aria-label={`Excluir ${item.titulo}`}><Trash2 className="h-4 w-4" aria-hidden="true"/></button></div></div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-text-muted">{plainText(item.conteudo)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted"><time>{new Date(item.data).toLocaleString('pt-BR')}</time>{item.anexos.length>0&&<span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" aria-hidden="true"/>{item.anexos.length} {item.anexos.length===1?'anexo':'anexos'}</span>}{item.requerConfirmacao&&<span className="inline-flex items-center gap-1 font-semibold text-primary"><CheckCheck className="h-3.5 w-3.5" aria-hidden="true"/>{item.confirmacoes} de {item.totalAlunos} confirmaram</span>}</div>
        </li>)}</ul>:<p className="py-8 text-center text-sm text-text-muted">O mural ainda não possui publicações.</p>}
        <Pagination currentPage={page} totalItems={items.length} itemsPerPage={5} onPageChange={setPage}/>
      </section>
    </Modal>
    <ConfirmationModal isOpen={Boolean(deleting)} onClose={()=>setDeleting(null)} onConfirm={remove} title="Excluir publicação" message={`A publicação “${deleting?.titulo||''}” será removida do mural e deixará de aparecer para os alunos.`} confirmLabel="Excluir publicação" loading={busy}/>
  </>;
}
