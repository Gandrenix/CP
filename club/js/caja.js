// CP Club - pantalla de caja (/club/caja): el cajero entra con su PIN, escribe
// el código que le muestra el cliente y entrega el premio. Solo usa CPClub.api.

(function (CP) {
  'use strict';

  const api = CP.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const KEY = 'cpclub-caja-token';
  const S = { atlas: null, token: null, name: '', pin: '', busy: false, spr: null, current: null };

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const getTok = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };
  const setTok = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } };

  // ---------- PIN ----------
  function buildKeys() {
    const keys = $('#keys');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''].forEach((k) => {
      if (!k) { keys.appendChild(mk('span')); return; }
      const b = mk('button', 'cl-key', k);
      b.type = 'button';
      b.setAttribute('aria-label', k === '⌫' ? 'Borrar' : k);
      b.addEventListener('click', () => press(k));
      keys.appendChild(b);
    });
    document.addEventListener('keydown', (e) => {
      if ($('#s-pin').hidden) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
    });
  }

  function dots() {
    [...$('#dots').children].forEach((d, i) => d.classList.toggle('on', i < S.pin.length));
  }

  async function press(k) {
    if (S.busy) return;
    const msg = $('#pin-msg');
    msg.textContent = '';
    msg.className = 'cl-msg';
    if (k === '⌫') S.pin = S.pin.slice(0, -1);
    else if (S.pin.length < 4) S.pin += k;
    dots();
    if (S.pin.length < 4) return;
    S.busy = true;
    const res = await api.staffLogin(S.pin);
    S.busy = false;
    S.pin = '';
    dots();
    if (!res.ok) {
      msg.textContent = res.error === 'device' ? 'Este dispositivo no está autorizado como caja. Pide el enlace de activación a quien administra el Club.'
        : res.error === 'rate_limit' ? 'Demasiados intentos. Espera un minuto.' : 'PIN incorrecto.';
      msg.classList.add('err');
      S.spr.play('sad', { loop: false, onend: () => S.spr.play('idle', { loop: true }) });
      return;
    }
    S.token = res.token;
    S.name = res.name;
    setTok(res.token + '|' + res.name);
    enter();
  }

  function enter() {
    S.spr.stop();
    $('#s-pin').hidden = true;
    $('#s-main').hidden = false;
    $('#btn-out').hidden = false;
    $('#who').textContent = S.name;
    $('#result').textContent = '';
    $('#code').value = '';
    loadLog();
    $('#code').focus();
  }

  function leave() {
    setTok(null);
    S.token = null;
    S.name = '';
    $('#s-pin').hidden = false;
    $('#s-main').hidden = true;
    $('#btn-out').hidden = true;
    S.spr.play('wave', { loop: false, onend: () => S.spr.play('idle', { loop: true }) });
  }

  // ---------- Canje ----------
  function normCode(v) {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const body = raw.startsWith('CP') ? raw.slice(2) : raw;
    return 'CP-' + body.slice(0, 4);
  }

  function resultCard(kind, title, lines, icon) {
    const box = $('#result');
    box.textContent = '';
    const card = mk('div', 'res ' + kind);
    const top = mk('div', 'res-top');
    if (icon) {
      const w = mk('div', 'ico-wrap');
      const i = mk('div');
      CP.icon(i, S.atlas, icon, 64);
      w.appendChild(i);
      top.appendChild(w);
    }
    const body = mk('div');
    body.appendChild(mk('div', 'res-name', title));
    const meta = mk('div', 'res-meta');
    lines.forEach((l, idx) => {
      if (idx) meta.appendChild(mk('br'));
      if (Array.isArray(l)) l.forEach((p) => meta.append(typeof p === 'string' ? p : mk('b', '', p.b)));
      else meta.append(l);
    });
    body.appendChild(meta);
    top.appendChild(body);
    card.appendChild(top);
    box.appendChild(card);
    return card;
  }

  const STATUS_TEXT = {
    used: ['Código ya usado', 'Este código ya se entregó. No lo canjees otra vez.'],
    expired: ['Código vencido', 'Pasaron los 10 minutos. El cliente puede generar uno nuevo desde su celular.'],
    cancelled: ['Código cancelado', 'El cliente canceló este canje. Pídele uno nuevo.'],
    cumple_used: ['Regalo ya entregado', 'Este cliente ya reclamó su burger de cumpleaños este año.'],
    unknown: ['Código no existe', 'Revisa que esté bien escrito.']
  };

  async function lookup(code) {
    const res = await api.staffLookup(S.token, code);
    if (!res.ok) {
      const t = STATUS_TEXT[res.error] || STATUS_TEXT.unknown;
      resultCard('bad', t[0], [t[1]]);
      S.spr.play('sad', { loop: false });
      return;
    }
    if (res.status !== 'active') {
      const t = STATUS_TEXT[res.status] || STATUS_TEXT.unknown;
      resultCard('bad', t[0], [[t[1]]], res.reward && res.reward.icon);
      return;
    }
    S.current = res;
    const card = resultCard('good', res.reward.name, [
      [{ b: res.firstName }, ' · celular terminado en ', { b: res.last4 }],
      'Confirma con la persona que el nombre y los 4 dígitos coinciden.'
    ], res.reward.icon);
    card.appendChild(mk('div', 'todo', 'Después de entregar, cárgalo en Toteat: el producto con descuento del 100 % y motivo "Premio CP Club".'));
    const row = mk('div', 'sheet-row');
    const ok = mk('button', 'cl-btn block', 'Entregar');
    ok.type = 'button';
    ok.addEventListener('click', () => deliver(res.code, ok));
    const no = mk('button', 'cl-btn ghost block', 'No es esta persona');
    no.type = 'button';
    no.addEventListener('click', () => { $('#result').textContent = ''; $('#code').value = ''; $('#code').focus(); });
    row.append(ok, no);
    card.appendChild(row);
  }

  async function deliver(code, btn) {
    btn.disabled = true;
    const res = await api.staffDeliver(S.token, code);
    if (!res.ok) {
      const t = STATUS_TEXT[res.error] || ['No se pudo entregar', 'Intenta de nuevo.'];
      resultCard('bad', t[0], [t[1]]);
      return;
    }
    S.spr.play('sparkle', { loop: false, onend: () => S.spr.play('idle', { loop: true }) });
    resultCard('good', '¡Entregado!', [
      [{ b: res.reward.name }, ' para ', { b: res.firstName }],
      (res.reward && res.reward.cost === 0 ? 'Era un regalo: no se descontaron puntos. ' : 'Ya se descontaron los puntos. ') + 'Recuerda cargarlo en Toteat con descuento del 100 % y motivo "Premio CP Club".'
    ], res.reward.icon);
    $('#code').value = '';
    CP.impact($('#result .res'));
    loadLog();
  }

  async function loadLog() {
    const res = await api.staffLog(S.token);
    // Aviso si el Club dejó de recibir ventas de Toteat (los puntos no se estarían sumando)
    const warn = $('#sync-warn');
    if (warn) warn.hidden = !(res.ok && res.sync && (!res.sync.ok || res.sync.minutes > 15));
    const ul = $('#log');
    ul.textContent = '';
    if (!res.ok || !res.items.length) { ul.appendChild(mk('li', '', 'Todavía ninguno')); return; }
    res.items.forEach((x) => {
      const r = CP.rules.rewardById(x.rewardId);
      const li = mk('li');
      const a = mk('span');
      a.append(mk('b', '', x.firstName), ' · ' + x.last4 + ' · ' + (r ? r.name : ''));
      const t = new Date(x.at);
      li.append(a, mk('span', '', String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ' · ' + x.by));
      ul.appendChild(li);
    });
  }

  // El cajero escribe un celular (de cualquier forma) y ve el saldo del cliente para decírselo en el mostrador.
  async function consultar(raw) {
    const phone = CP.rules.normalizePhone(raw);
    if (!phone) {
      resultCard('bad', 'Celular no válido', ['Escribe los 10 dígitos del celular (empieza por 3). Sirve con +57, espacios o guiones.']);
      return;
    }
    const res = await api.staffCustomer(S.token, phone);
    if (!res.ok) {
      const t = res.error === 'not_found'
        ? ['No tiene puntos todavía', 'Ese celular aún no tiene compras registradas con cliente. Al cobrar, asocia el cliente en Toteat con su celular.']
        : res.error === 'rate_limit' ? ['Muchas consultas', 'Espera un minuto.'] : ['No se pudo consultar', 'Intenta de nuevo.'];
      resultCard('bad', t[0], [t[1]]);
      return;
    }
    const c = res.customer;
    const lines = [[{ b: c.firstName }, ' · ', { b: String(c.available) }, ' puntos disponibles'], 'Nivel ' + c.tier.id + ' · ' + c.tier.name];
    const alcanza = c.rewards.filter((r) => r.affordable).map((r) => r.name);
    lines.push(alcanza.length ? 'Ya le alcanza para: ' + alcanza.join(' · ') : 'Todavía no le alcanza para un premio.');
    if (c.birthdayPrize === 'open') lines.push('¡Está de cumpleaños! Tiene su Burger Sencilla de regalo esta semana.');
    if (c.activeCode) lines.push('Tiene un canje en curso: pídele el código.');
    if (c.expiresInDays !== null && c.expiresInDays <= 15) lines.push('Sus puntos vencen en ' + c.expiresInDays + ' días.');
    resultCard('good', 'Cliente del Club', lines, 'punto');
  }

  // Enlace de activación (/club/caja/?activar=...): autoriza ESTE dispositivo como caja y limpia la dirección.
  function activarDispositivo() {
    try {
      const q = new URLSearchParams(location.search);
      const t = q.get('activar');
      if (t) {
        localStorage.setItem('cpclub-device', t);
        history.replaceState(null, '', location.pathname);
        return true;
      }
    } catch (e) { /* sin almacenamiento */ }
    return false;
  }

  async function init() {
    const recienActivado = activarDispositivo();
    S.atlas = await CP.loadAtlas();
    S.spr = new CP.Sprite($('#pin-spr'), S.atlas, 3);
    S.spr.setTier(1);
    S.spr.play('wave', { loop: false, onend: () => S.spr.play('idle', { loop: true }) });
    buildKeys();
    if (recienActivado) {
      const m = $('#pin-msg');
      m.textContent = 'Dispositivo autorizado. Ya puedes entrar con tu PIN.';
      m.className = 'cl-msg';
    }
    $('#btn-out').addEventListener('click', leave);
    $('#code').addEventListener('input', (e) => {
      const v = e.target.value;
      e.target.value = v.length ? normCode(v) : '';
    });
    $('#phone-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#cust-go').disabled = true;
      await consultar($('#cust-phone').value);
      $('#cust-go').disabled = false;
    });
    $('#code-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = normCode($('#code').value);
      if (code.length < 7) {
        resultCard('bad', 'Código incompleto', ['Son 4 letras o números después de CP-.']);
        return;
      }
      $('#code-go').disabled = true;
      await lookup(code);
      $('#code-go').disabled = false;
    });
    const saved = getTok();
    if (saved) {
      const [tok, name] = saved.split('|');
      S.token = tok;
      S.name = name;
      enter();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.CPClub);
