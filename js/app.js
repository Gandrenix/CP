// Cuatro Paredes - Controlador Principal de la Aplicación

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMenuTabs();
  initCPWorldInteractions();
  initModals();
  initArcadeGame();
  initOrderPanel();
  initHeroParallax();
  initGridParallax();
});

// 0. Parallax multicapa del Hero: la foto de fondo y la hamburguesa
// flotante se mueven a distinta velocidad con el mouse (profundidad),
// más un desplazamiento sutil por scroll que funciona en cualquier
// dispositivo, incluido táctil (donde el mousemove simplemente no ocurre).
function initHeroParallax() {
  const heroSection = document.getElementById('hero');
  const sceneBg = document.getElementById('heroSceneBg');
  const cutout = document.getElementById('heroBurgerCutout');
  if (!heroSection || !sceneBg || !cutout) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let scrollOffset = 0;
  let pointerX = 0;
  let pointerY = 0;
  let ticking = false;

  function apply() {
    sceneBg.style.transform = `translate3d(${pointerX * 10}px, ${(pointerY * 6) + (scrollOffset * 0.3)}px, 0) scale(1.06)`;
    cutout.style.transform = `translate3d(${pointerX * -26}px, ${(pointerY * -18) + (scrollOffset * -0.15)}px, 0)`;
    ticking = false;
  }

  function requestApply() {
    if (!ticking) {
      requestAnimationFrame(apply);
      ticking = true;
    }
  }

  function onScroll() {
    const rect = heroSection.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      scrollOffset = Math.min(Math.max(rect.top * -0.04, -18), 18);
      requestApply();
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  if (window.matchMedia('(pointer: fine)').matches) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      requestApply();
    });

    heroSection.addEventListener('mouseleave', () => {
      pointerX = 0;
      pointerY = 0;
      requestApply();
    });
  }

  apply();
}

// 0.1 Cuadrícula roja de fondo: se desplaza a una fracción de la velocidad
// del scroll (parallax clásico) para dar sensación de profundidad en las
// secciones de fondo plano. Un solo scroll listener mueve una custom
// property en :root que todas las secciones leen (--grid-shift), en vez
// de recalcular estilos por sección.
function initGridParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const CELL = 84;
  const root = document.documentElement;
  let ticking = false;

  function update() {
    const shift = (window.scrollY * 0.15) % CELL;
    root.style.setProperty('--grid-shift', `${shift}px`);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

// 1. Barra de Navegación y Scroll Suave
function initNavbar() {
  const header = document.querySelector('.site-header');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mobileMenu = document.getElementById('mobileNavDrawer');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
          const headerHeight = header.offsetHeight;
          const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - headerHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          if (mobileMenu && mobileMenu.classList.contains('open')) {
            mobileMenu.classList.remove('open');
          }
        }
      }
    });
  });

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
  }
}

// 2. Pestañas de Menú (Panel 2)
let currentMenuCategory = 'burgers';

function initMenuTabs() {
  const categoryBtns = document.querySelectorAll('.menu-cat-btn');
  const menuContainer = document.getElementById('menuItemsContainer');

  function renderCategory(catKey) {
    const items = MENU_DATA[catKey] || [];
    if (!menuContainer) return;

    menuContainer.innerHTML = items.map(item => `
      <div class="menu-item-row" data-id="${item.id}">
        <div class="menu-item-media${item.mediaFit === 'contain' ? ' menu-item-media--icon' : ''}">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
          ${item.tag ? `<span class="menu-item-badge${item.tag === 'NUEVA' ? ' tag-teal' : ''}">${item.tag}</span>` : ''}
        </div>
        <div class="menu-item-details">
          <div class="menu-item-header">
            <h3 class="menu-item-name">${item.name}</h3>
            <span class="menu-item-price">${window.cpCart ? window.cpCart.formatMoney(item.price) : `$${item.price}`}</span>
          </div>
          <p class="menu-item-desc">${item.description}</p>
          ${item.comboNote ? `<p class="menu-item-combo-note">${item.comboNote}</p>` : ''}
          <button class="menu-item-order-link" onclick="handleMenuOrder('${catKey}', '${item.id}')">
            PEDIR <span>&rarr;</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentMenuCategory = e.currentTarget.getAttribute('data-cat');
      renderCategory(currentMenuCategory);
    });
  });

  // Render inicial
  renderCategory('burgers');
}

function handleMenuOrder(catKey, itemId) {
  const items = MENU_DATA[catKey];
  const item = items.find(i => i.id === itemId);
  if (item && window.cpCart) {
    window.cpCart.addItem(item);
    window.cpCart.openCart();
  }
}

// 3. Panel Pedir (Panel 4) - Selección rápida
function initOrderPanel() {
  const continueBtn = document.getElementById('pedirContinueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      if (window.cpCart) {
        // Desplazarse al menú o abrir carrito
        const menuSection = document.getElementById('menu');
        if (menuSection) {
          const header = document.querySelector('.site-header');
          const headerHeight = header ? header.offsetHeight : 70;
          const pos = menuSection.getBoundingClientRect().top + window.pageYOffset - headerHeight;
          window.scrollTo({ top: pos, behavior: 'smooth' });
        }
        window.cpCart.showToast(`Configuración: ${window.cpCart.city} • ${window.cpCart.mode}`);
      }
    });
  }
}

// 4. Interacciones de CP World (Panel 6)
function initCPWorldInteractions() {
  document.querySelectorAll('[data-world-action]').forEach(card => {
    card.addEventListener('click', (e) => {
      const action = e.currentTarget.getAttribute('data-world-action');
      if (action === 'eventos') {
        scrollToSection('#eventos');
      } else if (action === 'jim-pluk') {
        openModal('colabPlukModal');
      } else if (action === 'burger-dealers') {
        openModal('dealersModal');
      } else if (action === 'merch') {
        openModal('merchModal');
      } else if (action === 'objetos') {
        openModal('objetosModal');
      } else if (action === 'juegos') {
        openModal('arcadeModal');
      }
    });
  });
}

function scrollToSection(selector) {
  const el = document.querySelector(selector);
  if (el) {
    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.offsetHeight : 70;
    const pos = el.getBoundingClientRect().top + window.pageYOffset - headerHeight;
    window.scrollTo({ top: pos, behavior: 'smooth' });
  }
}

// 5. Sistema de Modales Unificado
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function initModals() {
  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.currentTarget.closest('.cp-modal');
      if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });

  document.querySelectorAll('.cp-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });

  // Modal Cómo Llegar (Las Casas)
  document.querySelectorAll('[data-store-map]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const store = e.currentTarget.getAttribute('data-store-map');
      openStoreMapModal(store);
    });
  });

  // Modal RSVP Eventos
  document.querySelectorAll('[data-event-rsvp]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.getAttribute('data-event-rsvp');
      openEventRSVPModal(eventId);
    });
  });
}

function openStoreMapModal(store) {
  const title = document.getElementById('mapModalTitle');
  const address = document.getElementById('mapModalAddress');
  const hours = document.getElementById('mapModalHours');
  const link = document.getElementById('mapModalExternalLink');

  if (title) title.textContent = 'CUATRO PAREDES • BUCARAMANGA';
  if (address) address.textContent = 'Cra 35 #37-46, El Prado, San Gil plaza, Local 431, Bucaramanga.';
  if (hours) hours.textContent = 'Martes a Domingo: 12:00 p.m. - 10:00 p.m.';
  if (link) link.href = 'https://maps.google.com/?q=Cra+35+37-46+Bucaramanga';

  openModal('storeMapModal');

  if (window.showStoreOnMap) {
    window.showStoreOnMap('bucaramanga');
  }
}

function openEventRSVPModal(eventId) {
  const event = EVENTS_DATA.find(ev => ev.id === eventId) || EVENTS_DATA[0];
  const title = document.getElementById('eventRsvpTitle');
  const info = document.getElementById('eventRsvpInfo');
  if (title) title.textContent = event.title;
  if (info) info.textContent = `${event.date} • ${event.time} • ${event.location}`;
  openModal('eventModal');
}

// 6. Minijuego Arcade: "CP Burger Breaker" (js/game/*.js)
// Los archivos del juego pesan ~lo suficiente como para no cargarlos si
// nadie va a jugar: se inyectan la primera vez que se abre el modal, y la
// instancia se crea/destruye con cada apertura/cierre para no dejar loops
// de requestAnimationFrame corriendo de fondo con el modal cerrado.
let cpArcadeInstance = null;
let cpArcadeScriptsPromise = null;

function loadArcadeScripts() {
  if (cpArcadeScriptsPromise) return cpArcadeScriptsPromise;
  const sources = window.CP_GAME_SCRIPTS || [];
  cpArcadeScriptsPromise = sources.reduce((chain, src) => {
    return chain.then(() => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    }));
  }, Promise.resolve());
  return cpArcadeScriptsPromise;
}

function initArcadeGame() {
  const arcadeModal = document.getElementById('arcadeModal');
  const openTrigger = document.querySelector('[data-world-action="juegos"]');
  if (!arcadeModal || !openTrigger) return;

  openTrigger.addEventListener('click', () => {
    loadArcadeScripts().then(startArcadeInstance).catch(err => {
      console.error('No se pudo cargar CP Burger Breaker', err);
    });
  });

  // Si cierran el modal (X, click afuera, o Escape ya manejado por el
  // navegador para fullscreen) destruimos la instancia: para el loop de
  // render, quita listeners de input y de ResizeObserver.
  arcadeModal.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', destroyArcadeInstance);
  });
  arcadeModal.addEventListener('click', (e) => {
    if (e.target === arcadeModal) destroyArcadeInstance();
  });
}

function startArcadeInstance() {
  if (cpArcadeInstance) return; // ya corriendo
  const canvas = document.getElementById('arcadeCanvas');
  const shell = document.getElementById('gameShell');
  const canvasWrap = document.querySelector('.game-canvas-wrap');
  if (!canvas || !shell || !canvasWrap || !window.CPGame || !window.CPGame.BurgerBreaker) return;

  cpArcadeInstance = new window.CPGame.BurgerBreaker({
    canvas, canvasWrap, shell, hudRoot: shell, primaryBtn: document.getElementById('startArcadeBtn')
  });
}

function destroyArcadeInstance() {
  if (cpArcadeInstance) {
    cpArcadeInstance.destroy();
    cpArcadeInstance = null;
  }
}
