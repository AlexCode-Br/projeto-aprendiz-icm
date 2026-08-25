import React, { useState, useEffect, useCallback } from 'react';
import InformativoModal from '../../components/InformativoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const Informativos = () => {
    const { showToast } = useToast();
    const [informativos, setInformativos] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [isSendConfirmModalOpen, setSendConfirmModalOpen] = useState(false);
    const [currentInformativo, setCurrentInformativo] = useState(null);
    const [formDataToSave, setFormDataToSave] = useState(null);

    const fetchInformativos = useCallback(async () => {
        try {
            const response = await api.get('/api/informativos');
            setInformativos(response.data);
        } catch (error) {
            showToast(error.message || 'Erro ao carregar informativos.', 'error');
        }
    }, [showToast]);

    useEffect(() => { fetchInformativos(); }, [fetchInformativos]);

    const handleOpenFormModal = (info = null) => {
        setCurrentInformativo(info);
        setFormModalOpen(true);
    };

    const handleOpenDeleteConfirm = (info) => {
        setCurrentInformativo(info);
        setDeleteConfirmModalOpen(true);
    };

    const handleSaveAndOpenConfirm = (formData) => {
        setFormDataToSave(formData);
        setFormModalOpen(false); // Fecha o form
        setSendConfirmModalOpen(true); // Abre a confirmação de envio
    };

    const handleConfirmSend = async () => {
        try {
            if (currentInformativo) {
                await api.put(`/api/informativos/${currentInformativo.id}`, formDataToSave);
                showToast('Informativo atualizado com sucesso!', 'success');
            } else {
                await api.post('/api/informativos', formDataToSave);
                showToast('Informativo criado e publicado com sucesso!', 'success');
            }
            setSendConfirmModalOpen(false);
            setCurrentInformativo(null);
            setFormDataToSave(null);
            await fetchInformativos();
        } catch (error) {
            showToast(error.message || 'Erro ao salvar o informativo.', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/api/informativos/${currentInformativo.id}`);
            showToast('Informativo removido com sucesso!', 'success');
            setDeleteConfirmModalOpen(false);
            setCurrentInformativo(null);
            await fetchInformativos();
        } catch (error) {
            showToast(error.message || 'Erro ao remover o informativo.', 'error');
        }
    };
    
    const getCategoryClass = (cat) => ({
        'Geral': 'bg-blue-100 text-blue-800',
        'Inscrições': 'bg-green-100 text-green-800',
        'Eventos': 'bg-purple-100 text-purple-800',
        'Urgente': 'bg-red-100 text-red-800',
    }[cat] || 'bg-gray-100 text-gray-800');

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-text-default">Informativos</h2>
                <button onClick={() => handleOpenFormModal()} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark flex items-center">
                    Criar Novo Informativo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {informativos.map(info => (
                    <div key={info.id} className="bg-surface rounded-lg shadow-sm border border-border flex flex-col">
                        <div className="p-4 flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${getCategoryClass(info.categoria)}`}>{info.categoria}</span>
                                {info.fixado && <span title="Fixado no topo">📌</span>}
                            </div>
                            <h3 className="font-bold text-lg text-text-default">{info.titulo}</h3>
                            <p className="text-sm text-text-muted mt-1">{info.data} às {info.hora}</p>
                            <p className="text-sm text-text-default mt-4">{info.conteudo}</p>
                        </div>
                        <div className="p-4 border-t border-border flex justify-between items-center text-xs text-text-muted">
                            <div>
                                <span>👁️ {info.lido} Leituras</span>
                                {info.confirmacao && <span className="ml-4">✔️ {info.confirmacoes} Confirmações</span>}
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => handleOpenFormModal(info)} className="text-blue-600 hover:underline">Editar</button>
                                <button onClick={() => handleOpenDeleteConfirm(info)} className="text-danger hover:underline">Excluir</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <InformativoModal
                isOpen={isFormModalOpen}
                onClose={() => setFormModalOpen(false)}
                onSave={handleSaveAndOpenConfirm}
                informativo={currentInformativo}
            />

            <ConfirmationModal
                isOpen={isSendConfirmModalOpen}
                onClose={() => setSendConfirmModalOpen(false)}
                onConfirm={handleConfirmSend}
                title="Confirmar Envio?"
                message="O informativo será enviado para todos os destinatários selecionados. Deseja continuar?"
            />

            <ConfirmationModal
                isOpen={isDeleteConfirmModalOpen}
                onClose={() => setDeleteConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="Confirmar Exclusão?"
                message="Este informativo será permanentemente removido. Esta ação não pode ser desfeita."
            />
        </>
    );
};

export default Informativos;
