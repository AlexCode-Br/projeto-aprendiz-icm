import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function StudentAudienceModal({announcement,onClose}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const {showToast}=useToast();
  useEffect(()=>{
    let active=true;
    api.get(`/api/student-audiences/${announcement.id}`).then(({data})=>{if(active)setData(data);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[announcement.id]);
  const save=async()=>{
    setSaving(true);setError('');
    try{const response=await api.put(`/api/student-audiences/${announcement.id}`,{mode:data.mode,selected:data.selected});showToast(response.data.message,'success');onClose();}
    catch(e){setError(e.message);}
    finally{setSaving(false);}
  };
  return <Modal isOpen onClose={onClose} title="Compartilhar com alunos" footer={<button className="btn btn-primary w-full" disabled={!data||saving} onClick={save}>{saving?'Salvando…':'Salvar público de alunos'}</button>}><div className="space-y-4"><p className="text-sm text-text-muted">{announcement.titulo}. O público dos professores não será alterado. Compartilhe apenas conteúdo apropriado para os alunos.</p>{error&&<p role="alert" className="text-danger">{error}</p>}{data?<><label className="block"><span className="form-label">Público</span><FormSelect isClearable={false} value={data.mode} options={[{value:'none',label:'Não compartilhar com alunos'},{value:'all',label:'Todos os alunos com acesso'},{value:'classes',label:'Alunos de turmas específicas'}]} onChange={event=>setData({...data,mode:event.target.value})}/></label>{data.mode==='classes'&&<label className="block"><span className="form-label">Turmas</span><FormSelect isMulti value={data.selected} options={data.classes.map(c=>({value:c.id,label:`${c.curso} — ${c.local} (#${c.id})`}))} onChange={event=>setData({...data,selected:event.target.value})}/></label>}<p className="text-xs text-text-muted">Informativos agendados só ficam visíveis na data de publicação.</p></>:<p role="status">Carregando público…</p>}</div></Modal>;
}
