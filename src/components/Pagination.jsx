import { ChevronLeft, ChevronRight } from 'lucide-react';
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
        <nav className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row" aria-label="Paginação">
            {/* Informações de Contagem */}
            <div className="text-xs text-text-muted mb-2 sm:mb-0">
                Mostrando <span className="font-semibold text-text-default">{startItem}</span> a <span className="font-semibold text-text-default">{endItem}</span> de <span className="font-semibold text-text-default">{totalItems}</span> resultados
            </div>

            {/* Controles de Paginação */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="btn btn-secondary min-h-10 px-3"
                >
                    <ChevronLeft aria-hidden="true" className="w-3.5 h-3.5 mr-2" />
                    Anterior
                </button>
                
                <div className="text-sm text-text-muted">
                    Página <span className="font-semibold text-text-default">{currentPage}</span> de <span className="font-semibold text-text-default">{totalPages}</span>
                </div>

                <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary min-h-10 px-3"
                >
                    Próxima
                    <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 ml-2" />
                </button>
            </div>
        </nav>
    );
};

export default Pagination;
