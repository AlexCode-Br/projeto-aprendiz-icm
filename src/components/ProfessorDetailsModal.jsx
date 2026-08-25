import React from 'react';

const ProfessorDetailsModal = ({ isOpen, onClose, professor }) => {
    if (!isOpen || !professor) return null;

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">Detalhes do Professor</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default">&times;</button>
                </div>
                <div className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted">Nome Completo</label>
                            <p className="mt-1 text-text-default">{professor.nome}</p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-muted">E-mail</label>
                            <p className="mt-1 text-text-default">{professor.contato}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted">Telefone</label>
                            <p className="mt-1 text-text-default">{professor.telefone}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted">Local Principal</label>
                            <p className="mt-1 text-text-default">{professor.local}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted">Cursos Lecionados</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {professor.cursos.map(course => (
                                <span key={course} className="bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full">
                                    {course}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                 <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-text-default font-semibold rounded-lg shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default ProfessorDetailsModal;