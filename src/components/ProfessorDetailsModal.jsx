import React, { useState } from 'react';
import { BookOpen, Mail, MapPin } from 'lucide-react';
import Modal from './Modal';
import { WhatsAppIcon } from './ContactLink';
import ProfileAvatar from './ProfileAvatar';
import ProfilePhotoViewer from './ProfilePhotoViewer';
import { emailHref, whatsappHref } from '../../shared/contact-links.mjs';

const ContactAction = ({ href, icon: Icon, label, external = false }) => {
    const content = React.createElement(Icon, { 'aria-hidden': true, className: 'h-5 w-5' });
    const className = `flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${href ? 'hover:bg-primary hover:text-white' : 'cursor-not-allowed opacity-35'}`;
    return href
        ? <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={className} aria-label={label} title={label}>{content}</a>
        : <span className={className} aria-label={`${label} indisponível`} title={`${label} indisponível`} aria-disabled="true">{content}</span>;
};

const DetailItem = ({ icon: Icon, label, children }) => <div className="flex min-w-0 items-start gap-3">
    {React.createElement(Icon, { 'aria-hidden': true, className: 'mt-0.5 h-6 w-6 shrink-0 text-primary', strokeWidth: 1.9 })}
    <div className="min-w-0">
        <dt className="text-[0.625rem] font-semibold uppercase leading-tight tracking-wide text-text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm leading-snug text-text-default">{children || 'Não informado'}</dd>
    </div>
</div>;

const ProfessorDetailsModal = ({ isOpen, onClose, professor }) => {
    const [isPhotoOpen, setIsPhotoOpen] = useState(false);
    if (!professor) return null;
    const emailLink = emailHref(professor.contato || professor.email);
    const phoneLink = whatsappHref(professor.telefone);
    const courses = Array.isArray(professor.cursos) ? professor.cursos : [];

    return <>
        <Modal isOpen={isOpen} onClose={onClose} title="Dados do professor" maxWidth="max-w-lg">
            <div className="grid gap-5 sm:grid-cols-[8rem,minmax(0,1fr)] sm:gap-0">
                <div className="flex min-w-0 flex-col items-center border-b border-border pb-5 text-center sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
                    <button type="button" onClick={() => setIsPhotoOpen(true)} className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface" aria-label={`Ampliar foto de perfil de ${professor.nome}`}>
                        <ProfileAvatar name={professor.nome} src={professor.foto_url} className="h-20 w-20" textClassName="text-2xl" />
                    </button>
                    <h3 className="mt-3 max-w-full break-words text-base font-semibold leading-snug text-text-default">{professor.nome || 'Nome não informado'}</h3>
                    <div className="mt-3 flex items-center justify-center gap-3">
                        <ContactAction href={emailLink} icon={Mail} label="Enviar e-mail" />
                        <ContactAction href={phoneLink} icon={WhatsAppIcon} label="Abrir no WhatsApp" external />
                    </div>
                </div>
                <dl className="min-w-0 space-y-4 sm:pl-6">
                    <DetailItem icon={MapPin} label="Igreja principal">{professor.local}</DetailItem>
                    <DetailItem icon={BookOpen} label="Cursos lecionados">
                        <span className="flex flex-wrap gap-1.5">
                            {courses.length ? courses.map(course => <span key={course} className="rounded-full bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold leading-tight text-white">{course}</span>) : <span className="italic text-text-muted">Nenhum curso vinculado</span>}
                        </span>
                    </DetailItem>
                </dl>
            </div>
        </Modal>
        <ProfilePhotoViewer isOpen={isPhotoOpen} onClose={() => setIsPhotoOpen(false)} name={professor.nome} src={professor.foto_url} />
    </>;
};

export default ProfessorDetailsModal;
