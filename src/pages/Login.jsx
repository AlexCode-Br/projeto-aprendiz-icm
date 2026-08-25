import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import Logo from '../assets/logo_projeto_aprendiz.png';

// Ícones como componentes React para melhor manuseio
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>
);

const SuccessAnimation = () => (
    <div className="text-center">
        <svg className="checkmark w-24 h-24 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
        <p className="text-2xl font-bold text-gray-700 mt-4">Login bem-sucedido!</p>
        <p className="text-gray-500">Redirecionando...</p>
    </div>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!email || !password) {
            setErrorMessage('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const user = await login(email, password, remember);
            setShowSuccess(true);
            setTimeout(() => {
                navigate(`/${user.role}/dashboard`, { replace: true });
            }, 800);
        } catch (error) {
            setErrorMessage(error.message || 'Credenciais incorretas. Tente novamente.');
        }
    };
    
    return (
        <div className="bg-gray-100">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <img 
                          src={Logo} 
                          alt="Logo Projeto Aprendiz" 
                          className="h-20 mx-auto bg-[#b71c1c] p-4 rounded-2xl shadow-lg"
                        />
                    </div>
                    
                    {!showSuccess ? (
                        <div id="login-container" className="form-container">
                            <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl">
                                <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Bem-vindo!</h2>
                                <p className="text-center text-gray-500 mb-8">Faça login para continuar.</p>

                                {errorMessage && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                                        <span className="block sm:inline">{errorMessage}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                                    <div className="relative input-field border border-gray-300 rounded-lg transition-all duration-300">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                        </span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-3 py-3 bg-transparent border-none rounded-lg focus:outline-none"
                                            placeholder="seu.email@exemplo.com"
                                        />
                                    </div>

                                    <div className="relative input-field border border-gray-300 rounded-lg transition-all duration-300">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                           <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                        </span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-10 py-3 bg-transparent border-none rounded-lg focus:outline-none"
                                            placeholder="Sua senha"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <label className="flex items-center space-x-2 cursor-pointer custom-checkbox">
                                            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                                            <span className="checkmark"></span>
                                            <span className="text-gray-700">Lembrar-me</span>
                                        </label>
                                        <Link to="/forgot-password" id="forgot-password-link" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">Esqueceu a senha?</Link>
                                    </div>

                                    <div>
                                        <button
                                            type="submit"
                                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white submit-btn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                                        >
                                            Entrar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <SuccessAnimation />
                    )}

                    <footer className="text-center mt-8">
                        <p className="text-sm text-gray-500">
                            Versão 1.0.0
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default Login;
