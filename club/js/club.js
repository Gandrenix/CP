// CP Club - pantalla del cliente (/club). Habla solo con CPClub.api, así que
// pasar de la API de prueba al backend real no toca este archivo.

(function (CP) {
  'use strict';

  const R = CP.rules;
  const api = CP.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const KEY_PHONE = 'cpclub-phone';
  const DEMO = new URLSearchParams(location.search).has('demo');
  const DEMO_PHONES = [['3001112233', 'Camila · 120 pts, por vencer'], ['3002223344', 'Andrés · 520 pts'], ['3003334455', 'Valentina · 880 pts, nivel 4'], ['3004445566', 'Nicolás · nuevo, 0 pts']];

  const S = {
    atlas: null, k: 2, stageEl: null, sprEl: null, fxEl: null, sprite: null,
    phone: null, data: null, shown: 0, tierId: 1, coinTimer: null,
    active: null, codeTimer: null, poll: null, busy: false
  };

  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ------------------------------------------------------------------
  // Escenario: cuarto + mascota
  // ------------------------------------------------------------------
  function buildStage() {
    S.stageEl = $('#stage');
    S.sprEl = mk('button', 'spr');
    S.sprEl.type = 'button';
    S.sprEl.setAttribute('aria-label', 'Jugar con Smiley');
    S.fxEl = mk('div', 'fx');
    S.stageEl.append(S.sprEl, S.fxEl);
    S.sprite = new CP.Sprite(S.sprEl, S.atlas, 2);
    S.resetRoom = CP.roomControls(S, mood);
    layout();
    window.addEventListener('resize', layout);
  }

  function layout() {
    const avail = S.stageEl.parentElement.clientWidth;
    const k = Math.max(1, Math.min(4, Math.floor((avail - 6) / 160)));
    S.k = k;
    S.stageEl.style.setProperty('--flight', 160 * k + 'px');
    S.stageEl.style.width = 160 * k + 'px';
    S.stageEl.style.height = 90 * k + 'px';
    S.sprite.setScale(k);
    const [ax, ay] = S.atlas.rooms.smiley_anchor;
    S.sprEl.style.left = (ax - 24) * k + 'px';
    S.sprEl.style.top = (ay - 41) * k + 'px';
  }

  function setRoom(tierId, flash) {
    S.tierId = tierId;
    S.stageEl.style.backgroundImage = 'url(/club/assets/' + S.atlas.rooms.items[String(tierId)].file + ')';
    S.sprite.setTier(tierId);
    $('#room-number').textContent = '0' + tierId + ' / 04';
    S.stageEl.dataset.tier = tierId;
    if (flash) CP.impact(S.stageEl);
  }

  // Estado de ánimo de la mascota según lo que pasa en la cuenta
  function mood() {
    const d = S.data;
    if (S.busy || S.stageEl.dataset.secret) return;
    if (!d) { S.sprite.play('idle', { loop: true }); return; }
    if (d.activeCode) S.sprite.play('ticket', { loop: true });
    else if (d.points === 0) S.sprite.play('sleep', { loop: true });
    else if (d.expiresInDays !== null && d.expiresInDays <= 15) S.sprite.play('clock', { loop: true });
    else if (d.rewards.some((r) => r.affordable)) S.sprite.play('sparkle', { loop: true });
    else S.sprite.play('idle', { loop: true });
  }

  // ------------------------------------------------------------------
  // Entrar
  // ------------------------------------------------------------------
  function showScreen(name) {
    $('#s-login').hidden = name !== 'login';
    $('#s-home').hidden = name !== 'home';
    $('#btn-out').hidden = name !== 'home';
  }

  function fmtInput(v) {
    let d = v.replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('57')) d = d.slice(2);
    d = d.slice(0, 10);
    return d.replace(/^(\d{3})(\d{0,3})(\d{0,4})$/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
  }

  async function doLogin(raw, silent) {
    const phone = R.normalizePhone(raw);
    const msg = $('#login-msg');
    msg.className = 'cl-msg';
    if (!phone) {
      if (!silent) { msg.textContent = 'Escribe tu celular de 10 dígitos (empieza por 3).'; msg.classList.add('err'); }
      return;
    }
    $('#login-go').disabled = true;
    msg.textContent = silent ? '' : 'Buscándote…';
    const res = await api.lookup(phone);
    $('#login-go').disabled = false;
    if (!res.ok) {
      if (res.error !== 'not_found') {
        // Falla de red o demasiados intentos: no es "no estás en el Club"
        if (!silent) {
          msg.textContent = res.error === 'rate_limit' ? 'Demasiados intentos. Espera un minuto y vuelve a probar.' : 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.';
          msg.classList.add('err');
        }
        return;
      }
      store(KEY_PHONE, null);
      if (!silent) {
        msg.textContent = 'Ese celular todavía no está en el Club. En tu próxima compra pídele al cajero que lo registre y te regalamos ' + R.earn.welcome + ' puntos.';
        msg.classList.add('err');
        S.sprite.play('sad', { loop: false, onend: () => S.sprite.play('idle', { loop: true }) });
      }
      return;
    }
    msg.textContent = '';
    S.phone = phone;
    store(KEY_PHONE, phone);
    S.shown = 0;
    showScreen('home');
    renderHome(res.customer, { first: true });
    window.scrollTo(0, 0);
  }

  function logout() {
    store(KEY_PHONE, null);
    S.phone = null; S.data = null; S.shown = 0;
    clearInterval(S.coinTimer);
    S.coinTimer = null;
    S.resetRoom();
    clearTimeout(S.levelTimer);
    S.busy = false;
    $('#phone').value = '';
    showScreen('login');
    setRoom(1);
    S.sprite.play('wave', { loop: false, onend: () => S.sprite.play('idle', { loop: true }) });
  }

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  function countTo(node, from, to) {
    if (from === to && node.textContent === String(to)) return;
    node.replaceChildren();
    const digits = String(to);
    const old = String(from).padStart(digits.length, '0').slice(-digits.length);
    Array.from(digits).forEach((digit, i) => {
      const windowEl = mk('span', 'digit');
      const reel = mk('span', 'reel');
      windowEl.appendChild(reel);
      node.appendChild(windowEl);
      if (old[i] !== digit && !CP.reduced()) {
        reel.append(mk('i', '', old[i]), mk('i', '', digit));
        const roll = reel.animate([{transform:'translateY(0)'},{transform:'translateY(-50%)'}],
          {duration:300 + i * 65, easing:'cubic-bezier(.2,.85,.25,1)', fill:'forwards'});
        roll.onfinish = () => { reel.textContent = digit; roll.cancel(); };
      } else reel.textContent = digit;
    });
  }

  function renderHome(d, opts) {
    opts = opts || {};
    const prevTier = S.tierId;
    const previous = S.data;
    S.data = d;

    $('#who').textContent = d.firstName.toUpperCase();
    countTo($('#pts'), S.shown, d.available);
    S.shown = d.available;
    $('#pts-status').textContent = d.available + ' puntos disponibles';
    $('#pts-unit').textContent = d.reserved ? 'PUNTOS · ' + d.reserved + ' EN CANJE' : 'PUNTOS';
    if (!S.coinTimer) S.coinTimer = CP.spinCoin($('#coin'), S.atlas, 40);

    // nivel
    const bdg = $('#bdg');
    CP.badge(bdg, S.atlas, 'nivel_' + d.tier.id, 32);
    $('#tier-name').textContent = 'NIVEL ' + d.tier.id + ' · ' + d.tier.name;

    // progreso hacia el siguiente nivel
    const bar = $('#bar');
    const frac = d.next ? (d.lifetime - d.tier.min) / (d.next.tier.min - d.tier.min) : 1;
    const on = Math.floor(frac * 20);
    for (let i = 0; i < 20; i++) {
      const cell = bar.children[i] || bar.appendChild(mk('i'));
      cell.style.setProperty('--delay', (i * 18) + 'ms');
      cell.classList.toggle('on', i < on);
    }
    const ready = d.rewards.filter(r => r.affordable).length;
    const combo = $('#combo');
    combo.hidden = !ready || !!d.activeCode;
    combo.textContent = ready === 1 ? '1 premio disponible ↓' : ready + ' premios disponibles ↓';
    const note = $('#bar-note');
    note.textContent = '';
    if (d.next) {
      note.append('Te faltan ', mk('b', '', d.next.remaining + ' puntos'), ' para ', mk('b', '', d.next.tier.name), ': se levanta una pared más.');
    } else {
      note.append('Tienes las ', mk('b', '', 'cuatro paredes'), '. Eres de la casa.');
    }
    const nextReward = d.rewards.find((r) => !r.affordable);
    if (nextReward) {
      note.append(mk('br'), 'Próximo premio: ', mk('b', '', nextReward.name), ' (faltan ' + nextReward.missing + ').');
    }

    // aviso de puntos por vencer
    const ntc = $('#notice');
    if (d.expiresInDays !== null && d.expiresInDays <= 15) {
      ntc.hidden = false;
      ntc.textContent = 'Tus puntos vencen en ' + d.expiresInDays + (d.expiresInDays === 1 ? ' día' : ' días') + '. Pásate por una burger y se renuevan por 90 días.';
    } else {
      ntc.hidden = true;
    }

    renderRewards(d);
    renderBirthday(d);

    if (d.tier.id !== prevTier) setRoom(d.tier.id);
    else if (opts.first) setRoom(d.tier.id);

    if (previous && !opts.first && d.lifetime > previous.lifetime) {
      S.resetRoom();
      CP.fx.earn(S.fxEl, S.atlas, d.lifetime - previous.lifetime, S.k);
      const unlocked = d.rewards.some(r => r.affordable && previous.rewards.some(p => p.id === r.id && !p.affordable));
      if (d.tier.id > prevTier) { levelUp(d.tier); return; }
      CP.impact(unlocked ? $('.scoreboard') : $('.hud'));
      if (unlocked && !CP.reduced()) combo.animate([{transform:'translateY(3px)'},{transform:'translateY(-3px)'},{transform:'none'}], 420);
      S.sprite.play(unlocked ? 'sparkle' : 'jump', {loop:false, onend:mood});
    } else if (opts.first) {
      S.sprite.play('wave', { loop: false, onend: mood });
    } else if (!opts.keepAnim) {
      mood();
    }
  }

  function renderRewards(d) {
    const box = $('#rewards');
    box.textContent = '';
    if (d.activeCode) {
      const r = R.rewardById(d.activeCode.rewardId);
      const row = mk('div', 'rew ok');
      const body = mk('div', 'rew-body');
      body.append(mk('div', 'rew-name', 'Tienes un canje en curso'), mk('div', 'rew-desc', r ? r.name : ''));
      const b = mk('button', 'cl-btn', 'Ver código');
      b.type = 'button';
      b.addEventListener('click', () => showCode({ code: d.activeCode.code, expiresAt: d.activeCode.expiresAt, reward: r }));
      row.append(body, b);
      box.appendChild(row);
    }
    d.rewards.forEach((r, index) => {
      const ok = r.affordable && !d.activeCode;
      const row = mk('div', 'rew ' + (r.affordable ? 'ok' : 'lock'));
      row.style.setProperty('--delay', index * 45 + 'ms');
      const wrap = mk('div', 'ico-wrap');
      const ico = mk('div', 'ico');
      CP.icon(ico, S.atlas, r.icon, 64);
      wrap.appendChild(ico);
      if (!r.affordable) {
        const lk = mk('div', 'lk');
        CP.icon(lk, S.atlas, 'candado', 32);
        wrap.appendChild(lk);
      }
      const body = mk('div', 'rew-body');
      body.append(mk('div', 'rew-name', r.name), mk('div', 'rew-desc', r.desc), mk('div', 'rew-cost', r.cost + ' PTS'));
      row.append(wrap, body);
      if (r.affordable) {
        const b = mk('button', 'cl-btn', 'Canjear');
        b.type = 'button';
        b.disabled = !ok;
        b.addEventListener('click', () => openConfirm(r));
        row.appendChild(b);
      } else {
        row.appendChild(mk('div', 'need', 'FALTAN ' + r.missing));
      }
      box.appendChild(row);
    });
  }

  // Día en hora de Colombia (UTC-5): "14 de marzo"
  function fmtDay(ts) {
    const t = new Date(ts - 5 * 3600000);
    return t.getUTCDate() + ' de ' + MONTHS[t.getUTCMonth()];
  }

  function renderBirthday(d) {
    const box = $('#bday');
    box.textContent = '';
    const wrap = mk('div', 'ico-wrap');
    const ico = mk('div');
    CP.icon(ico, S.atlas, 'cumple', 64);
    wrap.appendChild(ico);
    const body = mk('div', 'bday-body');
    const bp = d.birthdayPrize || { state: 'none' };
    if (d.birthday) {
      const [mm, dd] = d.birthday.split('-').map(Number);
      const when = 'Anotado: ' + dd + ' de ' + MONTHS[mm - 1];
      const week = bp.from ? ' (del ' + fmtDay(bp.from) + ' al ' + fmtDay(bp.until - 86400000) + ')' : '';
      if (bp.state === 'open' && !d.activeCode) {
        body.append(mk('b', '', '¡Feliz cumple, ' + d.firstName + '!'), 'Esta semana tu Burger Sencilla va por la casa.');
        const go = mk('button', 'cl-btn', 'Canjear mi burger');
        go.type = 'button';
        go.style.marginTop = '10px';
        go.addEventListener('click', () => openConfirm(R.rewardById('cumple')));
        body.appendChild(go);
      } else if (bp.state === 'open') {
        body.append(mk('b', '', '¡Feliz cumple, ' + d.firstName + '!'), 'Tu regalo está en el canje en curso.');
      } else if (bp.state === 'used') {
        body.append(mk('b', '', 'Ya reclamaste tu burger'), 'Este año ya la tuviste. ¡Feliz cumple!');
      } else if (bp.state === 'need_purchase') {
        body.append(mk('b', '', 'Es tu semana'), 'Haz una compra con tu celular registrado y te entregamos tu Burger Sencilla.');
      } else if (bp.state === 'too_new') {
        body.append(mk('b', '', when), 'Lo guardaste cuando ya había empezado tu semana, así que este año no alcanza. El próximo, sí.');
      } else {
        body.append(mk('b', '', when), 'Tu semana de regalo' + week + ': una Burger Sencilla por la casa. Aplica con al menos una compra registrada.');
      }
    } else {
      body.append(mk('b', '', 'Una burger en tu cumple'), 'Cuéntanos cuándo es. Se guarda una sola vez y, si lo anotas antes de tu semana de cumpleaños, esa semana va por la casa.');
      const form = mk('div', 'bday-form');
      const dd = mk('select');
      dd.setAttribute('aria-label', 'Día');
      for (let i = 1; i <= 31; i++) dd.appendChild(new Option(String(i), String(i)));
      const mm = mk('select');
      mm.setAttribute('aria-label', 'Mes');
      MONTHS.forEach((m, i) => mm.appendChild(new Option(m, String(i + 1))));
      const msg = mk('div', 'cl-msg');
      const go = mk('button', 'cl-btn', 'Guardar');
      go.type = 'button';
      go.addEventListener('click', async () => {
        go.disabled = true;
        const val = String(mm.value).padStart(2, '0') + '-' + String(dd.value).padStart(2, '0');
        const res = await api.setBirthday(S.phone, val);
        if (res && res.ok) { refresh({ keepAnim: true }); return; }
        msg.textContent = 'Esa fecha no existe. Revisa el día y el mes.';
        go.disabled = false;
      });
      form.append(dd, mm, go);
      body.append(form, msg);
    }
    box.append(wrap, body);
  }

  async function refresh(opts) {
    opts = opts || {};
    if (!S.phone) return;
    const phone = S.phone;
    const request = S.refreshRequest = (S.refreshRequest || 0) + 1;
    const res = await api.lookup(phone);
    if (phone !== S.phone || request !== S.refreshRequest) return;
    if (!res.ok) {
      if (res.error === 'not_found') logout();   // una falla de red no debe cerrar la sesión
      return;
    }
    renderHome(res.customer, opts);
  }

  // ------------------------------------------------------------------
  // Canje: confirmar -> código -> entregado
  // ------------------------------------------------------------------
  let focusBefore;
  function sheet(id, on) {
    const dialog = $(id);
    if (on && dialog.hidden) focusBefore = document.activeElement;
    dialog.hidden = !on;
    const open = $('.cl-sheet:not([hidden])');
    for (const el of document.querySelectorAll('.arcade-layout,.cl-top,.demo')) el.inert = !!open;
    if (on) requestAnimationFrame(() => {
      Array.from(dialog.querySelectorAll('button')).find(b => b.offsetWidth && !b.disabled)?.focus();
    });
    else if (!open && focusBefore) {
      (focusBefore.isConnected ? focusBefore : $('#combo').hidden ? S.sprEl : $('#combo')).focus({preventScroll:true});
    }
  }

  function openConfirm(r) {
    $('#sheet-code').setAttribute('aria-labelledby', 'sc-title');
    sheet('#sheet-code', true);
    $('#sc-confirm').hidden = false;
    $('#sc-show').hidden = true;
    const ico = $('#sc-ico1');
    CP.icon(ico, S.atlas, r.icon, 96);
    $('#sc-title').textContent = '¿Canjear?';
    const t = $('#sc-text');
    t.textContent = '';
    if (r.cost === 0) t.append('Es un regalo: ', mk('b', '', r.name), ' no gasta puntos. Tendrás 10 minutos para mostrarle el código al cajero.');
    else t.append('Se reservan ', mk('b', '', r.cost + ' puntos'), ' por ', mk('b', '', r.name), '. Tendrás 10 minutos para mostrarle el código al cajero.');
    $('#sc-yes').disabled = false;
    $('#sc-yes').onclick = async () => {
      $('#sc-yes').disabled = true;
      const res = await api.reserve(S.phone, r.id);
      if (!res.ok) {
        t.textContent = res.error === 'active_code' ? 'Ya tienes un canje en curso.'
          : res.error === 'no_points' ? 'Ya no te alcanzan los puntos para este premio.'
          : /^cumple_/.test(res.error || '') ? 'Tu regalo de cumpleaños no está disponible ahora mismo.'
          : res.error === 'rate_limit' ? 'Demasiados intentos. Espera un minuto.'
          : 'No pudimos reservar tus puntos. Intenta de nuevo.';
        $('#sc-yes').disabled = false;
        return;
      }
      showCode(res);
      refresh({ keepAnim: true });
    };
    $('#sc-no').onclick = () => sheet('#sheet-code', false);
  }

  function showCode(res) {
    $('#sheet-code').setAttribute('aria-labelledby', 'code-title');
    S.active = res;
    sheet('#sheet-code', true);
    $('#sc-confirm').hidden = true;
    $('#sc-show').hidden = false;
    $('#sc-code').textContent = res.code;
    const r = res.reward;
    const info = $('#sc-info');
    info.textContent = '';
    info.append('Premio: ', mk('b', '', r ? r.name : ''), '. Muéstraselo al cajero: solo vale una vez y es solo tuyo.');

    const sprEl = $('#sc-spr');
    sprEl.textContent = '';
    const sp = new CP.Sprite(sprEl, S.atlas, 3);
    sp.setTier(S.tierId);
    sp.play('ticket', { loop: true });
    S.sheetSprite = sp;
    S.sprite.play('ticket', { loop: true });

    const tick = () => {
      const left = res.expiresAt - Date.now();
      if (left <= 0) { closeCode(); expired(); return; }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      $('#sc-timer').textContent = 'VENCE EN ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    };
    clearInterval(S.codeTimer);
    S.codeTimer = setInterval(tick, 500);
    tick();
    if (S.active !== res) return;

    clearInterval(S.poll);
    S.poll = setInterval(async () => {
      const st = await api.codeStatus(res.code);
      if (S.active !== res) return;
      if (st.status === 'used') { closeCode(); delivered(r); }
      else if (st.status === 'expired' || st.status === 'cancelled') { closeCode(); if (st.status === 'expired') expired(); else refresh(); }
    }, 1500);

    $('#sc-cancel').onclick = async () => {
      await api.cancel(res.code);
      closeCode();
      refresh();
    };
  }

  function closeCode() {
    clearInterval(S.codeTimer);
    clearInterval(S.poll);
    if (S.sheetSprite) S.sheetSprite.stop();
    sheet('#sheet-code', false);
    S.active = null;
  }

  function doneSheet(title, text, anim) {
    $('#sd-title').textContent = title;
    $('#sd-text').textContent = text;
    const el = $('#sd-spr');
    el.textContent = '';
    const sp = new CP.Sprite(el, S.atlas, 3);
    sp.setTier(S.tierId);
    sp.play(anim, { loop: anim !== 'eat' });
    S.doneSprite = sp;
    sheet('#sheet-done', true);
    $('#sd-ok').onclick = () => { sp.stop(); sheet('#sheet-done', false); mood(); };
  }

  function delivered(reward) {
    S.resetRoom();
    S.busy = true;
    CP.fx.confetti(S.fxEl, S.k, 40);
    S.sprite.play('eat', { onend: () => S.sprite.play('jump', { onend: () => { S.busy = false; refresh(); } }) });
    doneSheet('¡Entregado!', 'Disfruta tu premio' + (reward ? ' (' + reward.name + ')' : '') + '. Gracias por ser del parche.', 'sparkle');
    CP.impact($('#sheet-done .hero-spr'));
  }

  function expired() {
    S.sprite.play('sad', { loop: false, onend: mood });
    doneSheet('Se venció tu código', 'No pasa nada: tus puntos siguen ahí. Puedes volver a canjear cuando quieras.', 'sad');
    refresh({ keepAnim: true });
  }

  function levelUp(tier) {
    S.busy = true;
    setRoom(tier.id, true);
    CP.fx.confetti(S.fxEl, S.k, 50);
    S.sprite.play('jump', { onend: () => { S.busy = false; mood(); } });
    clearTimeout(S.levelTimer);
    S.levelTimer = setTimeout(() => doneSheet('¡Nivel nuevo!', 'Ahora eres ' + tier.name + '. Tu cuarto tiene una pared más.', 'sparkle'), 600);
  }

  // ------------------------------------------------------------------
  // Modo demo (?demo=1): simula lo que luego hará la lectura de ventas de Toteat
  // ------------------------------------------------------------------
  async function demoAction(kind) {
    if (kind === 'reset') { api.demo.reset(); logout(); return; }
    if (!S.phone) return;
    if (kind === 'expire') { await api.demo.expireSoon(S.phone, 7); refresh(); return; }
    let res;
    if (kind === 'sale') res = await api.demo.simulateSale(S.phone, { amount: 74000 });
    else if (kind === 'combo') res = await api.demo.simulateSale(S.phone, { amount: 90000, combos: 2 });
    else if (kind === 'tier') {
      const d = S.data;
      if (!d.next) return;
      res = await api.demo.grant(S.phone, d.next.remaining);
    }
    if (!res || !res.ok) return;
    await refresh({ keepAnim: true });
  }

  // ------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------
  async function init() {
    S.atlas = await CP.loadAtlas();
    buildStage();
    setRoom(1);

    const phoneIn = $('#phone');
    phoneIn.addEventListener('input', () => { phoneIn.value = fmtInput(phoneIn.value); });
    $('#login-form').addEventListener('submit', (e) => { e.preventDefault(); doLogin(phoneIn.value); });
    $('#btn-out').addEventListener('click', logout);
    $('#open-priv').addEventListener('click', () => sheet('#sheet-priv', true));
    $('#sp-ok').addEventListener('click', () => sheet('#sheet-priv', false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { sheet('#sheet-priv', false); if (!$('#sheet-done').hidden) $('#sd-ok').click(); }
    });
    window.addEventListener('focus', () => { if (S.phone && !S.busy) refresh({ keepAnim: true }); });

    if (DEMO) {
      $('#demo').hidden = false;
      const chips = $('#chips');
      chips.hidden = false;
      DEMO_PHONES.forEach(([p, label]) => {
        const c = mk('button', 'cl-chip', label);
        c.type = 'button';
        c.addEventListener('click', () => { phoneIn.value = fmtInput(p); doLogin(p); });
        chips.appendChild(c);
      });
      $('#demo').addEventListener('click', (e) => {
        const k = e.target && e.target.getAttribute && e.target.getAttribute('data-d');
        if (k) demoAction(k);
      });
    }

    showScreen('login');
    const saved = stored(KEY_PHONE);
    if (saved) {
      phoneIn.value = fmtInput(saved);
      await doLogin(saved, true);
    }
    if (!S.phone) S.sprite.play('wave', { loop: false, onend: () => S.sprite.play('idle', { loop: true }) });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.CPClub);
