import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    clearSupabaseAuthStorage,
    friendlyAuthError,
    isSupabaseSessionPersistent,
    setSupabaseSessionPersistence,
    supabase,
    usesSupabaseAuth,
} from '../services/supabase';

export const AuthContext = createContext(null);

async function exchangeSession(session, remember = false) {
    if (!session?.access_token) throw new Error('Sessão do Supabase não encontrada.');
    api.setAccessToken(session.access_token);
    try {
        const response = await api.post('/api/auth/exchange', { remember });
        api.setCsrfToken(response.data.csrfToken);
        return response.data.user;
    } finally {
        api.setAccessToken('');
    }
}

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
            if (!usesSupabaseAuth) {
                setUser(null);
            } else {
                const { data } = await supabase.auth.getSession();
                if (!data.session) setUser(null);
                else {
                    try { setUser(await exchangeSession(data.session, isSupabaseSessionPersistent())); }
                    catch { setUser(null); }
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);

    const login = useCallback(async (email, password, remember = false) => {
        if (usesSupabaseAuth) {
            setSupabaseSessionPersistence(remember);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw new Error(friendlyAuthError(error));
            try {
                const authenticatedUser = await exchangeSession(data.session, remember);
                setUser(authenticatedUser);
                return authenticatedUser;
            } catch (error) {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                clearSupabaseAuthStorage();
                throw error;
            }
        }
        const response = await api.post('/api/auth/login', { email, password, remember });
        api.setCsrfToken(response.data.csrfToken);
        setUser(response.data.user);
        return response.data.user;
    }, []);

    const logout = useCallback(async () => {
        try { await api.post('/api/auth/logout', {}); } finally {
            if (usesSupabaseAuth) {
                await supabase.auth.signOut().catch(() => {});
                clearSupabaseAuthStorage();
            }
            api.setCsrfToken('');
            api.setAccessToken('');
            setUser(null);
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const value = useMemo(() => ({
        isAuthenticated: Boolean(user), user, loading, login, logout, refreshUser: loadUser, usesSupabaseAuth,
    }), [user, loading, login, logout, loadUser]);

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return context;
};
