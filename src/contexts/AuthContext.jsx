import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { canRestoreServerSession } from '../services/authSessionPolicy';
import {
    clearSupabaseAuthStorage,
    friendlyAuthError,
    isSupabaseSessionPersistent,
    setSupabaseSessionPersistence,
    supabase,
    usesSupabaseAuth,
} from '../services/supabase';
import { clearLocalPushNotifications, disablePushNotifications, syncExistingPushSubscription } from '../services/pushNotifications';

export const AuthContext = createContext(null);
const LEGACY_SESSION_PERSISTENCE_KEY = 'projeto-aprendiz-session-persistence';

function legacySessionIsPersistent() {
    try { return window.localStorage.getItem(LEGACY_SESSION_PERSISTENCE_KEY) === 'local'; }
    catch { return false; }
}

function setLegacySessionPersistence(remember) {
    try {
        if (remember) window.localStorage.setItem(LEGACY_SESSION_PERSISTENCE_KEY, 'local');
        else window.localStorage.removeItem(LEGACY_SESSION_PERSISTENCE_KEY);
    } catch { /* storage can be unavailable in privacy-restricted browsers */ }
}

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
    const [rememberedSession, setRememberedSession] = useState(() => usesSupabaseAuth ? isSupabaseSessionPersistent() : legacySessionIsPersistent());
    const navigate = useNavigate();

    const loadUser = useCallback(async () => {
        let supabaseSession = null;
        let persistentSession = usesSupabaseAuth ? isSupabaseSessionPersistent() : legacySessionIsPersistent();
        try {
            if (usesSupabaseAuth) {
                const { data } = await supabase.auth.getSession();
                supabaseSession = data.session;

                // A persistent app session is backed by the secure server cookie.
                // Some installed browsers can restore that cookie before exposing
                // Supabase's local state, so do not send remembered users back to
                // login only because the intermediary token is temporarily absent.
                if (!canRestoreServerSession({ usesSupabaseAuth, supabaseSession, persistentSession })) {
                    setRememberedSession(false);
                    setUser(null);
                    await clearLocalPushNotifications().catch(() => {});
                    return;
                }
                setRememberedSession(persistentSession);
            }
            const response = await api.get('/api/auth/me');
            api.setCsrfToken(response.data.csrfToken);
            setUser(response.data.user);
        } catch {
            if (!usesSupabaseAuth) {
                setRememberedSession(legacySessionIsPersistent());
                setUser(null);
                await clearLocalPushNotifications().catch(() => {});
            } else {
                if (!supabaseSession) {
                    setRememberedSession(false);
                    setUser(null);
                    clearSupabaseAuthStorage();
                    await clearLocalPushNotifications().catch(() => {});
                } else {
                    try { setUser(await exchangeSession(supabaseSession, persistentSession)); }
                    catch { setRememberedSession(false); setUser(null); }
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);
    useEffect(() => {
        if (user && rememberedSession) syncExistingPushSubscription().catch(() => {});
    }, [user, rememberedSession]);

    const login = useCallback(async (email, password, remember = false) => {
        if (usesSupabaseAuth) {
            setSupabaseSessionPersistence(remember);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw new Error(friendlyAuthError(error));
            try {
                const authenticatedUser = await exchangeSession(data.session, remember);
                setRememberedSession(Boolean(remember));
                if (!remember) await disablePushNotifications().catch(() => {});
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
        setRememberedSession(Boolean(remember));
        setLegacySessionPersistence(Boolean(remember));
        if (!remember) await disablePushNotifications().catch(() => {});
        setUser(response.data.user);
        return response.data.user;
    }, []);

    const logout = useCallback(async () => {
        try {
            await disablePushNotifications().catch(() => {});
            await api.post('/api/auth/logout', {});
        } finally {
            if (usesSupabaseAuth) {
                await supabase.auth.signOut().catch(() => {});
                clearSupabaseAuthStorage();
            }
            api.setCsrfToken('');
            api.setAccessToken('');
            setRememberedSession(false);
            setLegacySessionPersistence(false);
            setUser(null);
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const value = useMemo(() => ({
        isAuthenticated: Boolean(user), user, loading, login, logout, refreshUser: loadUser, usesSupabaseAuth, rememberedSession,
    }), [user, loading, login, logout, loadUser, rememberedSession]);

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return context;
};
