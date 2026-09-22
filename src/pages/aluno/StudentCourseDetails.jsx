import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import PageSkeleton from '../../components/PageSkeleton';
import StudentPortal from './StudentPortal';

const views = [['mural', 'Mural da turma'], ['informativos', 'Informativos'], ['calendario', 'Aulas'], ['frequencia', 'Frequência']];

export default function StudentCourseDetails() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('mural');

  useEffect(() => {
    let active = true;
    setCourse(null);
    setError('');
    setView('mural');
    api.get(`/api/aluno/cursos/${id}`)
      .then(({ data }) => { if (active) setCourse(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);

  if (error) return (
    <div className="panel p-5">
      <p className="text-danger" role="alert">{error}</p>
      <Link className="btn btn-secondary mt-4" to="/aluno/cursos">Voltar aos meus cursos</Link>
    </div>
  );
  if (!course) return <PageSkeleton />;

  const customLabel = course.label && course.label !== course.curso && course.label !== `${course.curso} — ${course.local}`;
  return (
    <div className="space-y-5">
      <Link className="text-sm font-semibold text-primary hover:underline" to="/aluno/cursos">← Meus cursos</Link>
      <header className="panel p-5">
        <h1 className="page-title break-words">{course.curso}</h1>
        <p className="mt-2 break-words text-text-muted">{course.local}{customLabel ? ` · ${course.label}` : ''}</p>
        <p className="mt-2 text-sm text-text-muted">{course.periodo} · {course.status === 'ativa' ? 'Matrícula ativa' : 'Matrícula concluída'}</p>
      </header>
      <nav aria-label="Informações do meu curso" className="flex flex-wrap gap-2">
        {views.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`btn ${view === key ? 'btn-primary' : 'btn-secondary'}`} aria-current={view === key ? 'page' : undefined}>
            {label}
          </button>
        ))}
      </nav>
      <StudentPortal key={`${id}/${view}`} page={view} courseId={id} initialPeriod={String(course.periodId)} />
    </div>
  );
}
