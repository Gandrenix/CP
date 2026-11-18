// CP Club (servidor) - reglas del programa y utilidades de puntos.
// Misma fuente que club/js/rules.js (aprobado 2026-11-17); si cambias un número,
// cámbialo en los dos. Cuando exista el panel del dueño pasará a una tabla.

export const RULES = {
  earn: {
    perPeso: 1000,      // 1 punto por cada $1.000
    comboBonus: 30,     // +30 por combo
    groupBonus: 60,     // +60 por Combo para dos / para varios
    welcome: 30,        // al registrar el celular (era 50; bajada a 30 el 2026-11-17)
    orderCap: 250,      // tope por orden
    expireDays: 90      // desde la última compra
  },
  codeTtlMs: 10 * 60 * 1000,

  // Premio de cumpleaños: una burger por la casa la semana del cumpleaños (3 días antes y 3 después), una vez al año.
  // Condiciones: fecha registrada ANTES de que empiece esa semana (no se puede registrar de última hora),
  // la fecha no se puede cambiar después de guardarla, y al menos una compra registrada con el celular.
  birthday: {
    windowDays: 3,
    reward: { id: 'cumple', name: 'Burger Sencilla de cumpleaños', desc: 'Va por la casa en la semana de tu cumpleaños', cost: 0, icon: 'cumple' }
  },
  retentionMonths: 24,   // se borran los clientes sin actividad en 24 meses (contrato de datos, Anexo A)

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

  // Cómo se reconoce lo que suma en una venta de Toteat
  comboRe: /\bcombo\b/i,
  groupRe: /para\s+(dos|varios)/i,
  excludedPayRe: /cuenta corriente|convenio|premio/i,   // pagos que no suman
  excludedPayIds: [4000],                               // 4000 = Convenio
  deliveryProductIds: ['TOTEATDVYCOST']                 // costo de domicilio: no suma
};

export function earnFor({ amount = 0, combos = 0, groupCombos = 0 }) {
  const e = RULES.earn;
  const raw = Math.floor(amount / e.perPeso) + combos * e.comboBonus + groupCombos * e.groupBonus;
  return Math.min(e.orderCap, raw);
}

export function tierFor(lifetime) {
  let t = RULES.tiers[0];
  for (const x of RULES.tiers) if (lifetime >= x.min) t = x;
  return t;
}

export function nextTier(lifetime) {
  return RULES.tiers.find((x) => x.min > lifetime) || null;
}

export function rewardById(id) {
  if (id === RULES.birthday.reward.id) return RULES.birthday.reward;
  return RULES.rewards.find((r) => r.id === id) || null;
}

// Semana de cumpleaños (hora de Colombia, UTC-5 sin horario de verano). Devuelve la semana que contiene a 'now'
// ({active:true}) o la próxima ({active:false}); 'year' es el año del cumpleaños y sirve para no regalarla dos veces.
// El 29 de febrero se celebra el 28 en los años que no son bisiestos.
export function birthdayWindow(mmdd, now) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(mmdd || ''));
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const OFF = 5 * 3600000;
  const DAYMS = 86400000;
  const w = RULES.birthday.windowDays;
  const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const y0 = new Date(now - OFF).getUTCFullYear();
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const day = (mm === 2 && dd === 29 && !leap(y)) ? 28 : dd;
    const b = Date.UTC(y, mm - 1, day) + OFF;      // 00:00 en Colombia
    const from = b - w * DAYMS;
    const until = b + (w + 1) * DAYMS;
    if (now >= from && now < until) return { year: y, from, until, active: true };
    if (from > now) return { year: y, from, until, active: false };
  }
  return null;
}

// Celulares y nombres: toda la limpieza vive en phone.js (acepta +57, 57, 0057, espacios, guiones, letras por números...).
export { normalizePhone, parsePhone, cleanName } from './phone.js';
