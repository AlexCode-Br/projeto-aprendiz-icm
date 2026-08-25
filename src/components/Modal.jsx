import React, { useEffect, useRef } from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    const handleBackdropClick = (event) => {
        if (modalRef.current && event.target === modalRef.current) {
            onClose();
        }
    };
    
    if (!isOpen) {
        return null;
    }

    return (
        <div
            ref={modalRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
            <div 
                className="bg-surface rounded-lg shadow-xl w-full max-w-lg m-4"
                style={{ animation: 'scaleUp 0.3s ease-out' }}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-xl font-semibold text-text-default">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-default transition-colors duration-200"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {children}
                </div>
            </div>
            
            {/* CORREÇÃO: Removido 'jsx' e 'global' da tag <style> */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Modal;