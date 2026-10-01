import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormSelect from './FormSelect';

const StudentBulkEnrollmentModal = ({ isOpen, onClose, onConfirm, options, selectedCount, loading = false }) => {
    const [classId, setClassId] = useState('');

    useEffect(() => {
        if (isOpen) setClassId('');
    }, [isOpen]);

    const handleSubmit = event => {
        event.preventDefault();
        if (classId && !loading) onConfirm(classId);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar alunos à turma" maxWidth="max-w-md">
            <form onSubmit={handleSubmit}>
                <p className="mb-5 text-sm leading-6 text-text-muted">
                    {selectedCount} {selectedCount === 1 ? 'aluno selecionado será vinculado' : 'alunos selecionados serão vinculados'} à turma escolhida. Matrículas de outros cursos serão preservadas.
                </p>
                <div>
                    <label htmlFor="bulk-student-class" className="form-label">Turma de destino</label>
                    <FormSelect
                        id="bulk-student-class"
                        name="class_id"
                        value={classId}
                        onChange={event => setClassId(event.target.value)}
                        options={options}
                        placeholder="Selecione uma turma"
                        isClearable
                        isDisabled={loading}
                    />
                    <p className="mt-2 text-xs leading-5 text-text-muted">Se um aluno já estiver em outra turma do mesmo curso, o vínculo será transferido para esta turma.</p>
                </div>
                <div className="mt-6 flex sm:justify-end">
                    <button type="submit" disabled={!classId || loading} className="btn btn-primary">
                        {loading ? 'Adicionando...' : 'Adicionar à turma'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StudentBulkEnrollmentModal;
