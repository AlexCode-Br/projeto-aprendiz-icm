import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';
import { friendlyAuthError, supabase, usesSupabaseAuth } from '../services/supabase';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [mailbox, setMailbox] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async event => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (usesSupabaseAuth) {
                const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                if (authError) throw new Error(friendlyAuthError(authError));
                setMessage('Se o e-mail estiver cadastrado, enviaremos as instruções.');
                setMailbox('');
            } else {
                const response = await api.post('/api/auth/forgot-password', { email });
                setMessage(response.data.message);
                setMailbox(response.data.devMailbox || '');
            }
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Recuperar acesso" description="Informe o e-mail cadastrado para receber um link seguro de redefinição.">
            {message ? (
                <div className="space-y-5">
                    <div className="alert-success" role="status">{message}</div>
                    {mailbox && <a href={mailbox} className="btn btn-secondary w-full">Abrir caixa de e-mail de testes</a>}
                    <Link to="/login" className="block text-center font-semibold text-primary hover:underline">Voltar ao login</Link>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-5">
                    {error && <div className="alert-error" role="alert">{error}</div>}
                    <label className="block" htmlFor="recovery-email">
                        <span className="form-label">E-mail</span>
                        <input id="recovery-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="seu.email@exemplo.com" className="form-control" />
                    </label>
                    <button type="submit" disabled={loading} className="submit-btn w-full">{loading ? 'Enviando...' : 'Enviar instruções'}</button>
                    <Link to="/login" className="block text-center font-medium text-text-muted hover:text-text-default hover:underline">Voltar ao login</Link>
                </form>
            )}
        </AuthLayout>
    );
};

export default ForgotPassword;
