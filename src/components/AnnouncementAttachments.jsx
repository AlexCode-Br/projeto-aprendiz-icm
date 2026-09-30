import { ExternalLink, Download, FileText } from 'lucide-react';
import React from 'react';

const formatFileSize = bytes => {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const OpenIcon = () => <ExternalLink aria-hidden="true" className="h-4 w-4" />;
const DownloadIcon = () => <Download aria-hidden="true" className="h-4 w-4" />;

const AnnouncementAttachments = ({ attachments = [] }) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return null;
    return (
        <section className="mt-4 min-w-0 border-t border-border pt-3" aria-label="Anexos do informativo">
            <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Anexos</h4>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.68rem] font-semibold text-text-muted">{attachments.length} {attachments.length === 1 ? 'arquivo' : 'arquivos'}</span>
            </div>
            <div className="grid min-w-0 gap-2">
                {attachments.map((attachment, index) => {
                    const fileUrl = attachment.url || attachment.dataUrl;
                    const isImage = String(attachment.tipo || '').startsWith('image/');
                    const name = attachment.nome || (isImage ? 'Imagem' : 'Documento');
                    const downloadUrl = attachment.url ? `${attachment.url}${attachment.url.includes('?') ? '&' : '?'}download=1` : attachment.dataUrl;
                    return <div key={attachment.id || `${name}-${index}`} className="group grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-lg border border-border bg-surface-muted p-2 text-sm text-text-default transition-colors hover:bg-surface-hover">
                        {isImage && fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-surface" aria-label={`Visualizar imagem ${name}`}><img src={fileUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" /></a> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-lg" aria-hidden="true"><FileText aria-hidden="true" /></span>}
                        <span className="min-w-0 overflow-hidden">
                            <span className="block truncate font-medium leading-5" title={name}>{name}</span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.7rem] text-text-muted"><span className="rounded bg-surface px-1.5 py-0.5 font-semibold uppercase">{isImage ? 'Imagem' : 'PDF'}</span><span className="truncate">{formatFileSize(attachment.tamanho)}</span></span>
                        </span>
                        {fileUrl && <span className="flex shrink-0 items-center gap-1">
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface" aria-label={`Abrir ${name}`} title="Abrir"><OpenIcon /></a>
                            <a href={downloadUrl} download={name} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-default" aria-label={`Baixar ${name}`} title="Baixar"><DownloadIcon /></a>
                        </span>}
                    </div>;
                })}
            </div>
        </section>
    );
};

export default AnnouncementAttachments;
