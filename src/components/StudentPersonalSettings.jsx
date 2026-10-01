import React, { useEffect, useState } from 'react';
import FormSelect from './FormSelect';
import FormSwitch from './FormSwitch';
import StudentEmailChange from './StudentEmailChange';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function StudentPersonalSettings(){
  const [profile,setProfile]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const {showToast}=useToast();
  useEffect(()=>{let active=true;api.get('/api/aluno/perfil').then(({data})=>{if(active)setProfile({...data,instrumento:Boolean(data.instrumento),guardian_consent:Boolean(data.guardian_consent_at)});}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const change=event=>setProfile(p=>({...p,[event.target.name]:event.target.value}));
  const save=async event=>{
    event.preventDefault();setSaving(true);setError('');
    const {telefone,church_id,classe,instrumento,guardian_name,guardian_phone,guardian_consent}=profile;
    try{const{data}=await api.put('/api/aluno/perfil',{telefone,church_id,classe,instrumento,guardian_name,guardian_phone,guardian_consent});showToast(data.message,'success');}
    catch(e){setError(e.message);}
    finally{setSaving(false);}
  };
  return <section className="panel p-5 sm:p-7"><h2 className="text-lg font-bold">Meus dados pessoais</h2><p className="mt-1 text-sm text-text-muted">Mantenha seu contato e cadastro atualizados. Suas matrículas não serão alteradas.</p>{error&&<p className="mt-4 text-danger" role="alert">{error}</p>}{profile?<><form onSubmit={save} className="mt-5 space-y-5"><div className="grid gap-5 sm:grid-cols-2">
    <label className="block"><span className="form-label">Telefone com DDD</span><input name="telefone" type="tel" autoComplete="tel-national" value={profile.telefone||''} onChange={change} required className="form-control" maxLength={30}/></label>
    <div><label className="form-label" htmlFor="student-church">Igreja</label><FormSelect id="student-church" name="church_id" value={profile.church_id} options={profile.churches.map(ch=>({value:ch.id,label:ch.nome}))} onChange={change} isClearable={false}/><p className="mt-1 text-xs text-text-muted">{profile.churches.length} igrejas disponíveis. Digite para pesquisar ou role a lista.</p></div>
    <div><label className="form-label" htmlFor="student-age-group">Classe</label><FormSelect id="student-age-group" name="classe" value={profile.classe} options={['Adolescente','Jovem','Senhora','Varão']} onChange={change} isClearable={false}/></div>
    <div className="flex items-center"><FormSwitch checked={profile.instrumento} onChange={e=>setProfile(p=>({...p,instrumento:e.target.checked}))} label="Possuo instrumento"/></div>
    {profile.classe==='Adolescente'&&<><label><span className="form-label">Nome do responsável</span><input className="form-control" name="guardian_name" value={profile.guardian_name||''} onChange={change} required maxLength={100}/></label><label><span className="form-label">Telefone do responsável</span><input className="form-control" type="tel" name="guardian_phone" value={profile.guardian_phone||''} onChange={change} required maxLength={30}/></label><label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={profile.guardian_consent} onChange={e=>setProfile(p=>({...p,guardian_consent:e.target.checked}))} required/>Tenho autorização do responsável legal para manter estes dados no sistema.</label></>}
    </div><button className="btn btn-primary w-full sm:w-auto" disabled={saving}>{saving?'Salvando…':'Salvar dados pessoais'}</button></form><StudentEmailChange/></>:!error&&<p className="mt-5" role="status">Carregando dados pessoais…</p>}</section>;
}
