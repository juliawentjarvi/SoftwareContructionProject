import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPasswordResetSender } from '../src/mailer.js';

describe('password reset mailer', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('writes the message to the development outbox when SMTP is not configured', async () => {
    const outboxDir = await mkdtemp(join(tmpdir(), 'bear-outbox-'));
    dirs.push(outboxDir);
    await createPasswordResetSender({ mailFrom: 'x', production: false, outboxDir })('Bear@Example.test', 'TOKEN-123');
    const [file] = await readdir(outboxDir);
    const content = await readFile(join(outboxDir, file!), 'utf8');
    expect(content).toContain('To: Bear@Example.test');
    expect(content).toContain('TOKEN-123');
  });

  it('delivers nothing, and never prints the code, in production without SMTP', async () => {
    const outboxDir = await mkdtemp(join(tmpdir(), 'bear-outbox-'));
    dirs.push(outboxDir);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await createPasswordResetSender({ mailFrom: 'x', production: true, outboxDir })('a@example.test', 'TOKEN-456');
    expect(await readdir(outboxDir)).toEqual([]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('TOKEN-456');
  });
});
