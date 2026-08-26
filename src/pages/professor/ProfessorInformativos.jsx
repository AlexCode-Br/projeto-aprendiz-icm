import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const ProfessorInformativos = () => {
    const [informativos, setInformativos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInformativos = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/informativos');
            // Ordena para que os mais recentes apareçam primeiro
            const sorted = response.data.sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao));
            setInformativos(sorted);
            await Promise.allSettled(sorted.filter(info => !info.hasRead).map(info => api.post(`/api/informativos/${info.id}/lida`)));
            setError(null);
        } catch (err) {
            setError("Falha ao carregar os informativos. Tente novamente mais tarde.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInformativos();
    }, [fetchInformativos]);

    const getCardClassByType = (type) => {
        switch (type) {
            case 'Urgente':
                return 'border-l-4 border-danger';
            case 'Evento':
                return 'border-l-4 border-yellow-500';
            default:
                return 'border-l-4 border-primary';
        }
    };

    if (loading) return <div className="panel p-10 text-center text-text-muted" role="status">Carregando informativos...</div>;
    if (error) return <div className="panel p-10 text-center"><p className="text-danger" role="alert">{error}</p><button type="button" onClick={fetchInformativos} className="btn btn-secondary mt-4">Tentar novamente</button></div>;

    return (
        <div className="">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Informativos e avisos</h1>
                    <p className="page-description">Fique por dentro das últimas novidades e comunicados.</p>
                </div>
            </div>

            <div className="space-y-6">
                {informativos.length > 0 ? informativos.map((info, index) => (
                    <div
                        key={info.id}
                        className={`info-card panel p-5 transition-opacity duration-500 ease-out sm:p-6 ${getCardClassByType(info.tipo)}`}
                        style={{ animation: 'fadeInUp 0.5s ease-out forwards', animationDelay: `${index * 100}ms`, opacity: 0 }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-primary uppercase">{info.tipo}</span>
                            {info.fixado && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Fixado</span>}
                        </div>
                        <h3 className="text-xl font-bold text-text-default mb-2">{info.titulo}</h3>
                        <div className="prose prose-sm mb-4 max-w-none text-text-default" dangerouslySetInnerHTML={{ __html: info.conteudo }} />

                        <div className="flex items-center justify-between pt-4 border-t border-border">
                            <p className="text-xs text-text-muted">
                                Publicado em {new Date(info.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>

                        </div>
                    </div>
                )) : (
                     <div className="text-center py-16 text-text-muted">
                        <svg className="mx-auto w-12 h-12 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <h3 className="mt-2 text-sm font-medium text-text-default">Nenhum informativo por aqui</h3>
                        <p className="mt-1 text-sm">Quando um novo informativo for publicado, ele aparecerá aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfessorInformativos;
