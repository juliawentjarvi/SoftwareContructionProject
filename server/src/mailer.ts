import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';

export type PasswordResetSender = (email: string, token: string) => Promise<void>;

interface MailerOptions {
  /** Brevo transactional email API key. Takes priority over SMTP. */
  brevoApiKey?: string | undefined;
  smtpUrl?: string | undefined;
  mailFrom: string;
  production: boolean;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Directory for the development fallback; defaults to .dev-outbox next to package.json. */
  outboxDir?: string;
}

function messageBody(token: string): string {
  return [
    'Someone asked to reset the password for your Bear Care account.',
    '',
    'Reset code (valid for 30 minutes, works once):',
    token,
    '',
    'In the app choose "Forgot password?", then "I have a code", and enter it with a new password.',
    'If you did not ask for this, you can ignore this message; your password has not changed.',
  ].join('\n');
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/** Splits "Bear Care <no-reply@example.com>" into the name and address Brevo expects. */
export function parseSender(value: string): { name?: string; email: string } {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value);
  if (!match) return { email: value.trim() };
  const name = match[1]?.trim();
  return name ? { name, email: match[2]!.trim() } : { email: match[2]!.trim() };
}

/**
 * Delivers the reset code to the account's email. With BREVO_API_KEY set it goes through Brevo's HTTP API (the sender
 * address must be verified in Brevo); otherwise with SMTP_URL set it is sent over SMTP. Without it, outside
 * production only, the message is written to a git-ignored file so the flow can be tried on a development machine;
 * in production without SMTP nothing is delivered. The code is never logged or returned by the API.
 */
export function createPasswordResetSender(options: MailerOptions): PasswordResetSender {
  if (options.brevoApiKey) {
    const key = options.brevoApiKey;
    const send = options.fetchImpl ?? fetch;
    return async (email, token) => {
      const response = await send(BREVO_ENDPOINT, {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: parseSender(options.mailFrom),
          to: [{ email }],
          subject: 'Reset your Bear Care password',
          textContent: messageBody(token),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      // The error mentions only the status so the reset code can never end up in logs.
      if (!response.ok) throw new Error(`Brevo rejected the message (HTTP ${response.status})`);
    };
  }
  if (options.smtpUrl) {
    const transport = nodemailer.createTransport(options.smtpUrl);
    return async (email, token) => {
      await transport.sendMail({ from: options.mailFrom, to: email, subject: 'Reset your Bear Care password', text: messageBody(token) });
    };
  }
  if (options.production) {
    return async () => {
      console.warn('Password reset requested but SMTP_URL is not configured; no message was sent.');
    };
  }
  const dir = options.outboxDir ?? join(process.cwd(), '.dev-outbox');
  return async (email, token) => {
    await mkdir(dir, { recursive: true });
    const safeName = email.replace(/[^a-z0-9@._-]/gi, '_');
    await writeFile(join(dir, `${Date.now()}-${safeName}.txt`), `To: ${email}\nSubject: Reset your Bear Care password\n\n${messageBody(token)}\n`);
  };
}
