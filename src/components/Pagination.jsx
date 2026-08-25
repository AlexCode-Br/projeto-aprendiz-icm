import React from 'react';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        return null; // Não renderiza a paginação se houver apenas uma página
    }

    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4">
            {/* Informações de Contagem */}
            <div className="text-sm text-text-muted mb-2 sm:mb-0">
                Mostrando <span className="font-semibold text-text-default">{startItem}</span> a <span className="font-semibold text-text-default">{endItem}</span> de <span className="font-semibold text-text-default">{totalItems}</span> resultados
            </div>

            {/* Controles de Paginação */}
            <div className="inline-flex items-center space-x-2">
                <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="flex items-center justify-center px-3 h-8 text-sm font-medium text-text-default bg-surface border border-border rounded-md hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-3.5 h-3.5 mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5H1m0 0l4 4M1 5l4-4"/>
                    </svg>
                    Anterior
                </button>
                
                <div className="text-sm text-text-muted">
                    Página <span className="font-semibold text-text-default">{currentPage}</span> de <span className="font-semibold text-text-default">{totalPages}</span>
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="flex items-center justify-center px-3 h-8 text-sm font-medium text-text-default bg-surface border border-border rounded-md hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Próxima
                    <svg className="w-3.5 h-3.5 ml-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Pagination;