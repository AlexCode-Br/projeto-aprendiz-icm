import React, { useState } from 'react';
import { BookOpen, Mail, MapPin, Music2, Phone, UserRound, UsersRound } from 'lucide-react';
import Modal from './Modal';
import { WhatsAppIcon } from './ContactLink';
import ProfileAvatar from './ProfileAvatar';
import ProfilePhotoViewer from './ProfilePhotoViewer';
import { emailHref, whatsappHref } from '../../shared/contact-links.mjs';
import StudentAccessButton from './StudentAccessButton';

const ContactAction = ({ href, icon: Icon, label, external = false }) => {
    const content = React.createElement(Icon, { 'aria-hidden': true, className: 'h-5 w-5' });
    const className = `flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${href ? 'hover:bg-primary hover:text-white' : 'cursor-not-allowed opacity-35'}`;
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

const StudentDetailsModal = ({ student, isOpen, onClose, loading = false, error = '', onRetry, manageAccess = false }) => {
    const [isPhotoOpen, setIsPhotoOpen] = useState(false);
    if (loading || error) return <Modal isOpen={isOpen} onClose={onClose} title="Dados do aluno">
        {loading ? <p role="status" className="py-8 text-center text-text-muted">Carregando dados do aluno...</p> : <div className="space-y-4"><p role="alert" className="text-danger">{error}</p><button type="button" onClick={onRetry} className="btn btn-secondary">Tentar novamente</button></div>}
    </Modal>;
    if (!student) return null;
    const email = student.contato || student.email;
    const emailLink = emailHref(email);
    const phoneLink = whatsappHref(student.telefone);
    const courses = Array.isArray(student.turmas) && student.turmas.length
        ? student.turmas.map(item => `${item.nome} — ${item.local}`)
        : Array.isArray(student.curso) ? student.curso : student.curso ? [student.curso] : [];

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Dados do aluno" maxWidth="max-w-lg">
                <div className="grid grid-cols-[6.75rem,minmax(0,1fr)] sm:grid-cols-[8rem,minmax(0,1fr)]">
                    <div className="flex min-w-0 flex-col items-center border-r border-border pr-4 text-center sm:pr-5">
                        <button type="button" onClick={() => setIsPhotoOpen(true)} className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface" aria-label={`Ampliar foto de perfil de ${student.nome}`}>
                            <ProfileAvatar name={student.nome} src={student.foto_url} className="h-20 w-20" textClassName="text-2xl" />
                        </button>
                        <h3 className="mt-3 max-w-full break-words text-base font-semibold leading-snug text-text-default">{student.nome || 'Nome não informado'}</h3>
                        <div className="mt-3 flex items-center justify-center gap-3">
                            <ContactAction href={emailLink} icon={Mail} label="Enviar e-mail" />
                            <ContactAction href={phoneLink} icon={WhatsAppIcon} label="Abrir no WhatsApp" external />
                        </div>
                    </div>
                    <dl className="min-w-0 space-y-4 pl-4 sm:pl-6">
                        <DetailItem icon={UserRound} label="Classe">{student.classe}</DetailItem>
                        <DetailItem icon={Music2} label="Possui instrumento?">{student.instrumento}</DetailItem>
                        <DetailItem icon={MapPin} label="Igreja">{student.igreja}</DetailItem>
                        <DetailItem icon={BookOpen} label="Cursos">
                            <span className="flex flex-wrap gap-1.5">
                                {courses.length ? courses.map((course, index) => <span key={`${course}-${index}`} className="rounded-full bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold leading-tight text-white">{course}</span>) : <span className="italic text-text-muted">Nenhum curso selecionado</span>}
                            </span>
                        </DetailItem>
                        {student.classe === 'Adolescente' && <>
                            <DetailItem icon={UsersRound} label="Responsável">{student.guardian_name}</DetailItem>
                            <DetailItem icon={Phone} label="Telefone do responsável">{student.guardian_phone}</DetailItem>
                        </>}
                    </dl>
                </div>
                {manageAccess && <StudentAccessButton key={student.id} studentId={student.id} />}
            </Modal>
            <ProfilePhotoViewer isOpen={isPhotoOpen} onClose={() => setIsPhotoOpen(false)} name={student.nome} src={student.foto_url} />
        </>
    );
};

export default StudentDetailsModal;
