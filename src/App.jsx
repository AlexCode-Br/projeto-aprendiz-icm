import React from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import './index.css'; // Importando o CSS global

const Login = React.lazy(() => import('./pages/Login.jsx'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword.jsx'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword.jsx'));
const AcceptInvite = React.lazy(() => import('./pages/AcceptInvite.jsx'));
const GestorDashboard = React.lazy(() => import('./pages/gestor/Dashboard.jsx'));
const Cursos = React.lazy(() => import('./pages/gestor/Cursos.jsx'));
const Alunos = React.lazy(() => import('./pages/gestor/Alunos.jsx'));
const Professores = React.lazy(() => import('./pages/gestor/Professores.jsx'));
const GestorInformativos = React.lazy(() => import('./pages/gestor/Informativos.jsx'));
const GestorSuporte = React.lazy(() => import('./pages/gestor/Suporte.jsx'));
const ProfessorDashboard = React.lazy(() => import('./pages/professor/ProfessorDashboard.jsx'));
const ProfessorTurmas = React.lazy(() => import('./pages/professor/ProfessorTurmas.jsx'));
const ProfessorAlunos = React.lazy(() => import('./pages/professor/ProfessorAlunos.jsx'));
const ProfessorFrequencia = React.lazy(() => import('./pages/professor/ProfessorFrequencia.jsx'));
const ProfessorRelatorios = React.lazy(() => import('./pages/professor/ProfessorRelatorios.jsx'));
const ProfessorInformativos = React.lazy(() => import('./pages/professor/ProfessorInformativos.jsx'));
const ProfessorSuporte = React.lazy(() => import('./pages/professor/ProfessorSuporte.jsx'));
const Configuracoes = React.lazy(() => import('./pages/gestor/Configuracoes.jsx'));
const ProfessorConfiguracoes = React.lazy(() => import('./pages/professor/ProfessorConfiguracoes.jsx'));

const PageLoading = () => <div className="space-y-5 py-8" role="status" aria-label="Carregando página"><div className="skeleton h-9 w-72 max-w-full" /><div className="skeleton h-4 w-96 max-w-full" /><div className="grid gap-4 sm:grid-cols-2"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div></div>;


const NotFound = () => (
    <div className="flex items-center justify-center h-full">
        <div className="text-center">
            <h1 className="text-4xl font-bold text-text-default">404</h1>
            <p className="mt-2 text-text-muted">Página não encontrada</p>
            <Link to="/" className="btn btn-primary mt-6">Voltar ao início</Link>
        </div>
    </div>
);

const DashboardRedirector = () => {
    const { user } = React.useContext(AuthContext);
    if (!user) return <Navigate to="/login" replace />;
    
    const dashboardPath = user.role === 'gestor' 
        ? '/gestor/dashboard' 
        : '/professor/dashboard';
        
    return <Navigate to={dashboardPath} replace />;
};

const AppRoutes = () => {
    const { user } = React.useContext(AuthContext);

    const commonRoutes = (
        <>
            <Route path="/configuracoes" element={user?.role === 'gestor' ? <Configuracoes /> : <ProfessorConfiguracoes />} />
        </>
    );

    const gestorRoutes = (
        <>
            <Route path="/gestor/dashboard" element={<GestorDashboard />} />
            <Route path="/gestor/cursos" element={<Cursos />} />
            <Route path="/gestor/alunos" element={<Alunos />} />
            <Route path="/gestor/professores" element={<Professores />} />
            <Route path="/gestor/relatorios" element={<Navigate to="/gestor/dashboard" replace />} />
            <Route path="/gestor/informativos" element={<GestorInformativos />} />
            <Route path="/gestor/suporte" element={<GestorSuporte />} />
        </>
    );

    const professorRoutes = (
        <>
            <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
            <Route path="/professor/turmas" element={<ProfessorTurmas />} />
            <Route path="/professor/alunos" element={<ProfessorAlunos />} />
            <Route path="/professor/frequencia" element={<ProfessorFrequencia />} />
            <Route path="/professor/relatorios" element={<ProfessorRelatorios />} />
            <Route path="/professor/informativos" element={<ProfessorInformativos />} />
            <Route path="/professor/suporte" element={<ProfessorSuporte />} />
        </>
    );

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            
            <Route 
                path="/*"
                element={
                    <PrivateRoute>
                        <MainLayout>
                            <Routes>
                                <Route path="/" element={<DashboardRedirector />} />
                                
                                {user?.role === 'gestor' && gestorRoutes}
                                {user?.role === 'professor' && professorRoutes}
                                {commonRoutes}

                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </MainLayout>
                    </PrivateRoute>
                } 
            />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <React.Suspense fallback={<PageLoading />}><AppRoutes /></React.Suspense>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
