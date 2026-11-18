// CP Club - limpieza y estandarización de celulares colombianos.
// Los celulares los escriben personas (cajeros, clientes): con espacios, guiones, "+57", "57", "0057",
// letras por números ("3O5"), dos números en el mismo campo, etc. Todo se reduce a una forma única:
// 10 dígitos que empiezan por 3 (ej. 3051234567). Lo que no se puede arreglar con seguridad NO se
// adivina: se devuelve el motivo para que una persona lo revise.
//
// IMPORTANTE: club/js/rules.js tiene una copia idéntica de esta lógica (en la página). Si cambias una,
// cambia la otra; worker/test/phone-test.mjs comprueba que den el mismo resultado.

const PALABRAS = /\b(cel(?:ular)?|tel(?:[eé]fono)?|whats?app|wpp|wsp|wa|ext|m[oó]vil|numero|n[uú]mero|no\.?|nro\.?|col(?:ombia)?)\b\.?:?/gi;

// Reduce UN número escrito a 10 dígitos. Devuelve { phone } o { reason, digits }.
function parseOne(raw) {
  let t = String(raw == null ? '' : raw).trim();
  if (!t) return { reason: 'vacio', digits: 0 };
  t = t.replace(PALABRAS, ' ');
  // letras que la gente teclea por números (3O5 -> 305, 3l0 -> 310): solo si el texto es "de número"
  // (dígitos, separadores y esas letras); si trae otras palabras no se toca nada.
  if (/^[\d\s().+\-oOlI]+$/.test(t)) t = t.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
  let d = t.replace(/\D/g, '');
  if (!d) return { reason: 'sin_digitos', digits: 0 };
  if (d.startsWith('00')) d = d.slice(2);                       // 0057...
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);    // +57 / 57
  else if (d.length === 13 && d.startsWith('057')) d = d.slice(3);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1); // 0305...
  if (/^3\d{9}$/.test(d)) return { phone: d };
  if (d.length === 20) {                                         // dos celulares pegados
    const a = d.slice(0, 10);
    if (/^3\d{9}$/.test(a)) return { phone: a, varios: true };
  }
  if (d.length === 24 && d.startsWith('57')) {                   // dos con indicativo pegados
    const a = d.slice(2, 12);
    if (/^3\d{9}$/.test(a)) return { phone: a, varios: true };
  }
  if (d.length === 7 || (d.length === 10 && d.startsWith('60'))) return { reason: 'fijo', digits: d.length };
  if (d.length < 10) return { reason: 'corto', digits: d.length };
  if (d.length === 10) return { reason: 'no_empieza_en_3', digits: d.length };
  return { reason: 'largo', digits: d.length };
}

// Acepta un campo con uno o varios números ("305 123 4567 / 310 555 6677", "305..., 310...", "A y B").
export function parsePhone(raw) {
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
}

export function normalizePhone(raw) {
  return parsePhone(raw).phone;
}

// Primer nombre limpio: "jhon florez" -> "Jhon", "HÉCTOR HERNÁNDEZ" -> "Héctor", "  maría-josé " -> "María".
export function cleanName(raw) {
  const first = String(raw == null ? '' : raw).trim().split(/\s+/)[0] || '';
  const letters = first.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’-]/g, '').split(/[-]/)[0];
  if (letters.length < 2) return '';
  const w = letters.slice(0, 20);
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
