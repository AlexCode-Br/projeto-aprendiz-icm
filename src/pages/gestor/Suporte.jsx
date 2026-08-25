import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import TicketDetailsModal from '../../components/TicketDetailsModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

// Mock Data
const initialTicketsData = [
    { id: '001', nome: 'Ana Beatriz', contato: 'ana.beatriz@email.com', assunto: 'Dúvida sobre o material da aula 5', data: '28/08/2025', status: 'Aberto', mensagem: 'Olá, gostaria de saber se o material da aula 5 de Teclado já está disponível na plataforma. Não consegui encontrar. Obrigada!' },
    { id: '002', nome: 'Carlos Souza', contato: 'carlos.souza@email.com', assunto: 'Problema ao acessar a aula ao vivo', data: '28/08/2025', status: 'Aberto', mensagem: 'Não estou conseguindo acessar a transmissão da aula de Bateria. A página fica carregando infinitamente.' },
    { id: '003', nome: 'Juliana Costa', contato: 'juliana.costa@email.com', assunto: 'Sugestão de música para o repertório', data: '27/08/2025', status: 'Pendente', mensagem: 'Gostaria de sugerir a música "Como é grande o meu amor por você" para o repertório do curso de Teclado. Seria ótimo aprender a tocá-la!' },
    { id: '004', nome: 'Ricardo Alves', contato: 'ricardo.alves@email.com', assunto: 'Cancelamento de Matrícula', data: '26/08/2025', status: 'Resolvido', mensagem: 'Preciso cancelar minha matrícula no curso de Violão I por motivos pessoais. Como devo proceder?' },
];

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
            <button onClick={() => setIsOpen(!isOpen)} className={getStatusClass(ticket.status, true)}>
                {ticket.status}
                <svg className="w-2.5 h-2.5 ml-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/></svg>
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-32 bg-white dark:bg-surface rounded-md shadow-lg">
                    <ul className="py-1 text-sm text-gray-700 dark:text-gray-200">
                        {statusOptions.map(status => (
                            <li key={status}>
                                <a href="#" onClick={(e) => { e.preventDefault(); onStatusChange(ticket.id, status); setIsOpen(false); }} className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">{status}</a>
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
            <h2 className="text-2xl font-bold text-text-default mb-6">Central de Suporte</h2>

            <div className="p-4 bg-surface rounded-lg shadow-sm border border-border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                        type="text" 
                        placeholder="Pesquisar por assunto ou nome..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-surface" />
                    <select
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-surface"
                    >
                        <option value="">Todos os Status</option>
                        <option>Aberto</option>
                        <option>Pendente</option>
                        <option>Resolvido</option>
                    </select>
                </div>
            </div>

            <div className="bg-surface rounded-lg shadow-sm overflow-hidden border border-border">
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
                                        <button onClick={() => handleOpenModal(ticket)} className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20">
                                            Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
