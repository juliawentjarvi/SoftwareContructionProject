import { describe, expect, it, vi } from 'vitest';
import { createPasswordResetSender, parseSender } from '../src/mailer.js';

describe('Brevo delivery', () => {
  it('posts the message to Brevo with the API key and never puts the key in the body', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"messageId":"x"}', { status: 201 }));
    await createPasswordResetSender({
      brevoApiKey: 'xkeysib-secret', mailFrom: 'Bear Care <sender@example.com>', production: true, fetchImpl: fetchImpl as unknown as typeof fetch,
    })('user@example.test', 'CODE-789');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-secret');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ sender: { name: 'Bear Care', email: 'sender@example.com' }, to: [{ email: 'user@example.test' }] });
    expect(body.textContent).toContain('CODE-789');
    expect(init.body as string).not.toContain('xkeysib-secret');
  });

  it('fails with a message that contains neither the code nor the key when Brevo rejects the request', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"sender not verified"}', { status: 400 }));
    const send = createPasswordResetSender({
      brevoApiKey: 'xkeysib-secret', mailFrom: 'a@example.com', production: true, fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await send('user@example.test', 'CODE-789').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Brevo rejected the message (HTTP 400)');
  });

  it('parses sender addresses with and without a display name', () => {
    expect(parseSender('Bear Care <a@example.com>')).toEqual({ name: 'Bear Care', email: 'a@example.com' });
    expect(parseSender('"Bear, Care" <a@example.com>')).toEqual({ name: 'Bear, Care', email: 'a@example.com' });
    expect(parseSender('a@example.com')).toEqual({ email: 'a@example.com' });
    expect(parseSender('<a@example.com>')).toEqual({ email: 'a@example.com' });
  });
});
