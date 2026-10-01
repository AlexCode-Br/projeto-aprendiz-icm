import PasswordInput from '../components/PasswordInput';
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';
import { consumeSecureLinkParameters } from '../utils/secureLinkToken';

const labels = {
    length: '10 ou mais caracteres',
    upper: 'Uma letra maiúscula',
    lower: 'Uma letra minúscula',
    number: 'Um número',
    symbol: 'Um símbolo especial',
};

const strengthLevels = [
    { label: 'Muito fraca', bar: 'bg-danger', badge: 'bg-danger/10 text-danger' },
    { label: 'Fraca', bar: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
    { label: 'Razoável', bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    { label: 'Boa', bar: 'bg-lime-600', badge: 'bg-lime-600/10 text-lime-700 dark:text-lime-300' },
    { label: 'Forte', bar: 'bg-success', badge: 'bg-success/10 text-success' },
];

const ResetPassword = () => {
    const navigate = useNavigate();
    const [token] = useState(() => consumeSecureLinkParameters().token);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [confirmationTouched, setConfirmationTouched] = useState(false);
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
    const passedRules = Object.values(rules).filter(Boolean).length;
    const strength = password ? strengthLevels[Math.max(0, passedRules - 1)] : null;
    const activeSegments = password ? Math.max(1, Math.ceil(passedRules * 4 / 5)) : 0;
    const valid = passedRules === Object.keys(rules).length;
    const passwordsMatch = confirmation.length > 0 && password === confirmation;
    const confirmationMismatch = confirmation.length > 0 && !passwordsMatch
        && (confirmationTouched || confirmation.length >= password.length);

    const submit = async event => {
        event.preventDefault();
        setError('');
        if (!token) return setError('O link de recuperação está incompleto. Solicite um novo link.');
        if (!valid) return setError('A senha ainda não atende a todos os requisitos.');
        if (!passwordsMatch) {
            setConfirmationTouched(true);
            return setError('As senhas não coincidem.');
        }
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

    return (
        <AuthLayout isLogin compact title="Criar nova senha">
            {success ? (
                <div className="alert-success text-center" role="status">Senha alterada com sucesso. Redirecionando para o login...</div>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <p className="-mt-1 mb-1 text-center text-sm leading-5 text-text-muted">Escolha uma senha forte. O link é temporário e só pode ser usado uma vez.</p>
                    {error && <div className="alert-error" role="alert">{error}</div>}
                    <div>
                        <label className="form-label" htmlFor="new-password">Nova senha</label>
                        <PasswordInput id="new-password" aria-describedby="password-strength password-rules" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className="form-control" />
                    </div>
                    <div id="password-strength" className="space-y-1.5" aria-live="polite">
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-text-muted">Força da senha</span>
                            {strength && <span className={`rounded-full px-2 py-0.5 font-semibold ${strength.badge}`}>{strength.label}</span>}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5" role="meter" aria-label="Força da senha" aria-valuemin={0} aria-valuemax={5} aria-valuenow={passedRules} aria-valuetext={strength?.label || 'Ainda não informada'}>
                            {[0, 1, 2, 3].map(segment => <span key={segment} className={`h-1.5 rounded-full transition-colors ${segment < activeSegments ? strength?.bar : 'bg-border'}`} />)}
                        </div>
                    </div>
                    <ul id="password-rules" className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:text-xs" aria-label="Requisitos da senha">
                        {Object.entries(rules).map(([key, passed]) => <li key={key} className={`flex items-center gap-1.5 ${passed ? 'font-medium text-success' : 'text-text-muted'}`}><span aria-hidden="true">{passed ? <CheckCircle2 className="!h-3.5 !w-3.5" /> : <Circle className="!h-3.5 !w-3.5" />}</span>{labels[key]}</li>)}
                    </ul>
                    <div>
                        <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
                        <PasswordInput id="confirm-password" aria-describedby="password-match" aria-invalid={confirmationMismatch} autoComplete="new-password" required value={confirmation} onChange={event => { setConfirmation(event.target.value); setConfirmationTouched(false); }} onBlur={() => setConfirmationTouched(true)} className={passwordsMatch ? 'border-success focus:border-success' : confirmationMismatch ? 'border-danger focus:border-danger' : ''} />
                    </div>
                    <p id="password-match" className={`flex min-h-4 items-center gap-1.5 text-xs ${passwordsMatch ? 'font-medium text-success' : confirmationMismatch ? 'font-medium text-danger' : 'text-text-muted'}`} aria-live="polite">
                        {passwordsMatch ? <><CheckCircle2 className="!h-4 !w-4" aria-hidden="true" />As senhas são iguais.</> : confirmationMismatch ? <><XCircle className="!h-4 !w-4" aria-hidden="true" />As senhas não são iguais.</> : <><Circle className="!h-4 !w-4" aria-hidden="true" />Digite novamente para confirmar.</>}
                    </p>
                    <button type="submit" disabled={loading || !valid || !passwordsMatch} className="submit-btn w-full">{loading ? 'Alterando...' : 'Redefinir senha'}</button>
                    <Link to="/login" className="block text-center font-medium text-text-muted hover:text-text-default hover:underline">Voltar ao login</Link>
                </form>
            )}
        </AuthLayout>
    );
};

export default ResetPassword;
