const BRAND_NAME = 'Projeto Aprendiz';
const BRAND_COLOR = '#c51f26';
const BRAND_COLOR_DARK = '#991b1f';
const DEFAULT_FROM = 'naoresponda@aprendizicm.com.br';
const DEFAULT_LOGO_URL = 'https://aprendizicm.com.br/projeto-aprendiz-logo.png';
const DEFAULT_DEPARTMENT_LOGO_URL = 'https://aprendizicm.com.br/departamento-louvor-logo.png';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function brandedSender(value) {
  const configured = String(value || DEFAULT_FROM).trim();
  const address = configured.match(/<([^<>]+)>\s*$/)?.[1] || configured;
  return `${BRAND_NAME} <${address}>`;
}

function normalizedBody(body) {
  return String(body ?? '').trim().replace(/\n{2,}Projeto Aprendiz\.?$/i, '').trim();
}

function bodyHtml(body) {
  const escaped = escapeHtml(normalizedBody(body));
  const linked = escaped.replace(
    /https?:\/\/[^\s<]+/g,
    url => `<a href="${url}" style="color:${BRAND_COLOR_DARK};font-weight:700;text-decoration:underline;text-underline-offset:2px;">${url}</a>`,
  );
  return linked
    .split(/\n{2,}/)
    .map(paragraph => `<p style="margin:0 0 18px;line-height:1.7;">${paragraph.replaceAll('\n', '<br>')}</p>`)
    .join('');
}

function callToAction(subject, body) {
  if (!/(convite|recupera|senha|acesso)/i.test(subject)) return '';
  const url = normalizedBody(body).match(/https?:\/\/[^\s<]+/)?.[0];
  if (!url) return '';
  const safeUrl = escapeHtml(url);
  const label = /recupera|senha/i.test(subject) ? 'Redefinir minha senha' : 'Acessar o Projeto Aprendiz';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
      <tr><td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
        <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;line-height:1;text-decoration:none;border-radius:8px;">${label}</a>
      </td></tr>
    </table>`;
}

function preheaderText(body) {
  return normalizedBody(body).replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').slice(0, 140);
}

export function renderEmailHtml(subject, body) {
  const logoUrl = escapeHtml(process.env.EMAIL_LOGO_URL || DEFAULT_LOGO_URL);
  const departmentLogoUrl = escapeHtml(process.env.EMAIL_DEPARTMENT_LOGO_URL || DEFAULT_DEPARTMENT_LOGO_URL);
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media only screen and (max-width:620px){
      .email-shell{padding:12px 8px!important}
      .email-card{border-radius:12px!important}
      .email-header,.email-content,.email-footer{padding-left:22px!important;padding-right:22px!important}
      .department-logo{width:140px!important}
      .project-logo{width:118px!important}
      .email-title{font-size:23px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;color:#24262b;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheaderText(body))}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f4f6;">
    <tr><td class="email-shell" align="center" style="padding:32px 12px;">
      <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e4e8;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(17,24,39,.08);">
        <tr><td style="height:6px;background:${BRAND_COLOR};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="email-header" align="center" style="padding:25px 32px 23px;border-bottom:1px solid #eceef1;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
            <tr>
              <td align="center" valign="middle" style="padding-right:18px;">
                <img class="department-logo" src="${departmentLogoUrl}" width="180" alt="Departamento de Louvor" style="display:block;width:180px;max-width:100%;height:auto;border:0;">
              </td>
              <td width="1" style="width:1px;background:#e1e3e7;font-size:0;line-height:0;">&nbsp;</td>
              <td align="center" valign="middle" style="padding-left:18px;">
                <img class="project-logo" src="${logoUrl}" width="132" alt="Projeto Aprendiz" style="display:block;width:132px;max-width:100%;height:auto;border:0;">
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="email-content" style="padding:34px 36px 30px;">
          <div style="margin:0 0 12px;color:${BRAND_COLOR};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Comunicação oficial</div>
          <h1 class="email-title" style="margin:0 0 22px;color:#202228;font-size:26px;line-height:1.3;letter-spacing:-.3px;">${escapeHtml(subject)}</h1>
          <div style="font-size:16px;line-height:1.7;color:#4a4d55;">${bodyHtml(body)}</div>
          ${callToAction(subject, body)}
          <div style="margin-top:8px;padding:14px 16px;background:#f8f8f9;border-left:3px solid ${BRAND_COLOR};border-radius:0 8px 8px 0;color:#656870;font-size:12px;line-height:1.55;">
            Esta é uma mensagem automática e segura do Projeto Aprendiz. Se você não reconhece esta solicitação, ignore este e-mail.
          </div>
        </td></tr>
        <tr><td class="email-footer" align="center" style="padding:22px 32px;background:#fafafa;border-top:1px solid #eceef1;color:#747780;font-size:12px;line-height:1.6;">
          <strong style="color:#44474e;">Projeto Aprendiz</strong> &middot; Igreja Cristã Maranata<br>
          <a href="https://aprendizicm.com.br" style="color:${BRAND_COLOR_DARK};font-weight:700;text-decoration:none;">aprendizicm.com.br</a><br>
          <span style="color:#999ba2;">&copy; ${year} Projeto Aprendiz. Todos os direitos reservados.</span>
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
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY é obrigatória para enviar e-mails em produção.');
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
        html: renderEmailHtml(subject, body),
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
