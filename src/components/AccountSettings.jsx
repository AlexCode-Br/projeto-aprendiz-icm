import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Bell, CheckCircle2, ChevronDown, FileText, Info, Laptop, LockKeyhole, LogOut,
    Mail, MessageSquare, Send, ShieldCheck, Smartphone, Trash2, UserRound, UsersRound,
} from 'lucide-react';
import AccountDeletionModal from './AccountDeletionModal';
import FormSwitch from './FormSwitch';
import PageSkeleton from './PageSkeleton';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
    disablePushNotifications, enablePushNotifications, pushCapability, readPushState,
    removePushDevice, testPushNotifications,
} from '../services/pushNotifications';
import { describeDevice } from '../utils/deviceInfo';
import { personNameError } from '../../shared/validation.mjs';

const preferenceIcons = { newStudent: Mail, newTicket: MessageSquare, courseUpdates: UsersRound, systemAlerts: ShieldCheck, systemNews: FileText };

function formatAccessDate(value) {
    if (!value) return 'Acesso recente';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Acesso recente';
    return `Atualizado em ${new globalThis.Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

function SectionHeader({ icon: Icon, title, description, expanded, onToggle, collapsible = true }) {
    const content = <>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-text-default">{React.createElement(Icon, { 'aria-hidden': true, className: 'h-7 w-7' })}</span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-bold text-text-default">{title}</span><span className="mt-0.5 block text-sm text-text-muted">{description}</span></span>
        {collapsible && <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />}
    </>;
    return collapsible
        ? <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left" aria-expanded={expanded}>{content}</button>
        : <div className="flex items-center gap-3">{content}</div>;
}

export default function AccountSettings() {
    const { user, refreshUser, rememberedSession, logout } = useAuth();
    const { showToast } = useToast();
    const [profile, setProfile] = useState({ nome: user?.nome || '' });
    const [photoChange, setPhotoChange] = useState(undefined);
    const [photoVersion, setPhotoVersion] = useState(Date.now());
    const [photoUrl, setPhotoUrl] = useState('');
    const [preferences, setPreferences] = useState({ newStudent: true, newTicket: true, courseUpdates: true, systemAlerts: true, systemNews: false });
    const [preferenceStatus, setPreferenceStatus] = useState('saved');
    const [saving, setSaving] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [expanded, setExpanded] = useState({ security: true, notifications: true, devices: true, deletion: false });
    const [pushState, setPushState] = useState(() => ({ ...pushCapability(), configured: false, active: false, devices: [], loading: true }));

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

    const refreshPushState = useCallback(async () => {
        setPushState(previous => ({ ...previous, loading: true }));
        if (!rememberedSession) {
            setPushState({ ...pushCapability(), configured: false, active: false, devices: [], loading: false, error: '' });
            return;
        }
        try { setPushState({ ...(await readPushState()), loading: false }); }
        catch { setPushState(previous => ({ ...previous, loading: false, error: 'Não foi possível consultar os dispositivos.' })); }
    }, [rememberedSession]);
    useEffect(() => { refreshPushState(); }, [refreshPushState]);

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
            showToast(nextPhoto === null ? 'Foto de perfil removida.' : 'Foto salva automaticamente.', 'success');
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
        } catch (error) { showToast(error.message, 'error'); }
        finally { setSaving(''); }
    };

    const requestPasswordReset = async () => {
        if (saving) return;
        setSaving('password');
        try {
            const { data } = await api.post('/api/auth/forgot-password', { email: user.email });
            showToast(data.message || 'Enviamos um link seguro para seu e-mail.', 'success', 7000);
        } catch (error) { showToast(error.message, 'error', 7000); }
        finally { setSaving(''); }
    };

    const updatePreference = async (key, checked) => {
        if (saving) return;
        const previous = preferences;
        const next = { ...preferences, [key]: checked };
        setPreferences(next);
        setPreferenceStatus('saving');
        setSaving('preferences');
        try {
            const { data } = await api.put('/api/account/preferences', { preferences: next });
            setPreferences(data.preferences);
            setPreferenceStatus('saved');
        } catch (error) {
            setPreferences(previous);
            setPreferenceStatus('error');
            showToast(error.message, 'error');
        } finally { setSaving(''); }
    };

    const togglePush = async () => {
        if (saving || pushState.loading) return;
        if (!rememberedSession) return showToast('Entre marcando “Permanecer conectado” para ativar avisos neste dispositivo.', 'warning', 7000);
        setSaving('push');
        try {
            if (pushState.active) await disablePushNotifications();
            else await enablePushNotifications();
            showToast(pushState.active ? 'Notificações desativadas neste dispositivo.' : 'Notificações ativadas neste dispositivo.', 'success');
            await refreshPushState();
        } catch (error) { showToast(error.message, 'error', 7000); }
        finally { setSaving(''); }
    };

    const revokeDevice = async device => {
        if (saving || !window.confirm(`Remover ${describeDevice(device.userAgent).label} das notificações?`)) return;
        setSaving(`device-${device.id}`);
        try {
            if (Number(device.id) === Number(pushState.currentDeviceId)) await disablePushNotifications();
            else await removePushDevice(device.id);
            showToast('Dispositivo removido das notificações.', 'success');
            await refreshPushState();
        } catch (error) { showToast(error.message, 'error'); }
        finally { setSaving(''); }
    };

    const testDeviceNotification = async () => {
        if (saving || pushState.loading) return;
        setSaving('test-push');
        try { const { data } = await testPushNotifications(); showToast(data.message, 'success', 6000); }
        catch (error) { showToast(error.message, 'error', 7000); }
        finally { setSaving(''); }
    };

    const deleteAccount = async confirmation => {
        if (saving) return;
        setSaving('delete');
        try {
            const { data } = await api.post('/api/account/delete', { confirmation });
            showToast(data.message, 'success', 7000);
            setDeleteOpen(false);
            await logout();
        } catch (error) { showToast(error.message, 'error', 8000); }
        finally { setSaving(''); }
    };

    const options = user?.role === 'gestor' ? [
        ['newStudent', 'Novas inscrições', 'Avisar quando um aluno for cadastrado.'],
        ['newTicket', 'Novos chamados', 'Avisar sobre solicitações de suporte.'],
        ['courseUpdates', 'Alterações em turmas', 'Receber atualizações de cursos e professores.'],
        ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
        ['systemNews', 'Comunicados do sistema', 'Receber novidades e atualizações do projeto.'],
    ] : [
        ['newStudent', 'Novos alunos', 'Avisar quando um aluno entrar em uma de suas turmas.'],
        ['newTicket', 'Respostas do suporte', 'Avisar quando houver uma resposta em seus chamados.'],
        ['courseUpdates', 'Alterações nas turmas', 'Receber mudanças de curso, local ou horário.'],
        ['systemAlerts', 'Alertas de segurança', 'Receber alertas importantes da conta.'],
        ['systemNews', 'Comunicados do sistema', 'Receber novidades e atualizações do projeto.'],
    ];
    const devices = useMemo(() => pushState.devices || [], [pushState.devices]);

    if (loading) return <PageSkeleton />;
    if (loadError) return <div className="space-y-6"><h1 className="page-title">Configurações da conta</h1><div className="panel p-6"><p role="alert" className="text-danger">{loadError}</p><button type="button" onClick={loadAccount} className="btn btn-secondary mt-4">Tentar novamente</button></div></div>;

    return <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <header><h1 className="page-title">Configurações da conta</h1><p className="page-description">Gerencie suas informações, preferências e segurança em um só lugar.</p></header>

        <form onSubmit={saveProfile} className="panel p-5 sm:p-7">
            <SectionHeader icon={UserRound} title="Perfil" description="Suas informações pessoais e como você aparece no sistema." collapsible={false} />
            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-border pt-6 sm:gap-6 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <ProfilePhotoPicker compact name={profile.nome} currentUrl={photoUrl ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}view=${photoVersion}` : ''} value={photoChange} onChange={savePhoto} disabled={Boolean(saving)} saving={saving === 'photo'} />
                <label className="block text-sm font-semibold text-text-default" htmlFor="settings-name">Nome completo<input id="settings-name" required maxLength="100" autoComplete="name" value={profile.nome} onChange={event => setProfile({ nome: event.target.value })} className="form-control mt-2" /><span className="mt-2 block text-xs font-normal text-text-muted">Este nome será exibido no sistema.</span></label>
                <button disabled={Boolean(saving)} className="submit-btn col-span-2 w-full md:col-span-1 md:w-auto">{saving === 'profile' ? 'Salvando…' : 'Salvar'}</button>
            </div>
        </form>

        <section className="panel p-5 sm:p-7">
            <SectionHeader icon={LockKeyhole} title="Segurança da conta" description="Mantenha sua conta segura com uma senha forte." expanded={expanded.security} onToggle={() => setExpanded(value => ({ ...value, security: !value.security }))} />
            {expanded.security && <div className="mt-6 border-t border-border pt-6">
                <div className="grid items-center gap-5 rounded-xl bg-danger/5 p-5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"><Mail aria-hidden="true" className="h-7 w-7" /></span>
                    <div><h3 className="font-bold text-text-default">Senha</h3><p className="mt-1 text-sm leading-6 text-text-muted">A alteração é feita por um link seguro enviado para seu e-mail.</p></div>
                    <button type="button" onClick={requestPasswordReset} disabled={Boolean(saving)} className="btn btn-secondary border-danger text-danger hover:bg-danger/5"><Send aria-hidden="true" />{saving === 'password' ? 'Enviando…' : 'Alterar senha'}</button>
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-text-muted"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />Você receberá um e-mail com um link temporário para definir sua nova senha.</p>
            </div>}
        </section>

        <section className="panel p-5 sm:p-7">
            <SectionHeader icon={Bell} title="Notificações" description="Escolha o que deseja receber por e-mail e no sistema." expanded={expanded.notifications} onToggle={() => setExpanded(value => ({ ...value, notifications: !value.notifications }))} />
            {expanded.notifications && <div className="mt-5 border-t border-border pt-2">
                <div className="divide-y divide-border">{options.map(([key, title, description]) => {
                    const Icon = preferenceIcons[key];
                    return <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
                        <Icon aria-hidden="true" className="hidden h-6 w-6 text-primary sm:block" />
                        <span className="min-w-0"><span className="block text-sm font-semibold text-text-default">{title}</span><span className="mt-1 block text-sm leading-6 text-text-muted">{description}</span></span>
                        <FormSwitch checked={Boolean(preferences[key])} onChange={event => updatePreference(key, event.target.checked)} disabled={saving === 'preferences'} label={<span className="sr-only">{title}</span>} />
                    </div>;
                })}</div>
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${preferenceStatus === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}><CheckCircle2 aria-hidden="true" className="h-5 w-5" />{preferenceStatus === 'saving' ? 'Salvando suas preferências…' : preferenceStatus === 'error' ? 'Não foi possível salvar a última alteração.' : 'Suas preferências são salvas automaticamente.'}</div>
            </div>}
        </section>

        <section className="panel p-5 sm:p-7">
            <SectionHeader icon={Laptop} title="Dispositivos conectados" description="Gerencie os dispositivos autorizados a receber notificações." expanded={expanded.devices} onToggle={() => setExpanded(value => ({ ...value, devices: !value.devices }))} />
            {expanded.devices && <div className="mt-5 border-t border-border pt-2">
                {devices.length ? <div className="divide-y divide-border">{devices.map(device => {
                    const info = describeDevice(device.userAgent);
                    const current = Number(device.id) === Number(pushState.currentDeviceId);
                    const DeviceIcon = info.mobile ? Smartphone : Laptop;
                    return <div key={device.id} className="flex items-center gap-4 py-4">
                        <DeviceIcon aria-hidden="true" className="h-7 w-7 shrink-0 text-text-default" />
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-text-default">{info.label}</strong>{current && <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Este dispositivo</span>}</div><p className="mt-1 text-xs text-text-muted">{current ? 'Último acesso agora' : formatAccessDate(device.updatedAt)}</p></div>
                        {!current && <button type="button" onClick={() => revokeDevice(device)} disabled={Boolean(saving)} className="icon-button text-danger" aria-label={`Remover ${info.label}`} title="Remover dispositivo"><Trash2 aria-hidden="true" /></button>}
                    </div>;
                })}</div> : <div className="py-5 text-sm text-text-muted">Nenhum dispositivo está autorizado a receber notificações.</div>}
                <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={togglePush} disabled={Boolean(saving) || pushState.loading || !rememberedSession || !pushState.supported || !pushState.configured || pushState.requiresInstall || pushState.permission === 'denied'} className={`btn ${pushState.active ? 'btn-danger' : 'btn-primary'} w-full sm:w-auto disabled:opacity-50`}><LogOut aria-hidden="true" />{saving === 'push' ? 'Aguarde…' : pushState.active ? 'Desativar neste dispositivo' : 'Ativar neste dispositivo'}</button>
                    <div className="min-w-0 text-sm leading-6 text-text-muted">{pushState.loading ? 'Verificando este dispositivo…' : !rememberedSession ? 'Entre marcando “Permanecer conectado” para ativar.' : pushState.error || (pushState.active ? 'Este dispositivo receberá avisos mesmo com o aplicativo fechado.' : 'Ative para receber avisos na barra de notificações.')}{pushState.active && <button type="button" onClick={testDeviceNotification} disabled={Boolean(saving)} className="mt-1 block font-semibold text-primary hover:underline">{saving === 'test-push' ? 'Enviando teste…' : 'Enviar teste ao dispositivo'}</button>}</div>
                </div>
            </div>}
        </section>

        <section className="panel p-5 sm:p-7">
            <SectionHeader icon={Trash2} title="Excluir conta" description="Ação permanente. Seus dados pessoais serão removidos." expanded={expanded.deletion} onToggle={() => setExpanded(value => ({ ...value, deletion: !value.deletion }))} />
            {expanded.deletion && <div className="mt-5 border-t border-border pt-5"><p className="max-w-3xl text-sm leading-6 text-text-muted">A conta será desativada, todas as sessões serão encerradas e os dados pessoais serão anonimizados. Registros acadêmicos e de auditoria permanecem sem identificação pessoal.</p><button type="button" onClick={() => setDeleteOpen(true)} className="btn btn-danger mt-4"><Trash2 aria-hidden="true" />Excluir minha conta</button></div>}
        </section>

        <AccountDeletionModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} email={user.email} onConfirm={deleteAccount} loading={saving === 'delete'} />
    </div>;
}
