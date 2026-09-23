import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PageSkeleton from '../../components/PageSkeleton';
import StudentPortal from './StudentPortal';
import CourseRoom from '../../components/CourseRoom';

export default function StudentCourseDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [settings,setSettings]=useState(null);

  useEffect(() => {
    let active = true;
    setCourse(null);
    setSettings(null);
    setError('');
    api.get(`/api/aluno/cursos/${id}`)
      .then(({ data }) => { if (active) setCourse(data); })
      .catch(e => { if (active) setError(e.message); });
    api.get(`/api/turmas/${id}/configuracao`).then(({data})=>{if(active)setSettings(data);}).catch(()=>{});
    return () => { active = false; };
  }, [id]);

  if (error) return (
    <div className="panel p-5">
      <p className="text-danger" role="alert">{error}</p>
      <Link className="btn btn-secondary mt-4" to="/aluno/dashboard">Voltar à visão geral</Link>
    </div>
  );
  if (!course) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      <Link className="text-sm font-semibold text-primary hover:underline" to="/aluno/dashboard">← Visão geral</Link>
      <CourseRoom key={`${id}/${searchParams.get('view')||'mural'}`} course={course} settings={settings} student initialView={searchParams.get('view')==='informativos'?'informativos':'mural'} renderView={view=><StudentPortal key={`${id}/${view}`} page={view} courseId={id} initialPeriod={String(course.periodId)}/>}/>
    </div>
  );
}
