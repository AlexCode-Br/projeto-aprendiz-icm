import React from 'react';
import useDarkMode from '../hooks/useDarkMode';
import Logo from '../assets/logo_projeto_aprendiz.png';
import { Music2, Users, BookOpen, ShieldCheck, Sun, Moon } from 'lucide-react';

const AuthLayout = ({ children, title, description, footer = true }) => {
    const [isDark, setIsDark] = useDarkMode();
    return (
    <main className="auth-page">
        <div className="grid w-full max-w-[980px] overflow-hidden rounded-3xl border border-border bg-surface shadow-lg lg:grid-cols-[0.9fr_1fr]">
            <aside className="auth-brand">
                <div><img src={Logo} alt="Projeto Aprendiz" className="h-14 w-44 object-cover" /><p className="mt-3 text-xs font-medium tracking-[0.18em] text-white/75">IGREJA CRISTÃ MARANATA</p></div>
                <div className="my-14"><span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Music2 aria-hidden="true" className="!h-7 !w-7" /></span><h2 className="text-3xl font-semibold leading-tight tracking-tight">Aprender.<br />Compartilhar.<br />Servir.</h2><p className="mt-5 max-w-xs text-sm leading-7 text-white/80">Um espaço para conectar alunos, professores e o ensino da música.</p></div>
                <div className="flex gap-5 text-xs text-white/80"><span className="flex items-center gap-2"><Users aria-hidden="true" />Comunidade</span><span className="flex items-center gap-2"><BookOpen aria-hidden="true" />Aprendizado</span></div>
            </aside>
            <section className="relative px-6 py-9 sm:px-10 sm:py-12" aria-labelledby="auth-title">
                <button type="button" onClick={() => setIsDark(!isDark)} className="icon-button absolute right-4 top-4" aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}>{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>
                <img src={Logo} alt="Igreja Cristã Maranata" className="auth-logo lg:hidden" />
                <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-primary">Projeto Aprendiz</p>
                <h1 id="auth-title" className="auth-title">{title}</h1>
                {description && <p className="auth-copy">{description}</p>}
                <div className="mt-7">{children}</div>
                {footer && <p className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-text-muted"><ShieldCheck aria-hidden="true" className="!h-4 !w-4" />Acesso exclusivo à comunidade do projeto</p>}
            </section>
        </div>
    </main>
    );
};

export default AuthLayout;
