import React from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import ContactLink from './ContactLink';

export default function MobileStudentList({ students, loading, error, onView, onEdit, onDelete, showCourses = false }) {
    return <section className="panel divide-y divide-border sm:hidden" aria-label="Lista de alunos" aria-busy={loading}>
        {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="p-3"><div className="skeleton h-28 rounded-xl" /></div>)
            : error ? <p role="alert" className="p-4 text-sm text-danger">{error}</p>
                : students.map(student => <article key={student.id} className="min-w-0 p-3" aria-label={student.nome}>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onView(student)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:text-primary" aria-label={`Ver dados de ${student.nome}`}>
                            <ProfileAvatar name={student.nome} src={student.foto_url} className="h-8 w-8" textClassName="text-xs" />
                            <span className="min-w-0 break-words text-sm font-semibold leading-5">{student.nome}</span>
                        </button>
                        <div className="flex shrink-0 items-center">
                            <button type="button" onClick={() => onView(student)} className="icon-button" aria-label={`Ver detalhes de ${student.nome}`} title="Ver detalhes"><Eye aria-hidden="true" className="!h-5 !w-5" /></button>
                            {onEdit && <button type="button" onClick={() => onEdit(student)} className="icon-button text-primary" aria-label={`Editar ${student.nome}`} title="Editar"><Pencil aria-hidden="true" className="!h-5 !w-5" /></button>}
                            {onDelete && <button type="button" onClick={() => onDelete(student)} className="icon-button text-danger" aria-label={`Excluir ${student.nome}`} title="Excluir"><Trash2 aria-hidden="true" className="!h-5 !w-5" /></button>}
                        </div>
                    </div>
                    <div className="mt-1 grid min-w-0 gap-1 text-sm leading-5 [&_a]:min-h-8 [&_a]:items-center [&_svg]:!h-4 [&_svg]:!w-4 [&_svg]:shrink-0">
                        <div className="min-w-0">{student.email ? <><span className="sr-only">E-mail: </span><ContactLink type="email" value={student.email} /></> : <span className="text-text-muted">E-mail não informado</span>}</div>
                        <div className="min-w-0">{student.telefone ? <><span className="sr-only">Telefone: </span><ContactLink type="phone" value={student.telefone} /></> : <span className="text-text-muted">Telefone não informado</span>}</div>
                    </div>
                    {showCourses && <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-text-muted">
                        {student.cursos?.length ? [...new Set(student.cursos.map(course => course.nome))].map(name => <span key={name} className="max-w-full break-words rounded-lg bg-surface-muted px-2 py-1">{name}</span>) : 'Sem turma vinculada'}
                    </div>}
                </article>)}
        {!loading && !error && !students.length && <div className="p-6 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhum aluno encontrado</strong><p className="mt-1">Confira a busca e os filtros.</p></div>}
    </section>;
}
