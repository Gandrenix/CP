// CP Club - lectura de ventas de Toteat y conversión a puntos.
// Documentación: toteat-brain/02_endpoints/get_sales.md (GET /sales: pagos de
// órdenes cerradas por turno, máx. 15 días, 3 llamadas por minuto).
//
// SUPUESTOS A VERIFICAR CON DATOS REALES (primera llamada a /sales):
//  - `payed` incluye propina (en el ejemplo de la doc: total 11140 + propina 1114 = payed 12254),
//    por eso el monto que suma es payed - gratuity.
//  - Un turno abierto puede o no aparecer en /sales; como se consulta cada minuto con
//    ventana de 3 días, lo que no aparezca hoy se recoge cuando el turno cierre.
//  - Las notas de crédito (fiscalType "NC") llegan en negativo: restan puntos (sin bonus de combo).

import { RULES, earnFor } from './rules.js';
import { parsePhone, cleanName } from './phone.js';

const DAY = 86400000;
const BOGOTA = -5 * 3600000;   // Colombia no tiene horario de verano

function ymd(ms) {
  const d = new Date(ms + BOGOTA);
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
}

function parseUtc(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  return Number.isFinite(t) ? t : null;
}

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Qué parte de un pago suma puntos y cuántos combos trae.
export function describeSale(tx) {
  const payed = num(tx.payed != null ? tx.payed : tx.total);
  const tip = num(tx.gratuity);
  let amount = payed >= 0 ? payed - tip : payed;

  let delivery = 0;
  let combos = 0;
  let groupCombos = 0;
  (tx.products || []).forEach((p) => {
    const qty = Math.max(1, num(p.quantity));
    if (RULES.deliveryProductIds.includes(String(p.id))) delivery += num(p.payed);
    if (RULES.comboRe.test(p.name || '') && num(p.payed) > 0) {
      if (RULES.groupRe.test(p.name)) groupCombos += qty; else combos += qty;
    }
  });
  let excluded = 0;
  (tx.paymentForms || []).forEach((f) => {
    if (RULES.excludedPayIds.includes(Number(f.id)) || RULES.excludedPayRe.test(f.name || '')) excluded += num(f.amount);
  });
  // Un pago hecho por completo con convenio/cuenta corriente no suma nada (tampoco bonus de combo)
  if (payed > 0 && excluded >= payed - 0.5) return { amount: 0, combos: 0, groupCombos: 0 };
  amount = amount - (payed >= 0 ? delivery + excluded : 0);
  return { amount: Math.round(amount), combos, groupCombos };
}

// VERIFICADO con datos reales (2026-11-17): Toteat manda el celular en `client.phone` (texto),
// aunque su documentación habla de `client.phones` (lista). Se aceptan las dos formas.
export function phonesOf(c) {
  const out = [];
  const add = (v) => {
    if (Array.isArray(v)) v.forEach(add);
    else if (v != null && String(v).trim()) out.push(String(v));
  };
  c = c || {};
  add(c.phone);
  add(c.phones);
  add(c.phoneNumber);
  return out;
}

// Lee el celular del cliente de un pago y lo estandariza (ver phone.js). Devuelve siempre un objeto:
// { phone | null, reason, digits, varios, hasClient }. "reason" explica por qué no se pudo (para revisión humana).
export function clientPhoneInfo(tx) {
  const c = tx.client || {};
  const hasClient = Object.keys(c).some((k) => {
    const v = c[k];
    return Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object') ? Object.values(v).some(Boolean) : Boolean(String(v == null ? '' : v).trim());
  });
  const raws = phonesOf(c);
  if (!raws.length) return { phone: null, reason: 'sin_celular', digits: 0, varios: false, hasClient };
  let first = null;
  for (const raw of raws) {
    const r = parsePhone(raw);
    if (r.phone) return { phone: r.phone, reason: null, digits: 10, varios: !!r.varios || raws.length > 1, hasClient };
    if (!first) first = r;
  }
  return { phone: null, reason: first.reason, digits: first.digits, varios: false, hasClient };
}

function clientPhone(tx) {
  return clientPhoneInfo(tx).phone;
}

function firstName(tx) {
  return cleanName((tx.client || {}).firstName);
}

// Procesa una lista de pagos de /sales. Es idempotente: el mismo paymentId nunca suma dos veces.
export async function ingestSales(db, txs, now, opts) {
  opts = opts || {};
  const startRow = await db.prepare("SELECT v FROM kv WHERE k = 'club_start'").first();
  let clubStart = startRow ? Number(startRow.v) : null;
  if (clubStart === null) {
    clubStart = opts.clubStart != null ? opts.clubStart : now;   // la primera corrida marca el inicio: no hay puntos retroactivos
    await db.prepare("INSERT OR IGNORE INTO kv (k, v) VALUES ('club_start', ?)").bind(String(clubStart)).run();
  }

  const out = { seen: 0, processed: 0, noClient: 0, badPhone: 0, old: 0, skipped: 0, points: 0 };
  const sorted = [...txs].sort((a, b) => (parseUtc(a.dateClosed) || 0) - (parseUtc(b.dateClosed) || 0));

  for (const tx of sorted) {
    const pid = tx.paymentId != null ? String(tx.paymentId) : null;
    if (!pid) { out.skipped += 1; continue; }
    out.seen += 1;
    const already = await db.prepare('SELECT 1 FROM sales_seen WHERE payment_id = ?').bind(pid).first();
    if (already) continue;

    const closed = parseUtc(tx.dateClosed) || parseUtc(tx.dateOpen) || now;
    if (closed < clubStart) {
      out.old += 1;
      await db.prepare('INSERT OR IGNORE INTO sales_seen (payment_id, phone, amount, points, created_at) VALUES (?, NULL, 0, 0, ?)').bind(pid, now).run();
      continue;
    }

    const info = clientPhoneInfo(tx);
    const phone = info.phone;
    const sale = describeSale(tx);
    if (!phone) {
      // Sin celular utilizable: NO se marca como visto, así que se reintenta en cada lectura mientras el
      // pago siga dentro de la ventana de 3 días (si alguien corrige el cliente en Toteat, suma solo).
      if (info.hasClient) {
        out.badPhone += 1;
        await db.prepare(`INSERT INTO phone_issues (payment_id, order_id, first_name, reason, digits, closed_at, seen_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          ON CONFLICT(payment_id) DO UPDATE SET reason = excluded.reason, digits = excluded.digits, seen_at = excluded.seen_at`)
          .bind(pid, String(tx.orderId || ''), firstName(tx), info.reason || 'invalido', info.digits || 0, closed, now).run();
      } else {
        out.noClient += 1;
      }
      continue;
    }

    const negative = sale.amount < 0 || String(tx.fiscalType || '').toUpperCase() === 'NC';
    let pts = negative
      ? -earnFor({ amount: Math.abs(sale.amount) })
      : earnFor({ amount: sale.amount, combos: sale.combos, groupCombos: sale.groupCombos });
    const expiresAt = closed + RULES.earn.expireDays * DAY;   // vence a los 90 días de ESA compra (sirve también para historial)

    const existing = await db.prepare('SELECT welcome_given FROM customers WHERE phone = ?').bind(phone).first();
    const welcome = !existing || !existing.welcome_given ? RULES.earn.welcome : 0;
    const fn = firstName(tx);

    // Todo el pago se aplica en UNA transacción y solo si este proceso "reclamó" el pago: si otra lectura
    // simultánea ya lo reclamó, sus actualizaciones no se aplican (nunca se cuenta dos veces).
    const claim = crypto.randomUUID();
    const mine = '(SELECT 1 FROM sales_seen WHERE payment_id = ? AND claim = ?)';
    const stmts = [
      db.prepare('INSERT OR IGNORE INTO sales_seen (payment_id, phone, amount, points, created_at, claim) VALUES (?, ?, ?, ?, ?, ?)').bind(pid, phone, sale.amount, pts, now, claim),
      db.prepare('INSERT OR IGNORE INTO customers (phone, first_name, created_at) VALUES (?, ?, ?)').bind(phone, fn, now),
      db.prepare("UPDATE customers SET first_name = CASE WHEN first_name = '' THEN ? ELSE first_name END WHERE phone = ?").bind(fn, phone)
    ];
    if (welcome) {
      stmts.push(
        db.prepare("INSERT OR IGNORE INTO ledger (phone, kind, points, ref, note, created_at) VALUES (?, 'welcome', ?, ?, 'Bienvenida', ?)").bind(phone, welcome, phone, now),
        db.prepare('UPDATE customers SET points = points + ?, lifetime = lifetime + ?, welcome_given = 1 WHERE phone = ? AND welcome_given = 0 AND EXISTS ' + mine).bind(welcome, welcome, phone, pid, claim)
      );
    }
    if (pts !== 0) {
      stmts.push(
        db.prepare('INSERT OR IGNORE INTO ledger (phone, kind, points, ref, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(phone, pts > 0 ? 'earn' : 'reverse', pts, pid, 'Toteat ' + (tx.orderId || ''), now),
        db.prepare('UPDATE customers SET points = MAX(0, points + ?), lifetime = MAX(0, lifetime + ?), expires_at = CASE WHEN ? > 0 THEN MAX(COALESCE(expires_at, 0), ?) ELSE expires_at END WHERE phone = ? AND EXISTS ' + mine)
          .bind(pts, pts, pts, expiresAt, phone, pid, claim)
      );
    }
    stmts.push(db.prepare('DELETE FROM phone_issues WHERE payment_id = ?').bind(pid));
    await db.batch(stmts);
    const won = await db.prepare('SELECT claim FROM sales_seen WHERE payment_id = ?').bind(pid).first();
    if (!won || won.claim !== claim) continue;   // lo procesó otra lectura al mismo tiempo
    out.processed += 1;
    out.points += pts + welcome;
  }
  return out;
}

// Diagnóstico de las ventas reales: solo CONTEOS y formas, nunca nombres, celulares ni valores personales.
// Sirve para verificar los supuestos de arriba con datos reales sin guardar nada.
export async function diagnoseSales(env, now) {
  const base = (env.TOTEAT_BASE || 'https://api.toteat.com/mw/or/1.0').replace(/\/$/, '');
  const qs = new URLSearchParams({
    xir: env.TOTEAT_XIR, xil: env.TOTEAT_XIL, xiu: env.TOTEAT_XIU, xapitoken: env.TOTEAT_XAPITOKEN,
    ini: ymd(now - 2 * DAY), end: ymd(now)
  });
  const res = await fetch(base + '/sales?' + qs.toString());
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.data)) return { ok: false, status: res.status };
  const data = body.data;
  const count = (arr) => arr.reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {});
  const phoneShape = (p) => {
    const d = String(p).replace(/\D/g, '');
    const plus = String(p).trim().startsWith('+') ? '+' : '';
    return plus + d.length + 'd' + (d.length === 10 ? (d[0] === '3' ? '(3..)' : '(otro)') : '');
  };
  const closed = data.map((t) => parseUtc(t.dateClosed)).filter(Boolean);
  let tipIncluded = 0; let payedEqTotal = 0; let withTip = 0;
  data.forEach((t) => {
    const payed = num(t.payed); const total = num(t.total); const tip = num(t.gratuity);
    if (tip > 0) { withTip += 1; if (Math.abs(payed - (total + tip)) < 1) tipIncluded += 1; }
    if (Math.abs(payed - total) < 1) payedEqTotal += 1;
  });
  return {
    ok: true,
    pagos: data.length,
    ventana: { desde: closed.length ? new Date(Math.min(...closed) + BOGOTA).toISOString().slice(0, 16) : null, hasta: closed.length ? new Date(Math.max(...closed) + BOGOTA).toISOString().slice(0, 16) : null },
    sinFechaCierre: data.length - closed.length,
    conCliente: data.filter((t) => phonesOf(t.client).length).length,
    clienteSinTelefono: data.filter((t) => t.client && Object.keys(t.client).length && !phonesOf(t.client).length).length,
    telefonoValido: data.filter((t) => clientPhone(t)).length,
    formasDeTelefono: count(data.flatMap((t) => phonesOf(t.client)).map(phoneShape)),
    tipos: count(data.map((t) => t.fiscalType || 'sin_tipo')),
    conPropina: withTip,
    payedIncluyePropina: tipIncluded,
    payedIgualTotal: payedEqTotal,
    formasDePago: count(data.flatMap((t) => (t.paymentForms || []).map((f) => f.name || ('id' + f.id)))),
    combosDetectados: data.reduce((s, t) => s + ((t.products || []).filter((p) => RULES.comboRe.test(p.name || '') && num(p.payed) > 0).length), 0),
    productosDeDomicilio: data.reduce((s, t) => s + ((t.products || []).filter((p) => RULES.deliveryProductIds.includes(String(p.id))).length), 0),
    // Qué campos del cliente vienen con algo (solo cuántas veces, nunca el contenido)
    clienteCamposLlenos: data.reduce((m, t) => {
      const c = t.client || {};
      Object.keys(c).forEach((k) => {
        const v = c[k];
        const lleno = Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object') ? Object.values(v).some(Boolean) : Boolean(String(v == null ? '' : v).trim());
        if (lleno) m[k] = (m[k] || 0) + 1;
      });
      return m;
    }, {}),
    camposPago: Object.keys(data[0] || {}).sort()
  };
}

// Simulación: aplica las reglas del Club a las ventas REALES de los últimos días SIN guardar nada y
// devuelve solo agregados (sin celulares ni nombres). Demuestra que Toteat -> puntos funciona con datos reales.
export async function dryRunSales(env, now) {
  const base = (env.TOTEAT_BASE || 'https://api.toteat.com/mw/or/1.0').replace(/\/$/, '');
  const qs = new URLSearchParams({
    xir: env.TOTEAT_XIR, xil: env.TOTEAT_XIL, xiu: env.TOTEAT_XIU, xapitoken: env.TOTEAT_XAPITOKEN,
    ini: ymd(now - 2 * DAY), end: ymd(now)
  });
  const res = await fetch(base + '/sales?' + qs.toString());
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.data)) return { ok: false, status: res.status };
  const porCliente = new Map();
  let conCelular = 0; let sinCelular = 0; let conTope = 0; let combos = 0; let venta = 0;
  const cap = RULES.earn.orderCap;
  for (const tx of body.data) {
    const phone = clientPhone(tx);
    if (!phone) { sinCelular += 1; continue; }
    conCelular += 1;
    const sale = describeSale(tx);
    const negative = sale.amount < 0 || String(tx.fiscalType || '').toUpperCase() === 'NC';
    const raw = Math.floor(Math.abs(sale.amount) / RULES.earn.perPeso) + sale.combos * RULES.earn.comboBonus + sale.groupCombos * RULES.earn.groupBonus;
    if (raw > cap) conTope += 1;
    const pts = negative ? -earnFor({ amount: Math.abs(sale.amount) }) : earnFor({ amount: sale.amount, combos: sale.combos, groupCombos: sale.groupCombos });
    combos += sale.combos + sale.groupCombos;
    venta += sale.amount;
    porCliente.set(phone, (porCliente.get(phone) || 0) + pts);
  }
  const totales = [...porCliente.values()].map((p) => p + RULES.earn.welcome).sort((a, b) => b - a);
  const suma = totales.reduce((s, x) => s + x, 0);
  const tier = (p) => (p >= 2500 ? 4 : p >= 1200 ? 3 : p >= 400 ? 2 : 1);
  const alcanza = (min) => totales.filter((p) => p >= min).length;
  return {
    ok: true,
    nota: 'Simulación sobre ventas reales de los últimos 3 días. No se guardó nada.',
    pagosRevisados: body.data.length,
    pagosConCelular: conCelular,
    pagosSinCelular: sinCelular,
    porcentajeConCelular: Math.round(100 * conCelular / Math.max(1, body.data.length)),
    clientesDistintos: porCliente.size,
    ventaDeClientesIdentificados: Math.round(venta),
    combosQueSuman: combos,
    pagosQueLlegaronAlTopeDe250: conTope,
    puntosTotalesIncluyendoBienvenida: suma,
    puntosPorClienteMasAlto: totales[0] || 0,
    puntosPorClienteTipico: totales.length ? totales[Math.floor(totales.length / 2)] : 0,
    clientesQueYaPodriancanjear: { adicion50: alcanza(50), galletaBebida100: alcanza(100), burgerOpapas300: alcanza(300), comboSencilla450: alcanza(450), comboParaDos800: alcanza(800) },
    clientesPorNivel: totales.reduce((m, p) => { const t = tier(p); m[t] = (m[t] || 0) + 1; return m; }, {})
  };
}

// Carga de HISTORIAL por ventanas de hasta 15 días (límite de Toteat). Sin `apply` solo devuelve una vista previa
// anonimizada (celular convertido en una huella corta, nunca el número) para poder sumar entre ventanas.
export async function backfillWindow(env, p, now) {
  const base = (env.TOTEAT_BASE || 'https://api.toteat.com/mw/or/1.0').replace(/\/$/, '');
  const qs = new URLSearchParams({ xir: env.TOTEAT_XIR, xil: env.TOTEAT_XIL, xiu: env.TOTEAT_XIU, xapitoken: env.TOTEAT_XAPITOKEN, ini: String(p.ini), end: String(p.end) });
  const res = await fetch(base + '/sales?' + qs.toString());
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.data)) return { ok: false, status: res.status, msg: body && body.msg };
  if (p.apply) return { ok: true, pagos: body.data.length, ...(await ingestSales(env.DB, body.data, now)) };
  const enc = new TextEncoder();
  const huella = async (ph) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(env.SESSION_SECRET + ph)))].slice(0, 5).map((b) => b.toString(16).padStart(2, '0')).join('');
  const items = [];
  for (const tx of body.data) {
    const ph = clientPhone(tx);
    if (!ph) continue;
    const s = describeSale(tx);
    const negative = s.amount < 0 || String(tx.fiscalType || '').toUpperCase() === 'NC';
    const pts = negative ? -earnFor({ amount: Math.abs(s.amount) }) : earnFor({ amount: s.amount, combos: s.combos, groupCombos: s.groupCombos });
    items.push({ h: await huella(ph), pts, t: parseUtc(tx.dateClosed) || 0, id: String(tx.paymentId), v: Math.round(s.amount) });
  }
  return { ok: true, pagos: body.data.length, items };
}

// Pide las ventas de los últimos días a Toteat y las procesa. Se llama cada minuto (cron).
export async function syncFromToteat(env, now) {
  const need = ['TOTEAT_XIR', 'TOTEAT_XIL', 'TOTEAT_XIU', 'TOTEAT_XAPITOKEN'];
  const missing = need.filter((k) => !env[k]);
  const stamp = async (obj) => {
    await env.DB.prepare("INSERT INTO kv (k, v) VALUES ('last_sync', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(Object.assign({ at: now }, obj))).run();
  };
  if (missing.length) { await stamp({ ok: false, reason: 'faltan credenciales: ' + missing.join(', ') }); return { ok: false, reason: 'sin credenciales' }; }

  const base = (env.TOTEAT_BASE || 'https://api.toteat.com/mw/or/1.0').replace(/\/$/, '');
  const qs = new URLSearchParams({
    xir: env.TOTEAT_XIR, xil: env.TOTEAT_XIL, xiu: env.TOTEAT_XIU, xapitoken: env.TOTEAT_XAPITOKEN,
    ini: ymd(now - 2 * DAY), end: ymd(now)
  });
  let res;
  try {
    res = await fetch(base + '/sales?' + qs.toString(), { headers: { accept: 'application/json' } });
  } catch (e) { await stamp({ ok: false, reason: 'sin conexión con Toteat' }); return { ok: false }; }
  if (res.status === 429) { await stamp({ ok: false, reason: 'límite de Toteat (429)' }); return { ok: false }; }
  let body = null;
  try { body = await res.json(); } catch (e) { /* respuesta no JSON */ }
  if (!res.ok || !body || body.ok === false || !Array.isArray(body.data)) {
    await stamp({ ok: false, reason: 'respuesta inesperada de Toteat (' + res.status + ')' });
    return { ok: false };
  }
  const out = await ingestSales(env.DB, body.data, now);
  await stamp({ ok: true, ...out });
  return { ok: true, ...out };
}
