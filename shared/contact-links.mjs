export function whatsappHref(value) {
    const phone = String(value || '').trim();
    if (!phone || /[^\d\s()+.-]/.test(phone)) return null;
    let digits = phone.replace(/\D/g, '');
    if (!phone.startsWith('+') && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
    if (!/^[1-9]\d{9,14}$/.test(digits)) return null;
    return `https://wa.me/${digits}`;
}

export function emailHref(value) {
    const email = String(value || '').trim();
    if (!/^[^\s@?&#,;:<>"\\]+@[^\s@?&#,;:<>"\\]+\.[^\s@?&#,;:<>"\\]+$/.test(email)) return null;
    const [local, domain] = email.split('@');
    return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}`;
}
