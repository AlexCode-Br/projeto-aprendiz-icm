import React from 'react';
import { classSchedules, scheduleText } from '../../shared/class-schedules.mjs';

export default function ClassScheduleList({ course }) {
    const slots = classSchedules(course);
    if (!slots.length) return <span className="text-text-muted">A definir</span>;
    return <ul className="space-y-1">{slots.map(slot => <li key={(slot.date || slot.weekday) + slot.start_time} className="break-words">{scheduleText(slot)}</li>)}</ul>;
}
