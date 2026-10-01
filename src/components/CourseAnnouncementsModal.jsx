import React, { useState } from 'react';
import Modal from './Modal';
import AnnouncementAttachmentPicker from './AnnouncementAttachmentPicker';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import RichTextEditor,{richTextToPlainText} from './RichTextEditor';

const emptyForm=()=>({titulo:'',categoria:'Aviso',conteudo:'',fixarNoTopo:false,solicitarConfirmacao:false,anexos:[]});

export function CourseWallFormModal({course,item,onClose,onSaved,student=false}){
  const [form,setForm]=useState(()=>item?{
    titulo:item.titulo,
    categoria:item.categoria,
    conteudo:item.conteudo||'',
    fixarNoTopo:item.fixado,
    solicitarConfirmacao:item.requerConfirmacao,
    anexos:item.anexos||[],
  }:emptyForm());
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const {showToast}=useToast();
  const setField=(name,value)=>setForm(current=>({...current,[name]:value}));
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const path=`/api/turmas/${course.id}/mural${item?`/${item.id}`:''}`;
      const response=item?await api.put(path,form):await api.post(path,form);
      showToast(response.data.message,'success');
      await onSaved();
    }catch(reason){setError(reason.message);}
    finally{setBusy(false);}
  };
  return <Modal isOpen onClose={onClose} title={`${item?'Editar':'Nova'} publicação — ${course.nome||course.curso}`} maxWidth="max-w-3xl">
    <p className="mb-5 text-sm text-text-muted">{item?'Atualize a publicação já enviada aos alunos.':'Crie uma publicação exclusiva para os alunos desta turma.'}</p>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <form onSubmit={submit}>
      <div>
        <label className="block"><span className="form-label">Título</span><input className="form-control" value={form.titulo} onChange={event=>setField('titulo',event.target.value)} required minLength={3} maxLength={120}/></label>
      </div>
      <div className="mt-4"><label htmlFor="course-wall-content" className="form-label">Mensagem para a turma</label><RichTextEditor id="course-wall-content" value={form.conteudo} onChange={value=>setField('conteudo',value)} label="Mensagem para a turma" placeholder="Compartilhe uma mensagem, atividade ou material com a turma…" disabled={busy} minHeightClass="min-h-32"/></div>
      <div className="mt-4"><AnnouncementAttachmentPicker value={form.anexos} onChange={value=>setField('anexos',value)} disabled={busy}/></div>
      {!student&&<div className="mt-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={form.fixarNoTopo} onChange={event=>setField('fixarNoTopo',event.target.checked)}/><span><strong className="block text-sm">Fixar no topo</strong><span className="text-xs text-text-muted">Mantém esta publicação em destaque.</span></span></label>
      </div>}
      <button className="btn btn-primary mt-5 w-full" disabled={busy||richTextToPlainText(form.conteudo).length<10}>{busy?'Salvando…':item?'Salvar alterações':'Publicar no mural'}</button>
    </form>
  </Modal>;
}
