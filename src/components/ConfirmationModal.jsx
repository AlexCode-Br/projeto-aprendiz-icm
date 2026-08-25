import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 opacity-100">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl p-8 w-full max-w-md transform scale-100">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                        <svg className="h-6 w-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-text-default mt-5">
                        {title}
                    </h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-text-muted">
                            {message}
                        </p>
                    </div>
                </div>
                <div className="mt-8 flex justify-center space-x-4">
                    <button
                        onClick={onConfirm}
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-danger text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                    >
                        Sim
                    </button>
                    <button
                        onClick={onClose}
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-surface text-base font-medium text-gray-700 dark:text-text-default hover:bg-gray-50 dark:hover:bg-gray-50/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                    >
                        Não
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;