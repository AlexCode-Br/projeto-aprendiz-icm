import React, { useEffect, useRef, useState } from 'react';
import { MonitorPlay } from 'lucide-react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import CourseIcon from './CourseIcon';
import ClassScheduleFields from './ClassScheduleFields';
import api from '../services/api';
import { classSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';
import { catalogKey } from '../../shared/catalog-options.mjs';

const payloadSchedules = slots => slots.map(({ tipo, weekday, date, start_time }) => ({ tipo, weekday, date, start_time }));

export default function ProfessorClassModal({ course = null, onClose, onSaved }) {
    const nextId = useRef(0);
    const [options, setOptions] = useState({ cursos: [], locais: [] });
    const [form, setForm] = useState({ courseId: '', locationId: '' });
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        let active = true;
        setLoading(true);
        api.get('/api/professores/me/turmas/opcoes').then(({ data }) => {
            if (!active) return;
            const cursos = data.cursos || [], locais = data.locais || [];
            setOptions({ cursos, locais });
            setForm({
                courseId: course ? cursos.find(item => catalogKey(item.nome) === catalogKey(course.nome))?.id || '' : '',
                locationId: course ? locais.find(item => catalogKey(item.nome) === catalogKey(course.local))?.id || '' : '',
            });
            const current = course ? classSchedules(course) : [{ tipo: 'semanal', weekday: '', date: '', start_time: '' }];
            setSlots(current.map(slot => ({ tipo: 'semanal', ...slot, key: nextId.current++ })));
            setErrors({});
        }).catch(error => { if (active) setErrors({ geral: error.message || 'Não foi possível carregar os cursos e locais.' }); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [course]);

    const submit = async event => {
        event.preventDefault();
        const scheduleError = slots.length ? validateClassSchedules(payloadSchedules(slots)) : 'Cadastre ao menos um dia e horário de aula.';
        const nextErrors = {
            curso: form.courseId ? '' : 'Selecione o curso que você irá ofertar.',
            local: form.locationId ? '' : 'Selecione a igreja ou modalidade.',
            horarios: scheduleError,
        };
        if (Object.values(nextErrors).some(Boolean)) { setErrors(nextErrors); return; }
        setSaving(true); setErrors({});
        try {
            const payload = { courseId: Number(form.courseId), locationId: Number(form.locationId), horarios: payloadSchedules(slots) };
            const { data } = course
                ? await api.put(`/api/professores/me/turmas/${course.id}`, payload)
                : await api.post('/api/professores/me/turmas', payload);
            await onSaved(data);
        } catch (error) {
            setErrors({ ...error.response?.data?.errors, geral: error.message || 'Não foi possível salvar a turma.' });
        } finally { setSaving(false); }
    };

    const courseOptions = options.cursos.map(item => ({ value: item.id, label: item.nome }));
    const locationOptions = options.locais.map(item => ({ value: item.id, label: item.nome }));

    return <Modal isOpen onClose={() => { if (!saving) onClose(); }} title={course ? 'Editar curso' : 'Ofertar um curso'} maxWidth="max-w-3xl">
        {loading ? <p role="status">Carregando opções…</p> : <form onSubmit={submit} noValidate className="space-y-5">
            <p className="text-sm leading-6 text-text-muted">{course ? 'Atualize a igreja ou modalidade e os dias e horários desta turma.' : 'Defina o curso, a igreja ou modalidade e quando as aulas acontecerão. A turma aparecerá para a gestão assim que for salva.'}</p>
            {errors.geral && <p role="alert" className="alert-error">{errors.geral}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="teacher-course" className="form-label">Curso ofertado</label><FormSelect id="teacher-course" name="courseId" value={form.courseId} onChange={event => { setForm(current => ({ ...current, courseId: event.target.value })); setErrors(current => ({ ...current, curso: '' })); }} options={courseOptions} isDisabled={Boolean(course) || saving} invalid={Boolean(errors.curso)} placeholder="Selecione o curso" formatOptionLabel={option => <span className="flex items-center gap-2"><CourseIcon name={option.label} className="h-5 w-5 shrink-0" /><span>{option.label}</span></span>} />{course && <p className="mt-1 text-xs text-text-muted">Para preservar matrículas e históricos, o curso não muda depois da criação.</p>}{errors.curso && <p className="mt-1 text-xs text-danger">{errors.curso}</p>}</div>
                <div><label htmlFor="teacher-location" className="form-label">Igreja ou modalidade</label><FormSelect id="teacher-location" name="locationId" value={form.locationId} onChange={event => { setForm(current => ({ ...current, locationId: event.target.value })); setErrors(current => ({ ...current, local: '' })); }} options={locationOptions} isDisabled={saving} invalid={Boolean(errors.local)} placeholder="Selecione uma igreja ou EAD" formatOptionLabel={option => <span className="flex items-center gap-2">{catalogKey(option.label) === 'ead' && <MonitorPlay aria-hidden="true" className="h-5 w-5 shrink-0" />}<span>{option.label}</span></span>} />{errors.local && <p className="mt-1 text-xs text-danger">{errors.local}</p>}</div>
            </div>
            <section className="rounded-xl border border-border p-4"><h3 className="mb-1 font-semibold">Dias e horários</h3><p className="mb-4 text-sm text-text-muted">Você pode combinar aulas semanais e datas específicas.</p><ClassScheduleFields slots={slots} onChange={next => { setSlots(next); setErrors(current => ({ ...current, horarios: '' })); }} onAdd={() => setSlots(current => [...current, { key: nextId.current++, tipo: 'semanal', weekday: '', date: '', start_time: '' }])} onRemove={key => setSlots(current => current.filter(item => item.key !== key))} disabled={saving} />{errors.horarios && <p className="mt-3 text-sm text-danger" role="alert">{errors.horarios}</p>}</section>
            <button type="submit" className="btn btn-primary w-full" disabled={saving}>{saving ? 'Salvando…' : course ? 'Salvar alterações' : 'Criar turma'}</button>
        </form>}
    </Modal>;
}
