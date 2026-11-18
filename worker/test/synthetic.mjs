// BASE DE DATOS INVENTADA para comprobar todo el sistema (nada de esto toca Toteat real).
// Genera clientes y ventas con errores humanos, las manda al servidor con la misma forma que /sales de Toteat,
// y compara cada saldo contra una cuenta hecha aquí por construcción (independiente del código del servidor).
// Uso (contra un `wrangler dev --local` con la base vacía):  node worker/test/synthetic.mjs http://localhost:8790

const BASE = process.argv[2] || 'http://localhost:8790';
const ADMIN = { authorization: 'Bearer dev-admin-token' };
let pass = 0;
let bad = 0;
const check = (n, c, x) => { if (c) pass += 1; else { bad += 1; console.log('  FALLA ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 300) : '')); } };

// ---- generador pseudoaleatorio con semilla (siempre produce lo mismo)
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261117);
const pick = (a) => a[Math.floor(R() * a.length)];
const int = (a, b) => a + Math.floor(R() * (b - a + 1));
const chance = (p) => R() < p;

let ipN = 1;
let DEVICE = null;
async function api(path, body, extra) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': '10.1.' + Math.floor(ipN / 250) + '.' + (ipN++ % 250 + 1), ...(path.startsWith('/api/caja/') && DEVICE ? { 'x-device': DEVICE } : {}), ...(extra || {}) };
  const r = await fetch(BASE + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch (e) { /* sin json */ }
  return { status: r.status, ...j };
}

const now = Date.now();
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 19);

// ---- formas de escribir el MISMO celular (lo que hacen las personas)
const FORMATOS = [
  (p) => p,
  (p) => `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`,
  (p) => `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`,
  (p) => `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6)}`,
  (p) => `+57 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`,
  (p) => `+57${p}`,
  (p) => `57 ${p}`,
  (p) => `57${p}`,
  (p) => `(+57) ${p.slice(0, 3)}-${p.slice(3)}`,
  (p) => `0057 ${p}`,
  (p) => `${p[0]} ${p.slice(1, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8)}`,
  (p) => `cel ${p.slice(0, 3)} ${p.slice(3)}`,
  (p) => `${p} / 6045551234`,
  (p) => p.replace(/0/g, 'O'),
  (p) => ` ${p.slice(0, 3)}  ${p.slice(3)} `
];

const NOMBRES = [['jhon florez', 'Jhon'], ['HÉCTOR HERNÁNDEZ PARRA', 'Héctor'], ['maría josé', 'María'], ['Valentina', 'Valentina'], ['gustavo', 'Gustavo'],
  ['NICOLÁS GONZÁLEZ', 'Nicolás'], ['claudia quijano', 'Claudia'], ['Carlos', 'Carlos'], ['isabella brito', 'Isabella'], ['MANUEL', 'Manuel'],
  ['sofía', 'Sofía'], ['andrés', 'Andrés'], ['laura', 'Laura'], ['  camila  ', 'Camila'], ['danny miranda', 'Danny']];

const usados = new Set();
const nuevoCelular = () => { let p; do { p = '3' + int(0, 5) + String(int(0, 99999999)).padStart(8, '0'); } while (usados.has(p)); usados.add(p); return p; };

let pid = now;
let eventosEsperados = [];   // { phone, at, pts }  (lo que DEBE pasar, calculado por construcción)
const pagos = [];            // todo lo que llega de "Toteat"
const meta = { noClient: 0, issuesPermanentes: [], lateFix: [] };

// Construye un pago con la forma real de /sales. net = valor que debe sumar (sin propina ni domicilio).
function pago(o) {
  pid += 1;
  const products = [];
  for (let i = 0; i < (o.combos || 0); i += 1) products.push({ id: 'C' + i, name: 'Combo Burger sencilla', payed: 35900, quantity: 1 });
  for (let i = 0; i < (o.group || 0); i += 1) products.push({ id: 'G' + i, name: 'Combo para dos', payed: 67000, quantity: 1 });
  products.push({ id: 'B1', name: 'Burger Doble', payed: 34900, quantity: 1 });
  if (o.delivery) products.push({ id: 'TOTEATDVYCOST', name: 'Costo Delivery $7.000', payed: o.delivery, quantity: 1 });
  const nc = !!o.nc;
  const payed = nc ? -o.net : o.net + (o.tip || 0) + (o.delivery || 0);
  const forms = o.convenio ? [{ id: 4000, name: 'Convenio', amount: payed }] : [{ id: pick([2000, 3000, 1000]), name: pick(['Redeban tarjetas', 'CASH', 'Bold Qr']), amount: payed }];
  const tx = {
    paymentId: pid, orderId: pid + 7, payed, total: nc ? payed : o.net + (o.delivery || 0), gratuity: nc ? 0 : (o.tip || 0),
    fiscalType: nc ? 'NC' : 'BE', paymentForms: forms, products: nc ? [] : products,
    dateOpen: iso(o.at - 900000), dateClosed: iso(o.at),
    client: o.raw == null ? {} : (chance(0.2) ? { firstName: o.name, lastName: '', email: '', phones: [o.raw] } : { firstName: o.name, lastName: '', email: '', address: {}, phone: o.raw })
  };
  return tx;
}

// Puntos que debe dar un pago, calculados con la regla escrita a mano (no con el código del servidor)
const puntos = (net, combos, group, convenio, nc) => {
  if (convenio) return 0;
  if (nc) return -Math.min(250, Math.floor(net / 1000));
  return Math.min(250, Math.floor(net / 1000) + 30 * combos + 60 * group);
};

// ---------------------------------------------------------------- 1. clientes y visitas
const clientes = [];
for (let i = 0; i < 80; i += 1) {
  const [nombre, limpio] = pick(NOMBRES);
  clientes.push({ phone: nuevoCelular(), nombre, limpio, visitas: [], conNC: false, lateFix: false });
}
for (const c of clientes) {
  const n = int(1, 6);
  for (let v = 0; v < n; v += 1) {
    const big = chance(0.04);
    const net = big ? int(400, 600) * 1000 : int(18, 160) * 1000 + int(0, 9) * 100;
    const combos = chance(0.7) ? int(1, 3) : 0;
    const group = chance(0.12) ? 1 : 0;
    const convenio = chance(0.04);
    c.visitas.push({ at: now - int(0, 9) * DAY - int(0, 80000) * 1000, net, combos, group, convenio, tip: chance(0.4) ? Math.round(net * 0.1 / 100) * 100 : 0, delivery: chance(0.15) ? 7000 : 0 });
  }
  c.visitas.sort((a, b) => a.at - b.at);
}

// Notas de crédito: 4 clientes con una anulación de una de sus visitas (1 hora después de su última visita)
clientes.filter((c) => !c.visitas.some((v) => v.convenio)).slice(0, 4).forEach((c) => { c.conNC = true; });
// "Corrección tardía": 3 clientes cuyo celular llega mal escrito en un pago y luego lo corrigen en Toteat
clientes.filter((c) => !c.conNC).slice(10, 13).forEach((c) => { c.lateFix = true; });

for (const c of clientes) {
  c.visitas.forEach((v, idx) => {
    const raw = FORMATOS[(idx + int(0, 14)) % FORMATOS.length](c.phone);
    const dañar = c.lateFix && idx === 0;
    const tx = pago({ ...v, raw: dañar ? '305 123 45' : raw, name: c.nombre });
    pagos.push(tx);
    eventosEsperados.push({ phone: c.phone, at: v.at, pts: puntos(v.net, v.combos, v.group, v.convenio, false), tx, fix: dañar ? { ...v, raw, name: c.nombre } : null });
    if (dañar) meta.lateFix.push({ tx, fixed: { ...tx, client: { firstName: c.nombre, phone: raw } } });
  });
  if (c.conNC) {
    const v = c.visitas.find((x) => !x.convenio);
    const at = c.visitas[c.visitas.length - 1].at + 3600000;
    const tx = pago({ net: v.net, nc: true, at, raw: FORMATOS[3](c.phone), name: c.nombre });
    pagos.push(tx);
    eventosEsperados.push({ phone: c.phone, at, pts: puntos(v.net, 0, 0, false, true), tx });
  }
}

// Pagos SIN cliente (la mayoría de las ventas reales)
for (let i = 0; i < 110; i += 1) { pagos.push(pago({ net: int(15, 120) * 1000, combos: int(0, 2), at: now - int(0, 9) * DAY - int(0, 80000) * 1000, raw: null })); meta.noClient += 1; }
// Cliente asociado pero SIN celular
// (es lo que el equipo puede corregir en el CRM de Toteat: va a la lista de revisión con el motivo "sin_celular")
for (let i = 0; i < 6; i += 1) {
  const t = pago({ net: 30000, at: now - int(0, 9) * DAY, raw: '', name: 'sinCel' });
  t.client = { firstName: 'Sin Cel', lastName: '', email: '', address: {} };
  pagos.push(t);
  meta.issuesPermanentes.push({ id: String(t.paymentId), motivo: 'sin_celular', raw: '' });
}

// Celulares dañados que NO se pueden arreglar: deben ir a la lista de revisión, sin adivinar
const MALOS = [['305 123 456', 'corto'], ['604 555 1234', 'fijo'], ['3051234567890', 'largo'], ['2051234567', 'no_empieza_en_3'], ['abc', 'sin_digitos']];
MALOS.forEach(([raw, motivo], i) => {
  const t = pago({ net: 25000 + i * 1000, at: now - i * 3600000 - 7200000, raw, name: 'jhon florez' });
  pagos.push(t);
  meta.issuesPermanentes.push({ id: String(t.paymentId), motivo, raw });
});

// Errores de digitación: el cajero tecleó mal UN dígito; después se unen
const base = clientes[40];
const typo = base.phone.slice(0, 9) + String((Number(base.phone[9]) + 1) % 10);
usados.add(typo);
const typoVisitas = [{ at: now - 2 * DAY, net: 52000, combos: 1, group: 0 }, { at: now - 1 * DAY, net: 33000, combos: 0, group: 0 }];
typoVisitas.forEach((v) => { const tx = pago({ ...v, raw: typo, name: 'Typo Uno' }); pagos.push(tx); eventosEsperados.push({ phone: typo, at: v.at, pts: puntos(v.net, v.combos, v.group, false, false), tx }); });
const mal = nuevoCelular(); const bien = nuevoCelular();
const malV = { at: now - 3 * DAY, net: 71000, combos: 2, group: 0 };
{ const tx = pago({ ...malV, raw: mal, name: 'Rename Dos' }); pagos.push(tx); eventosEsperados.push({ phone: mal, at: malV.at, pts: puntos(malV.net, malV.combos, 0, false, false), tx }); }

// ---------------------------------------------------------------- 2. "la cuenta correcta" por construcción
function esperado(eventos) {
  const por = new Map();
  [...eventos].sort((a, b) => a.at - b.at).forEach((e) => {
    const x = por.get(e.phone) || { points: 0, lifetime: 0, welcome: false };
    if (!x.welcome) { x.welcome = true; x.points += 30; x.lifetime += 30; }
    x.points = Math.max(0, x.points + e.pts);
    x.lifetime = Math.max(0, x.lifetime + e.pts);
    por.set(e.phone, x);
  });
  return por;
}

// ---------------------------------------------------------------- 3. ejecutar
console.log('Pagos inventados:', pagos.length, '| clientes con celular válido:', new Set(eventosEsperados.map((e) => e.phone)).size);
let r = await api('/api/admin/staff', { name: 'Caja Sintética', pin: '2468' }, ADMIN);
check('crea un cajero de prueba', r.ok === true || r.error === 'pin_en_uso', r);
r = await api('/api/admin/device-new', { name: 'Tablet sintética' }, ADMIN);
DEVICE = r.token;

const ordenados = [...pagos].sort((a, b) => Date.parse(a.dateClosed + 'Z') - Date.parse(b.dateClosed + 'Z'));
const acum = { seen: 0, processed: 0, noClient: 0, badPhone: 0, old: 0 };
for (let i = 0; i < ordenados.length; i += 40) {
  r = await api('/api/admin/ingest', { clubStart: now - 15 * DAY, sales: ordenados.slice(i, i + 40) }, ADMIN);
  if (!r.ok) { check('ingest ok (bloque ' + i + ')', false, r); break; }
  Object.keys(acum).forEach((k) => { acum[k] += r[k] || 0; });
}
const validosIniciales = eventosEsperados.length - meta.lateFix.length;   // los 3 con celular dañado aún no cuentan
check('todos los pagos con celular válido se procesaron (' + validosIniciales + ')', acum.processed === validosIniciales, { acum, validosIniciales });
check('los pagos sin cliente o sin celular se cuentan aparte', acum.noClient === meta.noClient, { acum, esperado: meta.noClient });
check('los celulares dañados no se adivinan: van a revisión', acum.badPhone === meta.issuesPermanentes.length + meta.lateFix.length, { acum });
check('no se perdió ningún pago', acum.processed + acum.noClient + acum.badPhone === pagos.length, { acum, total: pagos.length });

// ---- corrección tardía: en Toteat corrigen el celular y el pago se procesa solo
r = await api('/api/admin/ingest', { sales: meta.lateFix.map((x) => x.fixed) }, ADMIN);
check('los 3 pagos corregidos en Toteat se procesan solos', r.ok && r.processed === 3, r);

// ---- idempotencia: mandar TODO otra vez no cambia nada
const antes = await api('/api/admin/customers', {}, ADMIN);
let reprocesados = 0;
for (let i = 0; i < ordenados.length; i += 60) {
  r = await api('/api/admin/ingest', { sales: ordenados.slice(i, i + 60).map((t) => meta.lateFix.find((x) => x.tx.paymentId === t.paymentId)?.fixed || t) }, ADMIN);
  reprocesados += r.processed || 0;
}
check('reenviar todo no suma nada otra vez', reprocesados === 0, { reprocesados });
const despues = await api('/api/admin/customers', {}, ADMIN);
const firma = (x) => JSON.stringify(x.items.map((c) => [c.phone, c.points, c.lifetime]).sort());
check('los saldos no cambian al reenviar', firma(antes) === firma(despues));

// ---- saldos contra la cuenta por construcción
let exp = esperado(eventosEsperados);
const bd = new Map(despues.items.map((c) => [c.phone, c]));
let errores = 0;
for (const [phone, e] of exp) {
  const c = bd.get(phone);
  if (!c || c.points !== e.points || c.lifetime !== e.lifetime) { errores += 1; if (errores <= 5) console.log('    difiere', phone.slice(-4), 'esperado', e.points, '/', e.lifetime, 'real', c && c.points, '/', c && c.lifetime); }
}
check('cada cliente tiene EXACTAMENTE los puntos esperados (' + exp.size + ' clientes)', errores === 0, { errores });
check('no hay clientes de más ni de menos', bd.size === exp.size, { bd: bd.size, exp: exp.size });
const sumaEsperada = [...exp.values()].reduce((s, x) => s + x.points, 0);
const sumaReal = despues.items.reduce((s, c) => s + c.points, 0);
check('el total de puntos coincide (' + sumaEsperada + ')', sumaReal === sumaEsperada, { sumaReal, sumaEsperada });
const nombresOk = clientes.filter((c) => bd.get(c.phone)).every((c) => bd.get(c.phone).first_name === c.limpio);
check('los nombres quedaron limpios (Jhon, Héctor, María...)', nombresOk);

// ---- lista de revisión
r = await api('/api/admin/phone-issues', {}, ADMIN);
const motivos = new Set((r.items || []).map((x) => x.reason));
check('la lista de revisión trae solo los ' + meta.issuesPermanentes.length + ' pagos sin arreglo', r.ok && r.items.length === meta.issuesPermanentes.length, { n: r.items && r.items.length });
check('con el motivo correcto de cada uno', [...MALOS.map(([, m]) => m), 'sin_celular'].every((m) => motivos.has(m)), [...motivos]);
const crudo = JSON.stringify(r);
check('la lista NO guarda números de celular', !MALOS.some(([raw]) => { const d = raw.replace(/\D/g, ''); return d.length >= 7 && crudo.includes(d); }));

// ---- dos lecturas AL MISMO TIEMPO no cuentan dos veces
const conc = [];
const cc = nuevoCelular();
for (let i = 0; i < 12; i += 1) conc.push(pago({ net: 20000 + i * 1000, combos: 1, at: now - 600000 + i * 1000, raw: FORMATOS[i % FORMATOS.length](cc), name: 'Paralelo' }));
const esperadoCC = 30 + conc.reduce((s, t, i) => s + (20 + i + 30), 0);
await Promise.all([api('/api/admin/ingest', { sales: conc }, ADMIN), api('/api/admin/ingest', { sales: conc }, ADMIN), api('/api/admin/ingest', { sales: conc }, ADMIN)]);
r = await api('/api/admin/customers', {}, ADMIN);
const pcc = r.items.find((c) => c.phone === cc);
check('3 lecturas simultáneas del mismo pago: se cuenta UNA vez (' + esperadoCC + ' pts)', pcc && pcc.points === esperadoCC, pcc);

// ---- canje con clientes inventados
const conPuntos = r.items.filter((c) => c.points >= 100).slice(0, 12);
r = await api('/api/caja/login', { pin: '2468' });
check('login del cajero sintético', r.ok && r.token, { ok: r.ok });
const H = { authorization: 'Bearer ' + r.token };
let canjesOk = 0;
for (const c of conPuntos) {
  const rs = await api('/api/club/reserve', { phone: c.phone, rewardId: 'galleta_bebida' });
  if (!rs.ok) continue;
  const lk = await api('/api/caja/lookup', { code: rs.code }, H);
  const dv = await api('/api/caja/deliver', { code: rs.code }, H);
  if (lk.ok && dv.ok) canjesOk += 1;
}
check('los 12 canjes se hacen de punta a punta', canjesOk === conPuntos.length, { canjesOk, de: conPuntos.length });
r = await api('/api/admin/customers', {}, ADMIN);
const finales = new Map(r.items.map((c) => [c.phone, c]));
check('cada canje restó exactamente 100 y no tocó los puntos históricos', conPuntos.every((c) => finales.get(c.phone).points === c.points - 100 && finales.get(c.phone).lifetime === c.lifetime));
const pobre = r.items.find((c) => c.points < 100 && c.points >= 0);
if (pobre) { const x = await api('/api/club/reserve', { phone: pobre.phone, rewardId: 'galleta_bebida' }); check('quien no alcanza no puede canjear', x.ok === false && x.error === 'no_points', x); }

// ---- unir celulares mal digitados
const t1 = finales.get(typo); const c1 = finales.get(base.phone);
r = await api('/api/admin/merge', { from: typo, to: base.phone }, ADMIN);
check('une el celular mal digitado con el correcto', r.ok === true, r);
r = await api('/api/admin/customers', {}, ADMIN);
const unido = r.items.find((c) => c.phone === base.phone);
check('los puntos del celular mal digitado se sumaron al correcto', unido && unido.points === c1.points + t1.points && unido.lifetime === c1.lifetime + t1.lifetime, { unido, esperado: c1.points + t1.points });
check('el celular mal digitado ya no existe', !r.items.some((c) => c.phone === typo));
const u1 = r.items.find((c) => c.phone === mal);
r = await api('/api/admin/merge', { from: mal, to: bien }, ADMIN);
r = await api('/api/admin/customers', {}, ADMIN);
const renombrado = r.items.find((c) => c.phone === bien);
check('si el correcto no existía, el cliente simplemente cambia de número', renombrado && renombrado.points === u1.points && !r.items.some((c) => c.phone === mal), renombrado);

// ---- ajuste manual
const aj = r.items[0];
r = await api('/api/admin/adjust', { phone: aj.phone, points: 25, note: 'regalo sintético' }, ADMIN);
check('ajuste manual +25', r.ok === true, r);
r = await api('/api/admin/adjust', { phone: aj.phone, points: 99999 }, ADMIN);
check('rechaza ajustes absurdos', r.ok === false, r);
r = await api('/api/admin/customers', {}, ADMIN);
check('el ajuste quedó en el saldo', r.items.find((c) => c.phone === aj.phone).points === aj.points + 25);

// ---- niveles desde los puntos históricos
const alto = r.items.reduce((m, c) => (c.lifetime > m.lifetime ? c : m), r.items[0]);
const lk = await api('/api/club/lookup', { phone: alto.phone });
const nivelEsperado = alto.lifetime >= 2500 ? 4 : alto.lifetime >= 1200 ? 3 : alto.lifetime >= 400 ? 2 : 1;
check('el nivel sale de los puntos históricos', lk.ok && lk.customer.tier.id === nivelEsperado, { lifetime: alto.lifetime, tier: lk.customer && lk.customer.tier });

const hs = await api('/api/admin/health', undefined, ADMIN);
console.log('\nResumen: clientes=' + hs.customers + ' puntos=' + hs.points + ' · ' + pass + ' comprobaciones ok, ' + bad + ' con falla');
process.exit(bad ? 1 : 0);
