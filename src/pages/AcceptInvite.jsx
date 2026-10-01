import PasswordInput from '../components/PasswordInput';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';
import { consumeSecureLinkParameters } from '../utils/secureLinkToken';

export default function AcceptInvite() {
    const navigate = useNavigate();
    const [link] = useState(consumeSecureLinkParameters);
    const token = link.token;
    const invitationPath = link.type === 'aluno' ? '/api/student-invitations' : '/api/invitations';
    const [invitation, setInvitation] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [confirmationTouched, setConfirmationTouched] = useState(false);
    const [status, setStatus] = useState({ loading: true, error: '', success: false });
    const passwordRules = useMemo(() => [
        ['length', '10 caracteres', password.length >= 10],
        ['uppercase', 'Uma letra maiúscula', /[A-Z]/.test(password)],
        ['lowercase', 'Uma letra minúscula', /[a-z]/.test(password)],
        ['number', 'Um número', /\d/.test(password)],
        ['symbol', 'Um símbolo', /[^A-Za-z0-9]/.test(password)],
    ], [password]);
    const valid = passwordRules.every(([, , passed]) => passed);
    const passwordsMatch = confirmation.length > 0 && password === confirmation;
    const confirmationMismatch = confirmation.length > 0 && !passwordsMatch
        && (confirmationTouched || confirmation.length >= password.length);

    useEffect(() => {
        api.get(`${invitationPath}/validate`, { params: { token } })
            .then(({ data }) => {
                setInvitation(data);
                setStatus({ loading: false, error: '', success: false });
            })
            .catch(error => setStatus({ loading: false, error: error.message, success: false }));
    }, [token, invitationPath]);

    const submit = async event => {
        event.preventDefault();
        if (!valid) return;
        if (!passwordsMatch) {
            setConfirmationTouched(true);
            return;
        }
        setStatus(previous => ({ ...previous, loading: true, error: '' }));
        try {
            await api.post(`${invitationPath}/accept`, { token, password });
            setStatus({ loading: false, error: '', success: true });
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        } catch (error) {
            setStatus({ loading: false, error: error.message, success: false });
        }
    };

    return (
        <AuthLayout isLogin compact title="Ativar conta">
            {status.loading && !invitation ? (
                <p className="text-center text-sm text-text-muted" role="status">Validando convite...</p>
            ) : status.success ? (
                <div className="alert-success text-center" role="status">Conta ativada. Redirecionando para o login...</div>
            ) : status.error && !invitation ? (
                <div className="space-y-5">
                    <div className="alert-error text-center" role="alert">{status.error}</div>
                    <Link to="/login" className="block text-center font-medium text-text-muted hover:underline">Voltar ao login</Link>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    {status.error && <div className="alert-error" role="alert">{status.error}</div>}
                    <div><label className="form-label" htmlFor="invite-password">Crie sua senha</label><PasswordInput id="invite-password" aria-describedby="invite-password-rules" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className="form-control" /></div>
                    <ul id="invite-password-rules" className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:text-xs" aria-label="Requisitos da senha">
                        {passwordRules.map(([key, label, passed]) => <li key={key} className={`flex items-center gap-1.5 ${passed ? 'font-medium text-success' : 'text-text-muted'}`}><span aria-hidden="true">{passed ? <CheckCircle2 className="!h-4 !w-4" /> : <Circle className="!h-4 !w-4" />}</span>{label}</li>)}
                    </ul>
                    <div><label className="form-label" htmlFor="invite-confirmation">Confirme sua senha</label><PasswordInput id="invite-confirmation" aria-describedby="invite-password-match" aria-invalid={confirmationMismatch} autoComplete="new-password" required value={confirmation} onChange={event => { setConfirmation(event.target.value); setConfirmationTouched(false); }} onBlur={() => setConfirmationTouched(true)} className={passwordsMatch ? 'border-success focus:border-success' : confirmationMismatch ? 'border-danger focus:border-danger' : ''} /></div>
                    <p id="invite-password-match" className={`flex min-h-4 items-center gap-1.5 text-xs ${passwordsMatch ? 'font-medium text-success' : confirmationMismatch ? 'font-medium text-danger' : 'text-text-muted'}`} aria-live="polite">
                        {passwordsMatch ? <><CheckCircle2 className="!h-4 !w-4" aria-hidden="true" />As senhas são iguais.</> : confirmationMismatch ? <><XCircle className="!h-4 !w-4" aria-hidden="true" />As senhas não são iguais.</> : <><Circle className="!h-4 !w-4" aria-hidden="true" />Digite novamente para confirmar.</>}
                    </p>
                    <button type="submit" disabled={status.loading || !valid || !passwordsMatch} className="submit-btn w-full">{status.loading ? 'Ativando...' : 'Ativar minha conta'}</button>
                </form>
            )}
        </AuthLayout>
    );
}
