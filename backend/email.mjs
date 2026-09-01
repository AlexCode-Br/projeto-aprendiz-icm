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
        from: process.env.EMAIL_FROM,
        to: [recipient], subject, text: body,
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
