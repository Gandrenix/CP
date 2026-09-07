// Cuatro Paredes - Controlador Principal de la Aplicación

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMenuTabs();
  initCPWorldInteractions();
  initModals();
  initArcadeGame();
  initOrderPanel();
});

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
        <div class="menu-item-media">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
          ${item.tag ? `<span class="menu-item-badge">${item.tag}</span>` : ''}
        </div>
        <div class="menu-item-details">
          <div class="menu-item-header">
            <h3 class="menu-item-name">${item.name}</h3>
            <span class="menu-item-price">${window.cpCart ? window.cpCart.formatMoney(item.price) : `$${item.price}`}</span>
          </div>
          <p class="menu-item-desc">${item.description}</p>
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
      } else if (action === 'colabs') {
        scrollToSection('#colaboraciones');
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

  if (store === 'bucaramanga') {
    if (title) title.textContent = 'CUATRO PAREDES • BUCARAMANGA';
    if (address) address.textContent = 'Cra 35 #37-46, El Prado, San Gil plaza, Local 431, Bucaramanga.';
    if (hours) hours.textContent = 'Martes a Domingo: 12:00 p.m. - 10:00 p.m.';
    if (link) link.href = 'https://maps.google.com/?q=Cra+35+37-46+Bucaramanga';
  } else {
    if (title) title.textContent = 'CUATRO PAREDES • SAN GIL';
    if (address) address.textContent = 'Cra 10 #10-62, Centro Histórico, San Gil, Santander.';
    if (hours) hours.textContent = 'Martes a Domingo: 12:00 p.m. - 10:00 p.m.';
    if (link) link.href = 'https://maps.google.com/?q=Cra+10+10-62+San+Gil';
  }

  openModal('storeMapModal');
}

function openEventRSVPModal(eventId) {
  const event = EVENTS_DATA.find(ev => ev.id === eventId) || EVENTS_DATA[0];
  const title = document.getElementById('eventRsvpTitle');
  const info = document.getElementById('eventRsvpInfo');
  if (title) title.textContent = event.title;
  if (info) info.textContent = `${event.date} • ${event.time} • ${event.location}`;
  openModal('eventModal');
}

// 6. Minijuego Retro Arcade: "CP BURGER STACK"
function initArcadeGame() {
  const canvas = document.getElementById('arcadeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scoreElem = document.getElementById('arcadeScore');
  const startBtn = document.getElementById('startArcadeBtn');

  let score = 0;
  let gameRunning = false;
  let burgerX = 140;
  let burgerWidth = 50;
  let burgerHeight = 14;
  let fallingItems = [];
  let animId;

  const itemTypes = [
    { name: 'pan_arriba', color: '#DE9B52', points: 10 },
    { name: 'carne', color: '#59291E', points: 15 },
    { name: 'queso', color: '#F8B825', points: 10 },
    { name: 'tocineta', color: '#BF2B2B', points: 20 },
    { name: 'pepinillo', color: '#4A7C32', points: 5 }
  ];

  function resetGame() {
    score = 0;
    fallingItems = [];
    burgerX = canvas.width / 2 - 25;
    if (scoreElem) scoreElem.textContent = score;
  }

  function spawnItem() {
    const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    fallingItems.push({
      x: Math.random() * (canvas.width - 24),
      y: -10,
      size: 18,
      speed: 2 + Math.random() * 2,
      ...type
    });
  }

  function loop() {
    if (!gameRunning) return;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibuja el pan/base del jugador
    ctx.fillStyle = '#DE9B52';
    ctx.beginPath();
    ctx.roundRect(burgerX, canvas.height - 24, burgerWidth, burgerHeight, [0, 0, 8, 8]);
    ctx.fill();

    // Dibuja items cayendo
    if (Math.random() < 0.04) spawnItem();

    for (let i = fallingItems.length - 1; i >= 0; i--) {
      const it = fallingItems[i];
      it.y += it.speed;

      ctx.fillStyle = it.color;
      ctx.fillRect(it.x, it.y, it.size, it.size * 0.7);

      // Colisión con la base
      if (
        it.y + it.size >= canvas.height - 24 &&
        it.y <= canvas.height - 10 &&
        it.x + it.size >= burgerX &&
        it.x <= burgerX + burgerWidth
      ) {
        score += it.points;
        if (scoreElem) scoreElem.textContent = score;
        fallingItems.splice(i, 1);
        continue;
      }

      if (it.y > canvas.height) {
        fallingItems.splice(i, 1);
      }
    }

    animId = requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    burgerX = Math.max(0, Math.min(canvas.width - burgerWidth, clientX - burgerWidth / 2));
  });

  // Soporte táctil para móviles
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches[0].clientX - rect.left;
      burgerX = Math.max(0, Math.min(canvas.width - burgerWidth, clientX - burgerWidth / 2));
      e.preventDefault();
    }
  }, { passive: false });

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      resetGame();
      gameRunning = true;
      startBtn.textContent = 'REINICIAR JUEGO';
      cancelAnimationFrame(animId);
      loop();
    });
  }
}
