import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import FormCheckbox from './FormCheckbox';
import FormRadio from './FormRadio';

const emptyAudience = { todos: true, professores: [], cursos: [] };

const normalizeIds = value => [...new Set((Array.isArray(value) ? value : []).map(Number).filter(id => Number.isInteger(id) && id > 0))];
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const createSelectionState = (professors = [], courses = []) => ({
    selectedProfessors: normalizeIds(professors),
    selectedCourses: normalizeIds(courses),
    manualCourseSelections: new Set(normalizeIds(courses)),
    manuallyExcludedCourses: new Set(),
    autoCourseSources: new Map(),
});

const cloneCourseSources = sources => new Map([...sources].map(([courseId, professorIds]) => [courseId, new Set(professorIds)]));

const ArrowLeftIcon = () => (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h20" />
    </svg>
);

const AnnouncementAudienceModal = ({ isOpen, onClose, onConfirm, options = {}, loading = false, initialAudience }) => {
    const [mode, setMode] = useState('todos');
    const [selection, setSelection] = useState(() => createSelectionState());
    const [professorSearch, setProfessorSearch] = useState('');
    const [courseSearch, setCourseSearch] = useState('');
    const [error, setError] = useState('');
    const professors = useMemo(() => (Array.isArray(options.professores) ? options.professores : []), [options.professores]);
    const courses = useMemo(() => (Array.isArray(options.cursos) ? options.cursos : []), [options.cursos]);

    const professorsById = useMemo(() => new Map(professors.map(professor => [Number(professor.id), professor])), [professors]);
    const filteredProfessors = useMemo(() => {
        const query = normalizeSearch(professorSearch);
        return professors.filter(professor => !query || normalizeSearch(professor.nome || professor.name).includes(query));
    }, [professors, professorSearch]);
    const filteredCourses = useMemo(() => {
        const query = normalizeSearch(courseSearch);
        return courses.filter(course => !query || normalizeSearch(course.nome || course.name).includes(query));
    }, [courses, courseSearch]);

    useEffect(() => {
        if (!isOpen) return;
        const audience = initialAudience && typeof initialAudience === 'object' ? initialAudience : emptyAudience;
        const professorIds = normalizeIds(audience.professores);
        const courseIds = normalizeIds(audience.cursos);
        const all = audience.todos !== false && professorIds.length === 0 && courseIds.length === 0;
        setMode(all ? 'todos' : 'selecionados');
        setSelection(createSelectionState(professorIds, courseIds));
        setProfessorSearch('');
        setCourseSearch('');
        setError('');
    }, [initialAudience, isOpen]);

    const toggleProfessor = professorId => {
        const id = Number(professorId);
        const professorCourses = normalizeIds(professorsById.get(id)?.cursos);
        setSelection(previous => {
            const selectedProfessors = new Set(previous.selectedProfessors);
            const selectedCourses = new Set(previous.selectedCourses);
            const manualCourseSelections = new Set(previous.manualCourseSelections);
            const manuallyExcludedCourses = new Set(previous.manuallyExcludedCourses);
            const autoCourseSources = cloneCourseSources(previous.autoCourseSources);

            if (selectedProfessors.has(id)) {
                selectedProfessors.delete(id);
                professorCourses.forEach(courseId => {
                    const sources = autoCourseSources.get(courseId) || new Set();
                    sources.delete(id);
                    if (sources.size) {
                        autoCourseSources.set(courseId, sources);
                    } else {
                        autoCourseSources.delete(courseId);
                        if (!manualCourseSelections.has(courseId) && !manuallyExcludedCourses.has(courseId)) selectedCourses.delete(courseId);
                    }
                });
            } else {
                selectedProfessors.add(id);
                professorCourses.forEach(courseId => {
                    const sources = autoCourseSources.get(courseId) || new Set();
                    sources.add(id);
                    autoCourseSources.set(courseId, sources);
                    if (!manuallyExcludedCourses.has(courseId)) selectedCourses.add(courseId);
                });
            }

            return {
                selectedProfessors: [...selectedProfessors],
                selectedCourses: [...selectedCourses],
                manualCourseSelections,
                manuallyExcludedCourses,
                autoCourseSources,
            };
        });
        setError('');
    };

    const toggleCourse = courseId => {
        const id = Number(courseId);
        setSelection(previous => {
            const selectedCourses = new Set(previous.selectedCourses);
            const manualCourseSelections = new Set(previous.manualCourseSelections);
            const manuallyExcludedCourses = new Set(previous.manuallyExcludedCourses);
            if (selectedCourses.has(id)) {
                selectedCourses.delete(id);
                manualCourseSelections.delete(id);
                manuallyExcludedCourses.add(id);
            } else {
                selectedCourses.add(id);
                manualCourseSelections.add(id);
                manuallyExcludedCourses.delete(id);
            }
            return { ...previous, selectedCourses: [...selectedCourses], manualCourseSelections, manuallyExcludedCourses };
        });
        setError('');
    };

    const handleSubmit = event => {
        event.preventDefault();
        if (mode === 'selecionados' && !selection.selectedProfessors.length && !selection.selectedCourses.length) {
            setError('Selecione ao menos um professor ou curso, ou escolha “Todos”.');
            return;
        }
        onConfirm({
            todos: mode === 'todos',
            professores: mode === 'todos' ? [] : normalizeIds(selection.selectedProfessors),
            cursos: mode === 'todos' ? [] : normalizeIds(selection.selectedCourses),
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
                        <div className="flex items-center justify-between gap-3">
                            <h3 id="announcement-professors-label" className="text-sm font-semibold text-text-default">Professores</h3>
                            <span className="text-xs text-text-muted">{selection.selectedProfessors.length} selecionado(s)</span>
                        </div>
                        <label htmlFor="announcement-professor-search" className="sr-only">Pesquisar professor</label>
                        <input id="announcement-professor-search" type="search" value={professorSearch} onChange={event => setProfessorSearch(event.target.value)} placeholder="Pesquisar professor..." className="form-control mt-3" />
                        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                            {loading && <p className="text-sm text-text-muted">Carregando professores…</p>}
                            {!loading && !professors.length && <p className="text-sm text-text-muted">Nenhum professor ativo cadastrado.</p>}
                            {!loading && professors.length > 0 && !filteredProfessors.length && <p className="py-2 text-sm text-text-muted">Nenhum professor encontrado.</p>}
                            {!loading && filteredProfessors.map(professor => {
                                const id = Number(professor.id);
                                return <FormCheckbox key={id} id={`announcement-professor-${id}`} checked={selection.selectedProfessors.includes(id)} onChange={() => toggleProfessor(id)} label={professor.nome || professor.name || 'Professor'} className="min-h-11 items-center rounded-md px-2 py-2 hover:bg-surface-hover" />;
                            })}
                        </div>
                    </section>
                    <section className="rounded-lg border border-border bg-surface-muted p-4" aria-labelledby="announcement-courses-label">
                        <div className="flex items-center justify-between gap-3">
                            <h3 id="announcement-courses-label" className="text-sm font-semibold text-text-default">Cursos</h3>
                            <span className="text-xs text-text-muted">{selection.selectedCourses.length} selecionado(s)</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-text-muted">Os cursos dos professores escolhidos são sugeridos automaticamente. Você pode ajustar a seleção.</p>
                        <label htmlFor="announcement-course-search" className="sr-only">Pesquisar curso</label>
                        <input id="announcement-course-search" type="search" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Pesquisar curso..." className="form-control mt-3" />
                        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                            {loading && <p className="text-sm text-text-muted">Carregando cursos…</p>}
                            {!loading && !courses.length && <p className="text-sm text-text-muted">Nenhum curso ativo cadastrado.</p>}
                            {!loading && courses.length > 0 && !filteredCourses.length && <p className="py-2 text-sm text-text-muted">Nenhum curso encontrado.</p>}
                            {!loading && filteredCourses.map(course => {
                                const id = Number(course.id);
                                return <FormCheckbox key={id} id={`announcement-course-${id}`} checked={selection.selectedCourses.includes(id)} onChange={() => toggleCourse(id)} label={course.nome || course.name || 'Curso'} className="min-h-11 items-center rounded-md px-2 py-2 hover:bg-surface-hover" />;
                            })}
                        </div>
                    </section>
                </div>}

                {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="btn btn-secondary"><ArrowLeftIcon /> Voltar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Carregando…' : 'Publicar informativo'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default AnnouncementAudienceModal;
