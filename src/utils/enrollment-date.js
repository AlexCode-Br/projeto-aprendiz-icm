const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

function calendarParts(value, timeZone) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = Object.fromEntries(new globalThis.Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { key: `${parts.year}-${parts.month}-${parts.day}`, year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function formatEnrollmentDate(value, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
    const enrollment = calendarParts(value, timeZone);
    const current = calendarParts(now, timeZone);
    if (!enrollment || !current) return '';
    const difference = Math.round((Date.UTC(current.year, current.month - 1, current.day) - Date.UTC(enrollment.year, enrollment.month - 1, enrollment.day)) / 86_400_000);
    if (difference === 0) return 'Hoje';
    if (difference === 1) return 'Ontem';
    return `${String(enrollment.day).padStart(2, '0')}/${String(enrollment.month).padStart(2, '0')}/${enrollment.year}`;
}
