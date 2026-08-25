import React from 'react';
import Modal from './Modal';

const StudentDetailsModal = ({ student, isOpen, onClose }) => {
    if (!student) return null;
    const fields = [
        ['Nome completo', student.nome],
        ['E-mail', student.contato],
        ['Telefone (WhatsApp)', student.telefone],
        ['Igreja-bairro', student.igreja],
        ['Classe', student.classe],
        ['Local', student.local],
        ['Possui instrumento?', student.instrumento],
    ];
    const courses = Array.isArray(student.curso) ? student.curso : student.curso ? [student.curso] : [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dados do aluno">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {fields.map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-text-muted">{label}</dt><dd className="mt-1 break-words text-text-default">{value || 'Não informado'}</dd></div>)}
                <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-text-muted">Cursos</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                        {courses.length ? courses.map(course => <span key={course} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">{course}</span>) : <span className="italic text-text-muted">Nenhum curso selecionado</span>}
                    </dd>
                </div>
            </dl>
            <div className="mt-6 flex justify-end border-t border-border pt-5"><button type="button" onClick={onClose} className="btn btn-secondary">Fechar</button></div>
        </Modal>
    );
};

export default StudentDetailsModal;
