import React from 'react';

const formatFileSize = bytes => {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const AnnouncementAttachments = ({ attachments = [] }) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return null;
    return (
        <div className="mt-4 border-t border-border pt-3" aria-label="Anexos do informativo">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Anexos</p>
            <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, index) => {
                    const label = `${attachment.nome || 'Imagem'} (${formatFileSize(attachment.tamanho)})`;
                    const content = <><span aria-hidden="true">🖼️</span><span className="max-w-[18rem] truncate" title={attachment.nome}>{attachment.nome || 'Imagem'}</span><span className="shrink-0 text-xs text-text-muted">({formatFileSize(attachment.tamanho)})</span></>;
                    const downloadUrl = attachment.url || attachment.dataUrl;
                    return downloadUrl ? (
                        <a key={attachment.id || `${attachment.nome}-${index}`} href={downloadUrl} download={attachment.nome || 'imagem'} className="flex max-w-full items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-default transition-colors hover:bg-surface-hover" aria-label={`Baixar anexo ${label}`}>
                            {content}
                        </a>
                    ) : (
                        <span key={attachment.id || `${attachment.nome}-${index}`} className="flex max-w-full items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-default">
                            {content}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export default AnnouncementAttachments;
