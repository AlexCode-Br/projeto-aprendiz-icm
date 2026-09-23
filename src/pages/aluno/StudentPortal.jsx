import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import PageSkeleton from '../../components/PageSkeleton';
import Pagination from '../../components/Pagination';
import FormSelect from '../../components/FormSelect';
import AnnouncementDetailModal from '../../components/AnnouncementDetailModal';
import { useToast } from '../../contexts/ToastContext';

const titles={dashboard:'Visão geral',perfil:'Meus dados',calendario:'Calendário de aulas',frequencia:'Minha frequência',mural:'Mural da turma',informativos:'Informativos',notificacoes:'Notificações'};
const dateLabel=value=>String(value).slice(0,10).split('-').reverse().join('/');
const today=new window.Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const Empty=({children})=><p className="py-8 text-center text-sm text-text-muted">{children}</p>;

export default function StudentPortal({page,courseId='',initialPeriod=''}) {
  const {user}=useContext(AuthContext),{showToast}=useToast();
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [period,setPeriod]=useState(initialPeriod),[month,setMonth]=useState(today.slice(0,7)),[current,setCurrent]=useState(1),[revision,setRevision]=useState(0),[selected,setSelected]=useState(null),[confirming,setConfirming]=useState(false);
  const lastQuery=useRef('');
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const key=JSON.stringify([page,period,month,current,courseId]);
      if(lastQuery.current!==key)setLoading(true);
      lastQuery.current=key;setError('');
      try {
        let value;
        if (page==='dashboard') {
          const results=await Promise.all(['turmas','calendario','nao-lidos'].map(path=>api.get(`/api/aluno/${path}`)));
          value={...results[0].data,aulas:results[1].data.aulas,avisos:results[2].data.total,avisoTurmaId:results[2].data.turmaId,avisoOrigem:results[2].data.origem,avisosPorTurma:results[2].data.porTurma||[]};
        } else {
          const endpoint=page==='mural'?'informativos':page;
          value=(await api.get(`/api/aluno/${endpoint}`,{params:{...(period?{periodo:period}:{}),mes:month,page:current,...(courseId?{turma:courseId}:{}),...(page==='mural'?{origem:'mural'}:page==='informativos'&&courseId?{origem:'gestao'}:{})}})).data;
        }
        if(active)setData(value);
      }catch(e){if(active)setError(e.message);}
      finally{if(active)setLoading(false);}
    };
    void load();return()=>{active=false;};
  },[page,period,month,current,revision,courseId]);
  useEffect(()=>{
    const refresh=()=>setRevision(value=>value+1);
    window.addEventListener('focus',refresh);
    return()=>window.removeEventListener('focus',refresh);
  },[]);
  const markRead=async item=>{
    if(item.lido)return true;
    try {
      await api.post(`/api/aluno/informativos/${item.id}/lido`);
      const update=row=>row.id===item.id?{...row,lido:true,confirmado:true}:row;
      setData(value=>({...value,items:value.items.map(update)}));
      setSelected(current=>current?.id===item.id?{...current,lido:true,confirmado:true}:current);
      window.dispatchEvent(new Event('announcements:updated'));
      return true;
    }catch(e){showToast(e.message,'error');return false;}
  };
  const open=async item=>{
    setSelected({...item,data_publicacao:item.data});
    if(!item.requerConfirmacao)await markRead(item);
  };
  const confirmRead=async()=>{
    if(!selected||selected.confirmado)return;
    setConfirming(true);
    try{if(await markRead(selected))showToast('Leitura confirmada.','success');}
    finally{setConfirming(false);}
  };
  const moveMonth=offset=>{
    const [y,m]=month.split('-').map(Number),next=new Date(Date.UTC(y,m-1+offset,1));
    setMonth(next.toISOString().slice(0,7));
  };
  if(loading)return <PageSkeleton />;
  if(error)return <div className="panel p-6"><h1 className="page-title">{titles[page]}</h1><p className="my-5 text-danger" role="alert">{error}</p><button className="btn btn-secondary" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button></div>;
  const academic=['calendario','frequencia'].includes(page);
  const courses=data?.turmas||[];
  const nextLessons=(data?.aulas||[]).filter(item=>item.data>=today).slice(0,5);
  const conflictSlots=[...new Map((data?.aulas||[]).filter(item=>item.conflito&&(page!=='dashboard'||item.data>=today)).map(item=>[`${item.data}/${item.hora}`,item])).values()];
  const unreadTarget=data?.avisoTurmaId?`/aluno/cursos/${data.avisoTurmaId}?view=${data.avisoOrigem==='mural'?'mural':'informativos'}`:'/aluno/dashboard';
  const unreadByClass=new Map((data?.avisosPorTurma||[]).map(item=>[Number(item.turmaId),item]));
  const courseSummaries=courses.map(course=>({
    ...course,
    proximaAula:(data?.aulas||[]).find(item=>Number(item.turmaId)===Number(course.id)&&item.data>=today)||null,
    avisos:unreadByClass.get(Number(course.id))||{total:0,origem:'mural'},
  }));
  const dashboardCards=[
    {Icon:BookOpen,label:'Meus cursos',value:courses.length},
    {Icon:CalendarDays,label:'Aulas neste mês',value:data?.aulas?.length||0},
    {Icon:Bell,label:'Avisos não lidos',value:data?.avisos||0,to:unreadTarget},
  ];
  return <div className="space-y-6 pb-8">
    {!courseId&&<header><h1 className="page-title">{titles[page]}</h1><p className="page-subtitle">{page==='dashboard'?`Olá, ${user.nome}. Acompanhe sua jornada no Projeto Aprendiz.`:'Informações vinculadas exclusivamente à sua matrícula.'}</p></header>}
    {academic&&!courseId&&data.periods.length>0&&<div className="panel p-4 sm:max-w-md"><label className="form-label" htmlFor="student-period">Período letivo</label><FormSelect id="student-period" value={period||data.periodId} isClearable={false} options={data.periods.map(item=>({value:String(item.id),label:item.label}))} onChange={event=>{setPeriod(String(event.target.value));setCurrent(1);}} /></div>}
    {page==='dashboard'&&<>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {dashboardCards.map(({Icon,label,value,to})=>{
          const content=<>{React.createElement(Icon,{'aria-hidden':true,className:'mb-4 h-6 w-6 text-primary'})}<p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></>;
          const className=`panel min-w-0 p-4 ${label==='Avisos não lidos'?'col-span-2 lg:col-span-1':''}`;
          return to?<Link key={label} to={to} className={`${className} transition-colors hover:bg-surface-hover`}>{content}</Link>:<div key={label} className={className}>{content}</div>;
        })}
      </div>
      {conflictSlots.length>0&&<div className="alert-warning" role="alert"><div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0"/><div><strong className="block text-text-default">Há aulas no mesmo horário</strong><p className="mt-1 text-sm">Confira {conflictSlots.map(item=>`${dateLabel(item.data)} às ${item.hora}`).join('; ')} e procure a coordenação para ajustar sua matrícula.</p></div></div></div>}
      <section><div className="mb-3"><h2 className="text-lg font-semibold">Acompanhamento por curso</h2><p className="mt-1 text-sm text-text-muted">Frequência, aulas e avisos permanecem separados para cada matrícula.</p></div><div className="grid gap-4 md:grid-cols-2">{courseSummaries.map(course=>{
        const frequency=course.frequencia?.percentual;
        const courseName=course.label&&course.label!==course.curso&&course.label!==`${course.curso} — ${course.local}`?course.label:course.curso;
        const noticeTarget=`/aluno/cursos/${course.id}?view=${course.avisos.origem==='informativos'?'informativos':'mural'}`;
        return <article key={course.id} className="panel flex min-w-0 flex-col p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{course.status==='ativa'?'Matrícula ativa':'Matrícula concluída'}</p><h3 className="mt-2 break-words text-lg font-bold">{courseName}</h3><p className="mt-1 text-sm text-text-muted">{course.local}</p></div><dl className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Frequência</dt><dd className="mt-1 text-lg font-bold">{frequency===null||frequency===undefined?'Sem chamadas':`${frequency}%`}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Avisos novos</dt><dd className="mt-1 text-lg font-bold">{course.avisos.total}</dd></div><div className="col-span-2 rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Próxima aula</dt><dd className="mt-1 font-semibold">{course.proximaAula?`${dateLabel(course.proximaAula.data)} às ${course.proximaAula.hora}`:'Nenhuma neste mês'}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"><Link className="btn btn-primary flex-1" to={`/aluno/cursos/${course.id}`}>Abrir curso</Link><Link className="btn btn-secondary flex-1" to={`/aluno/cursos/${course.id}?view=frequencia`}>Ver frequência</Link>{course.avisos.total>0&&<Link className="w-full rounded-lg px-3 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/10" to={noticeTarget}>Ver {course.avisos.total===1?'aviso novo':`${course.avisos.total} avisos novos`}</Link>}</div></article>;
      })}</div>{!courseSummaries.length&&<div className="panel"><Empty>Você não possui cursos vinculados no período atual.</Empty></div>}</section>
      <section className="panel p-5"><h2 className="text-lg font-semibold">Próximas aulas neste mês</h2>{nextLessons.length?<ul className="mt-4 divide-y divide-border">{nextLessons.map(item=><li key={item.id}><Link to={`/aluno/cursos/${item.turmaId}?view=calendario`} className="flex flex-wrap justify-between gap-2 rounded-lg py-4 transition-colors hover:bg-surface-hover sm:px-2"><span><strong>{item.curso}</strong><span className="block text-sm text-text-muted">{item.local}</span></span><span className="text-right text-sm">{dateLabel(item.data)} · {item.hora}{item.conflito&&<span className="mt-1 block text-xs font-semibold text-warning">Conflito de horário</span>}</span></Link></li>)}</ul>:<Empty>Nenhuma próxima aula cadastrada neste mês.</Empty>}</section>
    </>}
    {page==='calendario'&&<section className="panel p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap"><button className="icon-button shrink-0" aria-label="Mês anterior" onClick={()=>moveMonth(-1)} disabled={month==='2000-01'}><ChevronLeft/></button><label className="order-first min-w-0 w-full sm:order-none sm:w-auto sm:flex-1"><span className="sr-only">Mês das aulas</span><input type="month" className="form-control" min="2000-01" max="2099-12" value={month} onChange={e=>{if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value);}}/></label><button className="icon-button shrink-0" aria-label="Próximo mês" onClick={()=>moveMonth(1)} disabled={month==='2099-12'}><ChevronRight/></button></div><p className="my-4 text-xs text-text-muted">Horário de Brasília. Aulas semanais e datas específicas cadastradas pelo professor.</p>{conflictSlots.length>0&&<div className="alert-warning mb-4" role="alert"><strong>Há aulas no mesmo horário.</strong><p className="mt-1 text-sm">Procure a coordenação para ajustar sua matrícula.</p></div>}{data.aulas.length?<ul className="divide-y divide-border">{data.aulas.map(item=><li key={item.id} className="flex items-start gap-4 py-4"><span className={`w-14 shrink-0 rounded-xl p-2 text-center ${item.data===today?'bg-primary text-white':'bg-surface-muted'}`}><strong className="block text-xl">{item.data.slice(-2)}</strong><span className="text-xs">{new Date(`${item.data}T12:00:00Z`).toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'})}</span></span><div className="min-w-0"><h2 className="break-words font-semibold">{item.curso}</h2><p className="text-sm text-text-muted">{item.local}</p><time className="text-sm" dateTime={`${item.data}T${item.hora}:00-03:00`}>{item.hora}</time>{item.conflito&&<span className="mt-1 block text-xs font-semibold text-warning">Conflito de horário</span>}</div></li>)}</ul>:<Empty>Não há aulas cadastradas neste mês para suas turmas.</Empty>}</section>}
    {page==='frequencia'&&<section className="panel p-5"><div className="mb-5"><p className="text-sm text-text-muted">Participação nas aulas registradas</p><p className="mt-1 text-3xl font-bold">{data.percentual===null?'—':`${data.percentual}%`}</p><p className="mt-2 text-xs text-text-muted">Presenças: {data.presentes} · Justificadas: {data.justificadas||0} · Registros: {data.total}. Justificativas contam como participação, como nos relatórios da equipe.</p></div>{data.registros.length?<ul className="divide-y divide-border">{data.registros.map((item,index)=><li className="flex flex-wrap justify-between gap-3 py-4" key={`${item.turmaId}/${item.data}/${index}`}><div><p className="font-semibold">{item.curso}</p><p className="text-sm text-text-muted">{dateLabel(item.data)} · {item.local}</p></div><span className={`self-center rounded-full px-3 py-1 text-xs font-semibold ${item.status==='presente'?'bg-green-100 text-green-800':item.status==='ausente'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>{({presente:'Presente',ausente:'Ausente',justificado:'Justificado'})[item.status]}</span></li>)}</ul>:<Empty>Nenhuma frequência registrada neste período.</Empty>}<Pagination currentPage={current} totalItems={data.total} itemsPerPage={5} onPageChange={setCurrent}/></section>}
    {['mural','informativos'].includes(page)&&<><p className="text-sm text-text-muted">{page==='mural'?'Publicações do professor para esta turma.':'Informativos publicados pela gestão para esta turma.'}</p><div className="space-y-3">{data.items.map(item=><button key={item.id} onClick={()=>open(item)} className="panel block w-full p-5 text-left hover:bg-surface-hover"><div className="flex items-start justify-between gap-3"><h2 className="break-words font-semibold">{item.titulo}</h2>{!item.lido&&<span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{item.requerConfirmacao?'Confirmar leitura':'Novo'}</span>}</div><p className="mt-2 text-xs text-text-muted">{item.categoria} · {dateLabel(item.data)}{item.fixado?' · Fixado':''}{item.requerConfirmacao&&item.confirmado?' · Leitura confirmada':''}</p></button>)}</div>{!data.items.length&&<div className="panel"><Empty>{page==='mural'?'O professor ainda não publicou no mural desta turma.':'A gestão ainda não publicou informativos para esta turma.'}</Empty></div>}<Pagination currentPage={current} totalItems={data.total} itemsPerPage={5} onPageChange={setCurrent}/><AnnouncementDetailModal isOpen={Boolean(selected)} onClose={()=>setSelected(null)} announcement={selected} footer={selected?.requerConfirmacao?<div>{selected.confirmado?<p className="flex items-center gap-2 font-semibold text-success"><CheckCheck aria-hidden="true"/>Leitura confirmada</p>:<><p className="mb-3 text-sm text-text-muted">Confirme que você leu esta publicação. O professor verá apenas a confirmação, não dados do seu dispositivo.</p><button type="button" className="btn btn-primary w-full" onClick={confirmRead} disabled={confirming}><CheckCheck aria-hidden="true"/>{confirming?'Confirmando…':'Confirmar leitura'}</button></>}</div>:null}/></>}
  </div>;
}
