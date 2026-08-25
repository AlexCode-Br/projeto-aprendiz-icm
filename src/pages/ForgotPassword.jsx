import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../assets/logo_projeto_aprendiz.png';
import api from '../services/api';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [mailbox, setMailbox] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async event => {
        event.preventDefault();
        setLoading(true); setError('');
        try {
            const response = await api.post('/api/auth/forgot-password', { email });
            setMessage(response.data.message);
            setMailbox(response.data.devMailbox || '');
        } catch (requestError) {
            setError(requestError.message);
        } finally { setLoading(false); }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <img src={Logo} alt="Logo Projeto Aprendiz" className="h-20 mx-auto mb-8 bg-[#b71c1c] p-4 rounded-2xl shadow-lg" />
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl">
                    <h1 className="text-3xl font-bold text-center text-gray-800">Recuperar acesso</h1>
                    <p className="text-center text-gray-500 mt-2 mb-8">Informe o e-mail cadastrado para receber as instruções.</p>
                    {message ? (
                        <div className="space-y-5">
                            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg" role="status">{message}</div>
                            {mailbox && <a href={mailbox} className="block w-full text-center py-3 rounded-lg bg-gray-800 text-white font-semibold">Abrir caixa de e-mail de testes</a>}
                            <Link to="/login" className="block text-center font-medium text-[var(--color-primary)]">Voltar ao login</Link>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="space-y-6">
                            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}
                            <label className="block">
                                <span className="block text-sm font-medium text-gray-700 mb-2">E-mail</span>
                                <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="seu.email@exemplo.com" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                            </label>
                            <button disabled={loading} className="w-full submit-btn disabled:opacity-60">{loading ? 'Enviando...' : 'Enviar instruções'}</button>
                            <Link to="/login" className="block text-center font-medium text-gray-600 hover:text-gray-900">Voltar ao login</Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
