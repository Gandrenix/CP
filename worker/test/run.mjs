// Pruebas de integración del backend del Club contra un `wrangler dev --local`.
// Uso: node worker/test/run.mjs http://localhost:8790
// Empieza con una base vacía (ver worker/LEEME.md). Usa ventas FALSAS con la forma de /sales de Toteat.

const BASE = process.argv[2] || 'http://localhost:8790';
const ADMIN = { authorization: 'Bearer dev-admin-token' };
let pass = 0;
let failN = 0;

function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ok   ' + name); }
  else { failN += 1; console.log('  FALLA ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

let DEVICE = null;
async function api(path, body, headers) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(path.startsWith('/api/caja/') && DEVICE ? { 'x-device': DEVICE } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* no json */ }
  return { status: r.status, ...(j || {}) };
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const now = Date.now();
let pid = now;

function sale(o) {
  pid += 1;
  const payed = o.payed;
  return {
    orderId: pid + 7, paymentId: o.paymentId || pid, total: payed - (o.gratuity || 0), gratuity: o.gratuity || 0, payed,
    discounts: 0, fiscalType: o.fiscalType || 'BE',
    paymentForms: o.forms || [{ id: 2000, name: 'Redeban tarjetas', amount: payed }],
    products: o.products || [],
    dateOpen: iso(o.at || now - 600000), dateClosed: iso(o.at || now - 300000),
    client: o.phone ? { custom_id: 'x', firstName: o.name || 'Cliente', lastName: '', email: '', phones: [o.phone] } : {}
  };
}
const prod = (name, payed, qty, id) => ({ id: id || 'P1', name, payed, quantity: qty || 1, netPrice: payed, discounts: 0, hierarchyName: 'X' });

console.log('\n== Preparación');
let r = await api('/api/admin/health', undefined, ADMIN);
check('health responde con token de admin', r.ok === true, r);
r = await api('/api/admin/health');
check('health sin token es 401', r.status === 401, r);
await api('/api/admin/staff', { name: 'Stefany', pin: '1234' }, ADMIN);
await api('/api/admin/staff', { name: 'Javier', pin: '4321' }, ADMIN);
r = await api('/api/admin/staff', { name: 'Otro', pin: '1234' }, ADMIN);
check('no deja repetir un PIN', r.ok === false && r.error === 'pin_en_uso', r);

console.log('\n== Dispositivos de caja');
r = await api('/api/admin/device-new', { name: 'Tablet de prueba' }, ADMIN);
check('crea un dispositivo de caja con enlace secreto', r.ok && /^[0-9a-f]{40}$/.test(r.token), { ok: r.ok });
DEVICE = r.token;
const DEV1 = r.token;
const post = (hd) => fetch(BASE + '/api/caja/login', { method: 'POST', headers: { 'content-type': 'application/json', ...hd }, body: JSON.stringify({ pin: '1234' }) });
check('un celular NO autorizado no puede ni intentar un PIN (403)', (await post({})).status === 403);
check('un dispositivo inventado tampoco (403)', (await post({ 'x-device': 'a'.repeat(40) })).status === 403);
r = await api('/api/admin/devices', {}, ADMIN);
check('la lista de dispositivos no muestra el enlace', r.ok && r.items.length === 1 && !JSON.stringify(r).includes(DEV1), r);

console.log('\n== Ventas de Toteat -> puntos');
const tx1 = sale({ phone: '3001112233', name: 'Camila Rojas', payed: 77000, gratuity: 7000, products: [prod('Combo Burger sencilla', 35900)] });
const tx2 = sale({ phone: '3001112233', payed: 20000, products: [prod('Burger sencilla', 20000)] });
const nc2 = sale({ phone: '3001112233', payed: -20000, fiscalType: 'NC' });
const tx4 = sale({ payed: 40000 });
const tx6 = sale({ phone: '+57 313 4224529', name: 'Héctor Hernández Parra', payed: 67000, products: [prod('Combo para dos', 67000)] });
const tx7 = sale({ phone: '3009998877', name: 'Nicolás', payed: 500000, products: [prod('Combo Burger Doble', 44000)] });
const tx9 = sale({ phone: '3005556677', name: 'Valentina', payed: 49000, products: [prod('Burger sencilla', 42000), prod('Costo Delivery $7.000', 7000, 1, 'TOTEATDVYCOST')] });
const tx10 = sale({ phone: '3008887766', name: 'Gustavo', payed: 30000, forms: [{ id: 4000, name: 'Convenio', amount: 30000 }], products: [prod('Burger sencilla', 30000)] });
// Forma REAL de Toteat: el celular viene en client.phone (texto), no en client.phones
const txReal = sale({ payed: 24900, products: [prod('Burger sencilla', 24900)] });
txReal.client = { firstName: 'Laura', lastName: '', email: '', phone: '315 123 4567', address: {} };
const old = sale({ phone: '3001112233', payed: 90000, at: now - 2 * 86400000 });
r = await api('/api/admin/ingest', { clubStart: now - 3600000, sales: [tx1, tx2, nc2, tx4, tx6, tx7, tx9, tx10, txReal, old] }, ADMIN);
check('procesa 8 pagos y salta el viejo', r.ok && r.processed === 8 && r.old === 1 && r.noClient === 1, r);
r = await api('/api/admin/ingest', { sales: [tx1, tx2, tx6] }, ADMIN);
check('es idempotente: reenviar no suma de nuevo', r.ok && r.processed === 0, r);

const look = async (phone) => api('/api/club/lookup', { phone });
r = await look('300 111 2233');
check('Camila: 130 puntos (bienvenida 30 + 70 + combo 30 + 20 - 20)', r.ok && r.customer.points === 130 && r.customer.lifetime === 130, r.customer);
check('Camila: solo el primer nombre', r.customer && r.customer.firstName === 'Camila', r.customer && r.customer.firstName);
check('Camila: nivel 1 y siguiente nivel PARCHADO', r.customer.tier.id === 1 && r.customer.next.tier.id === 2 && r.customer.next.remaining === 270, r.customer.next);
r = await look('+573134224529');
check('Héctor (+57): 157 = 30 + 67 + combo para dos 60', r.ok && r.customer.points === 157, r.customer);
r = await look('3009998877');
check('pedido enorme: tope de 250 + bienvenida 30', r.ok && r.customer.points === 280, r.customer);
r = await look('3005556677');
check('domicilio: no suma el costo de envío (42 + 30)', r.ok && r.customer.points === 72, r.customer);
r = await look('3008887766');
check('pagado con convenio: solo la bienvenida', r.ok && r.customer.points === 30, r.customer);
r = await look('3151234567');
check('celular en client.phone (forma real de Toteat): 24 + 30 de bienvenida', r.ok && r.customer.points === 54 && r.customer.firstName === 'Laura', r.customer);
r = await look('3000000000');
check('celular que no está en el Club', r.ok === false && r.error === 'not_found', r);
r = await look('123');
check('celular inválido = no encontrado', r.ok === false, r);

console.log('\n== Canje: cliente -> caja');
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'combo' });
check('sin puntos suficientes no reserva', r.ok === false && r.error === 'no_points', r);
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'galleta_bebida' });
check('reserva galleta o bebida (100)', r.ok && /^CP-[A-Z2-9]{4}$/.test(r.code), r);
const code = r.code;
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'adicion' });
check('no deja tener dos canjes activos', r.ok === false && r.error === 'active_code', r);
r = await look('3001112233');
check('lo reservado baja el disponible (130 -> 30) pero no el saldo', r.customer.available === 30 && r.customer.points === 130 && r.customer.activeCode.code === code, r.customer);
r = await api('/api/club/code-status', { code });
check('el código está activo', r.status === 'active', r);

r = await api('/api/caja/login', { pin: '9999' });
check('PIN incorrecto', r.ok === false, r);
r = await api('/api/caja/lookup', { code }, {});
check('caja sin sesión es 401', r.status === 401, r);
r = await api('/api/caja/login', { pin: '1234' });
check('login: la sesión queda a nombre de la caja, no de una persona', r.ok && r.name === 'Tablet de prueba' && r.token, r);
const H = { authorization: 'Bearer ' + r.token };
{
  const d2 = await api('/api/admin/device-new', { name: 'Otro dispositivo' }, ADMIN);
  const rob = await fetch(BASE + '/api/caja/lookup', { method: 'POST', headers: { 'content-type': 'application/json', ...H, 'x-device': d2.token }, body: JSON.stringify({ code: code }) });
  check('una sesión robada no sirve en otro dispositivo (401)', rob.status === 401);
  await api('/api/admin/device-off', { name: 'Otro dispositivo' }, ADMIN);
  const apag = await fetch(BASE + '/api/caja/lookup', { method: 'POST', headers: { 'content-type': 'application/json', ...H, 'x-device': d2.token }, body: JSON.stringify({ code: code }) });
  check('un dispositivo desactivado queda sin acceso (403)', apag.status === 403);
}
r = await api('/api/caja/lookup', { code: code.toLowerCase() }, H);
check('caja ve premio, nombre y últimos 4 dígitos', r.ok && r.status === 'active' && r.firstName === 'Camila' && r.last4 === '2233' && r.reward.id === 'galleta_bebida', r);
r = await api('/api/caja/deliver', { code }, H);
check('entrega el premio', r.ok && r.reward.id === 'galleta_bebida', r);
r = await api('/api/caja/deliver', { code }, H);
check('no se entrega dos veces', r.ok === false && r.error === 'used', r);
r = await look('3001112233');
check('puntos descontados: 130 - 100 = 30 (lifetime sigue en 130)', r.customer.points === 30 && r.customer.lifetime === 130 && !r.customer.activeCode, r.customer);
r = await api('/api/club/code-status', { code });
check('el cliente ve el código como usado', r.status === 'used', r);
r = await api('/api/caja/log', {}, H);
check('el listado del día trae la entrega', r.ok && r.items.length === 1 && r.items[0].by === 'Tablet de prueba' && r.items[0].firstName === 'Camila', r);

console.log('\n== Cancelar y casos raros');
r = await api('/api/admin/adjust', { phone: '3001112233', points: 100, note: 'prueba de ajuste manual' }, ADMIN);
check('ajuste manual de +100 puntos', r.ok === true, r);
r = await look('3001112233');
check('el ajuste suma al saldo (30 + 100 = 130)', r.customer.points === 130, r.customer);
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'adicion' });
const code2 = r.code;
r = await api('/api/club/cancel', { phone: '3009998877', code: code2 });
check('otro celular no puede cancelar mi código', (await api('/api/club/code-status', { code: code2 })).status === 'active');
await api('/api/club/cancel', { phone: '3001112233', code: code2 });
check('cancelar libera el código', (await api('/api/club/code-status', { code: code2 })).status === 'cancelled');
r = await api('/api/caja/deliver', { code: code2 }, H);
check('un código cancelado no se entrega', r.ok === false && r.error === 'cancelled', r);
r = await api('/api/caja/lookup', { code: 'CP-ZZZZ' }, H);
check('código que no existe', r.ok === false && r.error === 'unknown', r);
r = await api('/api/club/birthday', { phone: '3001112233', mmdd: '03-14' });
check('guarda el cumpleaños', r.ok === true, r);
r = await api('/api/club/birthday', { phone: '3001112233', mmdd: '02-30' });
check('rechaza una fecha imposible', r.ok === false, r);
r = await look('3001112233');
check('el cumpleaños sale en la consulta', r.customer.birthday === '03-14', r.customer);

console.log('\n== Premio de cumpleaños');
const bd = (off) => { const t = new Date(Date.now() - 5 * 3600000 + off * 86400000); return String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0'); };
r = await api('/api/club/birthday', { phone: '3001112233', mmdd: '05-05' });
check('la fecha de cumpleaños no se puede cambiar una vez guardada', r.ok === false && r.error === 'locked', r);
r = await api('/api/club/birthday', { phone: '3001112233', mmdd: '03-14' });
check('guardar la misma fecha otra vez no falla', r.ok === true, r);
r = await api('/api/club/birthday', { phone: '3000000000', mmdd: '03-14' });
check('un celular que no existe no guarda nada', r.ok === false, r);
// La caja consulta con otro límite (120/min) que la web del cliente (20/min), así no se agota el límite de la web
const cust = async (phone) => (await api('/api/caja/customer', { phone }, H)).customer;
const bp = async (phone) => ({ state: (await cust(phone)).birthdayPrize });
check('cumple lejano: espera', (await bp('3001112233')).state === 'wait');
r = await api('/api/admin/birthday-set', { phone: '3134224529', mmdd: bd(3) }, ADMIN);
check('el admin corrige una fecha', r.ok === true, r);
check('límite: hoy + 3 días ya es la semana', (await bp('3134224529')).state === 'open');
await api('/api/admin/birthday-set', { phone: '3134224529', mmdd: bd(4) }, ADMIN);
check('límite: hoy + 4 días todavía no', (await bp('3134224529')).state === 'wait');
await api('/api/admin/birthday-set', { phone: '3134224529', mmdd: bd(-3) }, ADMIN);
check('límite: 3 días después todavía vale', (await bp('3134224529')).state === 'open');
await api('/api/admin/birthday-set', { phone: '3134224529', mmdd: bd(-4) }, ADMIN);
check('límite: 4 días después ya pasó', (await bp('3134224529')).state === 'wait');
r = await api('/api/club/reserve', { phone: '3134224529', rewardId: 'cumple' });
check('fuera de la semana no se puede reservar el regalo', r.ok === false && r.error === 'cumple_wait', r);

await api('/api/admin/birthday-set', { phone: '3008887766', mmdd: bd(0) }, ADMIN);
check('sin ninguna compra registrada no hay regalo (solo bienvenida)', (await bp('3008887766')).state === 'need_purchase');
r = await api('/api/club/reserve', { phone: '3008887766', rewardId: 'cumple' });
check('y tampoco deja reservarlo', r.ok === false && r.error === 'cumple_need_purchase', r);

r = await api('/api/club/birthday', { phone: '3005556677', mmdd: bd(0) });
check('Valentina guarda su cumple (es hoy)', r.ok === true, r);
check('registrado cuando ya empezó la semana: este año no aplica', (await bp('3005556677')).state === 'too_new');
r = await api('/api/club/reserve', { phone: '3005556677', rewardId: 'cumple' });
check('y no deja reservarlo', r.ok === false && r.error === 'cumple_too_new', r);

await api('/api/admin/birthday-set', { phone: '3001112233', mmdd: bd(0) }, ADMIN);
check('Camila está de cumple y ya compró: regalo abierto', (await bp('3001112233')).state === 'open');
const before = await cust('3001112233');
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'cumple' });
check('reserva el regalo (cuesta 0)', r.ok && /^CP-/.test(r.code) && r.reward.cost === 0, r);
const bcode = r.code;
let after = (await cust('3001112233'));
check('reservar el regalo no mueve los puntos', after.points === before.points && after.available === before.available, after);
r = await api('/api/caja/lookup', { code: bcode }, H);
check('la caja ve el regalo de cumpleaños', r.ok && r.reward.id === 'cumple' && r.firstName === 'Camila', r);
r = await api('/api/caja/customer', { phone: '3001112233' }, H);
check('la caja ve que está de cumpleaños', r.ok && r.customer.birthdayPrize === 'open', r);
r = await api('/api/caja/deliver', { code: bcode }, H);
check('entrega el regalo', r.ok && r.reward.id === 'cumple', r);
after = (await cust('3001112233'));
check('entregar el regalo no descuenta puntos', after.points === before.points, after);
check('después de entregarlo queda como reclamado', after.birthdayPrize === 'used', after.birthdayPrize);
r = await api('/api/club/reserve', { phone: '3001112233', rewardId: 'cumple' });
check('no se puede pedir otro regalo el mismo año', r.ok === false && r.error === 'cumple_used', r);
r = await api('/api/caja/deliver', { code: bcode }, H);
check('el mismo código no se entrega dos veces', r.ok === false && r.error === 'used', r);

console.log('\n== Sincronización con Toteat');
r = await api('/api/admin/sync', {}, ADMIN);
check('sin credenciales avisa y no rompe', r.ok === false, r);

console.log('\n== Límite de intentos');
let limited = false;
for (let i = 0; i < 30; i += 1) {
  const x = await look('3000000001');
  if (x.status === 429) { limited = true; break; }
}
check('muchas consultas seguidas -> 429', limited);

r = await api('/api/admin/purge', {}, ADMIN);
check('la limpieza de clientes inactivos no borra a nadie reciente', r.ok && r.borrados === 0, r);
r = await api('/api/caja/log', {}, H);
check('el listado de caja trae el estado de la lectura de Toteat', r.ok && 'sync' in r, r);

console.log('\n== PIN de la casa');
r = await api('/api/admin/pin-set', { pin: '7788' }, ADMIN);
check('el admin cambia el PIN de todas las cajas en un paso', r.ok === true, r);
r = await api('/api/caja/login', { pin: '1234' });
check('el PIN anterior ya no entra', r.ok === false, r);
r = await api('/api/caja/login', { pin: '4321' });
check('ningún PIN viejo de otra persona entra', r.ok === false, r);
r = await api('/api/caja/login', { pin: '7788' });
check('el PIN nuevo entra y queda a nombre de la caja', r.ok === true && r.name === 'Tablet de prueba', r);
r = await api('/api/admin/pin-set', { pin: '12' }, ADMIN);
check('rechaza un PIN que no es de 4 dígitos', r.ok === false, r);

console.log('\n== Salud');
r = await api('/api/admin/health', undefined, ADMIN);
check('6 clientes en la base', r.ok && r.customers === 6, r);

console.log('\n' + pass + ' pruebas ok, ' + failN + ' con falla');
process.exit(failN ? 1 : 0);
