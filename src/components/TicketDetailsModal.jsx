import React, { useState } from 'react';
import { useToast } from '../contexts/ToastContext';

const TicketDetailsModal = ({ isOpen, onClose, ticket, onReply }) => {
    const { showToast } = useToast();
    const [resposta, setResposta] = useState('');

    if (!isOpen || !ticket) return null;

    const handleSendResponse = async () => {
        if (!resposta.trim()) {
            showToast('O campo de resposta não pode estar vazio.', 'warning');
            return;
        }
        try {
            await onReply(ticket.id, resposta);
            setResposta('');
        } catch (error) {
            showToast(error.message || 'Erro ao enviar resposta.', 'error');
        }
    };
    
    const getStatusClass = (status) => ({
        'Aberto': 'bg-success/10 text-success',
        'Pendente': 'bg-warning/10 text-yellow-500',
        'Resolvido': 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
    }[status] || 'bg-gray-100');

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-2xl">
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">Detalhes do Ticket #{ticket.id}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-text-muted">Nome</label>
                            <p className="mt-1">{ticket.nome}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-muted">E-mail</label>
                            <p className="mt-1">{ticket.contato}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-muted">Data</label>
                            <p className="mt-1">{ticket.data}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-muted">Status</label>
                            <p className="mt-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(ticket.status)}`}>
                                    {ticket.status}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-text-muted">Assunto</label>
                        <p className="mt-1 font-semibold">{ticket.assunto}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-text-muted">Mensagem</label>
                        <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-border whitespace-pre-wrap">{ticket.mensagem}</p>
                    </div>
                    <div className="border-t border-border pt-4">
                        <label className="block text-sm font-medium text-text-default mb-1">Responder ao Ticket</label>
                        <textarea
                            value={resposta}
                            onChange={(e) => setResposta(e.target.value)}
                            rows="4"
                            placeholder="Escreva sua resposta aqui..."
                            className="w-full p-2 border border-border rounded-lg"
                        ></textarea>
                    </div>
                </div>
                <div className="flex justify-end p-4 md:p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                    <button onClick={handleSendResponse} className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark">
                        Enviar Resposta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailsModal;
