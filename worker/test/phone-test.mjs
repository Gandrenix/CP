// Prueba de la limpieza de celulares: muchas formas de escribir el MISMO número, casos inválidos que NO se
// deben adivinar, y que la copia de la página (club/js/rules.js) dé exactamente lo mismo que el servidor.
// Uso: node worker/test/phone-test.mjs

import fs from 'node:fs';
import vm from 'node:vm';
import { parsePhone, normalizePhone, cleanName } from '../phone.js';

let pass = 0;
let bad = 0;
const check = (n, c, x) => { if (c) pass += 1; else { bad += 1; console.log('  FALLA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

// --- la copia de la página
const win = {};
vm.runInNewContext(fs.readFileSync(new URL('../../club/js/rules.js', import.meta.url), 'utf8'), { window: win, console });
const cliente = win.CPClub.rules;

const BUENOS = [
  '3051234567', '305 123 4567', '305-123-4567', '305.123.4567', '(305) 123 4567', '3 05 123 45 67', '30 5123 4567', ' 305 123 4567 ',
  '+57 305 123 4567', '+573051234567', '57 305 1234567', '57305 123 4567', '573051234567', '(+57) 305-123-4567', '+57-305-123-4567',
  '0057 305 123 4567', '00573051234567', '03051234567', '0 305 123 4567', '+57 (305) 123-4567',
  '3O5 123 4567', '3o5 123 4567', '305 l23 4567', 'cel 305 123 4567', 'Cel: 305-123-4567', 'WhatsApp 305 123 4567', 'tel. 305 123 4567',
  '305 123 4567 / 604 555 1234', '305 123 4567, 310 555 6677', '305 123 4567 y 310 555 6677', '3051234567 3105556677',
  '+57 305 123 4567 ext', 'No. 305 123 4567'
];
BUENOS.forEach((raw) => {
  const r = parsePhone(raw);
  check('limpia: ' + raw, r.phone === '3051234567', r);
  check('página igual que servidor: ' + raw, cliente.parsePhone(raw).phone === r.phone, { srv: r.phone, pag: cliente.parsePhone(raw).phone });
});

// Lo que NO se debe adivinar: devuelve null y un motivo
const MALOS = [
  ['', 'vacio'], ['   ', 'vacio'], ['abc', 'sin_digitos'], ['305 123 456', 'corto'], ['305123', 'corto'],
  ['305 123 45678', 'largo'], ['+57 305 123 456789', 'largo'], ['6051234567', 'fijo'], ['604 5551234', 'fijo'], ['5551234', 'fijo'],
  ['2051234567', 'no_empieza_en_3'], ['1111111111', 'no_empieza_en_3'], ['+1 305 123 4567', 'largo']
];
MALOS.forEach(([raw, motivo]) => {
  const r = parsePhone(raw);
  check('no adivina: "' + raw + '"', r.phone === null && r.reason === motivo, r);
  check('página igual (inválido): "' + raw + '"', cliente.parsePhone(raw).phone === null && cliente.parsePhone(raw).reason === motivo);
});

check('la O al final se lee como 0', normalizePhone('305 123 456O') === '3051234560');
check('null/undefined', normalizePhone(null) === null && normalizePhone(undefined) === null);
check('número como número', normalizePhone(3051234567) === '3051234567');
check('marca varios números', parsePhone('305 123 4567 / 310 555 6677').varios === true);

// Nombres
const NOMBRES = [['jhon florez', 'Jhon'], ['HÉCTOR HERNÁNDEZ PARRA', 'Héctor'], ['  maría-josé ', 'María'], ['Danny', 'Danny'], ['x', ''], ['', ''], ['123', ''], ["o'brien", "O'brien"], ['Nicolás González', 'Nicolás']];
NOMBRES.forEach(([i, o]) => check('nombre: "' + i + '"', cleanName(i) === o, cleanName(i)));

console.log(pass + ' comprobaciones ok, ' + bad + ' con falla');
process.exit(bad ? 1 : 0);
