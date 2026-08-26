import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import Modal from './Modal';

const TicketDetailsModal = ({ isOpen, onClose, ticket, onReply }) => {
    const { showToast } = useToast();
    const [resposta, setResposta] = useState('');

    useEffect(() => {
        if (!isOpen) setResposta('');
    }, [isOpen]);

    if (!ticket) return null;

    const handleSendResponse = async () => {
        if (!resposta.trim()) return showToast('O campo de resposta não pode estar vazio.', 'warning');
        try {
            await onReply(ticket.id, resposta);
            setResposta('');
        } catch (error) {
            showToast(error.message || 'Erro ao enviar resposta.', 'error');
        }
    };

    const statusClass = {
        Aberto: 'bg-success/10 text-success',
        Pendente: 'bg-warning/10 text-yellow-700 dark:text-yellow-300',
        Resolvido: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
    }[ticket.status] || 'bg-gray-100 text-text-default';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes do ticket #${ticket.id}`} maxWidth="max-w-2xl">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[['Nome', ticket.nome], ['E-mail', ticket.contato], ['Data', ticket.data]].map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-text-muted">{label}</dt><dd className="mt-1 break-words text-text-default">{value || 'Não informado'}</dd></div>)}
                <div><dt className="text-sm font-medium text-text-muted">Status</dt><dd className="mt-1"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{ticket.status}</span></dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-text-muted">Assunto</dt><dd className="mt-1 font-semibold text-text-default">{ticket.assunto}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-text-muted">Mensagem</dt><dd className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-gray-50 p-3 text-text-default bg-surface-muted">{ticket.mensagem}</dd></div>
            </dl>
            <div className="mt-5 border-t border-border pt-5">
                <label htmlFor="ticket-response" className="form-label">Responder ao ticket</label>
                <textarea id="ticket-response" value={resposta} onChange={event => setResposta(event.target.value)} rows="4" placeholder="Escreva sua resposta aqui..." className="form-control min-h-28" />
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button><button type="button" onClick={handleSendResponse} className="btn btn-primary">Enviar resposta</button></div>
        </Modal>
    );
};

export default TicketDetailsModal;
