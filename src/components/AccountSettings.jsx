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

    const saveProfile = async event => {
        event.preventDefault();
        if (saving || loading || loadError) return;
        const profileError = personNameError(profile.nome, 'nome completo');
        if (profileError) return showToast(profileError, 'warning');
        setSaving('profile');
        try {
            await api.put('/api/account/profile', profile);
            if (typeof photoChange === 'string') { await api.put('/api/profile-photo', { dataUrl: photoChange }); setPhotoUrl('/api/profile-photo'); }
            else if (photoChange === null) { await api.delete('/api/profile-photo'); setPhotoUrl(''); }
            setPhotoChange(undefined);
            setPhotoVersion(Date.now());
            window.dispatchEvent(new CustomEvent('profile-photo:updated'));
            await refreshUser();
            showToast('Dados pessoais atualizados.', 'success');
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
                const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: password.currentPassword });
                if (signInError) throw new Error(friendlyAuthError(signInError));
                const { error: updateError } = await supabase.auth.updateUser({ password: password.newPassword });
                if (updateError) throw new Error(friendlyAuthError(updateError));
                await api.post('/api/account/security-alert', {}).catch(() => {});
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
            <h2 className="form-section-title"><UserRound aria-hidden="true" />Seu perfil</h2><p className="text-sm text-text-muted">Escolha como seu nome e sua foto aparecem no projeto.</p>
            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
                <label className="text-sm font-medium text-text-default">Nome completo<input required maxLength="100" autoComplete="name" value={profile.nome} onChange={event => setProfile({ ...profile, nome: event.target.value })} className={fieldClass} /></label>
                <ProfilePhotoPicker name={profile.nome} currentUrl={photoUrl ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}view=${photoVersion}` : ''} value={photoChange} onChange={setPhotoChange} disabled={saving === 'profile'} />
            </div>
            <div className="mt-5 flex justify-end"><button disabled={Boolean(saving)} className="submit-btn disabled:opacity-60"><Save aria-hidden="true" />{saving === 'profile' ? 'Salvando...' : 'Salvar perfil'}</button></div>
        </form>
        <form onSubmit={changePassword} className="panel p-5 md:p-7">
            <h2 className="form-section-title"><LockKeyhole aria-hidden="true" />Segurança da conta</h2><p className="text-sm text-text-muted mt-1">A alteração encerra suas outras sessões abertas.</p>
            <div className="grid md:grid-cols-3 gap-5 mt-5"><div><label className="form-label" htmlFor="settings-currentPassword">Senha atual</label><PasswordInput id="settings-currentPassword" required autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} className={fieldClass} /></div><div><label className="form-label" htmlFor="settings-newPassword">Nova senha</label><PasswordInput id="settings-newPassword" required autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} className={fieldClass} /></div><div><label className="form-label" htmlFor="settings-confirmation">Confirmar nova senha</label><PasswordInput id="settings-confirmation" required autoComplete="new-password" value={password.confirmation} onChange={event => setPassword({ ...password, confirmation: event.target.value })} className={fieldClass} /></div></div>
            <p className={`text-xs mt-3 ${password.newPassword && passwordValid ? 'text-success' : 'text-text-muted'}`}>Use ao menos 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
            <div className="mt-5 flex justify-end"><button disabled={Boolean(saving)} className="submit-btn disabled:opacity-60">{saving === 'password' ? 'Alterando...' : 'Alterar senha'}</button></div>
        </form>
        <section className="panel p-5 md:p-7">
            <h2 className="form-section-title"><Bell aria-hidden="true" />Notificações por e-mail</h2>
            <p className="mt-1 text-sm text-text-muted">Escolha quais atualizações serão enviadas ao e-mail de acesso cadastrado.</p>
            <div className="mt-4 divide-y divide-border">{options.map(([key, title, description]) => <div key={key} className="py-4"><FormSwitch checked={Boolean(preferences[key])} onChange={event => setPreferences({ ...preferences, [key]: event.target.checked })} label={title} description={description} /></div>)}</div>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={testNotifications} disabled={Boolean(saving)} className="btn btn-secondary disabled:opacity-60"><Mail aria-hidden="true" />{saving === 'test-notification' ? 'Enviando...' : 'Enviar teste'}</button><button type="button" onClick={savePreferences} disabled={Boolean(saving)} className="submit-btn disabled:opacity-60">{saving === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button></div>
        </section>
    </div>;
}
