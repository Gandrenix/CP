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
    if (widget.isPanelReady()) {
      widget.show();
      return true;
    }
    ui.setLoading(true);
    try {
      await widget.load();
      widget.show();
      if (!(await widget.whenPanelReady())) {
        widget.hide();
        ui.showFailure(whatsappUrl());
        return false;
      }
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
    if (widget.isPanelReady()) widget.toggle();
    else await open();
  }

  // order: ver chat-context.js. Devuelve { ok, error? } para que quien llama
  // (el carrito) decida cómo avisar; no toca el DOM del carrito.
  //   options.showCard=false: no mostrar el aviso flotante de WhatsApp (el
  //   carrito, que lo tapa, muestra su propio aviso con result.fallbackUrl).
  async function sendOrder(rawOrder, options = {}) {
    const showCard = options.showCard !== false;
    const { context, widget, ui } = C();
    const error = context.validateOrder(rawOrder);
    if (error) return { ok: false, error };

    // La identidad del cliente es su teléfono (normalizado), no el nombre.
    const order = Object.assign({}, rawOrder, {
      name: context.clean(rawOrder.name),
      phone: context.normalizePhone(rawOrder.phone)
    });

    const message = context.buildOrderMessage(order);
    ui.hideFailure();
    ui.setLoading(true);
    try {
      // Nombre y celular ya escritos en el carrito: el contacto llega
      // identificado (antes del mensaje, para que nazca con su nombre) y sin
      // pasar datos personales por la URL.
      await widget.load();
      widget.identify({ userName: order.name, userPhone: order.phone });
      const how = await widget.sendMessage(message);
      // Solo se da por entregado si la conversación nueva apareció: si no
      // (dominio no autorizado en el canal, bloqueador, sin red) el pedido pudo
      // perderse, y mejor avisar y ofrecer WhatsApp que mentir.
      if (how === 'unconfirmed') {
        // El panel que no pudo arrancar queda abierto (en blanco) encima de
        // todo y taparía el aviso: se cierra para que se vea la alternativa.
        widget.hide();
        if (showCard) ui.showFailure(whatsappUrl(message));
        return {
          ok: false,
          fallbackUrl: whatsappUrl(message),
          error: 'No pudimos confirmar que el chat recibió tu pedido. Envíalo por WhatsApp y te atendemos igual.'
        };
      }
      setFlag(C().config.storageKeys.started);
      C().customer.save({ name: order.name, phone: rawOrder.phone, address: rawOrder.address });
      return { ok: true, message };
    } catch (err) {
      widget.hide();
      if (showCard) ui.showFailure(whatsappUrl(message));
      return {
        ok: false,
        fallbackUrl: whatsappUrl(message),
        error: 'No pudimos abrir el chat. Envíalo por WhatsApp y te atendemos igual.'
      };
    } finally {
      ui.setLoading(false);
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    const { ui, widget, config } = C();

    // onWarm: el cursor/dedo se acercó al botón, así que se adelanta la carga
    // del widget y el clic lo encuentra casi listo (sin abrirlo todavía).
    ui.mount({ onOpen: open, onToggle: toggle, onWarm: () => widget.load().catch(() => {}) });

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
      widget.load().catch(() => ui.showFailure(whatsappUrl()));
    } else if (flag(config.storageKeys.started)) {
      // Ya chateó antes: se precarga en reposo para restaurar el contador.
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
      idle(() => widget.load().catch(() => {}));
    } else if (!flag(config.storageKeys.introSeen)) {
      setTimeout(() => ui.showBubble(), config.introBubbleDelayMs);
    }
  }

  window.CPChat.open = open;
  window.CPChat.sendOrder = sendOrder;
  window.CPChat.init = init;

  document.addEventListener('DOMContentLoaded', init);
})();
