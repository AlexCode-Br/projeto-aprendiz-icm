import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import './index.css'; // Importando o CSS global

// --- Páginas ---

// Públicas
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';

// Gestor
import GestorDashboard from './pages/gestor/Dashboard.jsx';
import Cursos from './pages/gestor/Cursos.jsx';
import Alunos from './pages/gestor/Alunos.jsx';
import Professores from './pages/gestor/Professores.jsx';
import GestorRelatorios from './pages/gestor/Relatorios.jsx';
import GestorInformativos from './pages/gestor/Informativos.jsx';
import GestorSuporte from './pages/gestor/Suporte.jsx';

// Professor
import ProfessorDashboard from './pages/professor/ProfessorDashboard.jsx';
import ProfessorAlunos from './pages/professor/ProfessorAlunos.jsx';
import ProfessorFrequencia from './pages/professor/ProfessorFrequencia.jsx';
import ProfessorRelatorios from './pages/professor/ProfessorRelatorios.jsx';
import ProfessorInformativos from './pages/professor/ProfessorInformativos.jsx';
import ProfessorSuporte from './pages/professor/ProfessorSuporte.jsx';

// Comum
import Configuracoes from './pages/gestor/Configuracoes.jsx';
import ProfessorConfiguracoes from './pages/professor/ProfessorConfiguracoes.jsx';


const NotFound = () => (
    <div className="flex items-center justify-center h-full">
        <div className="text-center">
            <h1 className="text-4xl font-bold text-text-default">404</h1>
            <p className="text-text-muted">Página Não Encontrada</p>
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
            <Route path="/gestor/relatorios" element={<GestorRelatorios />} />
            <Route path="/gestor/informativos" element={<GestorInformativos />} />
            <Route path="/gestor/suporte" element={<GestorSuporte />} />
        </>
    );

    const professorRoutes = (
        <>
            <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
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
                <AppRoutes />
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
