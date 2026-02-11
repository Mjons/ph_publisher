const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function signToken(secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp)
  );
  return `${timestamp}.${toHex(signature)}`;
}

export async function verifyToken(token: string, secret: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  if (Date.now() - ts > SESSION_MAX_AGE_MS) return false;

  const key = await getKey(secret);
  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp)
  );

  return timingSafeEqual(providedSig, toHex(expectedSig));
}

export async function requireAdmin(): Promise<void> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const session = cookieStore.get('ph_admin_session');
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!session?.value || !secret) {
    throw new Error('Unauthorized');
  }

  const valid = await verifyToken(session.value, secret);
  if (!valid) {
    throw new Error('Unauthorized');
  }
}
