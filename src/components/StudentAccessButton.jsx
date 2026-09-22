import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function StudentAccessButton({studentId}) {
  const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const {showToast}=useToast();
  useEffect(()=>{
    let active=true;
    api.get(`/api/student-access/${studentId}`).then(({data})=>{if(active)setStatus(data);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[studentId]);
  const invite=async()=>{
    setBusy(true);
    try{const {data}=await api.post(`/api/student-access/${studentId}`,{});setStatus(current=>({...current,...data}));showToast(data.message,'success');}
    catch(e){showToast(e.message,'error');}
    finally{setBusy(false);}
  };
  return <section className="mt-5 border-t border-border pt-4"><h3 className="text-sm font-semibold">Acesso do aluno</h3>{error?<p className="mt-2 text-sm text-danger" role="alert">{error}</p>:status?.active?<p className="mt-2 text-sm text-text-muted">Conta ativada. O aluno pode usar “Esqueci a senha” para recuperar o acesso.</p>:<><p className="mt-2 text-xs text-text-muted">{status?.pending?'O convite foi enviado e permanece válido por 48 horas. Você pode reenviá-lo para gerar um novo link.':status?.hasInvite?'O último convite expirou. Envie um novo link de acesso ao aluno.':'O convite permite criar uma conta exclusiva para consultar os próprios dados. Confirme que o e-mail cadastrado pertence ao aluno.'}</p><button className="btn btn-secondary mt-3" disabled={busy||!status?.hasEmail} onClick={invite}>{busy?'Enviando…':status?.hasInvite?'Reenviar convite':'Enviar convite de acesso'}</button>{status&&!status.hasEmail&&<p className="mt-2 text-xs text-text-muted">Cadastre o e-mail do aluno primeiro.</p>}</>}</section>;
}
