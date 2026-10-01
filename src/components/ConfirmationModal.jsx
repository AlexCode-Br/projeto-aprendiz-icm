import { TriangleAlert } from 'lucide-react';
import React from 'react';
import Modal from './Modal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', destructive = true, loading = false }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" aria-hidden="true">
                <TriangleAlert aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm leading-6 text-text-muted">{message}</p>
        </div>
        <div className="mt-7 flex sm:justify-end">
            <button type="button" onClick={onConfirm} disabled={loading} className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}>{loading ? 'Excluindo...' : confirmLabel}</button>
        </div>
    </Modal>
);

export default ConfirmationModal;
