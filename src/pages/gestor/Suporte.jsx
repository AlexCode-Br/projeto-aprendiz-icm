import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import TicketDetailsModal from '../../components/TicketDetailsModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const StatusDropdown = ({ ticket, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const statusOptions = ['Aberto', 'Pendente', 'Resolvido'];
    const getStatusClass = (status, base = false) => {
        const classes = {
            'Aberto': 'bg-success/10 text-success',
            'Pendente': 'bg-warning/10 text-yellow-500',
            'Resolvido': 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
        };
        return `${classes[status] || ''} ${base ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer' : ''}`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button type="button" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)} className={`${getStatusClass(ticket.status, true)} min-h-9`}>
                {ticket.status}
                <svg className="w-2.5 h-2.5 ml-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/></svg>
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-32 rounded-lg border border-border bg-surface shadow-lg" role="menu">
                    <ul className="py-1 text-sm text-text-default">
                        {statusOptions.map(status => (
                            <li key={status}>
                                <button type="button" role="menuitem" onClick={() => { onStatusChange(ticket.id, status); setIsOpen(false); }} className="block min-h-11 w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600">{status}</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


const Suporte = () => {
    const { showToast } = useToast();
    const [tickets, setTickets] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [currentTicket, setCurrentTicket] = useState(null);

    const fetchTickets = useCallback(async () => {
        try {
            const response = await api.get('/api/suporte');
            setTickets(response.data);
        } catch (error) {
            showToast(error.message || 'Erro ao carregar tickets.', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const handleOpenModal = (ticket) => {
        setCurrentTicket(ticket);
        setModalOpen(true);
    };

    const handleStatusChange = async (ticketId, newStatus) => {
        try {
            await api.put(`/api/suporte/${ticketId}/status`, { status: newStatus });
            showToast(`Status do ticket #${ticketId} alterado para ${newStatus}.`, 'success');
            await fetchTickets();
        } catch (error) {
            showToast(error.message || 'Erro ao alterar o status.', 'error');
        }
    };

    const handleReply = async (ticketId, mensagem) => {
        await api.post(`/api/suporte/${ticketId}/responder`, { mensagem });
        showToast('Resposta enviada com sucesso!', 'success');
        setModalOpen(false);
        await fetchTickets();
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket =>
            (ticket.assunto.toLowerCase().includes(searchTerm.toLowerCase()) || ticket.nome.toLowerCase().includes(searchTerm.toLowerCase())) &&
            (selectedStatus === '' || ticket.status === selectedStatus)
        );
    }, [tickets, searchTerm, selectedStatus]);

    return (
        <>
            <div className="page-header"><div><h1 className="page-title">Central de suporte</h1><p className="page-description">Acompanhe solicitações, responda usuários e atualize o andamento de cada ticket.</p></div></div>

            <section className="panel mb-6 p-4" aria-label="Filtros de suporte">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label><span className="sr-only">Pesquisar tickets</span><input
                        type="text" 
                        placeholder="Pesquisar por assunto ou nome..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-control" /></label>
                    <label><span className="sr-only">Filtrar tickets por status</span><select
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="form-control"
                    >
                        <option value="">Todos os Status</option>
                        <option>Aberto</option>
                        <option>Pendente</option>
                        <option>Resolvido</option>
                    </select></label>
                </div>
            </section>

            <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-surface/30 text-xs uppercase text-text-muted">
                            <tr>
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Assunto</th>
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.map(ticket => (
                                <tr key={ticket.id} className="border-b border-border hover:bg-gray-50 dark:hover:bg-gray-50/10">
                                    <td className="px-6 py-4 font-mono text-text-muted">#{ticket.id}</td>
                                    <td className="px-6 py-4 font-medium">{ticket.assunto}</td>
                                    <td className="px-6 py-4">{ticket.nome}</td>
                                    <td className="px-6 py-4">{ticket.data}</td>
                                    <td className="px-6 py-4 text-center">
                                        <StatusDropdown ticket={ticket} onStatusChange={handleStatusChange} />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button type="button" onClick={() => handleOpenModal(ticket)} className="btn min-h-9 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
                                            Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!filteredTickets.length && <tr><td colSpan="6" className="px-6 py-10 text-center text-sm text-text-muted">Nenhum ticket encontrado com estes filtros.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <TicketDetailsModal 
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                ticket={currentTicket}
                onReply={handleReply}
            />
        </>
    );
};

export default Suporte;
