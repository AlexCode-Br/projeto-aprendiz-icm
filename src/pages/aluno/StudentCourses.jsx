import React from 'react';
import { useSearchParams } from 'react-router-dom';
import StudentPortal from './StudentPortal';

export default function StudentCourses() {
  const [params,setParams]=useSearchParams();
  const view=['calendario','frequencia'].includes(params.get('view'))?params.get('view'):'turmas';
  return <div className="space-y-5"><nav aria-label="Consulta dos meus cursos" className="flex flex-wrap gap-2">
    {[['turmas','Meus cursos'],['calendario','Calendário'],['frequencia','Frequência']].map(([key,label])=><button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>setParams(key==='turmas'?{}:{view:key})} className={`btn ${view===key?'btn-primary':'btn-secondary'}`}>{label}</button>)}
  </nav><StudentPortal key={view} page={view}/></div>;
}
