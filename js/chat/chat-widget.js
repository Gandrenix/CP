// CP Chat - Puente con el widget de LiveConnect (window.LiveConnect). Es la
// ÚNICA pieza que sabe cómo carga el widget y cómo se le habla; la UI y el
// orquestador solo ven load() / show() / sendMessage() / on().
//
// Por qué el widget web y no el proxy de la API REST: el proxy desvía los
// mensajes a un servidor propio y los empleados dejarían de verlos en su
// bandeja de LiveConnect. El widget los deja justo donde ya trabajan, y no
// necesita ningún secreto en el navegador (los visitantes son anónimos a
// propósito).
//
// Enviar un pedido: el widget expone showNewMessage({ texto }), la misma
// función que usa internamente el enlace  ?lcopen=1&lcmsg=<texto>  (ver
// pestaña "Enlaces" del canal). Abre el chat y envía el texto como primer
// mensaje, sin recargar la página. Si una versión futura del widget la
// quitara, se cae al enlace con ?lcmsg (recarga la página, pero el pedido
// llega igual).
//
// Limitación de LiveConnect que este módulo resuelve: si el visitante ya
// tiene una conversación ABIERTA, showNewMessage solo abre esa conversación y
// DESCARTA el texto. Por eso antes de enviar un pedido se detecta esa
// situación (el widget guarda las conversaciones en localStorage, "lc:<canal>")
// y se le hace shutdown() para que el pedido arranque una conversación nueva;
// y la entrega se confirma viendo aparecer la conversación nueva en esa lista.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const cfg = () => window.CPChat.config;
  const listeners = {};          // evento -> [fn], para suscribirse antes de que cargue
  let loadPromise = null;
  let panelReady = false;        // el panel de conversación ya se abrió una vez

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

  // Inserta widget.js una sola vez. Resuelve cuando window.LiveConnect ya
  // responde (no hace falta esperar al panel: LiveConnect lo crea recién al
  // abrirlo). Si el widget arranca desde un enlace ?lcmsg=..., él mismo lee el
  // mensaje y limpia la URL.
  function load() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      if (lc()) {
        attachListeners();
        resolve();
        return;
      }

      const fail = (reason) => {
        clearTimeout(timer);
        loadPromise = null;
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail('timeout'), cfg().loadTimeoutMs);

      const script = document.createElement('script');
      script.src = cfg().widgetSrc;
      script.async = true;
      script.dataset.canalKey = cfg().channelKey;
      script.onerror = () => fail('script-error');
      script.onload = () => {
        // El script define window.LiveConnect al ejecutarse; la espera corta
        // cubre el caso (raro) de que lo defina un instante después.
        const poll = setInterval(() => {
          if (!lc()) return;
          clearInterval(poll);
          clearTimeout(timer);
          on('ready', () => { panelReady = true; });
          attachListeners();
          resolve();
        }, 20);
      };
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  // Resuelve true cuando el panel abierto está listo (el evento "ready" llega
  // recién cuando se abre por primera vez) y false si no llegó a tiempo. Un
  // false significa que el panel no pudo arrancar (dominio no autorizado en el
  // canal, bloqueador, sin red): quien llama no debe dar por entregado nada.
  function whenPanelReady(maxMs) {
    if (panelReady) return Promise.resolve(true);
    return new Promise((resolve) => {
      let finished = false;
      const finish = (ok) => { if (!finished) { finished = true; resolve(ok); } };
      on('ready', () => finish(true));
      setTimeout(() => finish(panelReady), maxMs || cfg().panelTimeoutMs);
    });
  }

  // Conversaciones del visitante que el widget guarda en localStorage
  // ("lc:<canal>" -> convs: [{ id, finished, ... }]). Solo lectura.
  function storedConvs() {
    try {
      const state = JSON.parse(localStorage.getItem('lc:' + cfg().channelKey) || '{}');
      return Array.isArray(state.convs) ? state.convs : [];
    } catch (err) {
      return [];
    }
  }

  const hasOpenConversation = () => storedConvs().some((c) => c && !c.finished);

  // Espera a que aparezca en la lista una conversación que no estaba en
  // `before` (= el pedido creó una conversación nueva). false si no llega.
  function waitForNewConversation(before, maxMs) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = setInterval(() => {
        if (storedConvs().some((c) => c && c.id && !before.has(c.id))) {
          clearInterval(tick);
          resolve(true);
        } else if (Date.now() - started >= maxMs) {
          clearInterval(tick);
          resolve(false);
        }
      }, 150);
    });
  }

  // Arranca una conversación nueva con el mensaje ya enviado. Devuelve:
  //   'delivered'   - la conversación nueva apareció (entrega confirmada)
  //   'unconfirmed' - se envió pero no se pudo confirmar a tiempo
  //   'navigating'  - respaldo por enlace (recarga la página)
  async function sendMessage(message, maxMs) {
    await load();
    const api = lc();
    if (!api || typeof api.showNewMessage !== 'function') {
      window.location.assign(urlWithMessage(message).toString());
      return 'navigating';
    }

    // Con una conversación abierta el texto se perdería: se olvida la sesión
    // del visitante para que el pedido abra una conversación nueva. El
    // historial no se pierde: sigue en la bandeja de LiveConnect.
    // shutdown() también borra el identificador del visitante; se guarda y se
    // devuelve para que el pedido siga siendo de la MISMA persona (mismo
    // visitante, mismo contacto) y no de un "Nuevo Visitante".
    if (hasOpenConversation() && typeof api.shutdown === 'function') {
      const visitorKey = 'liveconnect-visitor-' + cfg().channelKey;
      let visitorId = null;
      try { visitorId = localStorage.getItem(visitorKey); } catch (err) {}
      api.shutdown({ clear_local_cache: true });
      if (visitorId) {
        try { localStorage.setItem(visitorKey, visitorId); } catch (err) {}
      }
      panelReady = false;
    }

    const before = new Set(storedConvs().map((c) => c && c.id));
    api.showNewMessage({ texto: message });
    return (await waitForNewConversation(before, maxMs || cfg().sendTimeoutMs)) ? 'delivered' : 'unconfirmed';
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
    whenPanelReady,
    isLoaded: () => !!lc(),
    isPanelReady: () => panelReady,
    show: () => call('show'),
    hide: () => call('hide'),
    toggle: () => call('toggle'),
    // Nombre/celular que el cliente ya escribió en el carrito: así el contacto
    // llega identificado sin pedirle nada más (y sin pasarlos por la URL).
    identify: (data) => call('update', data),
    setUnread: (n) => call('setUnread', n)
  });
})();
