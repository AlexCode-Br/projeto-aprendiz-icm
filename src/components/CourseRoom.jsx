import React,{useEffect,useState} from 'react';
import {CalendarDays,MapPin,Users,MessageSquare,Paperclip,Info,Bell,CheckCheck,Settings,ExternalLink} from 'lucide-react';
import ClassBanner from './ClassBanner';
import ClassScheduleList from './ClassScheduleList';
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

export default function CourseRoom({course,settings,student=false,initialView='mural',renderView,onConfigure,onSchedule}){
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
  const tabs=[['mural','Mural',MessageSquare],['calendario','Aulas',CalendarDays],['arquivos','Arquivos',Paperclip],['informacoes','Informações',Info],...(student?[['informativos','Informativos',Bell],['frequencia','Frequência',CheckCheck]]:[])];
  const local=<><p className="mt-2 text-sm text-text-muted">{course.local}</p>{settings?.mapsUrl?<a className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm font-semibold hover:text-primary" href={settings.mapsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4"/>Abrir no Google Maps</a>:<p className="mt-3 text-xs text-text-muted">{settings?.endereco||'O professor ainda não informou o link do local.'}</p>}</>;
  return <div className="space-y-5">
    <section className="panel overflow-hidden"><ClassBanner name={course.nome||course.curso} local={course.local} settings={settings}/><nav aria-label="Seções da turma" className="flex overflow-x-auto px-3">{tabs.map(([key,label,Icon])=><button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>setView(key)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors ${view===key?'border-primary text-primary':'border-transparent text-text-muted hover:text-text-default'}`}>{React.createElement(Icon,{className:'h-4 w-4'})}{label}</button>)}</nav></section>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        {view==='mural'&&<CourseCommunity course={course}/>}
        {view==='arquivos'&&<CourseFiles course={course}/>}
        {view==='informacoes'&&<section className="panel space-y-5 p-5"><h2 className="text-lg font-semibold">Informações da turma</h2><div><h3 className="font-semibold">Local das aulas</h3>{local}</div><div><h3 className="mb-2 font-semibold">Dias e horários</h3><ClassScheduleList course={scheduled}/></div>{course.periodo&&<p className="text-sm text-text-muted">Período: {course.periodo}</p>}{onConfigure&&<button className="btn btn-primary" onClick={onConfigure}><Settings className="h-4 w-4"/>Configurar turma</button>}</section>}
        {view==='calendario'&&(student?renderView(view):<section className="panel p-5"><h2 className="mb-4 text-lg font-semibold">Dias e horários de aula</h2><ClassScheduleList course={scheduled}/><button className="btn btn-primary mt-5" onClick={onSchedule}>Ajustar dias e horários</button></section>)}
        {['informativos','frequencia'].includes(view)&&renderView?.(view)}
      </div>
      <aside aria-label="Resumo da turma" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <section className="panel p-5"><button className="flex w-full items-start gap-3 text-left" onClick={()=>setView('calendario')}><CalendarDays className="h-6 w-6 shrink-0"/><span><span className="text-xs font-semibold text-text-muted">Próxima aula</span><strong className="mt-2 block text-base">{scheduleError||next?.descricao||'A definir'}</strong><span className="mt-2 block text-xs text-primary">Ver aulas →</span></span></button></section>
        <section className="panel p-5"><h2 className="flex items-center gap-3 font-semibold"><MapPin className="h-6 w-6"/>Local</h2>{local}</section>
        <section className="panel p-5"><h2 className="flex items-center gap-3 font-semibold"><Users className="h-6 w-6"/>Sua turma</h2>{!student&&<p className="mt-3 text-sm">{Number(course.alunos||0)} {Number(course.alunos||0)===1?'aluno matriculado':'alunos matriculados'}</p>}<p className="mt-3 text-sm leading-relaxed text-text-muted">Um espaço para compartilhar materiais, tirar dúvidas e conversar com sua turma.</p><p className="mt-3 text-xs text-text-muted">Acesso exclusivo aos participantes vinculados.</p></section>
        {onConfigure&&<button className="btn btn-secondary" onClick={onConfigure}><Settings className="h-4 w-4"/>Configurar turma</button>}
      </aside>
    </div>
  </div>;
}
