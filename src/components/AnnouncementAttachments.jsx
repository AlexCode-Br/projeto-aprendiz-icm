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
            <div className="grid gap-2 sm:grid-cols-2">
                {attachments.map((attachment, index) => {
                    const fileUrl = attachment.url || attachment.dataUrl;
                    const isImage = String(attachment.tipo || '').startsWith('image/');
                    const name = attachment.nome || (isImage ? 'Imagem' : 'Documento');
                    const downloadUrl = attachment.url ? `${attachment.url}${attachment.url.includes('?') ? '&' : '?'}download=1` : attachment.dataUrl;
                    return <div key={attachment.id || `${name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-surface-muted p-2 text-sm text-text-default">
                        {isImage && fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Visualizar imagem ${name}`}><img src={fileUrl} alt="" loading="lazy" className="h-12 w-12 rounded object-cover" /></a> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface text-xl" aria-hidden="true">📄</span>}
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium" title={name}>{name}</span><span className="text-xs text-text-muted">{isImage ? 'Imagem' : 'PDF'} · {formatFileSize(attachment.tamanho)}</span></span>
                        {fileUrl && <span className="flex shrink-0 gap-1">
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="rounded px-2 py-2 text-xs font-semibold text-primary hover:bg-surface-hover" aria-label={`Visualizar ${name}`}>Abrir</a>
                            <a href={downloadUrl} download={name} className="rounded px-2 py-2 text-xs font-semibold text-text-muted hover:bg-surface-hover" aria-label={`Baixar ${name}`}>Baixar</a>
                        </span>}
                    </div>;
                })}
            </div>
        </div>
    );
};

export default AnnouncementAttachments;
