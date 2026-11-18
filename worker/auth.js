// CP Club - PIN de caja, sesiones firmadas y límite de intentos.

const enc = new TextEncoder();

function b64u(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function newSalt() {
  return b64u(crypto.getRandomValues(new Uint8Array(12)));
}

// El PIN solo tiene 10.000 combinaciones: lo que lo protege es el límite de
// intentos y la "pimienta" secreta del servidor, no el costo del hash.
export function pinHash(secret, salt, pin) {
  return hmac(secret, 'pin:' + salt + ':' + pin);
}

export async function signToken(secret, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + await hmac(secret, 'tok:' + body);
}

export async function verifyToken(secret, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  if (!safeEqual(sig, await hmac(secret, 'tok:' + body))) return null;
  try {
    const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

// Cuenta un intento en una ventana de tiempo. false = se pasó del máximo.
export async function allow(db, key, max, windowSec, now) {
  const w = Math.floor(now / 1000 / windowSec) * windowSec;   // inicio de la ventana, en segundos
  await db.prepare('INSERT INTO hits (k, w, n) VALUES (?, ?, 1) ON CONFLICT(k, w) DO UPDATE SET n = n + 1').bind(key, w).run();
  const row = await db.prepare('SELECT n FROM hits WHERE k = ? AND w = ?').bind(key, w).first();
  return !!row && row.n <= max;
}

export async function purgeHits(db, now) {
  await db.prepare('DELETE FROM hits WHERE w < ?').bind(Math.floor(now / 1000) - 2 * 86400).run();
}
