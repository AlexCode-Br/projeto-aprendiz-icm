export const MAX_VISIBLE_CLASSES = 6;

const compareNames = (left, right) => String(left.curso || '').localeCompare(
    String(right.curso || ''),
    'pt-BR',
    { sensitivity: 'base', numeric: true },
);

const compareStable = (left, right) => compareNames(left, right)
    || String(left.local || '').localeCompare(String(right.local || ''), 'pt-BR', { sensitivity: 'base', numeric: true })
    || Number(left.id || 0) - Number(right.id || 0);

export function rankEnrollmentClasses(data = [], sortBy = 'most', limit = MAX_VISIBLE_CLASSES) {
    const classes = data.map(item => ({
        ...item,
        total: Math.max(0, Number(item.total) || 0),
    }));

    classes.sort((left, right) => {
        if (sortBy === 'least') return left.total - right.total || compareStable(left, right);
        if (sortBy === 'az') return compareStable(left, right);
        if (sortBy === 'za') return compareStable(right, left);
        return right.total - left.total || compareStable(left, right);
    });

    return classes.slice(0, limit);
}

export function enrollmentBarWidth(total, largestTotal) {
    const maximum = Math.max(0, Number(largestTotal) || 0);
    if (!maximum) return 0;
    return Math.min(100, (Math.max(0, Number(total) || 0) / maximum) * 100);
}
