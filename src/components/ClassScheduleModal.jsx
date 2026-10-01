import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import ClassScheduleFields from './ClassScheduleFields';
import { classSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';

export default function ClassScheduleModal({ course, onClose, onSave }) {
    const nextId = useRef(0);
    const [slots,setSlots] = useState([]);
    const [error,setError] = useState('');
    const [saving,setSaving] = useState(false);
    useEffect(() => {
        if (!course) return;
        setSlots(classSchedules(course).map(slot => ({tipo:'semanal',...slot,key:nextId.current++})));
        setError('');
    },[course]);
    const submit = async event => {
        event.preventDefault();
        if (saving) return;
        const validation = validateClassSchedules(slots);
        if (validation) { setError(validation); return; }
        setSaving(true);
        setError('');
        try {
            await onSave(slots.map(({tipo,weekday,date,start_time})=>({tipo,weekday,date,start_time})));
            onClose();
        } catch (error) { setError(error.message || 'Não foi possível salvar os horários. Tente novamente.'); }
        finally { setSaving(false); }
    };
    return <Modal isOpen={Boolean(course)} onClose={() => { if (!saving) onClose(); }} title="Dias e horários de aula">
        <form onSubmit={submit} noValidate>
            <p className="font-semibold">{course?.nome} · {course?.local}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Cadastre aulas semanais ou datas específicas, sempre informando o horário de início.</p>
            <div className="mt-5"><ClassScheduleFields slots={slots} onChange={next => { setSlots(next); setError(''); }} onAdd={() => setSlots(current => [...current, { key: nextId.current++, tipo: 'semanal', weekday: '', date: '', start_time: '' }])} onRemove={key => { setSlots(current => current.filter(item => item.key !== key)); setError(''); }} disabled={saving} emptyMessage="Nenhum horário definido. Você pode adicionar uma aula ou salvar para manter a turma sem agenda." /></div>
            {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-5 flex border-t border-border pt-5 sm:justify-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar horários'}</button>
            </div>
        </form>
    </Modal>;
}
