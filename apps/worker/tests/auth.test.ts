import { describe, it, expect } from 'vitest';
import { issueSessionToken, verifySessionToken, verifyTelegramInitData } from '../src/auth';

const BOT_TOKEN = '123456:test-bot-token';

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(
  options: { user?: Record<string, unknown>; authDate?: number; botToken?: string } = {},
): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'AAH-test-query');
  params.set('auth_date', String(options.authDate ?? Math.floor(Date.now() / 1000)));
  if (options.user !== undefined) params.set('user', JSON.stringify(options.user));

  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretSig = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    new TextEncoder().encode(options.botToken ?? BOT_TOKEN),
  );
  params.set('hash', await hmacHex(secretSig, dataCheckString));
  return params.toString();
}

describe('auth — session token', () => {
  it('round-trips a token and rejects tampering or a different secret', async () => {
    const token = await issueSessionToken('user-1', 'session-secret');
    expect(await verifySessionToken(token, 'session-secret')).toBe('user-1');
    expect(await verifySessionToken(token, 'other-secret')).toBeNull();
    expect(await verifySessionToken(`${token}x`, 'session-secret')).toBeNull();
    expect(await verifySessionToken('no-dot', 'session-secret')).toBeNull();
  });
});

describe('auth — Telegram initData', () => {
  it('accepts a correctly signed payload', async () => {
    const initData = await buildInitData({
      user: { id: 424242, first_name: 'آزمون', username: 'tester' },
    });
    const result = await verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({
      ok: true,
      userId: 424242,
      firstName: 'آزمون',
      username: 'tester',
    });
  });

  it('rejects a tampered field even when a valid hash is present', async () => {
    const initData = await buildInitData({ user: { id: 424242, first_name: 'آزمون' } });
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ id: 424242, first_name: 'intruder' }));
    const result = await verifyTelegramInitData(params.toString(), BOT_TOKEN);
    expect(result).toEqual({ ok: false, error: 'signature mismatch' });
  });

  it('rejects a payload signed with a different bot token', async () => {
    const initData = await buildInitData({
      user: { id: 424242 },
      botToken: '999999:attacker-token',
    });
    const result = await verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, error: 'signature mismatch' });
  });

  it('rejects a stale auth_date beyond the 24h window', async () => {
    const initData = await buildInitData({
      user: { id: 424242 },
      authDate: Math.floor(Date.now() / 1000) - 90_000,
    });
    const result = await verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, error: 'auth_date stale' });
  });

  it('rejects a missing hash and a missing user id', async () => {
    expect(await verifyTelegramInitData('auth_date=1', BOT_TOKEN)).toEqual({
      ok: false,
      error: 'hash missing',
    });
    const unsignedUser = await buildInitData({});
    expect(await verifyTelegramInitData(unsignedUser, BOT_TOKEN)).toEqual({
      ok: false,
      error: 'user id missing',
    });
  });
});
