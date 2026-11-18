// CP Club - API del Club de Puntos (Cloudflare Worker + D1).
// Rutas /api/club/* (cliente), /api/caja/* (cajero con PIN) y /api/admin/* (solo con
// ADMIN_TOKEN). El resto del sitio lo sirven los assets estáticos.
//
// Secretos (wrangler secret put): ADMIN_TOKEN, SESSION_SECRET, TOTEAT_XIR, TOTEAT_XIL,
// TOTEAT_XIU, TOTEAT_XAPITOKEN. Variable opcional: TOTEAT_BASE.

import { RULES, tierFor, nextTier, rewardById, birthdayWindow, normalizePhone } from './rules.js';
import { signToken, verifyToken, pinHash, newSalt, safeEqual, allow, purgeHits } from './auth.js';
import { syncFromToteat, ingestSales, diagnoseSales, dryRunSales, backfillWindow } from './toteat.js';

const DAY = 86400000;
const BOGOTA = -5 * 3600000;
const SESSION_MS = 12 * 3600000;

const json = (data, status) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const fail = (error, status) => json({ ok: false, error }, status || 400);

function dayStartBogota(now) {
  return Math.floor((now + BOGOTA) / DAY) * DAY - BOGOTA;
}

function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0/O/1/I
  const b = crypto.getRandomValues(new Uint8Array(4));
  return 'CP-' + Array.from(b, (x) => A[x % A.length]).join('');
}

// ---------------------------------------------------------------- datos del cliente
async function sweep(db, now) {
  await db.batch([
    db.prepare("UPDATE codes SET status = 'expired' WHERE status = 'active' AND expires_at < ?").bind(now),
    db.prepare(`INSERT OR IGNORE INTO ledger (phone, kind, points, ref, note, created_at)
                SELECT phone, 'expire', -points, phone || ':' || expires_at, 'Vencieron', ? FROM customers WHERE points > 0 AND expires_at IS NOT NULL AND expires_at < ?`).bind(now, now),
    db.prepare('UPDATE customers SET points = 0 WHERE points > 0 AND expires_at IS NOT NULL AND expires_at < ?').bind(now)
  ]);
}

// Estado del premio de cumpleaños: none | wait | open | used | need_purchase | too_new
async function birthdayPrize(db, c, now) {
  const w = c.birthday ? birthdayWindow(c.birthday, now) : null;
  if (!w) return { state: 'none' };
  const base = { from: w.from, until: w.until };
  if (!w.active) return { state: 'wait', ...base };
  if (await db.prepare("SELECT 1 FROM ledger WHERE kind = 'birthday' AND ref = ?").bind(c.phone + ':' + w.year).first()) return { state: 'used', ...base };
  if (c.birthday_set_at && c.birthday_set_at > w.from) return { state: 'too_new', ...base };
  if (!await db.prepare("SELECT 1 FROM ledger WHERE phone = ? AND kind = 'earn' LIMIT 1").bind(c.phone).first()) return { state: 'need_purchase', ...base };
  return { state: 'open', ...base };
}

async function customerView(db, phone, now) {
  const c = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first();
  if (!c) return null;
  const res = await db.prepare("SELECT COALESCE(SUM(cost), 0) AS r FROM codes WHERE phone = ? AND status = 'active'").bind(phone).first();
  const ac = await db.prepare("SELECT code, expires_at, reward_id FROM codes WHERE phone = ? AND status = 'active'").bind(phone).first();
  const reserved = res ? res.r : 0;
  const available = Math.max(0, c.points - reserved);
  const next = nextTier(c.lifetime);
  return {
    phone,
    firstName: c.first_name || 'Parcero',
    points: c.points,
    reserved,
    available,
    lifetime: c.lifetime,
    tier: tierFor(c.lifetime),
    next: next ? { tier: next, remaining: next.min - c.lifetime } : null,
    expiresInDays: c.expires_at && c.points > 0 ? Math.max(0, Math.ceil((c.expires_at - now) / DAY)) : null,
    birthday: c.birthday,
    birthdayPrize: await birthdayPrize(db, c, now),
    activeCode: ac ? { code: ac.code, expiresAt: ac.expires_at, rewardId: ac.reward_id } : null,
    rewards: RULES.rewards.map((r) => ({ ...r, affordable: available >= r.cost, missing: Math.max(0, r.cost - available) }))
  };
}

// ---------------------------------------------------------------- rutas del cliente
async function clubRoute(path, body, env, ip, now) {
  const db = env.DB;
  await sweep(db, now);

  if (path === 'lookup') {
    if (!await allow(db, 'lookup:' + ip, 20, 60, now)) return fail('rate_limit', 429);
    const phone = normalizePhone(body.phone);
    if (!phone) return json({ ok: false, error: 'not_found' });
    const view = await customerView(db, phone, now);
    return view ? json({ ok: true, customer: view }) : json({ ok: false, error: 'not_found' });
  }

  if (path === 'reserve') {
    if (!await allow(db, 'reserve:' + ip, 10, 60, now)) return fail('rate_limit', 429);
    const phone = normalizePhone(body.phone);
    const reward = rewardById(body.rewardId);
    if (!phone || !reward) return fail('invalid');
    if (reward.id === RULES.birthday.reward.id) {          // regalo de cumpleaños: no gasta puntos, pero tiene condiciones
      const cu = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first();
      if (!cu) return fail('invalid');
      const bp = await birthdayPrize(db, cu, now);
      if (bp.state !== 'open') return fail('cumple_' + bp.state);
    }
    const code = newCode();
    const expiresAt = now + RULES.codeTtlMs;
    // Un solo INSERT condicionado: no hay dos canjes a la vez ni se reserva más de lo que hay.
    const r = await db.prepare(`INSERT INTO codes (code, phone, reward_id, cost, status, created_at, expires_at)
      SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?6
      WHERE EXISTS (SELECT 1 FROM customers WHERE phone = ?2)
        AND NOT EXISTS (SELECT 1 FROM codes WHERE phone = ?2 AND status = 'active')
        AND (SELECT points FROM customers WHERE phone = ?2) >= ?4`)
      .bind(code, phone, reward.id, reward.cost, now, expiresAt).run();
    if (!r.meta.changes) {
      const has = await db.prepare("SELECT 1 FROM codes WHERE phone = ? AND status = 'active'").bind(phone).first();
      return fail(has ? 'active_code' : 'no_points');
    }
    return json({ ok: true, code, expiresAt, reward });
  }

  if (path === 'cancel') {
    if (!await allow(db, 'cancel:' + ip, 20, 60, now)) return fail('rate_limit', 429);
    const phone = normalizePhone(body.phone);
    if (!phone || !body.code) return fail('invalid');
    await db.prepare("UPDATE codes SET status = 'cancelled' WHERE code = ? AND phone = ? AND status = 'active'").bind(String(body.code), phone).run();
    return json({ ok: true });
  }

  if (path === 'code-status') {
    if (!await allow(db, 'status:' + ip, 90, 60, now)) return fail('rate_limit', 429);
    const row = await db.prepare('SELECT status FROM codes WHERE code = ?').bind(String(body.code || '')).first();
    return json({ ok: !!row, status: row ? row.status : 'unknown' });
  }

  if (path === 'birthday') {
    if (!await allow(db, 'bday:' + ip, 10, 60, now)) return fail('rate_limit', 429);
    const phone = normalizePhone(body.phone);
    const m = /^(\d{2})-(\d{2})$/.exec(String(body.mmdd || ''));
    if (!phone || !m) return fail('invalid');
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
    if (!dim || dd < 1 || dd > dim) return fail('invalid');
    // Se guarda una sola vez (si no, bastaría cambiar la fecha cada vez que se quiera la burger).
    const r = await db.prepare('UPDATE customers SET birthday = ?, birthday_set_at = ? WHERE phone = ? AND birthday IS NULL').bind(m[0], now, phone).run();
    if (r.meta.changes > 0) return json({ ok: true });
    const cur = await db.prepare('SELECT birthday FROM customers WHERE phone = ?').bind(phone).first();
    if (cur && cur.birthday === m[0]) return json({ ok: true });
    return fail(cur ? 'locked' : 'not_found');
  }

  return fail('not_found', 404);
}

// ---------------------------------------------------------------- rutas de caja
// Dispositivo de caja autorizado (cabecera x-device). Sin esto ni siquiera se puede intentar un PIN.
async function deviceFromRequest(request, env, now) {
  const t = request.headers.get('x-device') || '';
  if (t.length < 20 || t.length > 80) return null;
  const hash = await pinHash(env.SESSION_SECRET, 'device', t);
  const row = await env.DB.prepare('SELECT id, name FROM devices WHERE token_hash = ? AND active = 1').bind(hash).first();
  if (row) await env.DB.prepare('UPDATE devices SET last_seen = ?1 WHERE id = ?2 AND (last_seen IS NULL OR last_seen < ?1 - 60000)').bind(now, row.id).run();
  return row || null;
}

async function staffFromRequest(request, env, now, deviceId) {
  const h = request.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const p = await verifyToken(env.SESSION_SECRET, tok);
  if (!p || p.did !== deviceId) return null;   // la sesión solo vale en el dispositivo donde se inició
  const row = await env.DB.prepare('SELECT id, name FROM staff WHERE id = ? AND active = 1').bind(p.sid).first();
  return row || null;
}

async function cajaRoute(path, body, request, env, ip, now) {
  const db = env.DB;
  await sweep(db, now);

  // Solo dispositivos autorizados llegan hasta aquí: un celular cualquiera no puede ni probar PINes.
  const dev = await deviceFromRequest(request, env, now);
  if (!dev) return fail('device', 403);

  if (path === 'login') {
    if (!await allow(db, 'login:' + ip, 12, 60, now) || !await allow(db, 'login:dev:' + dev.id, 20, 60, now)) return fail('rate_limit', 429);
    const pin = String(body.pin || '');
    if (!/^\d{4}$/.test(pin)) return json({ ok: false });
    const { results } = await db.prepare('SELECT id, name, salt, pin_hash FROM staff WHERE active = 1').all();
    for (const s of results) {
      if (safeEqual(await pinHash(env.SESSION_SECRET, s.salt, pin), s.pin_hash)) {
        const token = await signToken(env.SESSION_SECRET, { sid: s.id, name: dev.name, did: dev.id, exp: now + SESSION_MS });
        return json({ ok: true, name: dev.name, token });   // quien entrega queda registrado como la CAJA (dispositivo), no como una persona
      }
    }
    return json({ ok: false });
  }

  const staff = await staffFromRequest(request, env, now, dev.id);
  if (!staff) return fail('auth', 401);

  if (path === 'lookup') {
    const code = String(body.code || '').toUpperCase().trim();
    const c = await db.prepare('SELECT * FROM codes WHERE code = ?').bind(code).first();
    if (!c) return fail('unknown');
    const cu = await db.prepare('SELECT first_name FROM customers WHERE phone = ?').bind(c.phone).first();
    return json({
      ok: true, code: c.code, status: c.status,
      firstName: cu ? cu.first_name : '', last4: c.phone.slice(-4),
      reward: rewardById(c.reward_id), expiresAt: c.expires_at
    });
  }

  // El cajero consulta a un cliente por celular (cualquier forma de escribirlo): saldo, nivel y premios que le alcanzan.
  if (path === 'customer') {
    if (!await allow(db, 'cust:' + staff.id, 120, 60, now)) return fail('rate_limit', 429);
    const phone = normalizePhone(body.phone);
    if (!phone) return fail('invalid');
    const v = await customerView(db, phone, now);
    if (!v) return json({ ok: false, error: 'not_found' });
    const last = await db.prepare("SELECT MAX(created_at) AS t FROM ledger WHERE phone = ? AND kind = 'earn'").bind(phone).first();
    return json({
      ok: true,
      customer: {
        firstName: v.firstName, points: v.points, available: v.available, tier: v.tier, next: v.next, expiresInDays: v.expiresInDays,
        activeCode: v.activeCode ? { rewardId: v.activeCode.rewardId } : null,
        rewards: v.rewards.map((r) => ({ id: r.id, name: r.name, cost: r.cost, affordable: r.affordable })),
        birthdayPrize: v.birthdayPrize.state,
        lastPurchaseAt: last ? last.t : null
      }
    });
  }

  if (path === 'deliver') {
    const code = String(body.code || '').toUpperCase().trim();
    const c = await db.prepare('SELECT * FROM codes WHERE code = ?').bind(code).first();
    if (!c) return fail('unknown');
    if (c.status !== 'active') return fail(c.status);
    // Regalo de cumpleaños: una vez por año por cliente (la clave es celular:año del cumpleaños).
    let bref = '';
    if (c.reward_id === RULES.birthday.reward.id) {
      const cu0 = await db.prepare('SELECT birthday FROM customers WHERE phone = ?').bind(c.phone).first();
      const w = cu0 && cu0.birthday ? birthdayWindow(cu0.birthday, c.created_at) : null;
      if (!w) return fail('unknown');
      bref = c.phone + ':' + w.year;
      if (await db.prepare("SELECT 1 FROM ledger WHERE kind = 'birthday' AND ref = ?").bind(bref).first()) return fail('cumple_used');
    }
    // Reclama el código y descuenta los puntos en una sola transacción.
    await db.batch([
      db.prepare("UPDATE codes SET status = 'used', used_by = ?1, used_at = ?2 WHERE code = ?3 AND status = 'active' AND expires_at >= ?2 AND (reward_id <> 'cumple' OR NOT EXISTS (SELECT 1 FROM ledger WHERE kind = 'birthday' AND ref = ?4))").bind(dev.name, now, code, bref),
      db.prepare("UPDATE customers SET points = MAX(0, points - (SELECT cost FROM codes WHERE code = ?1)) WHERE phone = (SELECT phone FROM codes WHERE code = ?1 AND status = 'used' AND used_at = ?2)").bind(code, now),
      db.prepare(`INSERT OR IGNORE INTO ledger (phone, kind, points, ref, note, created_at)
                  SELECT phone, 'redeem', -cost, code, reward_id || ' · ' || used_by, ?2 FROM codes WHERE code = ?1 AND status = 'used' AND used_at = ?2 AND reward_id <> 'cumple'`).bind(code, now),
      db.prepare(`INSERT OR IGNORE INTO ledger (phone, kind, points, ref, note, created_at)
                  SELECT phone, 'birthday', 0, ?3, 'cumple · ' || used_by, ?2 FROM codes WHERE code = ?1 AND status = 'used' AND used_at = ?2 AND reward_id = 'cumple'`).bind(code, now, bref)
    ]);
    const after = await db.prepare('SELECT status, used_at FROM codes WHERE code = ?').bind(code).first();
    if (!after || after.status !== 'used' || after.used_at !== now) return fail(after && after.status === 'active' && bref ? 'cumple_used' : (after ? after.status : 'unknown'));
    const cu = await db.prepare('SELECT first_name FROM customers WHERE phone = ?').bind(c.phone).first();
    return json({ ok: true, reward: rewardById(c.reward_id), firstName: cu ? cu.first_name : '' });
  }

  if (path === 'log') {
    const { results } = await db.prepare("SELECT code, reward_id, phone, used_by, used_at FROM codes WHERE status = 'used' AND used_at >= ? ORDER BY used_at DESC LIMIT 100").bind(dayStartBogota(now)).all();
    const ls = await db.prepare("SELECT v FROM kv WHERE k = 'last_sync'").first();
    const sy = ls ? JSON.parse(ls.v) : null;
    const sync = sy ? { ok: !!sy.ok, minutes: Math.round((now - sy.at) / 60000) } : null;   // para avisar en caja si Toteat no está llegando
    const names = {};
    for (const r of results) {
      if (!(r.phone in names)) {
        const cu = await db.prepare('SELECT first_name FROM customers WHERE phone = ?').bind(r.phone).first();
        names[r.phone] = cu ? cu.first_name : '';
      }
    }
    return json({ ok: true, items: results.map((r) => ({ code: r.code, rewardId: r.reward_id, firstName: names[r.phone], last4: r.phone.slice(-4), by: r.used_by, at: r.used_at })), sync });
  }

  return fail('not_found', 404);
}

// ---------------------------------------------------------------- rutas de administración
async function adminRoute(path, body, request, env, now) {
  const h = request.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!env.ADMIN_TOKEN || !safeEqual(tok, env.ADMIN_TOKEN)) return fail('auth', 401);
  const db = env.DB;

  if (path === 'staff') {
    const name = String(body.name || '').trim();
    const pin = String(body.pin || '');
    if (!name || !/^\d{4}$/.test(pin)) return fail('invalid');
    const { results } = await db.prepare('SELECT salt, pin_hash FROM staff WHERE active = 1').all();
    for (const s of results) {
      if (safeEqual(await pinHash(env.SESSION_SECRET, s.salt, pin), s.pin_hash)) return fail('pin_en_uso');
    }
    const salt = newSalt();
    await db.prepare('INSERT INTO staff (name, salt, pin_hash) VALUES (?, ?, ?)').bind(name, salt, await pinHash(env.SESSION_SECRET, salt, pin)).run();
    return json({ ok: true });
  }

  // Dispositivos de caja: se crea un enlace secreto (se muestra UNA vez) y se abre en cada tablet/celular de caja.
  if (path === 'device-new') {
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return fail('invalid');
    const raw = crypto.getRandomValues(new Uint8Array(20));
    const token = Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('');
    await db.prepare('INSERT INTO devices (name, token_hash, created_at) VALUES (?, ?, ?)').bind(name, await pinHash(env.SESSION_SECRET, 'device', token), now).run();
    return json({ ok: true, name, token, path: '/club/caja/?activar=' + token });
  }
  if (path === 'device-off') {
    await db.prepare('UPDATE devices SET active = 0 WHERE name = ?').bind(String(body.name || '')).run();
    return json({ ok: true });
  }
  if (path === 'devices') {
    const { results } = await db.prepare('SELECT name, active, created_at, last_seen FROM devices ORDER BY id').all();
    return json({ ok: true, items: results });
  }

  // Borrado de clientes inactivos (retención): sin compras ni canjes desde hace `months` meses (mínimo 6)
  if (path === 'purge') {
    const months = Math.max(6, Math.trunc(Number(body.months) || RULES.retentionMonths));
    return json({ ok: true, ...(await purgeInactive(db, now, months)) });
  }

  // Corregir un cumpleaños que el cliente guardó mal (en la web solo se puede guardar una vez).
  if (path === 'birthday-set') {
    const phone = normalizePhone(body.phone);
    const m = /^(\d{2})-(\d{2})$/.exec(String(body.mmdd || ''));
    if (!phone || !m || !birthdayWindow(m[0], now)) return fail('invalid');
    const r = await db.prepare('UPDATE customers SET birthday = ?, birthday_set_at = NULL WHERE phone = ?').bind(m[0], phone).run();   // corrección del admin: no penaliza
    return json({ ok: r.meta.changes > 0 });
  }

  // PIN de la casa: reemplaza el PIN de todas las cajas por uno nuevo (si se filtra, se cambia en un paso).
  // Las personas no se registran: lo que protege es que solo las cajas autorizadas pueden usarlo.
  if (path === 'pin-set') {
    const pin = String(body.pin || '');
    if (!/^\d{4}$/.test(pin)) return fail('invalid');
    const salt = newSalt();
    await db.batch([
      db.prepare('UPDATE staff SET active = 0 WHERE active = 1'),
      db.prepare("INSERT INTO staff (name, salt, pin_hash) VALUES ('Equipo', ?, ?)").bind(salt, await pinHash(env.SESSION_SECRET, salt, pin))
    ]);
    return json({ ok: true });
  }

  if (path === 'staff-off') {
    await db.prepare('UPDATE staff SET active = 0 WHERE name = ?').bind(String(body.name || '')).run();
    return json({ ok: true });
  }

  if (path === 'ingest') {          // procesar pagos enviados a mano (pruebas o historial exportado)
    if (!Array.isArray(body.sales)) return fail('invalid');
    return json({ ok: true, ...(await ingestSales(db, body.sales, now, { clubStart: body.clubStart })) });
  }

  if (path === 'sync') return json(await syncFromToteat(env, now));

  if (path === 'diag-sales') return json(await diagnoseSales(env, now));

  if (path === 'dry-run') return json(await dryRunSales(env, now));

  // Historial: {ini, end, apply}. Sin apply = vista previa anonimizada; con apply = procesa de verdad.
  if (path === 'backfill') {
    if (!/^\d{8}$/.test(String(body.ini)) || !/^\d{8}$/.test(String(body.end))) return fail('invalid');
    return json(await backfillWindow(env, { ini: body.ini, end: body.end, apply: !!body.apply }, now));
  }

  // Mover el "inicio del Club" (y limpiar las marcas de "anterior al inicio") para cargar historial
  if (path === 'club-start') {
    const t = Number(body.at);
    if (!Number.isFinite(t) || t <= 0) return fail('invalid');
    await db.batch([
      db.prepare("INSERT INTO kv (k, v) VALUES ('club_start', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(t)),
      db.prepare('DELETE FROM sales_seen WHERE phone IS NULL AND claim IS NULL AND created_at > 0 AND points = 0 AND amount = 0')
    ]);
    return json({ ok: true });
  }

  // Lista de revisión: pagos con cliente cuyo celular no se pudo usar (sin el número, solo motivo y nombre)
  if (path === 'phone-issues') {
    const { results } = await db.prepare('SELECT payment_id, order_id, first_name, reason, digits, closed_at FROM phone_issues ORDER BY seen_at DESC LIMIT 200').all();
    return json({ ok: true, items: results });
  }

  if (path === 'customers') {
    const { results } = await db.prepare('SELECT phone, first_name, points, lifetime, expires_at, birthday, created_at FROM customers ORDER BY created_at DESC LIMIT 1000').all();
    return json({ ok: true, items: results });
  }

  // Un celular se tecleó mal en Toteat y los puntos cayeron en otro número: se unen en el correcto.
  if (path === 'merge') {
    const from = normalizePhone(body.from);
    const to = normalizePhone(body.to);
    if (!from || !to || from === to) return fail('invalid');
    const a = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(from).first();
    if (!a) return fail('not_found');
    const b = await db.prepare('SELECT 1 AS x FROM customers WHERE phone = ?').bind(to).first();
    const stmts = [db.prepare("UPDATE codes SET status = 'cancelled' WHERE phone = ? AND status = 'active'").bind(from)];
    if (!b) {
      stmts.push(db.prepare('UPDATE customers SET phone = ? WHERE phone = ?').bind(to, from));
    } else {
      stmts.push(
        db.prepare(`UPDATE customers SET points = points + ?1, lifetime = lifetime + ?2, welcome_given = MAX(welcome_given, ?3),
          expires_at = MAX(COALESCE(expires_at, 0), ?4), first_name = CASE WHEN first_name = '' THEN ?5 ELSE first_name END,
          birthday = COALESCE(birthday, ?6) WHERE phone = ?7`).bind(a.points, a.lifetime, a.welcome_given, a.expires_at || 0, a.first_name, a.birthday, to),
        db.prepare('DELETE FROM customers WHERE phone = ?').bind(from)
      );
    }
    stmts.push(
      db.prepare('UPDATE ledger SET phone = ? WHERE phone = ?').bind(to, from),
      db.prepare('UPDATE codes SET phone = ? WHERE phone = ?').bind(to, from),
      db.prepare('UPDATE sales_seen SET phone = ? WHERE phone = ?').bind(to, from),
      db.prepare("INSERT INTO ledger (phone, kind, points, ref, note, created_at) VALUES (?, 'adjust', 0, ?, ?, ?)").bind(to, 'merge:' + from + ':' + now, 'Unido desde el celular terminado en ' + from.slice(-4), now)
    );
    await db.batch(stmts);
    return json({ ok: true, movedPoints: a.points });
  }

  // Ajuste manual de puntos (corrección de un error humano). Queda en el libro con su nota.
  if (path === 'adjust') {
    const phone = normalizePhone(body.phone);
    const pts = Math.trunc(Number(body.points));
    if (!phone || !pts || Math.abs(pts) > 5000) return fail('invalid');
    const c = await db.prepare('SELECT 1 AS x FROM customers WHERE phone = ?').bind(phone).first();
    if (!c) return fail('not_found');
    const note = String(body.note || 'ajuste manual').slice(0, 80);
    await db.batch([
      db.prepare("INSERT INTO ledger (phone, kind, points, ref, note, created_at) VALUES (?, 'adjust', ?, ?, ?, ?)").bind(phone, pts, 'adj:' + now + ':' + Math.random().toString(36).slice(2, 8), note, now),
      db.prepare('UPDATE customers SET points = MAX(0, points + ?1), lifetime = MAX(0, lifetime + CASE WHEN ?1 > 0 THEN ?1 ELSE 0 END) WHERE phone = ?2').bind(pts, phone)
    ]);
    return json({ ok: true });
  }

  if (path === 'health') {
    const n = async (sql) => (await db.prepare(sql).first()).n;
    const last = await db.prepare("SELECT v FROM kv WHERE k = 'last_sync'").first();
    return json({
      ok: true,
      customers: await n('SELECT COUNT(*) AS n FROM customers'),
      points: await n('SELECT COALESCE(SUM(points),0) AS n FROM customers'),
      activeCodes: await n("SELECT COUNT(*) AS n FROM codes WHERE status = 'active'"),
      staff: await n('SELECT COUNT(*) AS n FROM staff WHERE active = 1'),
      // Diagnóstico: solo la LONGITUD de cada credencial, nunca su valor
      toteatEnv: Object.fromEntries(['TOTEAT_XIR', 'TOTEAT_XIL', 'TOTEAT_XIU', 'TOTEAT_XAPITOKEN'].map((k) => [k, env[k] == null ? null : String(env[k]).length])),
      lastSync: last ? JSON.parse(last.v) : null
    });
  }

  return fail('not_found', 404);
}

// Retención de datos: borra los clientes sin ninguna actividad desde hace `months` meses, con todo su rastro.
// (Lo promete el contrato de datos, Anexo A.) Los pagos de Toteat ya vistos se conservan sin celular para no reprocesarlos.
async function purgeInactive(db, now, months) {
  const cutoff = now - months * 30 * DAY;
  const viejos = `SELECT c.phone FROM customers c WHERE COALESCE((SELECT MAX(l.created_at) FROM ledger l WHERE l.phone = c.phone AND l.kind IN ('earn','redeem','reverse')), c.created_at) < ?1`;
  const n = await db.prepare(`SELECT COUNT(*) AS n FROM (${viejos})`).bind(cutoff).first();
  if (!n || !n.n) return { borrados: 0 };
  await db.batch([
    db.prepare(`DELETE FROM codes WHERE phone IN (${viejos})`).bind(cutoff),
    db.prepare(`DELETE FROM ledger WHERE phone IN (${viejos})`).bind(cutoff),
    db.prepare(`UPDATE sales_seen SET phone = NULL WHERE phone IN (${viejos})`).bind(cutoff),
    db.prepare(`DELETE FROM customers WHERE phone IN (${viejos})`).bind(cutoff),
    db.prepare("INSERT INTO kv (k, v) VALUES ('last_purge', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify({ at: now, borrados: n.n }))
  ]);
  return { borrados: n.n };
}

// ---------------------------------------------------------------- entrada
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = /^\/api\/(club|caja|admin)\/([a-z-]+)$/.exec(url.pathname);
    if (!m) {
      if (url.pathname.startsWith('/api/')) return fail('not_found', 404);
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }
    if (!env.DB) return fail('sin_base_de_datos', 500);
    if (request.method !== 'POST' && !(m[1] === 'admin' && request.method === 'GET')) return fail('method', 405);
    if (!env.SESSION_SECRET) return fail('sin_configurar', 500);

    const now = Date.now();
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    let body = {};
    if (request.method === 'POST') {
      try { body = await request.json(); } catch (e) { body = {}; }
      if (!body || typeof body !== 'object') body = {};
    }
    try {
      if (m[1] === 'club') return await clubRoute(m[2], body, env, ip, now);
      if (m[1] === 'caja') return await cajaRoute(m[2], body, request, env, ip, now);
      return await adminRoute(m[2], body, request, env, now);
    } catch (e) {
      console.error('error en /api/' + m[1] + '/' + m[2], e && e.stack || e);
      return fail('error_interno', 500);
    }
  },

  // Cada minuto: leer ventas nuevas de Toteat, y de vez en cuando limpiar intentos viejos.
  async scheduled(event, env, ctx) {
    const now = Date.now();
    ctx.waitUntil((async () => {
      await sweep(env.DB, now);
      await syncFromToteat(env, now);
      if (new Date(now).getUTCMinutes() === 0) await purgeHits(env.DB, now);
      if (new Date(now).getUTCHours() === 8 && new Date(now).getUTCMinutes() === 0) await purgeInactive(env.DB, now, RULES.retentionMonths);
    })());
  }
};
