import React from 'react';
import Modal from './Modal';

const ProfessorDetailsModal = ({ isOpen, onClose, professor }) => {
    if (!professor) return null;
    const fields = [
        ['Nome completo', professor.nome],
        ['E-mail', professor.contato],
        ['Telefone', professor.telefone],
        ['Igreja principal', professor.local],
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do professor">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {fields.map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-text-muted">{label}</dt><dd className="mt-1 break-words text-text-default">{value || 'Não informado'}</dd></div>)}
                <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-text-muted">Cursos lecionados</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                        {professor.cursos?.length ? professor.cursos.map(course => <span key={course} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{course}</span>) : <span className="text-text-muted">Nenhum curso vinculado</span>}
                    </dd>
                </div>
            </dl>
            <div className="mt-6 flex justify-end border-t border-border pt-5"><button type="button" onClick={onClose} className="btn btn-secondary">Fechar</button></div>
        </Modal>
    );
};

export default ProfessorDetailsModal;
