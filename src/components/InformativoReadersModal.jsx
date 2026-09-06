import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import ProfessorDetailsModal from './ProfessorDetailsModal';
import api from '../services/api';
import useLiveRefresh from '../hooks/useLiveRefresh';

const readMoment = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: 'Data não informada', time: '' };
    return {
        date: date.toLocaleDateString('pt-BR'),
        time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
};

const InformativoReadersModal = ({ isOpen, onClose, informativo, professores = [] }) => {
    const [readers, setReaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProfessor, setSelectedProfessor] = useState(null);

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
    useEffect(() => {
        if (!isOpen) setSelectedProfessor(null);
    }, [isOpen]);
    const refreshReaders = useCallback(() => fetchReaders({ silent: true }), [fetchReaders]);
    useLiveRefresh(refreshReaders, { enabled: Boolean(isOpen && informativo), intervalMs: 10000, eventName: 'announcements:updated' });

    if (!isOpen) return null;

    const professorFor = reader => professores.find(professor => Number(professor.id) === Number(reader.professor_id));

    return (<>
        <Modal isOpen={isOpen} onClose={onClose} title="Quem visualizou" maxWidth="max-w-xl">
            {loading ? (
                <div className="space-y-3 py-4" role="status" aria-label="Carregando visualizações">{[1,2,3].map(item=><div key={item} className="skeleton h-12 rounded-lg"/>)}</div>
            ) : error ? (
                <div className="py-8 text-center text-danger">{error}</div>
            ) : (
                <div>
                    <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success"/>{readers.length} {readers.length === 1 ? 'visualização sincronizada' : 'visualizações sincronizadas'}</p>
                    {readers.length > 0 ? (
                        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" aria-label="Professores que visualizaram">
                            {readers.map((reader, index) => {
                                const professor = professorFor(reader);
                                const moment = readMoment(reader.read_at);
                                return (
                                    <li key={`${reader.professor_id || reader.name}-${reader.read_at || index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-surface-hover">
                                        {professor ? (
                                            <button type="button" onClick={() => setSelectedProfessor(professor)} className="min-w-0 justify-self-start break-words text-left text-sm font-semibold leading-5 text-text-default transition-colors hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Ver detalhes de ${reader.name}`}>
                                                {reader.name}
                                            </button>
                                        ) : <span className="min-w-0 break-words text-sm font-semibold leading-5 text-text-default">{reader.name}</span>}
                                        <time dateTime={reader.read_at} className="shrink-0 text-right text-xs leading-5 text-text-muted">
                                            <span className="block">{moment.date}</span>
                                            {moment.time && <span className="block">{moment.time}</span>}
                                        </time>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="rounded-xl border border-border px-4 py-8 text-center text-text-muted">
                            <strong className="block text-text-default">Nenhuma visualização ainda</strong><span className="mt-1 block text-sm">Os professores aparecerão aqui após abrirem o informativo.</span>
                        </div>
                    )}
                </div>
            )}
        </Modal>
        <ProfessorDetailsModal isOpen={Boolean(selectedProfessor)} onClose={() => setSelectedProfessor(null)} professor={selectedProfessor} />
    </>);
};

export default InformativoReadersModal;
