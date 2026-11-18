// CP Club - reglas del programa (fuente única en el front).
// Los números salen de club-de-puntos/01_reglas-premios-y-canje.md (aprobado
// 2026-11-17). Cuando exista el backend, el servidor tendrá su propia copia
// (en una tabla de configuración) y esta solo sirve para mostrar textos.

window.CPClub = window.CPClub || {};

(function (CP) {
  'use strict';

  const rules = {
    earn: {
      perPeso: 1000,     // 1 punto por cada $1.000
      comboBonus: 30,    // +30 por combo
      groupBonus: 60,    // +60 por Combo para dos / para varios
      welcome: 30,       // al registrar el celular (era 50; bajada a 30 el 2026-11-17)
      orderCap: 250,     // tope por orden
      expireDays: 90     // desde la última compra
    },
    codeTtlMs: 10 * 60 * 1000,

    // Premio de cumpleaños (copia de worker/rules.js)
    birthday: {
      windowDays: 3,
      reward: { id: 'cumple', name: 'Burger Sencilla de cumpleaños', desc: 'Va por la casa en la semana de tu cumpleaños', cost: 0, icon: 'cumple' }
    },

    tiers: [
      { id: 1, name: 'PRIMERA PARED', min: 0 },
      { id: 2, name: 'PARCHADO', min: 400 },
      { id: 3, name: 'DE LA CASA', min: 1200 },
      { id: 4, name: 'CUATRO PAREDES', min: 2500 }
    ],

    rewards: [
      { id: 'adicion', name: 'Una adición', desc: 'Tocineta, queso, pepinillos o enchulado', cost: 50, icon: 'tocineta' },
      { id: 'galleta_bebida', name: 'Galleta o bebida', desc: 'Galleta, soda, Coca-Cola 400 o agua', cost: 100, icon: 'galleta' },
      { id: 'burger_papas', name: 'Burger Sencilla o Papas trufadas', desc: 'La que se te antoje', cost: 300, icon: 'burger' },
      { id: 'combo', name: 'Combo Sencilla', desc: 'Burger, papas rústicas y Coca-Cola', cost: 450, icon: 'combo' },
      { id: 'combo_dos', name: 'Combo para dos', desc: '2 sencillas, 2 bebidas y papas CP', cost: 800, icon: 'combo_dos' }
    ],

    earnFor({ amount = 0, combos = 0, groupCombos = 0 }) {
      const e = rules.earn;
      const raw = Math.floor(amount / e.perPeso) + combos * e.comboBonus + groupCombos * e.groupBonus;
      return Math.min(e.orderCap, raw);
    },

    tierFor(lifetime) {
      let t = rules.tiers[0];
      rules.tiers.forEach((x) => { if (lifetime >= x.min) t = x; });
      return t;
    },

    nextTier(lifetime) {
      return rules.tiers.find((x) => x.min > lifetime) || null;
    },

    rewardById(id) {
      if (id === rules.birthday.reward.id) return rules.birthday.reward;
      return rules.rewards.find((r) => r.id === id) || null;
    },

    // Semana de cumpleaños (copia IDÉNTICA de birthdayWindow en worker/rules.js)
    birthdayWindow(mmdd, now) {
      const m = /^(\d{2})-(\d{2})$/.exec(String(mmdd || ''));
      if (!m) return null;
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const OFF = 5 * 3600000;
      const DAYMS = 86400000;
      const w = rules.birthday.windowDays;
      const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const y0 = new Date(now - OFF).getUTCFullYear();
      for (const y of [y0 - 1, y0, y0 + 1]) {
        const day = (mm === 2 && dd === 29 && !leap(y)) ? 28 : dd;
        const b = Date.UTC(y, mm - 1, day) + OFF;
        const from = b - w * DAYMS;
        const until = b + (w + 1) * DAYMS;
        if (now >= from && now < until) return { year: y, from, until, active: true };
        if (from > now) return { year: y, from, until, active: false };
      }
      return null;
    },

    // Celular colombiano: 10 dígitos que empiezan por 3. Copia IDÉNTICA de worker/phone.js
    // (worker/test/phone-test.mjs comprueba que den lo mismo): acepta "+57", "57", "0057", espacios,
    // guiones, puntos, paréntesis, letras por números (3O5) y varios números en el mismo campo.
    parsePhone(raw) {
      const PALABRAS = /\b(cel(?:ular)?|tel(?:[eé]fono)?|whats?app|wpp|wsp|wa|ext|m[oó]vil|numero|n[uú]mero|no\.?|nro\.?|col(?:ombia)?)\b\.?:?/gi;
      const parseOne = (r) => {
        let t = String(r == null ? '' : r).trim();
        if (!t) return { reason: 'vacio', digits: 0 };
        t = t.replace(PALABRAS, ' ');
        if (/^[\d\s().+\-oOlI]+$/.test(t)) t = t.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
        let d = t.replace(/\D/g, '');
        if (!d) return { reason: 'sin_digitos', digits: 0 };
        if (d.startsWith('00')) d = d.slice(2);
        if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
        else if (d.length === 13 && d.startsWith('057')) d = d.slice(3);
        else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
        if (/^3\d{9}$/.test(d)) return { phone: d };
        if (d.length === 20) { const a = d.slice(0, 10); if (/^3\d{9}$/.test(a)) return { phone: a, varios: true }; }
        if (d.length === 24 && d.startsWith('57')) { const a = d.slice(2, 12); if (/^3\d{9}$/.test(a)) return { phone: a, varios: true }; }
        if (d.length === 7 || (d.length === 10 && d.startsWith('60'))) return { reason: 'fijo', digits: d.length };
        if (d.length < 10) return { reason: 'corto', digits: d.length };
        if (d.length === 10) return { reason: 'no_empieza_en_3', digits: d.length };
        return { reason: 'largo', digits: d.length };
      };
      const s = String(raw == null ? '' : raw).trim();
      if (!s) return { phone: null, reason: 'vacio', digits: 0 };
      const parts = s.split(/[\/,;|\n]|\s+(?:y|o|e)\s+/i).map((x) => x.trim()).filter(Boolean);
      let first = null;
      for (const p of parts) {
        const r = parseOne(p);
        if (r.phone) return { phone: r.phone, reason: null, varios: parts.length > 1 || !!r.varios };
        if (!first) first = r;
      }
      return { phone: null, reason: first ? first.reason : 'invalido', digits: first ? first.digits : 0 };
    },

    normalizePhone(raw) {
      return rules.parsePhone(raw).phone;
    },

    fmtPhone(p) {
      return p ? p.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : '';
    }
  };

  CP.rules = rules;
})(window.CPClub);
