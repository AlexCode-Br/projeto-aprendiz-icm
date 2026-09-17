import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import FormSelect from './FormSelect';
import { CLASS_WEEKDAYS, MAX_CLASS_SCHEDULES, classSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';

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
    const update = (key,field,value) => {
        setSlots(current => current.map(slot => slot.key === key ? {...slot,[field]:value} : slot));
        setError('');
    };
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
            <fieldset disabled={saving} className="mt-5 space-y-3">
                <legend className="sr-only">Horários semanais da turma</legend>
                {slots.map((slot,index) => <fieldset key={slot.key} className="rounded-xl border border-border bg-surface-muted/40 p-3">
                    <legend className="sr-only">Aula {index+1}</legend>
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-text-muted">Horário {index+1}</span>
                        <button type="button" onClick={() => { setSlots(current=>current.filter(item=>item.key!==slot.key)); setError(''); }} className="icon-button text-danger" aria-label={`Remover horário ${index+1}`}><Trash2 aria-hidden="true" className="!h-4 !w-4" /></button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_7rem]">
                        <div className="min-w-0"><label htmlFor={`schedule-type-${slot.key}`} className="form-label">Recorrência</label><FormSelect id={`schedule-type-${slot.key}`} value={slot.tipo} options={[{value:'semanal',label:'Toda semana'},{value:'data',label:'Data específica'}]} onChange={event=>update(slot.key,'tipo',event.target.value)} isDisabled={saving} /></div>
                        <div className="min-w-0">
                            <label htmlFor={`schedule-day-${slot.key}`} className="form-label">{slot.tipo === 'data' ? 'Data da aula' : 'Dia da semana'}</label>
                            {slot.tipo === 'data' ? <input id={`schedule-day-${slot.key}`} type="date" value={slot.date || ''} onChange={event=>update(slot.key,'date',event.target.value)} className="form-control" required /> : <FormSelect id={`schedule-day-${slot.key}`} value={slot.weekday} options={CLASS_WEEKDAYS} onChange={event=>update(slot.key,'weekday',event.target.value)} placeholder="Selecione o dia" isDisabled={saving} />}
                        </div>
                        <div className="min-w-0">
                            <label htmlFor={`schedule-time-${slot.key}`} className="form-label">Início da aula</label>
                            <input id={`schedule-time-${slot.key}`} type="time" value={slot.start_time} onInput={event=>update(slot.key,'start_time',event.currentTarget.value)} onChange={event=>update(slot.key,'start_time',event.target.value)} className="form-control" required />
                        </div>
                    </div>
                </fieldset>)}
                {!slots.length && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">Nenhum horário definido. Ao salvar assim, a turma ficará com horário “A definir”.</p>}
                <button type="button" onClick={()=>setSlots(current=>[...current,{key:nextId.current++,tipo:'semanal',weekday:'',date:'',start_time:''}])} disabled={slots.length>=MAX_CLASS_SCHEDULES} className="btn btn-secondary w-full"><Plus aria-hidden="true" />Adicionar aula</button>
            </fieldset>
            {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-5 flex border-t border-border pt-5 sm:justify-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar horários'}</button>
            </div>
        </form>
    </Modal>;
}
