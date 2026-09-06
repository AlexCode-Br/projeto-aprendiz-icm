import React from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import ContactLink from './ContactLink';
import KebabMenu, { KebabMenuItem } from './KebabMenu';

export default function MobileStudentList({ students, loading, error, onView, onEdit, onDelete, showCourses = false }) {
    return <section className="space-y-3 sm:hidden" aria-label="Lista de alunos" aria-busy={loading}>
        {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="panel p-3"><div className="skeleton h-24 rounded-xl" /></div>)
            : error ? <p role="alert" className="panel p-4 text-sm text-danger">{error}</p>
                : students.map(student => <article key={student.id} className="panel min-w-0 p-3.5" aria-label={student.nome}>
                    <div className="flex items-center gap-2.5">
                        <button type="button" onClick={() => onView(student)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:text-primary" aria-label={`Ver dados de ${student.nome}`}>
                            <ProfileAvatar name={student.nome} src={student.foto_url} className="h-9 w-9" textClassName="text-xs" />
                            <span className="min-w-0 break-words text-sm font-semibold leading-5">{student.nome}</span>
                        </button>
                        <KebabMenu label={`Ações de ${student.nome}`}>
                            <KebabMenuItem icon={Eye} onClick={() => onView(student)}>Ver detalhes</KebabMenuItem>
                            {onEdit && <KebabMenuItem icon={Pencil} tone="primary" onClick={() => onEdit(student)}>Editar cadastro</KebabMenuItem>}
                            {onDelete && <KebabMenuItem icon={Trash2} tone="danger" onClick={() => onDelete(student)}>Excluir aluno</KebabMenuItem>}
                        </KebabMenu>
                    </div>
                    <div className="mt-1.5 grid min-w-0 gap-0.5 border-t border-border/70 pt-2 text-[13px] leading-5 [&_a]:min-h-7 [&_a]:items-center [&_svg]:!h-4 [&_svg]:!w-4 [&_svg]:shrink-0">
                        <div className="min-w-0">{student.email ? <><span className="sr-only">E-mail: </span><ContactLink type="email" value={student.email} /></> : <span className="text-text-muted">E-mail não informado</span>}</div>
                        <div className="min-w-0">{student.telefone ? <><span className="sr-only">Telefone: </span><ContactLink type="phone" value={student.telefone} /></> : <span className="text-text-muted">Telefone não informado</span>}</div>
                    </div>
                    {showCourses && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2 text-xs text-text-muted">
                        {student.cursos?.length ? [...new Set(student.cursos.map(course => course.nome))].map(name => <span key={name} className="max-w-full break-words rounded-lg bg-surface-muted px-2 py-1">{name}</span>) : 'Sem turma vinculada'}
                    </div>}
                </article>)}
        {!loading && !error && !students.length && <div className="panel p-6 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhum aluno encontrado</strong><p className="mt-1">Confira a busca e os filtros.</p></div>}
    </section>;
}
