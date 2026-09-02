import { ArrowLeft } from 'lucide-react';
import React from 'react';
import Modal from './Modal';
import AnnouncementAttachments from './AnnouncementAttachments';

const AnnouncementDetailModal = ({ isOpen, onClose, announcement }) => {
    if (!announcement) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={announcement.titulo} maxWidth="max-w-3xl">
            <article>
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4 text-sm text-text-muted">
                    <span>{announcement.categoria || announcement.tipo}</span>
                    <span aria-hidden="true">•</span>
                    <span>Publicado em {new Date(announcement.data_publicacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {announcement.fixado && <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200">Fixado</span>}
                </div>
                <div className="announcement-content my-5 max-w-none leading-relaxed text-text-default" dangerouslySetInnerHTML={{ __html: announcement.conteudo }} />
                <AnnouncementAttachments attachments={announcement.anexos} />
            </article>
            <div className="mt-6 flex justify-start border-t border-border pt-5">
                <button type="button" onClick={onClose} className="btn btn-secondary"><ArrowLeft aria-hidden="true" />Voltar</button>
            </div>
        </Modal>
    );
};

export default AnnouncementDetailModal;
