const keys = ['wallPosts', 'wallComments', 'wallLikes'];
export function wallPreferenceValue(preferences) {
    const enabled = keys.filter(key => preferences[key] !== false).length;
    return enabled === 3 ? 'all' : enabled === 0 ? 'none' : 'mixed';
}
export function updateWallPreferences(preferences, value) {
    if (!['all', 'none'].includes(value)) return preferences;
    return { ...preferences, ...Object.fromEntries(keys.map(key => [key, value === 'all'])) };
}
