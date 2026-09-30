import React, { useState } from 'react';
import PasswordInput from './PasswordInput';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function StudentEmailChange(){
  const {user}=useAuth();
  const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try{const {data}=await api.post('/api/student-email/request',{email,password});setMessage(data.message);setPassword('');}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  return <div className="mt-6 border-t border-border pt-5"><h3 className="font-semibold">E-mail de acesso e contato</h3><p className="mt-1 break-all text-sm text-text-muted">{user.email}</p><button className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10 hover:underline" type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Ocultar alteração de e-mail':'Alterar e-mail'}</button>{open&&<form onSubmit={submit} className="mt-4 space-y-4"><p className="text-sm text-text-muted">O endereço atual continua válido até você confirmar a alteração pelo link enviado ao novo e-mail.</p><label className="block"><span className="form-label">Novo e-mail</span><input type="email" autoComplete="email" className="form-control" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label><label className="block"><span className="form-label">Senha atual</span><PasswordInput className="form-control" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>{error&&<p className="text-danger text-sm" role="alert">{error}</p>}{message&&<p className="text-success text-sm" role="status">{message}</p>}<button className="btn btn-secondary w-full sm:w-auto" disabled={busy}>{busy?'Enviando…':'Enviar confirmação'}</button></form>}</div>;
}
