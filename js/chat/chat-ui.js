// CP Chat - Interfaz propia de la marca alrededor del widget: botón flotante
// con la carita, contador de no leídos, burbuja de invitación y aviso de
// respaldo por WhatsApp. El panel de conversación en sí lo pinta LiveConnect
// (en el canal debe estar activo "Ocultar el widget" para que solo se vea
// este botón). Sin dependencias: DOM puro, textos desde config.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const SMILEY_SRC = 'assets/img/icon-smiley-cream.svg';

  let els = null;
  let state = { unread: 0, open: false, bubbleShown: false };

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function mount(handlers) {
    if (els) return els;
    const L = window.CPChat.config.labels;

    const root = el('div', 'cpchat');
    root.setAttribute('data-cpchat', '');

    const bubble = el('div', 'cpchat-bubble',
      '<button class="cpchat-bubble-close" type="button" aria-label="Cerrar aviso">&times;</button>' +
      `<strong>${L.bubbleTitle}</strong><span>${L.bubbleText}</span>`);
    bubble.hidden = true;
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('.cpchat-bubble-close')) {
        hideBubble(true);
        return;
      }
      hideBubble(true);
      handlers.onOpen();
    });

    const fail = el('div', 'cpchat-fail', '');
    fail.hidden = true;
    fail.setAttribute('role', 'alert');

    const launcher = el('button', 'cpchat-launcher',
      `<span class="cpchat-launcher-icon"><img src="${SMILEY_SRC}" alt="" width="30" height="30"></span>` +
      `<span class="cpchat-launcher-text">${L.launcher}</span>` +
      '<span class="cpchat-badge" hidden>0</span>');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', L.launcher);
    launcher.addEventListener('click', () => {
      hideBubble(true);
      handlers.onToggle();
    });

    root.append(bubble, fail, launcher);
    document.body.appendChild(root);
    els = { root, bubble, fail, launcher, badge: launcher.querySelector('.cpchat-badge') };
    return els;
  }

  function setLoading(on) {
    if (!els) return;
    els.launcher.classList.toggle('is-loading', !!on);
    els.launcher.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function setOpen(open) {
    state.open = open;
    if (els) els.launcher.classList.toggle('is-open', open);
  }

  function setUnread(n) {
    state.unread = n;
    if (!els) return;
    els.badge.hidden = !n;
    els.badge.textContent = n > 9 ? '9+' : String(n);
    els.launcher.classList.toggle('has-unread', !!n);
  }

  function showBubble() {
    if (!els || state.bubbleShown || state.open) return;
    state.bubbleShown = true;
    els.bubble.hidden = false;
  }

  function hideBubble(remember) {
    if (!els) return;
    els.bubble.hidden = true;
    if (remember) {
      try { localStorage.setItem(window.CPChat.config.storageKeys.introSeen, '1'); } catch (e) {}
    }
  }

  // Respaldo: el chat no cargó. Se ofrece WhatsApp con el mismo texto, para
  // que un pedido nunca se pierda por un bloqueador o por estar sin red.
  function showFailure(whatsappUrl) {
    if (!els) return;
    const L = window.CPChat.config.labels;
    els.fail.innerHTML =
      '<button class="cpchat-fail-close" type="button" aria-label="Cerrar">&times;</button>' +
      `<strong>${L.failTitle}</strong><span>${L.failText}</span>` +
      `<a class="cpchat-fail-cta" href="${whatsappUrl}" target="_blank" rel="noopener">${L.failCta}</a>`;
    els.fail.hidden = false;
    els.fail.querySelector('.cpchat-fail-close').addEventListener('click', () => { els.fail.hidden = true; });
    setLoading(false);
  }

  function hideFailure() {
    if (els) els.fail.hidden = true;
  }

  window.CPChat.ui = Object.freeze({
    mount, setLoading, setOpen, setUnread, showBubble, hideBubble, showFailure, hideFailure
  });
})();
