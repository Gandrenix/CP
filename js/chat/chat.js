// CP Chat - Orquestador. Une config + contexto + widget + UI y expone la API
// pública que usa el resto del sitio (window.CPChat.open / sendOrder):
//   - open():      abre el chat vacío (consulta).
//   - sendOrder(): valida, arma el mensaje del pedido y lo envía al chat.
// Ninguna otra parte del sitio sabe de LiveConnect.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const C = () => window.CPChat;
  let inited = false;

  function flag(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
  }

  function setFlag(key) {
    try { localStorage.setItem(key, '1'); } catch (e) {}
  }

  function whatsappUrl(message) {
    const text = message ? `&text=${encodeURIComponent(message)}` : '';
    return `https://api.whatsapp.com/send?phone=${C().config.fallbackWhatsApp}${text}`;
  }

  // Carga el widget (si hace falta) y lo muestra. Ante cualquier fallo se
  // ofrece WhatsApp en lugar de dejar al visitante sin salida.
  async function open() {
    const { ui, widget } = C();
    ui.hideFailure();
    if (widget.isReady()) {
      widget.show();
      return true;
    }
    ui.setLoading(true);
    try {
      await widget.load({ open: true });
      widget.show();
      return true;
    } catch (err) {
      ui.showFailure(whatsappUrl());
      return false;
    } finally {
      ui.setLoading(false);
    }
  }

  async function toggle() {
    const { widget } = C();
    if (widget.isReady()) widget.toggle();
    else await open();
  }

  // order: ver chat-context.js. Devuelve { ok, error? } para que quien llama
  // (el carrito) decida cómo avisar; no toca el DOM del carrito.
  async function sendOrder(order) {
    const { context, widget, ui } = C();
    const error = context.validateOrder(order);
    if (error) return { ok: false, error };

    const message = context.buildOrderMessage(order);
    ui.hideFailure();
    ui.setLoading(true);
    setFlag(C().config.storageKeys.started);
    try {
      const result = await widget.sendMessage(message);
      // Nombre y celular ya escritos en el carrito: el contacto llega
      // identificado sin pasar datos personales por la URL.
      if (result === 'sent') widget.identify({ userName: order.name, userPhone: order.phone });
      return { ok: true, message };
    } catch (err) {
      ui.showFailure(whatsappUrl(message));
      return { ok: false, error: 'No pudimos abrir el chat. Te dejamos WhatsApp como alternativa.' };
    } finally {
      ui.setLoading(false);
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    const { ui, widget, config } = C();

    ui.mount({ onOpen: open, onToggle: toggle });

    // El hero ya tiene su propia composición en la esquina inferior derecha
    // (el sello "Hecho para el antojo"); el botón entra cuando se sale de él.
    const hero = document.getElementById('hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        document.querySelector('[data-cpchat]').classList.toggle('is-over-hero', entry.intersectionRatio > 0.55);
      }, { threshold: [0, 0.55, 1] }).observe(hero);
    }

    widget.on('show', () => ui.setOpen(true));
    widget.on('hide', () => ui.setOpen(false));
    widget.on('unread_count', (n) => ui.setUnread(Number(n) || 0));

    const params = new URL(window.location.href).searchParams;
    const cameFromLink = params.has('lcmsg') || params.has('lcopen');

    if (cameFromLink) {
      // Llegó con un enlace de pedido (?lcmsg=...): el widget tiene que
      // arrancar ya para tomarlo, y la URL se limpia sola al estar listo.
      setFlag(config.storageKeys.started);
      widget.load({}).catch(() => ui.showFailure(whatsappUrl()));
    } else if (flag(config.storageKeys.started)) {
      // Ya chateó antes: se precarga en reposo para restaurar el contador.
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
      idle(() => widget.load({}).catch(() => {}));
    } else if (!flag(config.storageKeys.introSeen)) {
      setTimeout(() => ui.showBubble(), config.introBubbleDelayMs);
    }
  }

  window.CPChat.open = open;
  window.CPChat.sendOrder = sendOrder;
  window.CPChat.init = init;

  document.addEventListener('DOMContentLoaded', init);
})();
