// CP Club - API REAL: habla con el Worker (/api/club/*, /api/caja/*).
// Tiene la misma forma que mock-api.js (CPClub.api). Todavía NO está conectada
// a las páginas: se activa cuando el backend esté desplegado, cambiando el
// <script> de mock-api.js por este en index.html y caja/index.html.

window.CPClub = window.CPClub || {};

(function (CP) {
  'use strict';

  let lastPhone = null;   // el servidor exige el celular dueño del código para cancelarlo

  async function post(path, body, token) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    // En las rutas de caja va la autorización del dispositivo (se guarda al abrir el enlace de activación)
    if (path.startsWith('/api/caja/')) {
      try { const d = localStorage.getItem('cpclub-device'); if (d) headers['x-device'] = d; } catch (e) { /* sin almacenamiento */ }
    }
    try {
      const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
      const data = await res.json();
      return data && typeof data === 'object' ? data : { ok: false, error: 'respuesta' };
    } catch (e) {
      return { ok: false, error: 'red' };
    }
  }

  CP.httpApi = {
    mode: 'http',

    lookup(phone) { lastPhone = phone; return post('/api/club/lookup', { phone }); },
    reserve(phone, rewardId) { lastPhone = phone; return post('/api/club/reserve', { phone, rewardId }); },
    cancel(code) { return post('/api/club/cancel', { phone: lastPhone, code }); },
    codeStatus(code) { return post('/api/club/code-status', { code }); },
    setBirthday(phone, mmdd) { return post('/api/club/birthday', { phone, mmdd }); },

    staffLogin(pin) { return post('/api/caja/login', { pin }); },
    staffLookup(token, code) { return post('/api/caja/lookup', { code }, token); },
    staffDeliver(token, code) { return post('/api/caja/deliver', { code }, token); },
    staffCustomer(token, phone) { return post('/api/caja/customer', { phone }, token); },
    staffLog(token) { return post('/api/caja/log', {}, token); }
  };
})(window.CPClub);
