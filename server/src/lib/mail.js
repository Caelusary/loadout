// Sends email through Brevo's API (https://developers.brevo.com/reference/sendtransacemail) with plain
// fetch, so there's no extra package. Without BREVO_API_KEY (local development) the message is printed
// to the API's terminal instead, so every flow still works before an account exists. Tests collect
// messages in `outbox`.
export const outbox = [];

const configured = () => Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);

export async function sendMail({ to, name, subject, text, html }) {
  if (process.env.NODE_ENV === 'test') {
    outbox.push({ to, subject, text });
    return;
  }
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not set up: add BREVO_API_KEY and MAIL_FROM.');
    console.log(`\n[mail, not sent: no BREVO_API_KEY] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Loadout', email: process.env.MAIL_FROM },
      to: [{ email: to, ...(name && { name }) }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo refused the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
