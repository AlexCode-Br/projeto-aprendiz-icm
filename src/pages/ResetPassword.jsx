import PasswordInput from '../components/PasswordInput';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const ResetPassword = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const rules = useMemo(() => ({
        length: password.length >= 10,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password),
    }), [password]);

    const submit = async event => {
        event.preventDefault();
        setError('');
        if (!token) return setError('O link de recuperação está incompleto.');
        if (Object.values(rules).some(value => !value)) return setError('A senha não atende aos requisitos.');
        if (password !== confirmation) return setError('As senhas não coincidem.');
        setLoading(true);
        try {
            await api.post('/api/auth/reset-password', { token, password });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const labels = { length: '10 ou mais caracteres', upper: 'Uma letra maiúscula', lower: 'Uma letra minúscula', number: 'Um número', symbol: 'Um símbolo especial' };

    return (
        <AuthLayout title="Criar nova senha" description="Escolha uma senha forte. O link é temporário e só pode ser usado uma vez.">
            {success ? (
                <div className="alert-success text-center" role="status">Senha alterada com sucesso. Redirecionando para o login...</div>
            ) : (
                <form onSubmit={submit} className="space-y-5">
                    {error && <div className="alert-error" role="alert">{error}</div>}
                    <div><label className="form-label" htmlFor="new-password">Nova senha</label><PasswordInput id="new-password"  autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className="form-control" /></div>
                    <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2" aria-label="Requisitos da senha">
                        {Object.entries(rules).map(([key, valid]) => <li key={key} className={valid ? 'text-green-700 dark:text-green-400' : 'text-text-muted'}><span aria-hidden="true">{valid ? '✓' : '○'}</span> {labels[key]}</li>)}
                    </ul>
                    <div><label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label><PasswordInput id="confirm-password"  autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="form-control" /></div>
                    <button type="submit" disabled={loading} className="submit-btn w-full">{loading ? 'Alterando...' : 'Redefinir senha'}</button>
                    <Link to="/login" className="block text-center font-medium text-text-muted hover:text-text-default hover:underline">Voltar ao login</Link>
                </form>
            )}
        </AuthLayout>
    );
};

export default ResetPassword;
