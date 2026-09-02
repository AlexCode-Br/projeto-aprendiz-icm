import { Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormCheckbox from '../components/FormCheckbox';
import { AuthContext } from '../contexts/AuthContext';
import AuthLayout from '../layouts/AuthLayout';
import { Mail, LockKeyhole, Check, ArrowRight, LoaderCircle } from 'lucide-react';





const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async event => {
        event.preventDefault();
        if (submitting) return;
        setErrorMessage('');
        if (!email || !password) return setErrorMessage('Por favor, preencha todos os campos.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErrorMessage('Informe um e-mail válido.');
        setSubmitting(true);
        try {
            const user = await login(email.trim(), password, remember);
            setShowSuccess(true);
            setTimeout(() => navigate(`/${user.role}/dashboard`, { replace: true }), 800);
        } catch (error) {
            setErrorMessage(error.message || 'Credenciais incorretas. Tente novamente.');
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout title="Bem-vindo!" description="Entre com seu e-mail e senha para acessar a plataforma.">
            {showSuccess ? (
                <div className="py-5 text-center" role="status" aria-live="polite">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true"><Check className="!h-8 !w-8" /></span>
                    <p className="mt-4 text-lg font-bold text-text-default">Login realizado</p>
                    <p className="mt-1 text-sm text-text-muted">Redirecionando para seu painel...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    {errorMessage && <div className="alert-error" role="alert">{errorMessage}</div>}

                    <label className="block" htmlFor="email">
                        <span className="form-label">E-mail</span>
                        <span className="relative block">
                            <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required className="form-control pl-11" placeholder="seu.email@exemplo.com" />
                        </span>
                    </label>

                    <div className="block">
                        <label className="form-label" htmlFor="password">Senha</label>
                        <span className="relative block">
                            <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
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

                    <button type="submit" disabled={submitting} className="submit-btn w-full">{submitting ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Entrando...</> : <>Entrar<ArrowRight aria-hidden="true" /></>}</button>
                </form>
            )}
        </AuthLayout>
    );
};

export default Login;
