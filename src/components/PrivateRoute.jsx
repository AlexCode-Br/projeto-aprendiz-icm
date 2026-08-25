import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) {
        // Pode ser substituído por um componente de Spinner/Loading mais elegante
        return <div>Verificando autenticação...</div>;
    }

    if (!user) {
        // Redireciona para a página de login, mas guarda a página que o usuário tentou acessar
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default PrivateRoute;