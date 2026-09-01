import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import api from '../services/api';
import useLiveRefresh from '../hooks/useLiveRefresh';

const InformativoReadersModal = ({ isOpen, onClose, informativo }) => {
    const [readers, setReaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReaders = useCallback(async ({ silent = false } = {}) => {
        if (!isOpen || !informativo) return;
        if (!silent) {
            setLoading(true);
            setError(null);
        }
        try {
            const response = await api.get(`/api/informativos/${informativo.id}/leituras`);
            setReaders(Array.isArray(response.data) ? response.data : []);
            setError(null);
        } catch (err) {
            if (silent) throw err;
            setError('Falha ao carregar a lista de visualizações.');
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [informativo, isOpen]);

    useEffect(() => {
        if (isOpen && informativo) void fetchReaders();
    }, [fetchReaders, informativo, isOpen]);
    const refreshReaders = useCallback(() => fetchReaders({ silent: true }), [fetchReaders]);
    useLiveRefresh(refreshReaders, { enabled: Boolean(isOpen && informativo), intervalMs: 10000, eventName: 'announcements:updated' });

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quem visualizou" maxWidth="max-w-2xl">
            {loading ? (
                <div className="space-y-3 py-4" role="status" aria-label="Carregando visualizações">{[1,2,3].map(item=><div key={item} className="skeleton h-12 rounded-lg"/>)}</div>
            ) : error ? (
                <div className="py-8 text-center text-danger">{error}</div>
            ) : (
                <div className="overflow-x-auto">
                    <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success"/>{readers.length} {readers.length === 1 ? 'visualização sincronizada' : 'visualizações sincronizadas'}</p>
                    <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-surface">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left font-medium text-text-muted">Professor</th>
                                <th scope="col" className="px-4 py-3 text-left font-medium text-text-muted">E-mail</th>
                                <th scope="col" className="px-4 py-3 text-left font-medium text-text-muted">Data/Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {readers.length > 0 ? (
                                readers.map((reader, index) => (
                                    <tr key={index} className="hover:bg-border/50">
                                        <td className="px-4 py-3 font-medium text-text-default">{reader.name}</td>
                                        <td className="px-4 py-3 text-text-muted">{reader.email}</td>
                                        <td className="px-4 py-3 text-text-muted">
                                            {new Date(reader.read_at).toLocaleString('pt-BR')}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-text-muted">
                                        <strong className="block text-text-default">Nenhuma visualização ainda</strong><span className="mt-1 block text-sm">Os professores aparecerão aqui após abrirem o informativo.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="mt-6 flex justify-end">
                <button type="button" onClick={onClose} className="btn btn-secondary">Fechar</button>
            </div>
        </Modal>
    );
};

export default InformativoReadersModal;
