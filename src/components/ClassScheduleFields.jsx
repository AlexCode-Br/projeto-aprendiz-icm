import React, { useId, useRef } from 'react';
import { CalendarDays, Clock3, Plus, Trash2 } from 'lucide-react';
import { CLASS_WEEKDAYS, MAX_CLASS_SCHEDULES } from '../../shared/class-schedules.mjs';

const shortDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function ClassScheduleFields({ slots, onChange, disabled = false, emptyMessage = 'Escolha os dias em que a turma terá aula.' }) {
    const prefix = useId();
    const sequence = useRef(0);
    const newKey = () => `${prefix}-${sequence.current++}`;
    const groups = [...slots.reduce((map, slot) => {
        const id = slot.groupKey || (slot.tipo === 'data' ? `date-${slot.key}` : `weekly-${slot.start_time}`);
        const group = map.get(id) || { id, tipo: slot.tipo || 'semanal', time: slot.start_time, date: slot.date || '', items: [] };
        group.items.push(slot);
        map.set(id, group);
        return map;
    }, new Map()).values()];
    const replace = (group, items) => {
        const keys = new Set(group.items.map(item => item.key));
        onChange(slots.flatMap(slot => keys.has(slot.key) ? (slot.key === group.items[0].key ? items : []) : [slot]));
    };
    const toggleDay = (group, day) => {
        const days = new Set(group.items.map(item => item.weekday).filter(Boolean));
        if (days.has(day)) days.delete(day); else days.add(day);
        const items = [...days].sort((a, b) => CLASS_WEEKDAYS.indexOf(a) - CLASS_WEEKDAYS.indexOf(b)).map(weekday => ({ key: newKey(), groupKey: group.id, tipo: 'semanal', weekday, start_time: group.time }));
        replace(group, items.length ? items : [{ key: newKey(), groupKey: group.id, tipo: 'semanal', weekday: '', start_time: group.time }]);
    };
    const add = tipo => onChange([...slots, { key: newKey(), groupKey: newKey(), tipo, weekday: '', date: '', start_time: '' }]);

    return <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="sr-only">Dias e horários da turma</legend>
        {!groups.length && <p className="text-sm text-text-muted">{emptyMessage}</p>}
        {groups.map((group, index) => <section key={group.id} className="rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4" aria-label={`Horário ${index + 1}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">{group.tipo === 'data' ? <CalendarDays aria-hidden="true" className="h-4 w-4" /> : <Clock3 aria-hidden="true" className="h-4 w-4" />}{group.tipo === 'data' ? 'Data avulsa' : 'Toda semana'}</span>
                <button type="button" onClick={() => replace(group, [])} className="icon-button text-text-muted hover:text-danger" aria-label={`Remover horário ${index + 1}`}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
            </div>
            {group.tipo !== 'data' && <fieldset className="mb-4"><legend className="mb-2 text-xs text-text-muted">Selecione um ou mais dias</legend><div className="grid grid-cols-7 gap-1.5">{CLASS_WEEKDAYS.map((day, dayIndex) => {
                const selected = group.items.some(item => item.weekday === day);
                const atLimit = !selected && slots.length >= MAX_CLASS_SCHEDULES && group.items.every(item => item.weekday);
                return <button key={day} type="button" aria-label={day} aria-pressed={selected} disabled={disabled || atLimit} onClick={() => toggleDay(group, day)} className={`min-h-11 rounded-lg border text-xs font-semibold transition-colors sm:text-sm ${selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-default hover:border-primary'}`}>{shortDays[dayIndex]}</button>;
            })}</div></fieldset>}
            <div className="flex flex-wrap items-end gap-3">
                {group.tipo === 'data' && <div className="min-w-0 flex-1"><label htmlFor={`${prefix}-date-${index}`} className="form-label">Data da aula</label><input id={`${prefix}-date-${index}`} type="date" value={group.date} onChange={event => replace(group, group.items.map(item => ({ ...item, groupKey: group.id, date: event.target.value })))} className="form-control" required /></div>}
                <div className="w-36 max-w-full"><label htmlFor={`${prefix}-time-${index}`} className="form-label">Horário de início</label><input id={`${prefix}-time-${index}`} type="time" value={group.time} onChange={event => replace(group, group.items.map(item => ({ ...item, groupKey: group.id, start_time: event.target.value })))} className="form-control" required /></div>
                {group.tipo !== 'data' && <p className="pb-3 text-xs text-text-muted">Mesmo horário para os dias selecionados.</p>}
            </div>
        </section>)}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => add('semanal')} disabled={disabled || slots.length >= MAX_CLASS_SCHEDULES} className="btn btn-secondary flex-1 text-sm"><Plus aria-hidden="true" />{groups.length ? 'Outro horário semanal' : 'Horário semanal'}</button><button type="button" onClick={() => add('data')} disabled={disabled || slots.length >= MAX_CLASS_SCHEDULES} className="btn btn-secondary flex-1 text-sm"><CalendarDays aria-hidden="true" />Data avulsa</button></div>
        <p className="text-xs text-text-muted">Horário de Salvador (Brasília). Datas avulsas acrescentam aulas à agenda semanal.</p>
    </fieldset>;
}
