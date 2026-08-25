import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';

// Páginas
import Login from './pages/Login';

// ---- Crie estes arquivos com um conteúdo simples por enquanto ----
// Exemplo para Dashboard.js:
// const Dashboard = () => {
//   const { user } = useContext(AuthContext);
//   return <h1 className="text-3xl font-bold">Bem-vindo ao Dashboard, {user?.name}!</h1>;
// };
// export default Dashboard;

import Dashboard from './pages/Dashboard';
import Cursos from './pages/gestor/Cursos';
import Alunos from './pages/gestor/Alunos';
import Professores from './pages/gestor/Professores';
import RelatoriosGestor from './pages/gestor/Relatorios';
import InformativosGestor from './pages/gestor/Informativos';
import SuporteGestor from './pages/gestor/Suporte';
import Configuracoes from './pages/Configuracoes';

import MeusAlunos from './pages/professor/MeusAlunos';
import Frequencia from './pages/professor/Frequencia';
import RelatoriosProfessor from './pages/professor/Relatorios';
import InformativosProfessor from './pages/professor/Informativos';
import SuporteProfessor from './pages/professor/Suporte';
// -----------------------------------------------------------------


const AppRoutes = () => {
    const { user } = useContext(AuthContext);

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/*" element={
                <PrivateRoute>
                    <MainLayout>
                        <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            
                            {/* Rotas do Gestor */}
                            {user?.role === 'gestor' && (
                                <>
                                    <Route path="/cursos" element={<Cursos />} />
                                    <Route path="/alunos" element={<Alunos />} />
                                    <Route path="/professores" element={<Professores />} />
                                    <Route path="/relatorios" element={<RelatoriosGestor />} />
                                    <Route path="/informativos" element={<InformativosGestor />} />
                                    <Route path="/suporte" element={<SuporteGestor />} />
                                </>
                            )}

                            {/* Rotas do Professor */}
                            {user?.role === 'professor' && (
                                <>
                                    <Route path="/meus-alunos" element={<MeusAlunos />} />
                                    <Route path="/frequencia" element={<Frequencia />} />
                                    <Route path="/relatorios" element={<RelatoriosProfessor />} />
                                    <Route path="/informativos" element={<InformativosProfessor />} />
                                    <Route path="/suporte" element={<SuporteProfessor />} />
                                </>
                            )}
                            
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/" element={<Navigate to="/dashboard" />} />
                            {/* Adicionar uma rota 404 seria uma boa prática */}
                        </Routes>
                    </MainLayout>
                </PrivateRoute>
            } />
        </Routes>
    );
};

function App() {

    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;