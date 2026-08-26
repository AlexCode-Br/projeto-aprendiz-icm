import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../services/api';

const InformativoReadersModal = ({ isOpen, onClose, informativo }) => {
    const [readers, setReaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen || !informativo) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        api.get(`/api/informativos/${informativo.id}/leituras`)
            .then(response => {
                if (isMounted) {
                    setReaders(response.data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError('Falha ao carregar lista de leituras.');
                    setLoading(false);
                    console.error(err);
                }
            });

        return () => { isMounted = false; };
    }, [isOpen, informativo]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quem visualizou" maxWidth="max-w-2xl">
            {loading ? (
                <div className="py-8 text-center text-text-muted">Carregando leituras...</div>
            ) : error ? (
                <div className="py-8 text-center text-danger">{error}</div>
            ) : (
                <div className="overflow-x-auto">
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
                                        Ninguém leu este informativo ainda.
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
