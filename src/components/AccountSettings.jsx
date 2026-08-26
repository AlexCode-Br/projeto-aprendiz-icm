import React, { useEffect, useMemo, useState } from 'react';
import FormCheckbox from './FormCheckbox';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { friendlyAuthError, supabase } from '../services/supabase';
import { emailError, personNameError } from '../../shared/validation.mjs';

const fieldClass = 'form-control mt-1';

export default function AccountSettings() {
    const { user, refreshUser, usesSupabaseAuth } = useAuth();
    const { showToast } = useToast();
    const [profile, setProfile] = useState({ nome: user?.nome || '', email: user?.email || '' });
    const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
    const [preferences, setPreferences] = useState({ newStudent: true, newTicket: true, courseUpdates: true, systemAlerts: true });
    const [saving, setSaving] = useState('');

    useEffect(() => {
        api.get('/api/account').then(({ data }) => {
            setProfile({ nome: data.user.nome, email: data.user.email });
            setPreferences(previous => ({ ...previous, ...data.preferences }));
        }).catch(error => showToast(error.message, 'error'));
    }, [showToast]);

    const passwordValid = useMemo(() => password.newPassword.length >= 10 && /[A-Z]/.test(password.newPassword) && /[a-z]/.test(password.newPassword) && /\d/.test(password.newPassword) && /[^A-Za-z0-9]/.test(password.newPassword), [password.newPassword]);

    const saveProfile = async event => {
        event.preventDefault();
        const profileError = personNameError(profile.nome, 'nome completo') || emailError(profile.email);
        if (profileError) return showToast(profileError, 'warning');
        setSaving('profile');
        try {
            const nextProfile = usesSupabaseAuth ? { ...profile, email: user.email } : profile;
            await api.put('/api/account/profile', nextProfile);
            await refreshUser();
            showToast('Dados pessoais atualizados.', 'success');
        }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const changePassword = async event => {
        event.preventDefault();
        if (!passwordValid) return showToast('A nova senha não atende aos requisitos.', 'warning');
        if (password.newPassword !== password.confirmation) return showToast('As senhas não coincidem.', 'warning');
        setSaving('password');
        try {
            if (usesSupabaseAuth) {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: password.currentPassword });
                if (signInError) throw new Error(friendlyAuthError(signInError));
                const { error: updateError } = await supabase.auth.updateUser({ password: password.newPassword });
                if (updateError) throw new Error(friendlyAuthError(updateError));
            } else {
                await api.put('/api/account/password', { currentPassword: password.currentPassword, newPassword: password.newPassword });
            }
            setPassword({ currentPassword: '', newPassword: '', confirmation: '' });
            showToast('Senha alterada com sucesso.', 'success');
        }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const savePreferences = async () => {
        setSaving('preferences');
        try { await api.put('/api/account/preferences', { preferences }); showToast('Preferências salvas.', 'success'); }
        catch (error) { showToast(error.message, 'error'); } finally { setSaving(''); }
    };
    const options = user?.role === 'gestor' ? [
        ['newStudent', 'Novas inscrições', 'Avisar quando um aluno for cadastrado.'], ['newTicket', 'Novos tickets', 'Avisar sobre solicitações de suporte.'], ['courseUpdates', 'Alterações em turmas', 'Receber atualizações de cursos e professores.'], ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
    ] : [
        ['newStudent', 'Novos alunos', 'Avisar quando um aluno entrar em uma de suas turmas.'], ['newTicket', 'Respostas do suporte', 'Avisar quando houver uma resposta em seus tickets.'], ['courseUpdates', 'Alterações nas turmas', 'Receber mudanças de curso, local ou horário.'], ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
    ];

    return <div className="space-y-6">
        <div><h1 className="page-title">Configurações da conta</h1><p className="page-description">Seus dados são salvos com segurança e usados no acesso ao sistema.</p></div>
        <form onSubmit={saveProfile} className="panel p-5 md:p-7">
            <h3 className="text-lg font-semibold text-text-default">Dados pessoais</h3>
            <div className="grid md:grid-cols-2 gap-5 mt-5"><label className="text-sm font-medium text-text-default">Nome completo<input required maxLength="100" autoComplete="name" value={profile.nome} onChange={event => setProfile({ ...profile, nome: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium text-text-default">E-mail de acesso<input required maxLength="254" autoComplete="email" readOnly={usesSupabaseAuth} type="email" value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} className={`${fieldClass} ${usesSupabaseAuth ? 'opacity-70 cursor-not-allowed' : ''}`} />{usesSupabaseAuth && <span className="block mt-1 text-xs text-text-muted">Para trocar o e-mail de acesso, fale com o Gestor.</span>}</label></div>
            <div className="mt-5 flex justify-end"><button disabled={saving === 'profile'} className="submit-btn disabled:opacity-60">{saving === 'profile' ? 'Salvando...' : 'Salvar dados'}</button></div>
        </form>
        <form onSubmit={changePassword} className="panel p-5 md:p-7">
            <h3 className="text-lg font-semibold text-text-default">Alterar senha</h3><p className="text-sm text-text-muted mt-1">A alteração encerra suas outras sessões abertas.</p>
            <div className="grid md:grid-cols-3 gap-5 mt-5"><label className="text-sm font-medium text-text-default">Senha atual<input required type="password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium text-text-default">Nova senha<input required type="password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium text-text-default">Confirmar nova senha<input required type="password" value={password.confirmation} onChange={event => setPassword({ ...password, confirmation: event.target.value })} className={fieldClass} /></label></div>
            <p className={`text-xs mt-3 ${password.newPassword && passwordValid ? 'text-green-700' : 'text-text-muted'}`}>Use ao menos 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
            <div className="mt-5 flex justify-end"><button disabled={saving === 'password'} className="submit-btn disabled:opacity-60">{saving === 'password' ? 'Alterando...' : 'Alterar senha'}</button></div>
        </form>
        <section className="panel p-5 md:p-7">
            <h3 className="text-lg font-semibold text-text-default">Notificações</h3>
            <div className="mt-4 divide-y divide-border">{options.map(([key, title, description]) => <div key={key} className="py-4"><FormCheckbox checked={Boolean(preferences[key])} onChange={event => setPreferences({ ...preferences, [key]: event.target.checked })} label={title} description={description} className="justify-between flex-row-reverse w-full" /></div>)}</div>
            <div className="mt-4 flex justify-end"><button type="button" onClick={savePreferences} disabled={saving === 'preferences'} className="submit-btn disabled:opacity-60">{saving === 'preferences' ? 'Salvando...' : 'Salvar preferências'}</button></div>
        </section>
    </div>;
}
