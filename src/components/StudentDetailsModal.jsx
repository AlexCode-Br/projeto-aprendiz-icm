import React from 'react';

const StudentDetailsModal = ({ student, isOpen, onClose }) => {
    if (!isOpen || !student) {
        return null;
    }

    const renderCourseTags = (courses) => {
        if (!courses || courses.length === 0) {
            return <span className="text-text-muted italic">Nenhum curso selecionado</span>;
        }
        return courses.map(course => (
            <span key={course} className="course-tag flex items-center bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full cursor-default">
                {course}
            </span>
        ));
    };

    return (
        <div 
            className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 px-4 opacity-100"
            onClick={onClose}
        >
            <div 
                className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-lg transform scale-100"
                onClick={e => e.stopPropagation()} // Impede que o clique dentro do modal o feche
            >
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">Dados do Aluno</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Nome Completo</label>
                                <input type="text" value={student.nome || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">E-mail</label>
                                <input type="email" value={student.contato || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Telefone (WhatsApp)</label>
                                <input type="tel" value={student.telefone || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Igreja-Bairro</label>
                                <input type="text" value={student.igreja || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Classe</label>
                                <input type="text" value={student.classe || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-text-default mb-1">Cursos</label>
                                <div className="course-input-container w-full border border-border rounded-lg p-2 bg-gray-100 dark:bg-gray-700 min-h-[42px]">
                                    {renderCourseTags(student.curso)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Local</label>
                                <input type="text" value={student.local || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-default mb-1">Ele possui instrumento?</label>
                                <input type="text" value={student.instrumento || ''} className="w-full px-3 py-2 border border-border rounded-lg bg-gray-100 dark:bg-gray-700" readOnly />
                            </div>
                        </div>
                    </form>
                </div>
                 <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-text-default font-semibold rounded-lg shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default StudentDetailsModal;