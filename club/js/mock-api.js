// CP Club - API de PRUEBA. Guarda todo en localStorage para poder probar el
// flujo completo (cliente + caja) sin backend. Cuando exista el Worker se
// reemplaza este archivo por uno con la misma forma (CPClub.api) que llame a
// /api/club/*. Nada de aquí es seguro: PINs y datos son de ejemplo.

window.CPClub = window.CPClub || {};

(function (CP) {
  'use strict';

  const R = CP.rules;
  const KEY = 'cpclub-mock-v1';
  const DAY = 86400000;
  const STAFF = { '1234': 'Stefany', '4321': 'Javier' };   // PINs de ejemplo
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lag = () => sleep(120 + Math.random() * 180);

  function seed() {
    const now = Date.now();
    return {
      customers: {
        '3001112233': { firstName: 'Camila', points: 120, lifetime: 340, expiresAt: now + 12 * DAY, birthday: null },
        '3002223344': { firstName: 'Andrés', points: 520, lifetime: 1380, expiresAt: now + 60 * DAY, birthday: '03-14' },
        '3003334455': { firstName: 'Valentina', points: 880, lifetime: 2700, expiresAt: now + 75 * DAY, birthday: null },
        '3004445566': { firstName: 'Nicolás', points: 0, lifetime: 0, expiresAt: null, birthday: null }
      },
      codes: {},
      log: []
    };
  }

  let db = null;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.customers) db = seed();
    sweep();
    return db;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento: la demo sigue en memoria */ }
  }

  // Vence códigos y puntos. (Simplificación de la demo: los puntos vencen en
  // bloque; el backend real los vence por lote de compra.)
  function sweep() {
    const now = Date.now();
    Object.values(db.codes).forEach((c) => {
      if (c.status === 'active' && now > c.expiresAt) c.status = 'expired';
    });
    Object.values(db.customers).forEach((c) => {
      if (c.expiresAt && now > c.expiresAt && c.points > 0) c.points = 0;
    });
  }

  function reserved(phone) {
    return Object.values(db.codes)
      .filter((c) => c.phone === phone && c.status === 'active')
      .reduce((s, c) => s + c.cost, 0);
  }
  function activeCode(phone) {
    return Object.values(db.codes).find((c) => c.phone === phone && c.status === 'active') || null;
  }

  function newCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0/O/1/I
    let code;
    do {
      code = 'CP-' + Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
    } while (db.codes[code]);
    return code;
  }

  // Regalo de cumpleaños (demo): mismas reglas que el servidor
  function bprize(phone, c) {
    const w = c.birthday ? R.birthdayWindow(c.birthday, Date.now()) : null;
    if (!w) return { state: 'none' };
    const base = { from: w.from, until: w.until };
    if (!w.active) return Object.assign({ state: 'wait' }, base);
    if ((db.bdayUsed || {})[phone + ':' + w.year]) return Object.assign({ state: 'used' }, base);
    if (c.birthdaySetAt && c.birthdaySetAt > w.from) return Object.assign({ state: 'too_new' }, base);
    if (!c.lifetime) return Object.assign({ state: 'need_purchase' }, base);
    return Object.assign({ state: 'open' }, base);
  }

  function view(phone) {
    const c = db.customers[phone];
    const res = reserved(phone);
    const available = Math.max(0, c.points - res);
    const tier = R.tierFor(c.lifetime);
    const next = R.nextTier(c.lifetime);
    const ac = activeCode(phone);
    const expiresInDays = c.expiresAt && c.points > 0 ? Math.max(0, Math.ceil((c.expiresAt - Date.now()) / DAY)) : null;
    return {
      phone,
      firstName: c.firstName,
      points: c.points,
      reserved: res,
      available,
      lifetime: c.lifetime,
      tier,
      next: next ? { tier: next, remaining: next.min - c.lifetime } : null,
      expiresInDays,
      birthday: c.birthday,
      birthdayPrize: bprize(phone, c),
      activeCode: ac ? { code: ac.code, expiresAt: ac.expiresAt, rewardId: ac.rewardId } : null,
      rewards: R.rewards.map((r) => Object.assign({}, r, {
        affordable: available >= r.cost,
        missing: Math.max(0, r.cost - available)
      }))
    };
  }

  const api = {
    mode: 'mock',

    async lookup(phone) {
      await lag();
      load();
      if (!db.customers[phone]) return { ok: false, error: 'not_found' };
      return { ok: true, customer: view(phone) };
    },

    async reserve(phone, rewardId) {
      await lag();
      load();
      const c = db.customers[phone];
      const r = R.rewardById(rewardId);
      if (!c || !r) return { ok: false, error: 'invalid' };
      if (activeCode(phone)) return { ok: false, error: 'active_code' };
      if (c.points - reserved(phone) < r.cost) return { ok: false, error: 'no_points' };
      if (r.id === 'cumple' && bprize(phone, c).state !== 'open') return { ok: false, error: 'cumple_' + bprize(phone, c).state };
      const now = Date.now();
      const code = newCode();
      db.codes[code] = { code, phone, rewardId, cost: r.cost, createdAt: now, expiresAt: now + R.codeTtlMs, status: 'active' };
      save();
      return { ok: true, code, expiresAt: now + R.codeTtlMs, reward: r };
    },

    async cancel(code) {
      await lag();
      load();
      const c = db.codes[code];
      if (c && c.status === 'active') { c.status = 'cancelled'; save(); }
      return { ok: true };
    },

    async codeStatus(code) {
      load();
      const c = db.codes[code];
      return { ok: !!c, status: c ? c.status : 'unknown' };
    },

    async setBirthday(phone, mmdd) {
      await lag();
      load();
      if (!db.customers[phone] || !/^\d{2}-\d{2}$/.test(mmdd)) return { ok: false };
      if (db.customers[phone].birthday && db.customers[phone].birthday !== mmdd) return { ok: false, error: 'locked' };
      db.customers[phone].birthday = mmdd;
      db.customers[phone].birthdaySetAt = Date.now();
      save();
      return { ok: true };
    },

    // ----- Caja -----
    async staffLogin(pin) {
      await lag();
      const name = STAFF[pin];
      return name ? { ok: true, name, token: btoa(pin + ':' + name) } : { ok: false };
    },

    _staffName(token) {
      try {
        const [pin, name] = atob(token).split(':');
        return STAFF[pin] === name ? name : null;
      } catch (e) { return null; }
    },

    async staffLookup(token, code) {
      await lag();
      load();
      if (!api._staffName(token)) return { ok: false, error: 'auth' };
      const c = db.codes[String(code || '').toUpperCase().trim()];
      if (!c) return { ok: false, error: 'unknown' };
      const cu = db.customers[c.phone];
      return {
        ok: true,
        code: c.code,
        status: c.status,
        firstName: cu ? cu.firstName : '',
        last4: c.phone.slice(-4),
        reward: R.rewardById(c.rewardId),
        expiresAt: c.expiresAt
      };
    },

    async staffDeliver(token, code) {
      await lag();
      load();
      const who = api._staffName(token);
      if (!who) return { ok: false, error: 'auth' };
      const c = db.codes[code];
      if (!c) return { ok: false, error: 'unknown' };
      if (c.status !== 'active') return { ok: false, error: c.status };
      const cu = db.customers[c.phone];
      if (!cu || cu.points < c.cost) return { ok: false, error: 'no_points' };
      if (c.rewardId === 'cumple') {
        const w = R.birthdayWindow(cu.birthday, c.createdAt);
        db.bdayUsed = db.bdayUsed || {};
        if (!w || db.bdayUsed[c.phone + ':' + w.year]) return { ok: false, error: 'cumple_used' };
        db.bdayUsed[c.phone + ':' + w.year] = true;
      }
      cu.points -= c.cost;
      c.status = 'used';
      c.usedBy = who;
      c.usedAt = Date.now();
      db.log.unshift({ code, rewardId: c.rewardId, firstName: cu.firstName, last4: c.phone.slice(-4), by: who, at: c.usedAt });
      db.log = db.log.slice(0, 50);
      save();
      return { ok: true, reward: R.rewardById(c.rewardId), firstName: cu.firstName };
    },

    async staffCustomer(token, phone) {
      await lag();
      load();
      if (!api._staffName(token)) return { ok: false, error: 'auth' };
      if (!db.customers[phone]) return { ok: false, error: 'not_found' };
      const v = view(phone);
      return {
        ok: true,
        customer: {
          firstName: v.firstName, points: v.points, available: v.available, tier: v.tier, next: v.next, expiresInDays: v.expiresInDays,
          activeCode: v.activeCode ? { rewardId: v.activeCode.rewardId } : null,
          rewards: v.rewards.map((r) => ({ id: r.id, name: r.name, cost: r.cost, affordable: r.affordable })), lastPurchaseAt: null
        }
      };
    },

    async staffLog(token) {
      load();
      if (!api._staffName(token)) return { ok: false };
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      return { ok: true, items: db.log.filter((x) => x.at >= t0.getTime()) };
    },

    // ----- Solo demo: simula lo que luego hará la lectura de ventas de Toteat -----
    demo: {
      async simulateSale(phone, sale) {
        await lag();
        load();
        const c = db.customers[phone];
        if (!c) return { ok: false };
        const before = R.tierFor(c.lifetime);
        const earned = R.earnFor(sale);
        c.points += earned;
        c.lifetime += earned;
        c.expiresAt = Date.now() + R.earn.expireDays * DAY;
        save();
        return { ok: true, earned, tierBefore: before, tierAfter: R.tierFor(c.lifetime) };
      },
      // Suma puntos sin tope (para saltar de nivel en la demo)
      async grant(phone, pts) {
        await lag();
        load();
        const c = db.customers[phone];
        if (!c) return { ok: false };
        const before = R.tierFor(c.lifetime);
        c.points += pts;
        c.lifetime += pts;
        c.expiresAt = Date.now() + R.earn.expireDays * DAY;
        save();
        return { ok: true, earned: pts, tierBefore: before, tierAfter: R.tierFor(c.lifetime) };
      },
      async expireSoon(phone, days) {
        load();
        if (db.customers[phone]) { db.customers[phone].expiresAt = Date.now() + days * DAY; save(); }
        return { ok: true };
      },
      reset() {
        db = seed();
        save();
      }
    }
  };

  CP.mockApi = api;
})(window.CPClub);
