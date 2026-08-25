import React from 'react';
import Logo from '../assets/logo_projeto_aprendiz.png';

const AuthLayout = ({ children, title, description, footer = true }) => (
    <main className="auth-page">
        <div className="auth-wrap fade-in-up">
            <img src={Logo} alt="Projeto Aprendiz" className="auth-logo" />
            <section className="auth-card" aria-labelledby="auth-title">
                <h1 id="auth-title" className="auth-title">{title}</h1>
                {description && <p className="auth-copy">{description}</p>}
                <div className="mt-7">{children}</div>
            </section>
            {footer && <p className="mt-6 text-center text-xs text-text-muted">Projeto Aprendiz · Ambiente seguro</p>}
        </div>
    </main>
);

export default AuthLayout;
