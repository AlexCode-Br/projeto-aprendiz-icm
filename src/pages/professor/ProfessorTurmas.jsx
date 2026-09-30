import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PageSkeleton from '../../components/PageSkeleton';
import ClassSettingsModal from '../../components/ClassSettingsModal';
import ProfessorClassModal from '../../components/ProfessorClassModal';
import CourseRoom from '../../components/CourseRoom';
import { useToast } from '../../contexts/ToastContext';
import { classScheduleConflicts } from '../../../shared/class-schedules.mjs';

export default function ProfessorTurmas() {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedId = Number(searchParams.get('turma'));
    const createRequested = searchParams.get('nova') === '1';
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [configuring, setConfiguring] = useState(null);
    const [offering, setOffering] = useState(undefined);
    const [presentation, setPresentation] = useState(null);
    const { showToast } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/professores/meus-cursos');
            setCourses(data);
            setError('');
        } catch (requestError) {
            setError(requestError.message || 'Não foi possível carregar suas turmas.');
        } finally { setLoading(false); }
    }, []);
    const loadPresentation = useCallback(async () => {
        if (!selectedId) { setPresentation(null); return; }
        try { setPresentation((await api.get(`/api/turmas/${selectedId}/configuracao`)).data); }
        catch { setPresentation(null); }
    }, [selectedId]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        const refresh = () => { void load(); };
        window.addEventListener('class-schedules:updated', refresh);
        window.addEventListener('classes:updated', refresh);
        return () => { window.removeEventListener('class-schedules:updated', refresh); window.removeEventListener('classes:updated', refresh); };
    }, [load]);
    useEffect(() => {
        setPresentation(null); setConfiguring(null); setOffering(undefined);
        void loadPresentation();
        window.addEventListener('class-presentation:updated', loadPresentation);
        return () => window.removeEventListener('class-presentation:updated', loadPresentation);
    }, [loadPresentation]);
    useEffect(() => {
        if (!createRequested) return;
        setOffering(null);
        const next = new URLSearchParams(searchParams);
        next.delete('nova');
        setSearchParams(next, { replace: true });
    }, [createRequested, searchParams, setSearchParams]);

    const conflicts = useMemo(() => classScheduleConflicts(courses), [courses]);
    const selectedCourse = useMemo(() => Number.isSafeInteger(selectedId) && selectedId > 0 ? courses.find(course => Number(course.id) === selectedId) || null : null, [courses, selectedId]);
    const visibleConflicts = useMemo(() => selectedCourse ? conflicts.filter(conflict => conflict.turmas.some(course => Number(course.id) === selectedId)) : conflicts, [conflicts, selectedCourse, selectedId]);
    const classSaved = async (data, message) => {
        setOffering(undefined);
        await load();
        await loadPresentation();
        if (data?.id) setSearchParams({ turma: String(data.id) }, { replace: true });
        window.dispatchEvent(new Event('classes:updated'));
        showToast(message, 'success');
    };
    const presentationSaved = async () => {
        setConfiguring(null);
        await loadPresentation();
        window.dispatchEvent(new Event('class-presentation:updated'));
    };

    if (loading) return <PageSkeleton label="Carregando suas turmas" />;
    if (error && selectedId) return <div className="panel empty-state"><p role="alert">{error}</p><button type="button" className="btn btn-secondary" onClick={load}>Tentar novamente</button></div>;

    if (selectedCourse) return <>
        <CourseRoom key={`${selectedCourse.id}-${selectedCourse.local}`} course={selectedCourse} settings={presentation} onConfigure={() => setConfiguring(selectedCourse)} onEdit={() => setOffering(selectedCourse)} notice={visibleConflicts.length > 0 && <div role="alert" className="alert-warning">Há conflito de horários: {visibleConflicts.map(item => item.descricao).join('; ')}.</div>} />
        {offering !== undefined && <ProfessorClassModal course={offering} onClose={() => setOffering(undefined)} onSaved={data => classSaved(data, offering ? 'Turma atualizada com sucesso!' : 'Turma criada com sucesso!')} />}
        {configuring && <ClassSettingsModal course={configuring} onClose={() => setConfiguring(null)} onSaved={presentationSaved} />}
    </>;

    if (createRequested || offering !== undefined) return <ProfessorClassModal course={offering ?? null} onClose={() => setOffering(undefined)} onSaved={data => classSaved(data, 'Turma criada com sucesso!')} />;

    return <Navigate to="/professor/dashboard" replace />;
}
