import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import FormCheckbox from './FormCheckbox';
import FormRadio from './FormRadio';

const emptyAudience = { todos: true, professores: [], cursos: [] };

const normalizeIds = value => [...new Set((Array.isArray(value) ? value : []).map(Number).filter(id => Number.isInteger(id) && id > 0))];

const AnnouncementAudienceModal = ({ isOpen, onClose, onConfirm, options = {}, loading = false, initialAudience }) => {
    const [mode, setMode] = useState('todos');
    const [selectedProfessors, setSelectedProfessors] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [error, setError] = useState('');
    const professors = Array.isArray(options.professores) ? options.professores : [];
    const courses = Array.isArray(options.cursos) ? options.cursos : [];

    useEffect(() => {
        if (!isOpen) return;
        const audience = initialAudience && typeof initialAudience === 'object' ? initialAudience : emptyAudience;
        const professorIds = normalizeIds(audience.professores);
        const courseIds = normalizeIds(audience.cursos);
        const all = audience.todos !== false && professorIds.length === 0 && courseIds.length === 0;
        setMode(all ? 'todos' : 'selecionados');
        setSelectedProfessors(professorIds);
        setSelectedCourses(courseIds);
        setError('');
    }, [initialAudience, isOpen]);

    const toggleId = (setter, id) => setter(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);

    const handleSubmit = event => {
        event.preventDefault();
        if (mode === 'selecionados' && !selectedProfessors.length && !selectedCourses.length) {
            setError('Selecione ao menos um professor ou curso, ou escolha “Todos”.');
            return;
        }
        onConfirm({
            todos: mode === 'todos',
            professores: mode === 'todos' ? [] : selectedProfessors,
            cursos: mode === 'todos' ? [] : selectedCourses,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Escolher destinatários" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} noValidate>
                <p className="text-sm text-text-muted">Escolha quem receberá este informativo. Você pode enviar para todos ou filtrar por professores e cursos.</p>
                <div className="mt-5 space-y-3">
                    <FormRadio name="announcement-audience" value="todos" checked={mode === 'todos'} onChange={() => { setMode('todos'); setError(''); }} label="Todos os usuários" description="O aviso ficará disponível para todos os professores." />
                    <FormRadio name="announcement-audience" value="selecionados" checked={mode === 'selecionados'} onChange={() => { setMode('selecionados'); setError(''); }} label="Selecionar destinatários" description="Escolha professores, cursos ou uma combinação dos dois." />
                </div>

                {mode === 'selecionados' && <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <section className="rounded-lg border border-border bg-surface-muted p-4" aria-labelledby="announcement-professors-label">
                        <h3 id="announcement-professors-label" className="text-sm font-semibold text-text-default">Professores</h3>
                        <div className="mt-3 max-h-48 space-y-3 overflow-y-auto">
                            {loading && <p className="text-sm text-text-muted">Carregando professores…</p>}
                            {!loading && !professors.length && <p className="text-sm text-text-muted">Nenhum professor ativo cadastrado.</p>}
                            {!loading && professors.map(professor => {
                                const id = Number(professor.id);
                                return <FormCheckbox key={id} checked={selectedProfessors.includes(id)} onChange={() => toggleId(setSelectedProfessors, id)} label={professor.nome || professor.name || 'Professor'} />;
                            })}
                        </div>
                    </section>
                    <section className="rounded-lg border border-border bg-surface-muted p-4" aria-labelledby="announcement-courses-label">
                        <h3 id="announcement-courses-label" className="text-sm font-semibold text-text-default">Cursos</h3>
                        <div className="mt-3 max-h-48 space-y-3 overflow-y-auto">
                            {loading && <p className="text-sm text-text-muted">Carregando cursos…</p>}
                            {!loading && !courses.length && <p className="text-sm text-text-muted">Nenhum curso ativo cadastrado.</p>}
                            {!loading && courses.map(course => {
                                const id = Number(course.id);
                                return <FormCheckbox key={id} checked={selectedCourses.includes(id)} onChange={() => toggleId(setSelectedCourses, id)} label={course.nome || course.name || 'Curso'} />;
                            })}
                        </div>
                    </section>
                </div>}

                {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Carregando…' : 'Publicar informativo'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AnnouncementAudienceModal;
