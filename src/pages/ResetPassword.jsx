import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
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
        event.preventDefault(); setError('');
        if (!token) return setError('O link de recuperação está incompleto.');
        if (Object.values(rules).some(value => !value)) return setError('A senha não atende aos requisitos.');
        if (password !== confirmation) return setError('As senhas não coincidem.');
        setLoading(true);
        try {
            await api.post('/api/auth/reset-password', { token, password });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        } catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    };

    const labels = { length: '10 ou mais caracteres', upper: 'Uma letra maiúscula', lower: 'Uma letra minúscula', number: 'Um número', symbol: 'Um símbolo especial' };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <img src={Logo} alt="Logo Projeto Aprendiz" className="h-20 mx-auto mb-8 bg-[#b71c1c] p-4 rounded-2xl shadow-lg" />
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl">
                    <h1 className="text-3xl font-bold text-center text-gray-800">Criar nova senha</h1>
                    <p className="text-center text-gray-500 mt-2 mb-8">O link é temporário e só poderá ser utilizado uma vez.</p>
                    {success ? (
                        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-center" role="status">Senha alterada com sucesso. Redirecionando para o login...</div>
                    ) : (
                        <form onSubmit={submit} className="space-y-5">
                            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg" role="alert">{error}</div>}
                            <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nova senha" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {Object.entries(rules).map(([key, valid]) => <li key={key} className={valid ? 'text-green-700' : 'text-gray-500'}>{valid ? '✓' : '○'} {labels[key]}</li>)}
                            </ul>
                            <input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Confirme a nova senha" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                            <button disabled={loading} className="w-full submit-btn disabled:opacity-60">{loading ? 'Alterando...' : 'Redefinir senha'}</button>
                            <Link to="/login" className="block text-center text-gray-600">Voltar ao login</Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
