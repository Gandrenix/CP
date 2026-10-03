// CP Chat - Interfaz propia de la marca alrededor del widget: botón flotante
// pixel-art con la carita, contador de no leídos, burbuja de invitación y
// aviso de respaldo por WhatsApp. El panel de conversación en sí lo pinta
// LiveConnect (en el canal debe estar activo "Ocultar el widget" para que
// solo se vea este botón). Sin dependencias: DOM puro, textos desde config.
//
// Los sprites son mapas de caracteres que se convierten en <rect> de SVG con
// bordes duros (shape-rendering: crispEdges): cero imágenes que descargar.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  // Carita de la marca (solo contorno, como el ícono del sitio). "e" = ojos.
  const SMILEY = [
    '...OOOOOO...',
    '..OO....OO..',
    '.OO......OO.',
    '.O.ee..ee.O.',
    '.O.ee..ee.O.',
    'O..........O',
    'O.O......O.O',
    'O..O....O..O',
    '.O..OOOO..O.',
    '.OO......OO.',
    '..OO....OO..',
    '...OOOOOO...'
  ];
  const SMILEY_PALETTE = { O: 'var(--cp-cream)', e: ['var(--cp-cream)', 'cpchat-eye'] };

  // Burger pixel-art para la burbuja.
  const BURGER = [
    '....KKKKKK....',
    '..KKBBSBBBKK..',
    '.KBBBBBBSBBBK.',
    '.KBSBBBBBBBBK.',
    'KKKKKKKKKKKKKK',
    'KLLLLLLLLLLLLK',
    'KCCCCCCCCCCCCK',
    'KPPPPPPPPPPPPK',
    'KPPPPPPPPPPPPK',
    '.KUUUUUUUUUUK.',
    '..KKKKKKKKKK..'
  ];
  const BURGER_PALETTE = {
    K: '#111111', B: '#F2A541', S: '#FFE3A3', L: '#8FC6C7',
    C: '#FFD23F', P: '#6B3A22', U: '#E58F2A'
  };

  let els = null;
  let state = { unread: 0, open: false, bubbleShown: false, typer: null, warmed: false };

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  // Convierte un mapa de caracteres en un SVG de píxeles. Los píxeles
  // contiguos de un mismo color se fusionan en un solo <rect> (SVG liviano).
  function sprite(rows, palette, px, cls) {
    const w = rows[0].length;
    let rects = '';
    rows.forEach((row, y) => {
      let x = 0;
      while (x < w) {
        const ch = row[x];
        const entry = palette[ch];
        if (!entry) { x++; continue; }
        let run = 1;
        while (x + run < w && row[x + run] === ch) run++;
        const fill = Array.isArray(entry) ? entry[0] : entry;
        const klass = Array.isArray(entry) ? ` class="${entry[1]}"` : '';
        rects += `<rect x="${x}" y="${y}" width="${run}" height="1"${klass} style="fill:${fill}"/>`;
        x += run;
      }
    });
    return `<svg class="${cls}" viewBox="0 0 ${w} ${rows.length}" width="${w * px}" height="${rows.length * px}" ` +
      `shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  }

  function mount(handlers) {
    if (els) return els;
    const L = window.CPChat.config.labels;

    const root = el('div', 'cpchat');
    root.setAttribute('data-cpchat', '');

    const bubble = el('div', 'cpchat-bubble cpchat-dialog',
      '<button class="cpchat-x" type="button" aria-label="Cerrar aviso">&times;</button>' +
      `<span class="cpchat-bubble-burger">${sprite(BURGER, BURGER_PALETTE, 3, 'cpchat-burger')}</span>` +
      '<div class="cpchat-dialog-body">' +
        `<strong>${L.bubbleTitle}</strong>` +
        `<span class="cpchat-bubble-text"><span class="cpchat-ghost">${L.bubbleText}</span><span class="cpchat-typed"></span></span>` +
      '</div>' +
      '<i class="cpchat-caret" aria-hidden="true"></i>' +
      '<span class="cpchat-tail" aria-hidden="true"></span>');
    bubble.hidden = true;
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('.cpchat-x')) {
        hideBubble(true);
        return;
      }
      hideBubble(true);
      handlers.onOpen();
    });
    bubble.addEventListener('pointerenter', warm, { once: true });

    const fail = el('div', 'cpchat-fail cpchat-dialog', '');
    fail.hidden = true;
    fail.setAttribute('role', 'alert');

    const launcher = el('button', 'cpchat-launcher',
      '<span class="cpchat-launcher-face">' +
        `<span class="cpchat-launcher-icon">${sprite(SMILEY, SMILEY_PALETTE, 3, 'cpchat-smiley')}</span>` +
        `<span class="cpchat-launcher-text">${L.launcher}</span>` +
      '</span>' +
      '<span class="cpchat-spark cpchat-spark-a" aria-hidden="true"></span>' +
      '<span class="cpchat-spark cpchat-spark-b" aria-hidden="true"></span>' +
      '<span class="cpchat-badge" hidden>0</span>');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', L.launcher);
    launcher.addEventListener('click', () => {
      hideBubble(true);
      handlers.onToggle();
    });

    // Pedir el chat "por adelantado": cuando el cursor o el dedo se acercan al
    // botón se calienta la conexión, así el clic encuentra el chat casi listo.
    function warm() {
      if (state.warmed) return;
      state.warmed = true;
      if (handlers.onWarm) handlers.onWarm();
    }
    launcher.addEventListener('pointerenter', warm);
    launcher.addEventListener('focus', warm);
    launcher.addEventListener('touchstart', warm, { passive: true });

    // Inclinación 3D siguiendo el cursor (solo con mouse; en táctil no aplica).
    const fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (fine && !reduce) {
      launcher.addEventListener('pointermove', (e) => {
        const r = launcher.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        launcher.style.setProperty('--ry', `${(nx * 14).toFixed(1)}deg`);
        launcher.style.setProperty('--rx', `${(-ny * 12).toFixed(1)}deg`);
      });
      launcher.addEventListener('pointerleave', () => {
        launcher.style.removeProperty('--ry');
        launcher.style.removeProperty('--rx');
      });
    }

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
    if (els) {
      els.launcher.classList.toggle('is-open', open);
      // El panel de LiveConnect se abre justo encima del botón: mientras está
      // abierto el botón se esconde (el panel trae su propia X para cerrar).
      els.root.classList.toggle('is-chat-open', open);
    }
  }

  function setUnread(n) {
    state.unread = n;
    if (!els) return;
    els.badge.hidden = !n;
    els.badge.textContent = n > 9 ? '9+' : String(n);
    els.launcher.classList.toggle('has-unread', !!n);
  }

  // La burbuja "escribe" su mensaje letra por letra, como un diálogo de
  // videojuego. El texto completo ya está en el DOM (invisible) para que la
  // caja no cambie de tamaño mientras se escribe ni se pierda para lectores
  // de pantalla.
  function typeInto(target, text) {
    clearInterval(state.typer);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { target.textContent = text; return; }
    let i = 0;
    target.textContent = '';
    state.typer = setInterval(() => {
      i++;
      target.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(state.typer);
    }, 28);
  }

  function showBubble() {
    if (!els || state.bubbleShown || state.open) return;
    state.bubbleShown = true;
    els.bubble.hidden = false;
    typeInto(els.bubble.querySelector('.cpchat-typed'), window.CPChat.config.labels.bubbleText);
  }

  function hideBubble(remember) {
    if (!els) return;
    clearInterval(state.typer);
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
      '<button class="cpchat-x" type="button" aria-label="Cerrar">&times;</button>' +
      '<div class="cpchat-dialog-body">' +
        `<strong>${L.failTitle}</strong><span>${L.failText}</span>` +
        `<a class="cpchat-fail-cta" href="${whatsappUrl}" target="_blank" rel="noopener"><span>${L.failCta}</span></a>` +
      '</div>' +
      '<span class="cpchat-tail" aria-hidden="true"></span>';
    els.fail.hidden = false;
    els.root.classList.add('has-fail');
    els.fail.querySelector('.cpchat-x').addEventListener('click', hideFailure);
    setLoading(false);
  }

  function hideFailure() {
    if (!els) return;
    els.fail.hidden = true;
    els.root.classList.remove('has-fail');
  }

  window.CPChat.ui = Object.freeze({
    mount, setLoading, setOpen, setUnread, showBubble, hideBubble, showFailure, hideFailure
  });
})();
