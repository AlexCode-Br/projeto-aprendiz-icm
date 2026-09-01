import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SchoolYearContext = createContext(null);
const STORAGE_KEY = 'projeto-aprendiz-school-year';

export function SchoolYearProvider({ children }) {
    const { user } = useAuth();
    const [periods, setPeriods] = useState([]);
    const [selectedId, setSelectedIdState] = useState('');
    const [loading, setLoading] = useState(Boolean(user));

    const refresh = useCallback(async preferredId => {
        if (!user) {
            setPeriods([]);
            setSelectedIdState('');
            api.setSchoolYearId('');
            setLoading(false);
            return [];
        }
        setLoading(true);
        try {
            const { data } = await api.get('/api/school-years');
            const nextPeriods = data.periods || [];
            const storedId = Number(localStorage.getItem(STORAGE_KEY));
            const preferred = nextPeriods.find(period => period.id === Number(preferredId))
                || nextPeriods.find(period => period.id === storedId)
                || nextPeriods.find(period => period.id === Number(selectedId))
                || nextPeriods.find(period => period.active)
                || nextPeriods[0];
            const nextId = preferred ? String(preferred.id) : '';
            setPeriods(nextPeriods);
            setSelectedIdState(nextId);
            api.setSchoolYearId(nextId);
            if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
            return nextPeriods;
        } finally {
            setLoading(false);
        }
    }, [selectedId, user]);

    useEffect(() => { refresh().catch(() => setLoading(false)); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectPeriod = useCallback(id => {
        const nextId = String(id || '');
        if (!periods.some(period => String(period.id) === nextId)) return;
        setSelectedIdState(nextId);
        api.setSchoolYearId(nextId);
        localStorage.setItem(STORAGE_KEY, nextId);
    }, [periods]);

    const selectedPeriod = periods.find(period => String(period.id) === selectedId) || null;
    const value = useMemo(() => ({ periods, selectedId, selectedPeriod, loading, selectPeriod, refresh }), [periods, selectedId, selectedPeriod, loading, selectPeriod, refresh]);
    return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

export function useSchoolYear() {
    const context = useContext(SchoolYearContext);
    if (!context) throw new Error('useSchoolYear precisa estar dentro de SchoolYearProvider.');
    return context;
}
