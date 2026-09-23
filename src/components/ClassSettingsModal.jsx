import React,{useEffect,useState} from 'react';
import Modal from './Modal';
import ClassBanner from './ClassBanner';
import BannerCropper from './BannerCropper';
import ClassScheduleList from './ClassScheduleList';
import ClassScheduleModal from './ClassScheduleModal';
import api from '../services/api';
import { googleMapsLink } from '../../shared/google-maps-link.mjs';

const wallModes=[
  {value:'post_and_comment',title:'Alunos publicam e comentam',description:'Participação completa no mural, com moderação do professor.'},
  {value:'comment_only',title:'Alunos comentam e reagem',description:'Somente o professor cria publicações; alunos participam das conversas.'},
  {value:'teacher_only',title:'Somente o professor publica',description:'Alunos podem apenas visualizar o conteúdo da turma.'},
];

export default function ClassSettingsModal({course,onClose,onSaved}){
  const [form,setForm]=useState(null),[source,setSource]=useState(undefined),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [scheduleCourse,setScheduleCourse]=useState(null),[editingSchedule,setEditingSchedule]=useState(false);
  const [cropImage,setCropImage]=useState(null);
  useEffect(()=>{let active=true;api.get('/professores/meus-cursos').then(({data})=>{if(active)setScheduleCourse(data.find(item=>Number(item.id)===Number(course.id)));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[course.id]);
  useEffect(()=>{let active=true;api.get(`/api/turmas/${course.id}/configuracao`).then(({data})=>{if(active)setForm(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[course.id]);
  const choose=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setError('');setBusy(true);
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Escolha uma imagem PNG, JPG ou WEBP de até 5 MB.');
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const image=canvas.toDataURL('image/jpeg',0.82);
      if(image.length>1350000)throw new Error('Escolha uma imagem menor para o banner.');
      setCropImage({source:image,initial:{x:50,y:50,zoom:100},isNew:true});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const save=async event=>{
    event.preventDefault();
    if(form.mapsUrl?.trim()&&!googleMapsLink(form.mapsUrl)){setError('Cole um link válido do Google Maps, usando a opção Compartilhar no mapa.');return;}
    setBusy(true);setError('');
    try{await api.put(`/api/turmas/${course.id}/configuracao`,{mapsUrl:form.mapsUrl||'',x:form.x,y:form.y,zoom:form.zoom,permissaoMural:form.permissaoMural,...(source!==undefined?{banner:source}:{})});await onSaved();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  if(editingSchedule)return <ClassScheduleModal course={scheduleCourse} onClose={()=>setEditingSchedule(false)} onSave={async horarios=>{const {data}=await api.put(`/api/professores/me/turmas/${course.id}/horarios`,{horarios});setScheduleCourse(current=>({...current,horarios:data.horarios}));window.dispatchEvent(new Event('class-schedules:updated'));}}/>;
  if(cropImage)return <BannerCropper source={cropImage.source} initial={cropImage.initial} onClose={()=>setCropImage(null)} onApply={crop=>{if(cropImage.isNew)setSource(cropImage.source);setForm(current=>({...current,banner:cropImage.source,...crop}));setCropImage(null);}}/>;
  return <Modal isOpen onClose={onClose} title={`Configurar turma — ${course.nome||course.curso}`} maxWidth="max-w-4xl">
    {error&&<p role="alert" className="mb-4 text-danger">{error}</p>}
    {!form?<p role="status">Carregando configuração…</p>:<form onSubmit={save} className="space-y-5">
      <p className="text-sm text-text-muted">Informe o local, personalize o banner e defina como os alunos participam. Você pode alterar estas opções depois.</p>
      <section className="rounded-xl border border-border p-4"><h3 className="mb-2 font-semibold">Dias e horários de aula</h3>{scheduleCourse?<><div className="text-sm"><ClassScheduleList course={scheduleCourse}/></div><button type="button" className="btn btn-secondary mt-3" disabled={busy} onClick={()=>setEditingSchedule(true)}>Ajustar dias e horários</button></>:<p className="text-sm text-text-muted">Carregando horários…</p>}</section>
      <fieldset className="rounded-xl border border-border p-4"><legend className="px-1 font-semibold">Participação no mural</legend><p className="mb-3 text-sm text-text-muted">Esta regra é aplicada no servidor a todas as publicações, comentários e curtidas da turma.</p><div className="grid gap-2">{wallModes.map(mode=><label key={mode.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${form.permissaoMural===mode.value?'border-primary bg-primary/5':'border-border bg-surface-muted'}`}><input type="radio" name="wall-mode" className="mt-1 h-4 w-4 accent-primary" checked={form.permissaoMural===mode.value} onChange={()=>setForm({...form,permissaoMural:mode.value})}/><span><strong className="block text-sm">{mode.title}</strong><span className="text-xs text-text-muted">{mode.description}</span></span></label>)}</div></fieldset>
      <div><label className="block"><span className="form-label">Link do Google Maps (opcional)</span><input type="url" className="form-control" maxLength={2000} value={form.mapsUrl||''} onChange={e=>setForm({...form,mapsUrl:e.target.value})} placeholder="https://maps.app.goo.gl/..."/></label><p className="mt-2 text-xs text-text-muted">No Google Maps, escolha o local das aulas, toque em Compartilhar e copie o link.</p>{googleMapsLink(form.mapsUrl)&&<a className="mt-2 inline-block text-sm font-semibold text-primary" href={googleMapsLink(form.mapsUrl)} target="_blank" rel="noopener noreferrer">Conferir local no Google Maps</a>}</div>
      <ClassBanner name={course.nome||course.curso} local={course.local} settings={form}/>
      <div className="flex flex-wrap items-center gap-3"><label className="btn btn-secondary cursor-pointer">Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={choose}/></label>{form.banner&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setSource(null);setForm({...form,banner:'',x:50,y:50,zoom:100});}}>Usar fundo vermelho</button>}</div>
      {form.banner&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setCropImage({source:form.banner,initial:form,isNew:false})}>Ajustar recorte da imagem</button>}
      <p className="text-xs text-text-muted">Banner panorâmico na proporção 6,4:1. A prévia mostra o recorte que será exibido.</p>
      <button className="btn btn-primary w-full" disabled={busy}>{busy?'Salvando…':'Salvar configuração'}</button>
    </form>}
  </Modal>;
}
