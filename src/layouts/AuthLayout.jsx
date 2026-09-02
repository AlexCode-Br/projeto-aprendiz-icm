import React from 'react';
import useDarkMode from '../hooks/useDarkMode';
import Logo from '../assets/projeto-aprendiz-logo.png';
import LoginOrchestra from '../assets/login-orquestra.jpg';
import { Music2, Users, BookOpen, ShieldCheck, Sun, Moon } from 'lucide-react';

const AuthLayout = ({ children, title, description, footer = true, isLogin = false }) => {
    const [isDark, setIsDark] = useDarkMode();
    return (
    <main className={`auth-page ${isLogin ? 'auth-page--light' : ''}`}>
        <div className="grid w-full max-w-[980px] overflow-hidden rounded-3xl border border-border bg-surface shadow-lg lg:grid-cols-[0.9fr_1fr]">
            {isLogin ? <aside className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-primary sm:min-h-[340px] lg:min-h-[600px]">
                <img src={LoginOrchestra} width="2200" height="1088" alt="Orquestra com um violino em destaque e músicos ao fundo." className="absolute inset-0 h-full w-full object-cover object-[58%_center]" fetchPriority="high" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-black/80 via-black/35 to-transparent" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] bg-gradient-to-t from-black/90 via-black/70 to-transparent lg:h-[48%]" />
                <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="relative m-4 h-auto w-32 object-contain brightness-0 invert lg:m-5 lg:w-36" />
                <figure className="relative px-6 pb-6 pt-6 text-white lg:px-8 lg:pb-9 lg:pt-12">
                    <blockquote className="login-scripture text-[1.875rem] leading-[1.2] sm:text-[2.125rem]">“Tudo quanto tem fôlego louve ao Senhor. Louvai ao Senhor.”</blockquote>
                    <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Salmos 150:6</figcaption>
                </figure>
            </aside> : <aside className="auth-brand">
                <div><img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="h-auto w-44 object-contain brightness-0 invert" /></div>
                <div className="my-14"><span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Music2 aria-hidden="true" className="!h-7 !w-7" /></span><h2 className="text-3xl font-semibold leading-tight tracking-tight">Aprender.<br />Compartilhar.<br />Servir.</h2><p className="mt-5 max-w-xs text-sm leading-7 text-white/80">Um espaço para conectar alunos, professores e o ensino da música.</p></div>
                <div className="flex gap-5 text-xs text-white/80"><span className="flex items-center gap-2"><Users aria-hidden="true" />Comunidade</span><span className="flex items-center gap-2"><BookOpen aria-hidden="true" />Aprendizado</span></div>
            </aside>}
            <section className={`relative px-6 py-9 sm:px-10 sm:py-12 ${isLogin ? 'flex flex-col justify-center' : ''}`} aria-labelledby="auth-title">
                {!isLogin && <button type="button" onClick={() => setIsDark(!isDark)} className="icon-button absolute right-4 top-4" aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}>{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>}
                {!isLogin && <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className={`auth-logo lg:hidden ${isDark ? 'brightness-0 invert' : ''}`} />}
                {!isLogin && <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-primary">Projeto Aprendiz</p>}
                <h1 id="auth-title" className="auth-title">{title}</h1>
                {description && <p className="auth-copy">{description}</p>}
                <div className="mt-7">{children}</div>
                {footer && !isLogin && <p className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-text-muted"><ShieldCheck aria-hidden="true" className="!h-4 !w-4" />Acesso exclusivo à comunidade do projeto</p>}
            </section>
        </div>
    </main>
    );
};

export default AuthLayout;
