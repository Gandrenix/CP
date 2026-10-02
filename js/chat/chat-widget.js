// CP Chat - Puente con el widget de LiveConnect (window.LiveConnect). Es la
// ÚNICA pieza que sabe cómo carga el widget y cómo se le habla; la UI y el
// orquestador solo ven load() / show() / sendMessage() / on().
//
// Por qué así y no con el proxy de la API REST: el proxy desvía los mensajes
// a un servidor propio y los empleados dejarían de verlos en su bandeja de
// LiveConnect. El widget web los deja justo donde ya trabajan, y no necesita
// ningún secreto en el navegador (los visitantes son anónimos a propósito).
//
// El widget NO tiene una función "enviar mensaje" en su API de JavaScript;
// la forma documentada de arrancar una conversación con texto ya enviado es
// el enlace  ?lcopen=1&lcmsg=<texto>  (ver pestaña "Enlaces" del canal). Por
// eso: si el widget aún no cargó, se pone el parámetro en la URL justo antes
// de insertar el script (sin recargar la página) y se limpia al estar listo;
// si ya estaba cargado, hay que navegar al enlace.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const cfg = () => window.CPChat.config;
  const listeners = {};          // evento -> [fn], para suscribirse antes de que cargue
  let loadPromise = null;
  let ready = false;

  function lc() {
    return window.LiveConnect && typeof window.LiveConnect.on === 'function' ? window.LiveConnect : null;
  }

  function attachListeners() {
    const api = lc();
    if (!api) return;
    Object.keys(listeners).forEach((evt) => {
      listeners[evt].forEach((fn) => {
        if (!fn.__attached) {
          api.on(evt, fn);
          fn.__attached = true;
        }
      });
    });
  }

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    attachListeners();
  }

  function urlWithMessage(message) {
    const url = new URL(window.location.href);
    url.searchParams.set('lcopen', '1');
    if (message) url.searchParams.set('lcmsg', message);
    return url;
  }

  function cleanUrl() {
    const url = new URL(window.location.href);
    ['lcopen', 'lcmsg', 'lcname', 'lcmail', 'lctel', 'lcuid', 'lcjwt', 'lcteam'].forEach((k) => url.searchParams.delete(k));
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  }

  // Inserta widget.js una sola vez. `message` (opcional) viaja en la URL solo
  // mientras el widget arranca, y se borra apenas está listo.
  function load(options = {}) {
    if (loadPromise) return loadPromise;
    const { message = '', open = false } = options;
    const q = new URL(window.location.href).searchParams;
    const hadParams = q.has('lcmsg') || q.has('lcopen');

    if (message || open) {
      const u = urlWithMessage(message);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }

    loadPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        loadPromise = null;
        reject(new Error('timeout'));
      }, cfg().loadTimeoutMs);

      const done = () => {
        if (ready) return;
        ready = true;
        clearTimeout(timer);
        attachListeners();
        if (message || open || hadParams) cleanUrl();
        resolve();
      };

      const script = document.createElement('script');
      script.src = cfg().widgetSrc;
      script.async = true;
      script.dataset.canalKey = cfg().channelKey;
      script.onerror = () => {
        clearTimeout(timer);
        loadPromise = null;
        if (message || open) cleanUrl();
        reject(new Error('script-error'));
      };
      script.onload = () => {
        // El script define window.LiveConnect; "ready" avisa que el panel
        // acepta órdenes. Si ya se emitió antes de suscribirnos, la espera
        // corta de abajo evita quedarnos colgados.
        const poll = setInterval(() => {
          const api = lc();
          if (!api) return;
          clearInterval(poll);
          api.on('ready', done);
          setTimeout(done, 1500);
        }, 50);
      };
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  // Arranca una conversación con un mensaje ya enviado. Devuelve 'sent'
  // cuando el widget lo toma del enlace, o 'navigating' si hubo que navegar
  // (widget ya cargado: es la única vía documentada).
  async function sendMessage(message) {
    if (ready) {
      window.location.assign(urlWithMessage(message).toString());
      return 'navigating';
    }
    await load({ message, open: true });
    return 'sent';
  }

  function call(method, ...args) {
    const api = lc();
    if (api && typeof api[method] === 'function') return api[method](...args);
    return undefined;
  }

  window.CPChat.widget = Object.freeze({
    load,
    on,
    sendMessage,
    isReady: () => ready,
    show: () => call('show'),
    hide: () => call('hide'),
    toggle: () => call('toggle'),
    // Nombre/celular que el cliente ya escribió en el carrito: así el contacto
    // llega identificado sin pedirle nada más (y sin pasarlos por la URL).
    identify: (data) => call('update', data),
    setUnread: (n) => call('setUnread', n),
    cleanUrl
  });
})();
