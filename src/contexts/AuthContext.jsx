import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
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

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rememberedSession, setRememberedSession] = useState(legacySessionIsPersistent);
    const navigate = useNavigate();

    const loadUser = useCallback(async () => {
        try {
            const response = await api.get('/api/auth/me');
            api.setCsrfToken(response.data.csrfToken);
            setUser(response.data.user);
        } catch {
            setRememberedSession(legacySessionIsPersistent());
            setUser(null);
            await clearLocalPushNotifications().catch(() => {});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUser(); }, [loadUser]);
    useEffect(() => {
        if (user && rememberedSession) syncExistingPushSubscription().catch(() => {});
    }, [user, rememberedSession]);

    const login = useCallback(async (email, password, remember = false, turnstileToken = '') => {
        const response = await api.post('/api/auth/login', { email, password, remember, turnstileToken });
        if (response.data.mfaRequired) return response.data;
        api.setCsrfToken(response.data.csrfToken);
        setRememberedSession(Boolean(remember));
        setLegacySessionPersistence(Boolean(remember));
        if (!remember) await disablePushNotifications().catch(() => {});
        setUser(response.data.user);
        return response.data.user;
    }, []);

    const verifyMfa = useCallback(async (challengeToken, code, remember = false) => {
        const response = await api.post('/api/auth/mfa/verify', { challengeToken, code });
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
            api.setCsrfToken('');
            api.setAccessToken('');
            setRememberedSession(false);
            setLegacySessionPersistence(false);
            setUser(null);
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const value = useMemo(() => ({
        isAuthenticated: Boolean(user), user, loading, login, verifyMfa, logout, refreshUser: loadUser, rememberedSession,
    }), [user, loading, login, verifyMfa, logout, loadUser, rememberedSession]);

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return context;
};
