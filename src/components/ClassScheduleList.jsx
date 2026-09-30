import React, { useId, useState } from 'react';
import { classSchedules, compactClassScheduleRows, scheduleText } from '../../shared/class-schedules.mjs';

export default function ClassScheduleList({ course, compact = false, maxVisible = Infinity }) {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const slots = classSchedules(course);
    if (!slots.length) return <span className="text-text-muted">A definir</span>;
    const rows = compact
        ? compactClassScheduleRows(course)
        : slots.map(slot => ({ key: `${slot.tipo || 'semanal'}/${slot.date || slot.weekday}/${slot.start_time}`, text: scheduleText(slot) }));
    const visibleRows = expanded ? rows : rows.slice(0, maxVisible);
    const remaining = rows.length - visibleRows.length;
    return <div className="min-w-0">
        <ul id={listId} className="space-y-1">{visibleRows.map(row => <li key={row.key} className="break-words">{row.text}</li>)}</ul>
        {rows.length > maxVisible && <button type="button" className="mt-1.5 font-semibold text-primary hover:underline" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(current => !current)}>{expanded ? 'Mostrar menos' : `Ver mais ${remaining} ${remaining === 1 ? 'horário' : 'horários'}`}</button>}
    </div>;
}
