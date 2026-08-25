import React from 'react';
import Modal from './Modal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', destructive = true }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" aria-hidden="true">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="mt-4 text-sm leading-6 text-text-muted">{message}</p>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button type="button" onClick={onConfirm} className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}>{confirmLabel}</button>
        </div>
    </Modal>
);

export default ConfirmationModal;
