import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserRound, LockKeyhole, Bell, Save, Mail } from 'lucide-react';
import FormSwitch from './FormSwitch';
import PasswordInput from './PasswordInput';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import PageSkeleton from './PageSkeleton';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { friendlyAuthError, supabase } from '../services/supabase';
import { personNameError } from '../../shared/validation.mjs';

const fieldClass = 'form-control mt-1';

export default function AccountSettings() {
    const { user, refreshUser, usesSupabaseAuth } = useAuth();
    const { showToast } = useToast();
    const [profile, setProfile] = useState({ nome: user?.nome || '' });
    const [photoChange, setPhotoChange] = useState(undefined);
    const [photoVersion, setPhotoVersion] = useState(Date.now());
    const [photoUrl, setPhotoUrl] = useState('');
    const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
    const [preferences, setPreferences] = useState({ newStudent: true, newTicket: true, courseUpdates: true, systemAlerts: true });
    const [saving, setSaving] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const loadAccount = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const { data } = await api.get('/api/account');
            setProfile({ nome: data.user.nome });
            setPhotoUrl(data.photoUrl || '');
            setPreferences(previous => ({ ...previous, ...data.preferences }));
        } catch (error) { setLoadError(error.message || 'Não foi possível carregar sua conta.'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { loadAccount(); }, [loadAccount]);

    const passwordValid = useMemo(() => password.newPassword.length >= 10 && /[A-Z]/.test(password.newPassword) && /[a-z]/.test(password.newPassword) && /\d/.test(password.newPassword) && /[^A-Za-z0-9]/.test(password.newPassword), [password.newPassword]);

    const savePhoto = async nextPhoto => {
        if (saving || loading || loadError) return false;
        const previousPhotoUrl = photoUrl;
        setPhotoChange(nextPhoto);
        setSaving('photo');
        try {
            if (typeof nextPhoto === 'string') {
                const { data } = await api.put('/api/profile-photo', { dataUrl: nextPhoto });
                setPhotoUrl(data.url || '/api/profile-photo');
            } else {
                await api.delete('/api/profile-photo');
                setPhotoUrl('');
            }
            setPhotoChange(undefined);
            setPhotoVersion(Date.now());
            window.dispatchEvent(new CustomEvent('profile-photo:updated'));
            await refreshUser();
            showToast(nextPhoto === null ? 'Foto de perfil removida.' : 'Foto de perfil salva automaticamente.', 'success');
            return true;
        } catch (error) {
            setPhotoUrl(previousPhotoUrl);
            setPhotoChange(undefined);
            showToast(error.message || 'Não foi possível salvar a foto.', 'error');
            throw error;
        } finally { setSaving(''); }
    };

    const saveProfile = async event => {
        event.preventDefault();
        if (saving || loading || loadError) return;
        const profileError = personNameError(profile.nome, 'nome completo');
        if (profileError) return showToast(profileError, 'warning');
        setSaving('profile');
        try {
            await api.put('/api/account/profile', profile);
            await refreshUser();
            showToast('Nome atualizado com sucesso.', 'success');
        }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const changePassword = async event => {
        event.preventDefault();
        if (saving || loading || loadError) return;
        if (!passwordValid) return showToast('A nova senha não atende aos requisitos.', 'warning');
        if (password.newPassword !== password.confirmation) return showToast('As senhas não coincidem.', 'warning');
        setSaving('password');
        try {
            if (usesSupabaseAuth) {
                const { error: updateError } = await supabase.auth.updateUser({ password: password.newPassword, current_password: password.currentPassword });
                if (updateError) throw new Error(friendlyAuthError(updateError));
                const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' });
                if (revokeError) throw new Error('A senha foi alterada, mas não foi possível encerrar as outras sessões. Entre novamente e tente de novo.');
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData.session?.access_token) throw new Error('A senha foi alterada, mas sua sessão precisa ser renovada. Entre novamente.');
                api.setAccessToken(sessionData.session.access_token);
                try { await api.post('/api/account/password-changed', {}); }
                finally { api.setAccessToken(''); }
            } else {
                await api.put('/api/account/password', { currentPassword: password.currentPassword, newPassword: password.newPassword });
            }
            setPassword({ currentPassword: '', newPassword: '', confirmation: '' });
            showToast('Senha alterada com sucesso.', 'success');
        }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const savePreferences = async () => {
        if (saving || loading || loadError) return;
        setSaving('preferences');
        try { const { data } = await api.put('/api/account/preferences', { preferences }); setPreferences(data.preferences); showToast('Preferências salvas e ativas.', 'success'); }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const testNotifications = async () => {
        if (saving || loading || loadError) return;
        setSaving('test-notification');
        try { const { data } = await api.post('/api/account/preferences/test', {}); showToast(data.message, 'success', 6000); }
        catch (error) { showToast(error.message, 'error', 6000); } finally { setSaving(''); }
    };
    const options = user?.role === 'gestor' ? [
        ['newStudent', 'Novas inscrições', 'Avisar quando um aluno for cadastrado.'], ['newTicket', 'Novos chamados', 'Avisar sobre solicitações de suporte.'], ['courseUpdates', 'Alterações em turmas', 'Receber atualizações de cursos e professores.'], ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
    ] : [
        ['newStudent', 'Novos alunos', 'Avisar quando um aluno entrar em uma de suas turmas.'], ['newTicket', 'Respostas do suporte', 'Avisar quando houver uma resposta em seus chamados.'], ['courseUpdates', 'Alterações nas turmas', 'Receber mudanças de curso, local ou horário.'], ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
    ];

    if (loading) return <PageSkeleton />;
    if (loadError) return <div className="space-y-6"><h1 className="page-title">Configurações da conta</h1><div className="panel p-6"><p role="alert" className="text-danger">{loadError}</p><button type="button" onClick={loadAccount} className="btn btn-secondary mt-4">Tentar novamente</button></div></div>;

    return <div className="space-y-6 max-w-5xl">
        <div><h1 className="page-title">Configurações da conta</h1><p className="page-description">Personalize seu perfil, proteja sua conta e escolha o que deseja receber.</p></div>
        <form onSubmit={saveProfile} className="panel p-5 md:p-7">
            <div className="settings-section-header">
                <h2 className="form-section-title"><UserRound aria-hidden="true" />Seu perfil</h2>
                <button disabled={Boolean(saving)} className="submit-btn justify-self-end disabled:opacity-60"><Save aria-hidden="true" />{saving === 'profile' ? 'Salvando...' : 'Salvar nome'}</button>
                <p className="col-span-2 text-sm text-text-muted">Escolha como seu nome e sua foto aparecem no projeto.</p>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5">
                <ProfilePhotoPicker name={profile.nome} currentUrl={photoUrl ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}view=${photoVersion}` : ''} value={photoChange} onChange={savePhoto} disabled={Boolean(saving)} saving={saving === 'photo'} />
                <label className="text-sm font-medium text-text-default">Nome completo<input required maxLength="100" autoComplete="name" value={profile.nome} onChange={event => setProfile({ ...profile, nome: event.target.value })} className={fieldClass} /></label>
            </div>
        </form>
        <form onSubmit={changePassword} className="panel p-5 md:p-7">
            <div className="settings-section-header">
                <h2 className="form-section-title"><LockKeyhole aria-hidden="true" />Segurança da conta</h2>
                <button disabled={Boolean(saving)} className="submit-btn justify-self-end disabled:opacity-60">{saving === 'password' ? 'Alterando...' : 'Alterar senha'}</button>
                <p className="col-span-2 text-sm text-text-muted">A alteração encerra suas outras sessões abertas.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 mt-5"><div><label className="form-label" htmlFor="settings-currentPassword">Senha atual</label><PasswordInput id="settings-currentPassword" required autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} className={fieldClass} /></div><div><label className="form-label" htmlFor="settings-newPassword">Nova senha</label><PasswordInput id="settings-newPassword" required autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} className={fieldClass} /></div><div><label className="form-label" htmlFor="settings-confirmation">Confirmar nova senha</label><PasswordInput id="settings-confirmation" required autoComplete="new-password" value={password.confirmation} onChange={event => setPassword({ ...password, confirmation: event.target.value })} className={fieldClass} /></div></div>
            <p className={`text-xs mt-3 ${password.newPassword && passwordValid ? 'text-success' : 'text-text-muted'}`}>Use ao menos 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
        </form>
        <section className="panel p-5 md:p-7">
            <div className="settings-section-header">
                <h2 className="form-section-title"><Bell aria-hidden="true" />Notificações por e-mail</h2>
                <button type="button" onClick={savePreferences} disabled={Boolean(saving)} className="submit-btn justify-self-end disabled:opacity-60">{saving === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-text-muted">Escolha quais atualizações serão enviadas ao e-mail de acesso cadastrado.</p>
                    <button type="button" onClick={testNotifications} disabled={Boolean(saving)} className="inline-flex min-h-9 items-center gap-2 rounded text-sm font-semibold text-primary hover:underline disabled:opacity-60"><Mail aria-hidden="true" />{saving === 'test-notification' ? 'Enviando...' : 'Enviar teste'}</button>
                </div>
            </div>
            <div className="mt-4 divide-y divide-border">{options.map(([key, title, description]) => <div key={key} className="py-4"><FormSwitch checked={Boolean(preferences[key])} onChange={event => setPreferences({ ...preferences, [key]: event.target.checked })} label={title} description={description} /></div>)}</div>
        </section>
    </div>;
}
