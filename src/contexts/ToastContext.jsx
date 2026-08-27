import React, { createContext, useState, useContext, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, AlertIcon, InfoIcon, CloseIcon } from '../components/icons/index.jsx';

const ICON_MAP = {
  success: <CheckCircleIcon className="w-5 h-5 text-success shrink-0" />,
  error:   <XCircleIcon   className="w-5 h-5 text-danger shrink-0" />,
  warning: <AlertIcon     className="w-5 h-5 text-warning shrink-0" />,
  info:    <InfoIcon      className="w-5 h-5 text-info shrink-0" />,
};

const BG_MAP = {
  success: 'bg-success-bg border-success-border',
  error:   'bg-danger-bg border-danger-border',
  warning: 'bg-warning-bg border-warning-border',
  info:    'bg-info-bg border-info-border',
};

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed right-4 top-4 z-[9999] flex flex-col gap-2 sm:right-5 sm:top-5"
        aria-live="polite"
        aria-atomic="false"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={[
              'flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg toast-enter',
              BG_MAP[toast.type] || BG_MAP.info,
            ].join(' ')}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            {ICON_MAP[toast.type]}
            <p className="flex-1 text-sm font-medium text-text-default leading-snug">{toast.message}</p>
            <button
              type="button"
              className="icon-btn shrink-0 -mt-0.5 -mr-0.5"
              aria-label="Fechar notificação"
              onClick={() => remove(toast.id)}
            >
              <CloseIcon className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
