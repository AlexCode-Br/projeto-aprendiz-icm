import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

export default function AcceptInvite() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';
    const [invitation, setInvitation] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [status, setStatus] = useState({ loading: true, error: '', success: false });
    const valid = useMemo(() => password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password), [password]);

    useEffect(() => {
        api.get('/api/invitations/validate', { params: { token } })
            .then(({ data }) => {
                setInvitation(data);
                setStatus({ loading: false, error: '', success: false });
            })
            .catch(error => setStatus({ loading: false, error: error.message, success: false }));
    }, [token]);

    const submit = async event => {
        event.preventDefault();
        if (!valid) return setStatus(previous => ({ ...previous, error: 'A senha não atende aos requisitos.' }));
        if (password !== confirmation) return setStatus(previous => ({ ...previous, error: 'As senhas não coincidem.' }));
        setStatus(previous => ({ ...previous, loading: true, error: '' }));
        try {
            await api.post('/api/invitations/accept', { token, password });
            setStatus({ loading: false, error: '', success: true });
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        } catch (error) {
            setStatus({ loading: false, error: error.message, success: false });
        }
    };

    return (
        <AuthLayout title="Ativar conta" description="Conclua seu cadastro para acessar o Projeto Aprendiz.">
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
                <form onSubmit={submit} className="space-y-5">
                    <p className="text-sm leading-6 text-text-muted">Olá, <strong className="text-text-default">{invitation?.nome}</strong>. Crie a senha de acesso para <strong className="break-all text-text-default">{invitation?.email}</strong>.</p>
                    {status.error && <div className="alert-error" role="alert">{status.error}</div>}
                    <label className="block" htmlFor="invite-password">
                        <span className="form-label">Crie uma senha</span>
                        <input id="invite-password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className="form-control" />
                    </label>
                    <p className={`text-xs ${password && valid ? 'text-green-700 dark:text-green-400' : 'text-text-muted'}`}>10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
                    <label className="block" htmlFor="invite-confirmation">
                        <span className="form-label">Confirme a senha</span>
                        <input id="invite-confirmation" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="form-control" />
                    </label>
                    <button type="submit" disabled={status.loading} className="submit-btn w-full">{status.loading ? 'Ativando...' : 'Ativar minha conta'}</button>
                </form>
            )}
        </AuthLayout>
    );
}
