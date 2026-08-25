import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';

// --- Ícones SVG ---
const AddIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>;
const ChevronDownIcon = ({ className = '' }) => <svg aria-hidden="true" className={`h-5 w-5 transition-transform duration-300 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;
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
        <Modal isOpen={isOpen} onClose={onClose} title="Abrir novo ticket de suporte">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="ticket-subject" className="form-label">Assunto</label>
                            <input type="text" id="ticket-subject" name="assunto" value={formData.assunto} onChange={handleChange} aria-invalid={Boolean(errors.assunto)} aria-describedby={errors.assunto ? 'ticket-subject-error' : undefined} className={`form-control ${errors.assunto ? 'border-danger' : ''}`} />
                            {errors.assunto && <p id="ticket-subject-error" className="text-danger text-xs mt-1">{errors.assunto}</p>}
                        </div>
                        <div>
                            <label htmlFor="ticket-priority" className="form-label">Prioridade</label>
                            <select id="ticket-priority" name="prioridade" value={formData.prioridade} onChange={handleChange} className="form-control">
                                <option>Normal</option>
                                <option>Alta</option>
                                <option>Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="ticket-message" className="form-label">Descreva o problema</label>
                            <textarea id="ticket-message" name="mensagem" rows="6" value={formData.mensagem} onChange={handleChange} aria-invalid={Boolean(errors.mensagem)} aria-describedby={errors.mensagem ? 'ticket-message-error' : undefined} className={`form-control min-h-32 ${errors.mensagem ? 'border-danger' : ''}`}></textarea>
                            {errors.mensagem && <p id="ticket-message-error" className="text-danger text-xs mt-1">{errors.mensagem}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary">Enviar ticket</button>
                    </div>
                </form>
        </Modal>
    );
};

const ProfessorSuporte = () => {
    const { showToast } = useToast();
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
            showToast(err.message || 'Falha ao carregar os tickets de suporte.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleSaveTicket = async (ticketData) => {
        try {
            await api.post('/api/suporte', ticketData);
            setIsModalOpen(false);
            showToast('Ticket aberto com sucesso.', 'success');
            fetchTickets();
        } catch (err) {
            showToast(err.message || 'Falha ao criar o ticket.', 'error');
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
            showToast('Resposta enviada.', 'success');
            fetchTickets();
        } catch (err) {
            showToast(err.message || 'Falha ao responder o ticket.', 'error');
        }
    };
    
    const handleCloseTicket = async (ticketId) => {
        try {
            await api.put(`/api/suporte/${ticketId}/fechar`);
            showToast('Ticket marcado como resolvido.', 'success');
            fetchTickets();
        } catch (err) {
            showToast(err.message || 'Falha ao resolver o ticket.', 'error');
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
    
    if (loading) return <div className="panel p-10 text-center text-text-muted" role="status">Carregando tickets...</div>;
    if (error) return <div className="panel p-10 text-center"><p className="text-danger" role="alert">{error}</p><button type="button" onClick={fetchTickets} className="btn btn-secondary mt-4">Tentar novamente</button></div>;

    return (
        <>
            <div className="page-header fade-in-up">
                <div><h1 className="page-title">Suporte</h1><p className="page-description">Abra solicitações e acompanhe as respostas da equipe responsável.</p></div>
                <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary w-full sm:w-auto">
                    <AddIcon /><span>Abrir novo ticket</span>
                </button>
            </div>

            <div className="panel overflow-hidden fade-in-up delay-200">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-default">Seus Tickets</h3>
                </div>
                <div className="divide-y divide-border">
                    {tickets.length > 0 ? tickets.map(ticket => (
                        <div key={ticket.id} className="ticket-item">
                            <button type="button" aria-expanded={activeAccordion === ticket.id} aria-controls={`ticket-${ticket.id}-details`} onClick={() => toggleAccordion(ticket.id)} className="flex min-h-20 w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-50/10 sm:p-6">
                                <div className="flex-1 pr-4">
                                    <p className="font-semibold text-text-default">{ticket.assunto}</p>
                                    <p className="text-sm text-text-muted">Ticket #{ticket.id} - Aberto em {new Date(ticket.data_abertura).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
                                    <ChevronDownIcon className={activeAccordion === ticket.id ? 'rotate-180' : ''}/>
                                </div>
                            </button>
                            <div id={`ticket-${ticket.id}-details`} hidden={activeAccordion !== ticket.id}>
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
                                                    aria-label={`Responder ao ticket ${ticket.id}`}
                                                    className="form-control min-h-28"
                                                ></textarea>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4">
                                                <button type="button" onClick={() => handleCloseTicket(ticket.id)} className="btn btn-secondary">Resolver ticket</button>
                                                <button type="button" onClick={() => handleReplySubmit(ticket.id)} className="btn btn-primary"><SendIcon /> Enviar</button>
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
