// Cuatro Paredes - Lógica de Temporada, Galería y Efectos Interactivos

let currentSeasonIndex = 0;

function initSeasonCarousel() {
  const prevBtn = document.getElementById('seasonPrevBtn');
  const nextBtn = document.getElementById('seasonNextBtn');
  const orderSeasonBtn = document.getElementById('seasonOrderBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentSeasonIndex = (currentSeasonIndex - 1 + SEASON_ITEMS.length) % SEASON_ITEMS.length;
      updateSeasonUI();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentSeasonIndex = (currentSeasonIndex + 1) % SEASON_ITEMS.length;
      updateSeasonUI();
    });
  }

  if (orderSeasonBtn) {
    orderSeasonBtn.addEventListener('click', () => {
      const current = SEASON_ITEMS[currentSeasonIndex];
      if (window.cpCart) {
        window.cpCart.addItem({
          id: `season-${current.id}`,
          name: current.name,
          price: current.price,
          image: current.image
        });
        window.cpCart.openCart();
      }
    });
  }

  // Click en miniaturas de otros experimentos de temporada
  document.querySelectorAll('.season-thumb-card').forEach((card, idx) => {
    card.addEventListener('click', () => {
      currentSeasonIndex = idx % SEASON_ITEMS.length;
      updateSeasonUI();
    });
  });

  updateSeasonUI();
}

function updateSeasonUI() {
  const current = SEASON_ITEMS[currentSeasonIndex];
  if (!current) return;

  const counter = document.getElementById('seasonCounter');
  const title = document.getElementById('seasonTitle');
  const desc = document.getElementById('seasonDesc');
  const price = document.getElementById('seasonPrice');
  const image = document.getElementById('seasonImage');
  const note = document.getElementById('seasonNote');

  if (counter) counter.textContent = current.number;
  if (title) title.textContent = current.name;
  if (desc) desc.textContent = current.description;
  if (price) price.textContent = window.cpCart ? window.cpCart.formatMoney(current.price) : `$${current.price}`;
  if (image) {
    image.style.opacity = '0';
    setTimeout(() => {
      image.src = current.image;
      image.style.opacity = '1';
    }, 180);
  }
  if (note) note.textContent = current.note;
}

// Galería CP (Panel: fotos reales del producto; espacio listo para sumar
// las fotografías adicionales que comparta el restaurante más adelante).
const GALLERY_PHOTOS = [
  { title: "Azul Maple", image: "assets/img/burger_azul_maple.jpg", tag: "EXPERIMENTO #2" },
  { title: "Burger Trufada", image: "assets/img/burger_trufada.jpg", tag: "EXPERIMENTO #1" },
  { title: "Hot Sweet Burger", image: "assets/img/burger_hot_sweet.jpg", tag: "BURGERS" },
  { title: "Papas Trufadas", image: "assets/img/papas_trufadas.jpg", tag: "PAPAS" },
  { title: "Combo para Varios", image: "assets/img/mesa_combo_varios.jpg", tag: "PARCHE" },
  { title: "Galleta Chips de Chocolate", image: "assets/img/galleta_chocolate.jpg", tag: "POSTRE" }
];

// Carrusel "Cinta CP" (rollo de 35mm): scroll nativo con scroll-snap (sin
// loop de JS para el desplazamiento), resaltado del fotograma centrado vía
// IntersectionObserver, arrastre con mouse y auto-avance lento que se
// pausa solo con cualquier interacción. Las fotos se duplican una vez en
// el DOM para que el loop del auto-avance no se note (mismo truco que un
// marquee infinito), salvo que el usuario pida menos movimiento.
function initFilmCarousel() {
  const track = document.getElementById('filmStripTrack');
  const prevBtn = document.getElementById('filmPrevBtn');
  const nextBtn = document.getElementById('filmNextBtn');
  if (!track) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frameHTML(item, i) {
    const safeTitle = item.title.replace(/'/g, "\\'");
    return `
      <div class="film-frame" data-index="${i}">
        <img src="${item.image}" alt="${item.title}" loading="lazy">
        <div class="film-frame-label">
          <span class="film-frame-tag">${item.tag}</span>
          <span class="film-frame-title">${item.title}</span>
        </div>
      </div>
    `;
  }

  const setHTML = GALLERY_PHOTOS.map(frameHTML).join('');
  track.innerHTML = reducedMotion ? setHTML : setHTML + setHTML;

  const frames = Array.from(track.children);
  let moved = false;

  frames.forEach((frame, i) => {
    frame.addEventListener('click', () => {
      if (moved) return;
      const item = GALLERY_PHOTOS[i % GALLERY_PHOTOS.length];
      openLightbox(item.image, item.title, item.tag);
    });
  });

  // Resalta el fotograma más cercano al centro: el rootMargin negativo
  // reduce la zona "observada" a una franja central angosta del track, así
  // solo el fotograma que realmente está en el medio queda activo.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-active', entry.isIntersecting && entry.intersectionRatio > 0.5);
    });
  }, { root: track, threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '0px -35% 0px -35%' });
  frames.forEach((f) => observer.observe(f));

  // --- Arrastre con mouse (en táctil el scroll nativo ya funciona solo) ---
  let isDown = false;
  let startX = 0;
  let startScroll = 0;

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    isDown = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add('is-dragging');
    stopAutoplay();
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startScroll - dx;
  });

  window.addEventListener('pointerup', () => {
    if (!isDown) return;
    isDown = false;
    track.classList.remove('is-dragging');
    scheduleAutoplayResume();
  });

  // --- Flechas prev/next ---
  function step(dir) {
    const width = frames[0] ? frames[0].getBoundingClientRect().width + 14 : 300;
    track.scrollBy({ left: dir * width, behavior: 'smooth' });
    stopAutoplay();
    scheduleAutoplayResume();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => step(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => step(1));

  // --- Auto-avance continuo y lento, con loop sin costuras ---
  // setInterval en vez de requestAnimationFrame: un rAF encadenado se
  // frena o se detiene del todo en cuanto la pestaña pierde foco real (ya
  // nos pasó con el timer del "Prepárate..." del arcade -- ver game.js),
  // y este carrusel debe seguir moviéndose aunque el usuario tenga otra
  // ventana al frente. setInterval no depende de eso.
  let intervalId = null;
  let resumeTimer = null;
  const TICK_MS = 30;
  const SPEED = 0.7; // px por tick

  function autoplayTick() {
    if (isDown) return;
    track.scrollLeft += SPEED;
    const singleSetWidth = track.scrollWidth / 2;
    if (track.scrollLeft >= singleSetWidth) {
      track.scrollLeft -= singleSetWidth;
    }
  }

  function stopAutoplay() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    track.classList.remove('is-autoplaying');
  }

  function startAutoplay() {
    track.classList.add('is-autoplaying');
    if (!intervalId) intervalId = setInterval(autoplayTick, TICK_MS);
  }

  function scheduleAutoplayResume() {
    if (reducedMotion) return;
    resumeTimer = setTimeout(startAutoplay, 1800);
  }

  track.addEventListener('mouseenter', stopAutoplay);
  track.addEventListener('mouseleave', scheduleAutoplayResume);
  track.addEventListener('touchstart', stopAutoplay, { passive: true });
  track.addEventListener('touchend', scheduleAutoplayResume, { passive: true });

  if (!reducedMotion) startAutoplay();
}

// Lightbox Modal para fotos
function openLightbox(src, title, tag) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  const caption = document.getElementById('lightboxCaption');
  if (!modal || !img) return;

  img.src = src;
  if (caption) caption.innerHTML = `<strong>${tag}</strong> • ${title}`;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const modal = document.getElementById('lightboxModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Efecto 3D Tilt suave para tarjetas interactivas
function init3DTilt() {
  const cards = document.querySelectorAll('.tilt-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateX = -(y / rect.height) * 18;
      const rotateY = (x / rect.width) * 18;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSeasonCarousel();
  initFilmCarousel();
  init3DTilt();
});
