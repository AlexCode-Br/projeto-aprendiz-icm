import React,{useEffect,useState} from 'react';
import {CalendarDays,MapPin,Users,MessageSquare,Paperclip,Bell,CheckCheck,Settings,ExternalLink,Pencil} from 'lucide-react';
import ClassBanner from './ClassBanner';
import CourseCommunity from './CourseCommunity';
import AnnouncementAttachments from './AnnouncementAttachments';
import Pagination from './Pagination';
import api from '../services/api';
import {CLASS_WEEKDAYS,nextClassSchedule} from '../../shared/class-schedules.mjs';

function CourseFiles({course}){
  const [data,setData]=useState({items:[],total:0}),[page,setPage]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;setLoading(true);api.get(`/api/turmas/${course.id}/mural`,{params:{page}}).then(({data})=>{if(active){setData(data);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[course.id,page]);
  return <section className="panel p-5"><h2 className="text-lg font-semibold">Arquivos da turma</h2><p className="mt-1 text-sm text-text-muted">Materiais compartilhados no mural. Navegue pelas publicações para consultar os anexos.</p>{error&&<p role="alert" className="mt-4 text-danger">{error}</p>}{loading?<p className="py-6">Carregando arquivos…</p>:<>{data.items.filter(item=>item.anexos.length).map(item=><section key={item.id} className="mt-5"><h3 className="font-semibold">{item.titulo}</h3><p className="text-xs text-text-muted">{item.autor} · {new Date(item.data).toLocaleDateString('pt-BR')}</p><AnnouncementAttachments attachments={item.anexos}/></section>)}{!data.items.some(item=>item.anexos.length)&&<p className="py-8 text-sm text-text-muted">Nenhum anexo neste grupo de publicações.</p>}<Pagination currentPage={page} totalItems={data.total} itemsPerPage={5} onPageChange={setPage}/></>}</section>;
}

export default function CourseRoom({course,settings,student=false,initialView='mural',renderView,onConfigure,onEdit,notice}){
  const [view,setView]=useState(initialView),[scheduled,setScheduled]=useState(course),[scheduleError,setScheduleError]=useState('');
  useEffect(()=>{
    if(!student){setScheduled(course);return;}
    let active=true;
    api.get('/api/aluno/turmas',{params:{turma:course.id,periodo:course.periodId}}).then(({data})=>{
      const item=data.turmas.find(item=>Number(item.id)===Number(course.id));
      if(active)setScheduled({...course,horarios:(item?.horarios||[]).map(slot=>({tipo:slot.data?'data':'semanal',date:slot.data,weekday:CLASS_WEEKDAYS[slot.dia],start_time:`${String(Math.floor(slot.minutos/60)).padStart(2,'0')}:${String(slot.minutos%60).padStart(2,'0')}`}))});
    }).catch(()=>{if(active)setScheduleError('Não foi possível carregar os horários.');});
    return()=>{active=false;};
  },[course,student]);
  const next=nextClassSchedule([scheduled]);
  const tabs=[['mural','Mural',MessageSquare],['arquivos','Arquivos',Paperclip],...(student?[['informativos','Informativos',Bell],['frequencia','Frequência',CheckCheck]]:[])];
  return <div className="w-full min-w-0 space-y-4 sm:space-y-5">
    <section className="panel overflow-hidden">
      <ClassBanner name={course.nome||course.curso} settings={settings} actions={!student&&<>{onEdit&&<button type="button" title="Editar curso" aria-label="Editar curso" className="btn h-10 min-h-10 w-10 min-w-10 border-white/30 bg-black/35 p-0 text-white shadow-sm backdrop-blur-sm hover:border-white/60 hover:bg-black/50 sm:h-auto sm:min-h-11 sm:w-auto sm:border-white/35 sm:bg-surface sm:px-4 sm:py-2.5 sm:text-text-default sm:backdrop-blur-none sm:hover:border-white sm:hover:bg-surface" onClick={onEdit}><Pencil aria-hidden="true" className="h-4 w-4"/><span className="sr-only sm:not-sr-only">Editar curso</span></button>}{onConfigure&&<button type="button" title="Configurar turma" aria-label="Configurar turma" className="btn h-10 min-h-10 w-10 min-w-10 border-white/30 bg-black/35 p-0 text-white shadow-sm backdrop-blur-sm hover:border-white/60 hover:bg-black/50 sm:h-auto sm:min-h-11 sm:w-auto sm:border-white/35 sm:bg-surface sm:px-4 sm:py-2.5 sm:text-text-default sm:backdrop-blur-none sm:hover:border-white sm:hover:bg-surface" onClick={onConfigure}><Settings aria-hidden="true" className="h-4 w-4"/><span className="sr-only sm:not-sr-only">Configurar turma</span></button>}</>}/>
      <dl aria-label="Resumo da turma" className={`grid grid-cols-2 border-b border-border ${student?'sm:grid-cols-2':'sm:grid-cols-3'}`}>
        <div className="flex min-w-0 gap-2.5 border-r border-border p-3 sm:gap-3 sm:p-5"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5"/><div className="min-w-0"><dt className="text-[0.68rem] text-text-muted sm:text-xs">Próxima aula</dt><dd className="mt-1 break-words text-xs font-semibold sm:text-sm">{scheduleError||next?.descricao||'A definir'}</dd></div></div>
        <div className={`flex min-w-0 gap-2.5 p-3 sm:gap-3 sm:p-5 ${student?'':'sm:border-r sm:border-border'}`}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5"/><div className="min-w-0"><dt className="text-[0.68rem] text-text-muted sm:text-xs">Local ou modalidade</dt><dd className="mt-1 break-words text-xs font-semibold sm:text-sm">{settings?.mapsUrl?<a className="inline-flex min-h-6 items-center gap-1.5 text-primary underline-offset-4 hover:underline" href={settings.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${course.local} no Google Maps (nova aba)`}>{course.local}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/></a>:course.local||'A definir'}</dd></div></div>
        {!student&&<div className="col-span-2 flex min-w-0 items-center gap-2.5 border-t border-border p-3 sm:col-span-1 sm:items-start sm:gap-3 sm:border-t-0 sm:p-5"><Users aria-hidden="true" className="h-4 w-4 shrink-0 text-primary sm:mt-0.5 sm:h-5 sm:w-5"/><div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:block"><dt className="text-[0.68rem] text-text-muted sm:text-xs">Participantes</dt><dd className="text-xs font-semibold sm:mt-1 sm:text-sm">{Number(course.alunos||0)} {Number(course.alunos||0)===1?'aluno matriculado':'alunos matriculados'}</dd></div></div>}
      </dl>
      <nav aria-label="Seções da turma" className="grid grid-cols-2 px-2 sm:flex sm:flex-wrap sm:px-3">{tabs.map(([key,label,Icon])=><button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>setView(key)} className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-5 ${view===key?'border-primary text-primary':'border-transparent text-text-muted hover:bg-surface-hover hover:text-text-default'}`}>{React.createElement(Icon,{className:'h-4 w-4 shrink-0','aria-hidden':true})}{label}</button>)}</nav>
    </section>
    {notice}
      <div className="min-w-0">
        {view==='mural'&&<CourseCommunity course={course}/>}
        {view==='arquivos'&&<CourseFiles course={course}/>}
        {['informativos','frequencia'].includes(view)&&renderView?.(view)}
      </div>
  </div>;
}
