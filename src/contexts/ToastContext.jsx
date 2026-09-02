import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import React, { createContext, useState, useContext, useCallback } from 'react';

// --- Ícones para os tipos de Toast ---
const SuccessIcon = () => <CircleCheck aria-hidden="true" className="w-6 h-6 text-green-500" />;
const ErrorIcon = () => <CircleX aria-hidden="true" className="w-6 h-6 text-red-500" />;
const InfoIcon = () => <Info aria-hidden="true" className="w-6 h-6 text-blue-500" />;
const WarningIcon = () => <TriangleAlert aria-hidden="true" className="w-6 h-6 text-yellow-500" />;

const icons = {
    success: <SuccessIcon />,
    error: <ErrorIcon />,
    info: <InfoIcon />,
    warning: <WarningIcon />,
};

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = crypto.randomUUID();
        setToasts(prevToasts => [...prevToasts.slice(-2), { id, message, type }]);
        
        setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
        }, duration);
    }, []);

    const removeToast = (id) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[9999] space-y-2 sm:left-auto sm:right-5 sm:bottom-5" aria-live="polite" aria-atomic="false">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="pointer-events-auto flex w-full max-w-sm items-center rounded-xl border border-border bg-surface p-4 text-text-muted shadow-lg sm:w-auto toast-enter"
                        role={toast.type === 'error' ? 'alert' : 'status'}
                    >
                        {icons[toast.type]}
                        <div className="ml-3 min-w-0 break-words text-sm leading-6">{toast.message}</div>
                        <button 
                            type="button" 
                        className="icon-button ml-auto shrink-0"
                        aria-label="Fechar notificação"
                            onClick={() => removeToast(toast.id)}
                        >
                            <X aria-hidden="true" className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
