import React from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import ContactLink from './ContactLink';
import KebabMenu, { KebabMenuItem } from './KebabMenu';

export default function MobileStudentList({ students, loading, error, onView, onEdit, onDelete, showCourses = false }) {
    return <section className="space-y-3 sm:hidden" aria-label="Lista de alunos" aria-busy={loading}>
        {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="panel p-3"><div className="skeleton h-28 rounded-xl" /></div>)
            : error ? <p role="alert" className="panel p-4 text-sm text-danger">{error}</p>
                : students.map(student => <article key={student.id} className="panel relative flex min-w-0 items-stretch gap-4 p-4 pr-12" aria-label={student.nome}>
                    <button type="button" onClick={() => onView(student)} className="self-center rounded-full transition-transform hover:scale-105 focus-visible:outline-offset-4" aria-label={`Ver dados de ${student.nome}`}>
                        <ProfileAvatar name={student.nome} src={student.foto_url} className="h-[72px] w-[72px]" textClassName="text-2xl" />
                    </button>
                    <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-border" />
                    <div className="min-w-0 flex-1 py-0.5">
                        <button type="button" onClick={() => onView(student)} className="max-w-full rounded text-left hover:text-primary" aria-label={`Ver dados de ${student.nome}`}>
                            <span className="block break-words text-base font-semibold leading-5">{student.nome}</span>
                        </button>
                        <p className="mt-1 text-xs text-text-muted">Contato</p>
                        <div className="mt-1 grid min-w-0 gap-0.5 text-[13px] leading-5 [&_a]:min-h-7 [&_a]:items-center [&_svg]:!h-[18px] [&_svg]:!w-[18px] [&_svg]:shrink-0">
                            <div className="min-w-0">{student.email ? <><span className="sr-only">E-mail: </span><ContactLink type="email" value={student.email} /></> : <span className="text-text-muted">E-mail não informado</span>}</div>
                            <div className="min-w-0">{student.telefone ? <><span className="sr-only">Telefone: </span><ContactLink type="phone" value={student.telefone} /></> : <span className="text-text-muted">Telefone não informado</span>}</div>
                        </div>
                        {showCourses && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2 text-xs text-text-muted">
                            {student.cursos?.length ? [...new Set(student.cursos.map(course => course.nome))].map(name => <span key={name} className="max-w-full break-words rounded-lg bg-surface-muted px-2 py-1">{name}</span>) : 'Sem turma vinculada'}
                        </div>}
                    </div>
                    <div className="absolute right-2 top-2">
                        <KebabMenu label={`Ações de ${student.nome}`}>
                            <KebabMenuItem icon={Eye} onClick={() => onView(student)}>Ver detalhes</KebabMenuItem>
                            {onEdit && <KebabMenuItem icon={Pencil} tone="primary" onClick={() => onEdit(student)}>Editar cadastro</KebabMenuItem>}
                            {onDelete && <KebabMenuItem icon={Trash2} tone="danger" onClick={() => onDelete(student)}>Excluir aluno</KebabMenuItem>}
                        </KebabMenu>
                    </div>
                </article>)}
        {!loading && !error && !students.length && <div className="panel p-6 text-center text-sm text-text-muted"><strong className="block text-text-default">Nenhum aluno encontrado</strong><p className="mt-1">Confira a busca e os filtros.</p></div>}
    </section>;
}
