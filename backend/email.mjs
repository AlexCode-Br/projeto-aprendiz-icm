const BRAND_NAME = 'Projeto Aprendiz';
const BRAND_COLOR = '#c51f26';
const DEFAULT_LOGO_URL = 'https://aprendizicm.com.br/projeto-aprendiz-logo.png';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function brandedSender(value) {
  const configured=String(value || '').trim();
  const address=configured.match(/<([^<>]+)>\s*$/)?.[1] || configured;
  return `${BRAND_NAME} <${address}>`;
}

function bodyHtml(body) {
  const escaped=escapeHtml(body);
  const linked=escaped.replace(/https?:\/\/[^\s<]+/g,url=>`<a href="${url}" style="color:${BRAND_COLOR};font-weight:600;text-decoration:underline;">${url}</a>`);
  return linked.split(/\n{2,}/).map(paragraph=>`<p style="margin:0 0 16px;line-height:1.65;">${paragraph.replaceAll('\n','<br>')}</p>`).join('');
}

function emailHtml(subject, body) {
  const logoUrl=escapeHtml(process.env.EMAIL_LOGO_URL || DEFAULT_LOGO_URL);
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f4f4f5;color:#202124;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e2e5;border-top:6px solid ${BRAND_COLOR};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #eeeeef;">
          <img src="${logoUrl}" width="180" alt="Projeto Aprendiz" style="display:block;width:180px;max-width:70%;height:auto;border:0;">
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 20px;color:#202124;font-size:22px;line-height:1.3;">${escapeHtml(subject)}</h1>
          <div style="font-size:16px;line-height:1.65;color:#3f4147;">${bodyHtml(body)}</div>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#fafafa;border-top:1px solid #eeeeef;color:#6b6d74;font-size:12px;line-height:1.5;">
          Esta mensagem foi enviada pelo Projeto Aprendiz.<br>
          <a href="https://aprendizicm.com.br" style="color:${BRAND_COLOR};text-decoration:none;">aprendizicm.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function createEmailService({ db, isProduction, fetchImpl = fetch }) {
  async function sendEmail(recipient, subject, body, idempotencyKey) {
    if (!isProduction) {
      await db.prepare('INSERT INTO dev_emails (recipient,subject,body) VALUES (?,?,?)').run(recipient, subject, body);
      return { local: true };
    }
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      throw new Error('RESEND_API_KEY e EMAIL_FROM são obrigatórias para enviar e-mails em produção.');
    }
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: brandedSender(process.env.EMAIL_FROM),
        to: [recipient],
        subject,
        text: body,
        html: emailHtml(subject,body),
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    });
    if (!response.ok) {
      const providerResponse = await response.json().catch(() => ({}));
      const error = new Error(`Falha no envio de e-mail (${response.status}).`);
      error.code = 'EMAIL_DELIVERY_FAILED';
      error.providerMessage = String(providerResponse?.message || '').slice(0, 300);
      throw error;
    }
    return response.json();
  }

  return { sendEmail };
}
