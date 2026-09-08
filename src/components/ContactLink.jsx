import React from 'react';
import { Mail } from 'lucide-react';
import { emailHref, whatsappHref } from '../../shared/contact-links.mjs';

export function WhatsAppIcon({ className = 'h-5 w-5 shrink-0', ...props }) {
    return <svg {...props} aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M20.52 3.48A11.88 11.88 0 0 0 12.05 0C5.47 0 .11 5.35.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.93 11.93 0 0 0 5.78 1.47h.01c6.58 0 11.94-5.35 11.95-11.94a11.86 11.86 0 0 0-3.48-8.41ZM12.05 21.82a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.89 9.89 0 0 1-1.51-5.27c0-5.47 4.46-9.92 9.93-9.92a9.85 9.85 0 0 1 7.02 2.91 9.85 9.85 0 0 1 2.91 7.02c0 5.47-4.46 9.92-9.99 9.87Zm5.45-7.42c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.67-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.68-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.1 4.49.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" /></svg>;
}

export default function ContactLink({ type, value }) {
    const href = type === 'email' ? emailHref(value) : whatsappHref(value);
    if (!href) return <span className="break-words">{value || 'Não informado'}</span>;
    return <a href={href} target={type === 'phone' ? '_blank' : undefined} rel={type === 'phone' ? 'noopener noreferrer' : undefined}
        className="inline-flex max-w-full items-start gap-2 rounded text-primary underline-offset-4 hover:underline"
        aria-label={`${type === 'email' ? 'Enviar e-mail para' : 'Conversar no WhatsApp com'} ${value}`}>
        {type === 'email' ? <Mail aria-hidden="true" /> : <WhatsAppIcon />}
        <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
    </a>;
}
