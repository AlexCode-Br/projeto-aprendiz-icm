import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// --- Ícones SVG ---
const AddIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>;
const ChevronDownIcon = () => <svg className="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;
const SendIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>;

// --- Componente NewTicketModal ---
const NewTicketModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        assunto: '',
        mensagem: '',
        prioridade: 'Normal',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData({ assunto: '', mensagem: '', prioridade: 'Normal' });
            setErrors({});
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.assunto.trim()) newErrors.assunto = 'O assunto é obrigatório.';
        if (!formData.mensagem.trim()) newErrors.mensagem = 'A mensagem é obrigatória.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            onSave(formData);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 opacity-100 px-4">
            <div className="modal-content bg-white dark:bg-surface rounded-lg shadow-xl w-full max-w-lg transform scale-100">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-text-default">Abrir Novo Ticket de Suporte</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-text-default"><CloseIcon /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                        <div>
                            <label htmlFor="ticket-subject" className="block text-sm font-medium text-text-default mb-1">Assunto</label>
                            <input type="text" id="ticket-subject" name="assunto" value={formData.assunto} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-transparent ${errors.assunto ? 'border-danger' : 'border-border'}`} />
                            {errors.assunto && <p className="text-danger text-xs mt-1">{errors.assunto}</p>}
                        </div>
                        <div>
                            <label htmlFor="ticket-priority" className="block text-sm font-medium text-text-default mb-1">Prioridade</label>
                            <select id="ticket-priority" name="prioridade" value={formData.prioridade} onChange={handleChange} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-transparent">
                                <option>Normal</option>
                                <option>Alta</option>
                                <option>Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="ticket-message" className="block text-sm font-medium text-text-default mb-1">Descreva o problema</label>
                            <textarea id="ticket-message" name="mensagem" rows="6" value={formData.mensagem} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-transparent ${errors.mensagem ? 'border-danger' : 'border-border'}`}></textarea>
                            {errors.mensagem && <p className="text-danger text-xs mt-1">{errors.mensagem}</p>}
                        </div>
                    </div>
                    <div className="flex justify-end p-6 border-t border-border bg-gray-50 dark:bg-surface/50 rounded-b-lg">
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors">Enviar Ticket</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProfessorSuporte = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeAccordion, setActiveAccordion] = useState(null);
    const [replyMessages, setReplyMessages] = useState({});

    const fetchTickets = useCallback(async () => {
        try {
            const response = await api.get('/api/suporte');
            const sorted = response.data.sort((a, b) => {
                if (a.status === 'Aberto' && b.status !== 'Aberto') return -1;
                if (a.status !== 'Aberto' && b.status === 'Aberto') return 1;
                return new Date(b.data_abertura) - new Date(a.data_abertura);
            });
            setTickets(sorted);
            setError(null);
        } catch (err) {
            setError("Falha ao carregar os tickets de suporte.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleSaveTicket = async (ticketData) => {
        try {
            await api.post('/api/suporte', ticketData);
            setIsModalOpen(false);
            fetchTickets();
        } catch (err) {
            console.error("Falha ao criar ticket:", err);
        }
    };
    
    const handleReplyChange = (ticketId, message) => {
        setReplyMessages(prev => ({ ...prev, [ticketId]: message }));
    };

    const handleReplySubmit = async (ticketId) => {
        const message = replyMessages[ticketId];
        if (!message || !message.trim()) return;
        try {
            await api.post(`/api/suporte/${ticketId}/responder`, { mensagem: message });
            handleReplyChange(ticketId, '');
            fetchTickets();
        } catch (err) {
            console.error("Falha ao responder ticket:", err);
        }
    };
    
    const handleCloseTicket = async (ticketId) => {
        try {
            await api.put(`/api/suporte/${ticketId}/fechar`);
            fetchTickets();
        } catch (err) {
            console.error("Falha ao fechar ticket:", err);
        }
    };

    const toggleAccordion = (id) => {
        setActiveAccordion(activeAccordion === id ? null : id);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Aberto': return 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300';
            case 'Resolvido': return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-300';
            case 'Pendente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/30 dark:text-yellow-300';
            default: return 'bg-blue-100 text-blue-800';
        }
    };
    
    if (loading) return <div className="text-center p-10 text-text-muted">Carregando...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center fade-in-up mb-6">
                <h2 className="text-2xl font-bold text-text-default mb-4 sm:mb-0">Suporte</h2>
                <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto flex-shrink-0 px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                    <AddIcon /><span>Abrir Novo Ticket</span>
                </button>
            </div>

            <div className="bg-surface rounded-lg shadow-sm border border-border fade-in-up delay-200">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Seus Tickets</h3>
                </div>
                <div className="divide-y divide-border">
                    {tickets.length > 0 ? tickets.map(ticket => (
                        <div key={ticket.id} className="ticket-item">
                            <button onClick={() => toggleAccordion(ticket.id)} className="w-full flex justify-between items-center text-left p-6 hover:bg-gray-50 dark:hover:bg-gray-50/10 transition-colors">
                                <div className="flex-1 pr-4">
                                    <p className="font-semibold text-text-default">{ticket.assunto}</p>
                                    <p className="text-sm text-text-muted">Ticket #{ticket.id} - Aberto em {new Date(ticket.data_abertura).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
                                    <ChevronDownIcon className={activeAccordion === ticket.id ? 'rotate-180' : ''}/>
                                </div>
                            </button>
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${activeAccordion === ticket.id ? 'max-h-[1000px]' : 'max-h-0'}`}>
                                <div className="p-6 border-t border-border bg-gray-50 dark:bg-surface/30">
                                    <div className="space-y-4 mb-6">
                                        <div className="message user">
                                            <p className="text-sm font-semibold text-text-default">Você</p>
                                            <div className="mt-1 p-3 bg-primary/10 rounded-lg text-text-default">{ticket.mensagem}</div>
                                        </div>
                                    </div>

                                    {ticket.status !== 'Resolvido' && (
                                        <>
                                            <div className="reply-form">
                                                <textarea 
                                                    placeholder="Digite sua resposta..." 
                                                    rows="4"
                                                    value={replyMessages[ticket.id] || ''}
                                                    onChange={(e) => handleReplyChange(ticket.id, e.target.value)}
                                                    className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition bg-transparent"
                                                ></textarea>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4">
                                                <button onClick={() => handleCloseTicket(ticket.id)} className="px-4 py-2 text-sm bg-gray-200 text-text-default font-semibold rounded-lg shadow-sm hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors">Resolver Ticket</button>
                                                <button onClick={() => handleReplySubmit(ticket.id)} className="px-4 py-2 text-sm bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition-colors flex items-center gap-2"><SendIcon /> Enviar</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-10 text-center text-text-muted">
                            <p>Nenhum ticket de suporte encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <NewTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTicket} />
        </>
    );
};

export default ProfessorSuporte;
