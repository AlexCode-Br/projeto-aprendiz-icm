import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ConfirmEmail(){
  const {logout}=useAuth();
  const [params]=useSearchParams(),token=params.get('token')||'';
  const [email,setEmail]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api.get('/api/student-email/validate',{params:{token}}).then(({data})=>{if(active)setEmail(data.email);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token]);
  const confirm=async()=>{setBusy(true);setError('');try{await api.post('/api/student-email/confirm',{token});setDone(true);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <AuthLayout title="Confirmar novo e-mail" description="Atualização segura da sua conta de aluno."><div className="space-y-5">{error&&<p className="alert-error" role="alert">{error}</p>}{done?<><p role="status">E-mail confirmado. Use o novo endereço para entrar no Projeto Aprendiz.</p><button className="btn btn-primary w-full" onClick={logout}>Ir para o login</button></>:email?<><p className="break-words text-sm">Confirmar <strong>{email}</strong> como seu e-mail de acesso e contato?</p><button className="btn btn-primary w-full" disabled={busy} onClick={confirm}>{busy?'Confirmando…':'Confirmar alteração'}</button></>:!error&&<p role="status">Verificando link…</p>}</div></AuthLayout>;
}
