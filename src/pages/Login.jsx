import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormCheckbox from '../components/FormCheckbox';
import { AuthContext } from '../contexts/AuthContext';
import AuthLayout from '../layouts/AuthLayout';

const EyeIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);

const EyeOffIcon = () => (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/></svg>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async event => {
        event.preventDefault();
        setErrorMessage('');
        if (!email || !password) return setErrorMessage('Por favor, preencha todos os campos.');
        try {
            const user = await login(email, password, remember);
            setShowSuccess(true);
            setTimeout(() => navigate(`/${user.role}/dashboard`, { replace: true }), 800);
        } catch (error) {
            setErrorMessage(error.message || 'Credenciais incorretas. Tente novamente.');
        }
    };

    return (
        <AuthLayout title="Bem-vindo!" description="Entre com seu e-mail e senha para acessar a plataforma.">
            {showSuccess ? (
                <div className="py-5 text-center" role="status" aria-live="polite">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700" aria-hidden="true">✓</span>
                    <p className="mt-4 text-lg font-bold text-text-default">Login realizado</p>
                    <p className="mt-1 text-sm text-text-muted">Redirecionando para seu painel...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    {errorMessage && <div className="alert-error" role="alert">{errorMessage}</div>}

                    <label className="block" htmlFor="email">
                        <span className="form-label">E-mail</span>
                        <span className="relative block">
                            <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required className="form-control pl-11" placeholder="seu.email@exemplo.com" />
                        </span>
                    </label>

                    <div className="block">
                        <label className="form-label" htmlFor="password">Senha</label>
                        <span className="relative block">
                            <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required className="form-control px-11" placeholder="Digite sua senha" />
                            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center rounded-r-lg text-text-muted hover:text-text-default" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <FormCheckbox
                            checked={remember}
                            onChange={event => setRemember(event.target.checked)}
                            label="Lembrar meu acesso"
                            className="items-center min-h-11"
                        />
                        <Link to="/forgot-password" className="font-semibold text-primary hover:text-primary-dark hover:underline">Esqueceu a senha?</Link>
                    </div>

                    <button type="submit" className="submit-btn w-full">Entrar</button>
                </form>
            )}
        </AuthLayout>
    );
};

export default Login;
