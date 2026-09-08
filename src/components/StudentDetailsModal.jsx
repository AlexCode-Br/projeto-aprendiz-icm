import React from 'react';
import Modal from './Modal';
import ContactLink from './ContactLink';
import ProfileAvatar from './ProfileAvatar';

const StudentDetailsModal = ({ student, isOpen, onClose, loading = false, error = '', onRetry }) => {
    if (loading || error) return <Modal isOpen={isOpen} onClose={onClose} title="Dados do aluno">
        {loading ? <p role="status" className="py-8 text-center text-text-muted">Carregando dados do aluno...</p> : <div className="space-y-4"><p role="alert" className="text-danger">{error}</p><button type="button" onClick={onRetry} className="btn btn-secondary">Tentar novamente</button></div>}
    </Modal>;
    if (!student) return null;
    const fields = [
        ['Nome completo', student.nome],
        ['E-mail', <ContactLink type="email" value={student.contato || student.email} />],
        ['Telefone (WhatsApp)', <ContactLink type="phone" value={student.telefone} />],
        ['Igreja', student.igreja],
        ['Classe', student.classe],
        ['Possui instrumento?', student.instrumento],
    ];
    if (student.classe === 'Adolescente') {
        fields.splice(5, 0,
            ['Responsável', student.guardian_name],
            ['Telefone do responsável', <ContactLink type="phone" value={student.guardian_phone} />],
        );
    }
    const courses = Array.isArray(student.turmas) && student.turmas.length
        ? student.turmas.map(item => `${item.nome} — ${item.local}`)
        : Array.isArray(student.curso) ? student.curso : student.curso ? [student.curso] : [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dados do aluno">
            <div className="sm:hidden">
                <dl>
                    <div className="flex min-w-0 items-center gap-3 border-b border-border pb-3">
                        <ProfileAvatar name={student.nome} src={student.foto_url} className="h-12 w-12" />
                        <div className="min-w-0">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">Nome completo</dt>
                            <dd className="mt-0.5 break-words font-semibold leading-snug text-text-default">{student.nome || 'Não informado'}</dd>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
                        {fields.slice(1).map(([label, value]) => <div key={label} className="min-w-0">
                            <dt className="text-[0.6875rem] font-semibold uppercase leading-tight tracking-wide text-text-muted">{label}</dt>
                            <dd className="mt-1 break-words text-sm leading-snug text-text-default">{value || 'Não informado'}</dd>
                        </div>)}
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                        <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">Cursos</dt>
                        <dd className="mt-1.5 flex flex-wrap gap-1.5">
                            {courses.length ? courses.map((course, index) => <span key={`${course}-${index}`} className="rounded-full bg-primary px-2.5 py-1 text-[0.6875rem] font-semibold leading-tight text-white">{course}</span>) : <span className="text-sm italic text-text-muted">Nenhum curso selecionado</span>}
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="hidden sm:block">
                <div className="mb-5"><ProfileAvatar name={student.nome} src={student.foto_url} className="h-16 w-16" /></div>
                <dl className="grid grid-cols-2 gap-5">
                    {fields.map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-text-muted">{label}</dt><dd className="mt-1 break-words text-text-default">{value || 'Não informado'}</dd></div>)}
                    <div className="col-span-2">
                        <dt className="text-sm font-medium text-text-muted">Cursos</dt>
                        <dd className="mt-2 flex flex-wrap gap-2">
                            {courses.length ? courses.map((course, index) => <span key={`${course}-${index}`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">{course}</span>) : <span className="italic text-text-muted">Nenhum curso selecionado</span>}
                        </dd>
                    </div>
                </dl>
            </div>
        </Modal>
    );
};

export default StudentDetailsModal;
