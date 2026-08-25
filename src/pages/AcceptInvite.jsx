import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
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
        api.get('/api/invitations/validate', { params: { token } }).then(({ data }) => { setInvitation(data); setStatus({ loading: false, error: '', success: false }); }).catch(error => setStatus({ loading: false, error: error.message, success: false }));
    }, [token]);

    const submit = async event => {
        event.preventDefault();
        if (!valid) return setStatus(previous => ({ ...previous, error: 'A senha não atende aos requisitos.' }));
        if (password !== confirmation) return setStatus(previous => ({ ...previous, error: 'As senhas não coincidem.' }));
        setStatus(previous => ({ ...previous, loading: true, error: '' }));
        try { await api.post('/api/invitations/accept', { token, password }); setStatus({ loading: false, error: '', success: true }); setTimeout(() => navigate('/login', { replace: true }), 1800); }
        catch (error) { setStatus({ loading: false, error: error.message, success: false }); }
    };

    return <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4"><div className="w-full max-w-md">
        <img src={Logo} alt="Logo Projeto Aprendiz" className="h-20 mx-auto mb-8 bg-[#b71c1c] p-4 rounded-2xl shadow-lg" />
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl">
            <h1 className="text-3xl font-bold text-center text-gray-800">Ativar conta</h1>
            {status.loading && !invitation ? <p className="text-center text-gray-500 mt-6">Validando convite...</p> : status.success ? <div className="mt-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-center">Conta ativada. Redirecionando para o login...</div> : status.error && !invitation ? <div className="mt-6"><div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">{status.error}</div><Link to="/login" className="block text-center mt-5 text-gray-600">Voltar ao login</Link></div> : <form onSubmit={submit} className="space-y-5 mt-6">
                <p className="text-center text-gray-600">Olá, <strong>{invitation?.nome}</strong>. Crie a senha de acesso para <strong>{invitation?.email}</strong>.</p>
                {status.error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{status.error}</div>}
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Crie uma senha" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                <p className={`text-sm ${password && valid ? 'text-green-700' : 'text-gray-500'}`}>10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
                <input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Confirme a senha" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                <button disabled={status.loading} className="w-full submit-btn disabled:opacity-60">{status.loading ? 'Ativando...' : 'Ativar minha conta'}</button>
            </form>}
        </div>
    </div></div>;
}
