import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const loadUser = useCallback(async () => {
        try {
            const response = await api.get('/api/auth/me');
            api.setCsrfToken(response.data.csrfToken);
            setUser(response.data.user);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);

    const login = async (email, password, remember = false) => {
        const response = await api.post('/api/auth/login', { email, password, remember });
        api.setCsrfToken(response.data.csrfToken);
        setUser(response.data.user);
        return response.data.user;
    };

    const logout = async () => {
        try { await api.post('/api/auth/logout', {}); } finally {
            api.setCsrfToken('');
            setUser(null);
            navigate('/login', { replace: true });
        }
    };

    const value = useMemo(() => ({
        isAuthenticated: Boolean(user), user, loading, login, logout, refreshUser: loadUser,
    }), [user, loading, loadUser]);

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return context;
};
