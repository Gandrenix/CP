// Prueba de humo contra un Worker DESPLEGADO (por ejemplo cp-club-test).
// Uso: ADMIN_TOKEN=... STAFF_PIN=1234 node worker/test/smoke-remote.mjs https://cp-club-test.andresgarcia2964.workers.dev
// Carga clientes FALSOS (celulares 300111xxxx/300222xxxx) y recorre ventas -> puntos -> canje -> caja.

const BASE = (process.argv[2] || '').replace(/\/$/, '');
const ADMIN = process.env.ADMIN_TOKEN;
const PIN = process.env.STAFF_PIN;
if (!BASE || !ADMIN || !PIN) { console.error('Faltan BASE, ADMIN_TOKEN o STAFF_PIN'); process.exit(2); }

let pass = 0;
let bad = 0;
const check = (n, c, x) => { if (c) { pass += 1; console.log('  ok   ' + n); } else { bad += 1; console.log('  FALLA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

let DEVICE = null;
async function api(path, body, headers) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(path.startsWith('/api/caja/') && DEVICE ? { 'x-device': DEVICE } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* sin json */ }
  return { status: r.status, ...j };
}
const A = { authorization: 'Bearer ' + ADMIN };
const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const now = Date.now();
let pid = now;
const sale = (phone, name, payed, products) => {
  pid += 1;
  return {
    paymentId: pid, orderId: pid + 1, payed, total: payed, gratuity: 0, fiscalType: 'BE',
    paymentForms: [{ id: 3000, name: 'Tarjeta Débito', amount: payed }], products: products || [],
    dateOpen: iso(now - 600000), dateClosed: iso(now - 300000),
    client: { firstName: name, lastName: '', email: '', phones: [phone] }
  };
};

console.log('== Servidor');
let r = await api('/api/admin/health', undefined, A);
check('health con token de admin', r.ok === true, r);
r = await api('/api/admin/health');
check('health sin token = 401', r.status === 401, r);

console.log('== Cajero de prueba');
r = await api('/api/admin/staff', { name: 'Caja Prueba', pin: PIN }, A);
check('cajero creado (o ya existía)', r.ok === true || r.error === 'pin_en_uso', r);
r = await api('/api/admin/device-new', { name: 'prueba de humo' }, A);
DEVICE = r.token;
check('dispositivo de caja creado', r.ok === true, { ok: r.ok });

console.log('== Clientes falsos (ventas simuladas)');
const combo = [{ id: 'C1', name: 'Combo Burger sencilla', payed: 35900, quantity: 1 }];
r = await api('/api/admin/ingest', { clubStart: now - 3600000, sales: [
  sale('3001112233', 'Camila', 120000, combo),
  sale('3002223344', 'Andrés', 250000, combo), sale('3002223344', 'Andrés', 250000, combo), sale('3002223344', 'Andrés', 250000, combo)
] }, A);
check('procesa 4 pagos', r.ok && (r.processed === 4 || r.processed === 0), r);
r = await api('/api/club/lookup', { phone: '3001112233' });
check('Camila existe y tiene puntos', r.ok && r.customer.points >= 100, r.customer && r.customer.points);

console.log('== Canje de punta a punta');
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'galleta_bebida' });
check('reserva un canje', r.ok && /^CP-/.test(r.code), r);
const code = r.code;
r = await api('/api/caja/login', { pin: PIN });
check('login de caja con el PIN', r.ok && r.token, { ok: r.ok });
const H = { authorization: 'Bearer ' + r.token };
r = await api('/api/caja/lookup', { code }, H);
check('caja ve el premio y el nombre', r.ok && r.firstName === 'Camila', r);
r = await api('/api/caja/deliver', { code }, H);
check('entrega', r.ok === true, r);
r = await api('/api/club/code-status', { code });
check('el cliente ve el código como usado', r.status === 'used', r);

console.log('\n' + pass + ' ok, ' + bad + ' con falla');
process.exit(bad ? 1 : 0);
