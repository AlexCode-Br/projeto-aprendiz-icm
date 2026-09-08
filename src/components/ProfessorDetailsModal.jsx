import React, { useState } from 'react';
import Modal from './Modal';
import ContactLink from './ContactLink';
import ProfileAvatar from './ProfileAvatar';
import ProfilePhotoViewer from './ProfilePhotoViewer';

const ProfessorDetailsModal = ({ isOpen, onClose, professor }) => {
    const [isPhotoOpen, setIsPhotoOpen] = useState(false);
    if (!professor) return null;
    const fields = [
        ['Nome completo', professor.nome],
        ['E-mail', <ContactLink type="email" value={professor.contato || professor.email} />],
        ['Telefone (WhatsApp)', <ContactLink type="phone" value={professor.telefone} />],
        ['Igreja principal', professor.local],
    ];
    const courses = Array.isArray(professor.cursos) ? professor.cursos : [];

    return <>
        <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do professor">
            <div className="sm:hidden">
                <dl>
                    <div className="flex min-w-0 items-center gap-3 border-b border-border pb-3">
                        <button type="button" onClick={() => setIsPhotoOpen(true)} className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface" aria-label={`Ampliar foto de perfil de ${professor.nome}`}>
                            <ProfileAvatar name={professor.nome} src={professor.foto_url} className="h-12 w-12" />
                        </button>
                        <div className="min-w-0">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">Nome completo</dt>
                            <dd className="mt-0.5 break-words font-semibold leading-snug text-text-default">{professor.nome || 'Não informado'}</dd>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
                        {fields.slice(1).map(([label, value], index) => <div key={label} className={`min-w-0 ${index === 2 ? 'col-span-2' : ''}`}>
                            <dt className="text-[0.6875rem] font-semibold uppercase leading-tight tracking-wide text-text-muted">{label}</dt>
                            <dd className="mt-1 break-words text-sm leading-snug text-text-default">{value || 'Não informado'}</dd>
                        </div>)}
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">Cursos lecionados</dt>
                        <dd className="mt-1.5 flex flex-wrap gap-1.5">
                            {courses.length ? courses.map(course => <span key={course} className="rounded-full bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold leading-tight text-white">{course}</span>) : <span className="text-sm italic text-text-muted">Nenhum curso vinculado</span>}
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="hidden sm:block">
                <button type="button" onClick={() => setIsPhotoOpen(true)} className="mb-5 rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface" aria-label={`Ampliar foto de perfil de ${professor.nome}`}>
                    <ProfileAvatar name={professor.nome} src={professor.foto_url} className="h-16 w-16" />
                </button>
                <dl className="grid grid-cols-2 gap-5">
                    {fields.map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-text-muted">{label}</dt><dd className="mt-1 break-words text-text-default">{value || 'Não informado'}</dd></div>)}
                    <div className="col-span-2">
                        <dt className="text-sm font-medium text-text-muted">Cursos lecionados</dt>
                        <dd className="mt-2 flex flex-wrap gap-2">
                            {courses.length ? courses.map(course => <span key={course} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">{course}</span>) : <span className="italic text-text-muted">Nenhum curso vinculado</span>}
                        </dd>
                    </div>
                </dl>
            </div>
        </Modal>
        <ProfilePhotoViewer isOpen={isPhotoOpen} onClose={() => setIsPhotoOpen(false)} name={professor.nome} src={professor.foto_url} />
    </>;
};

export default ProfessorDetailsModal;
