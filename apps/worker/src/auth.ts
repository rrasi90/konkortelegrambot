/**
 * ابزارهای اعتبارسنجی — توکن نشست و دادهٔ initData تلگرام
 * فقط از Web Crypto استاندارد استفاده می‌کند (سازگار با Cloudflare Workers و Node 20).
 */

export async function hmacSha256Hex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return toHex(sig);
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** توکن نشست: `${userId}.${hmac(secret, userId)}` — قابل جعل نیست بدون کلید سرور */
export async function issueSessionToken(userId: string, secret: string): Promise<string> {
  return `${userId}.${await hmacSha256Hex(secret, userId)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const expected = await hmacSha256Hex(secret, userId);
  const provided = token.slice(idx + 1);
  if (provided.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0 ? userId : null;
}

/**
 * اعتبارسنجی امضای initData مینی‌اپ تلگرام.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): Promise<{ ok: true; userId: number; firstName?: string; username?: string } | { ok: false; error: string }> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'hash missing' };

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
  const secretSig = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(botToken));
  const computed = await hmacSha256Hex(secretSig, dataCheckString);

  if (computed !== hash) return { ok: false, error: 'signature mismatch' };

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) {
    return { ok: false, error: 'auth_date stale' };
  }

  let userId = 0;
  let firstName: string | undefined;
  let username: string | undefined;
  try {
    const rawUser = params.get('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { id?: number; first_name?: string; username?: string };
      userId = parsed.id ?? 0;
      firstName = parsed.first_name;
      username = parsed.username;
    }
  } catch {
    return { ok: false, error: 'invalid user payload' };
  }
  if (!userId) return { ok: false, error: 'user id missing' };
  return { ok: true, userId, firstName, username };
}
