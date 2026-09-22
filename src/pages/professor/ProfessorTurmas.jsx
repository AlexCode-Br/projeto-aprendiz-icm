import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, MapPin, MessageSquareText, Users } from 'lucide-react';
import api from '../../services/api';
import PageSkeleton from '../../components/PageSkeleton';
import ClassScheduleList from '../../components/ClassScheduleList';
import ClassScheduleModal from '../../components/ClassScheduleModal';
import CourseAnnouncementsModal from '../../components/CourseAnnouncementsModal';
import { useToast } from '../../contexts/ToastContext';
import { classScheduleConflicts, classSchedules } from '../../../shared/class-schedules.mjs';

export default function ProfessorTurmas() {
    const [searchParams]=useSearchParams();
    const selectedId=Number(searchParams.get('turma'));
    const [courses,setCourses] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState('');
    const [editing,setEditing] = useState(null);
    const [announcing,setAnnouncing] = useState(null);
    const {showToast} = useToast();
    const conflicts=useMemo(()=>classScheduleConflicts(courses),[courses]);
    const selectedCourses=useMemo(()=>Number.isSafeInteger(selectedId)&&selectedId>0?courses.filter(course=>Number(course.id)===selectedId):courses,[courses,selectedId]);
    const visibleConflicts=useMemo(()=>Number.isSafeInteger(selectedId)&&selectedId>0?conflicts.filter(conflict=>conflict.turmas.some(course=>Number(course.id)===selectedId)):conflicts,[conflicts,selectedId]);
    const conflictingIds=useMemo(()=>new Set(conflicts.flatMap(conflict=>conflict.turmas.map(course=>String(course.id)))),[conflicts]);
    const load = useCallback(async () => {
        setLoading(true);
        try { const {data}=await api.get('/professores/meus-cursos'); setCourses(data); setError(''); }
        catch(error) { setError(error.message || 'Não foi possível carregar suas turmas.'); }
        finally { setLoading(false); }
    },[]);
    useEffect(()=>{load();},[load]);
    const save = async horarios => {
        const {data}=await api.put(`/api/professores/me/turmas/${editing.id}/horarios`,{horarios});
        setCourses(current=>current.map(course=>course.id===editing.id?{...course,horarios:data.horarios}:course));
        showToast('Dias e horários salvos com sucesso!','success');
    };
    if(loading)return <PageSkeleton label="Carregando suas turmas" />;
    const selectedCourse=selectedCourses.length===1&&Number.isSafeInteger(selectedId)&&selectedId>0?selectedCourses[0]:null;
    return <>
        <div className="page-header"><div><h1 className="page-title">{selectedCourse?selectedCourse.nome:'Minhas turmas'}</h1><p className="page-description">{selectedCourse?`Informações da turma em ${selectedCourse.local}.`:'Defina os dias da semana e os horários das suas aulas.'}</p></div></div>
        {visibleConflicts.length>0&&<div className="alert-warning mb-5" role="alert">
            <div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0"/><div><strong className="block text-text-default">Há conflito entre horários já cadastrados</strong><p className="mt-1 text-sm">Ajuste uma das turmas em cada horário: {visibleConflicts.map(conflict=>conflict.descricao).join('; ')}.</p></div></div>
        </div>}
        {error ? <div className="panel empty-state"><p role="alert">{error}</p><button type="button" className="btn btn-secondary" onClick={load}>Tentar novamente</button></div>
            : <div className="grid gap-4 md:grid-cols-2">
                {selectedCourses.map(course=>{const hasConflict=conflictingIds.has(String(course.id));return <article key={course.id} className={`panel flex min-w-0 flex-col overflow-hidden ${selectedCourse?'md:col-span-2':''} ${hasConflict?'border-warning/70':''}`}>
                    <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-3"><h2 className="break-words text-lg font-semibold">{course.nome}</h2>{hasConflict&&<span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">Conflito</span>}</div>
                        <p className="mt-2 flex items-start gap-2 text-sm text-text-muted"><MapPin aria-hidden="true" className="shrink-0" /><span className="break-words">{course.local}</span></p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-text-muted"><Users aria-hidden="true" className="shrink-0"/><span>{Number(course.alunos||0)} {Number(course.alunos||0)===1?'aluno':'alunos'}</span></p>
                        {course.label && course.label!==`${course.nome} — ${course.local}` && <p className="mt-1 text-sm text-text-muted">{course.label}</p>}
                        <h3 className="mb-2 mt-5 text-xs font-semibold text-text-muted">Dias e horários</h3>
                        <div className="text-sm leading-6"><ClassScheduleList course={course} /></div>
                    </div>
                    <div className="space-y-2 border-t border-border p-4"><button type="button" onClick={()=>setEditing(course)} className="btn btn-secondary w-full" aria-label={`Editar horários de ${course.nome} em ${course.local}`}><CalendarClock aria-hidden="true" />{classSchedules(course).length?'Editar horários':'Definir horários'}</button><button type="button" onClick={()=>setAnnouncing(course)} className="btn btn-secondary w-full"><MessageSquareText aria-hidden="true"/>Mural da turma</button></div>
                </article>})}
                {!selectedCourses.length && <div className="panel empty-state md:col-span-2"><strong className="text-text-default">{courses.length?'Turma não encontrada':'Nenhuma turma atribuída'}</strong><p>{courses.length?'Selecione uma das suas turmas no menu lateral.':'Suas turmas aparecerão aqui quando o gestor vinculá-las ao seu perfil.'}</p></div>}
            </div>}
        <ClassScheduleModal course={editing} onClose={()=>setEditing(null)} onSave={save} />
        {announcing&&<CourseAnnouncementsModal course={announcing} onClose={()=>setAnnouncing(null)}/>}
    </>;
}
