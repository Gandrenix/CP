// Cuatro Paredes - Lógica de Temporada, Archivo y Efectos Interactivos

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

  // Click en miniaturas de archivo de temporada
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

// Lógica de filtrado para Archivo CP (Panel 11)
function initArchiveCP() {
  const yearButtons = document.querySelectorAll('.archive-year-btn');
  const galleryContainer = document.getElementById('archiveGalleryGrid');

  function renderYear(year) {
    const photos = ARCHIVE_PHOTOS[year] || ARCHIVE_PHOTOS["2026"];
    if (!galleryContainer) return;

    galleryContainer.innerHTML = photos.map((item, i) => `
      <div class="archive-photo-card" onclick="openLightbox('${item.image}', '${item.title}', '${item.tag}')">
        <img src="${item.image}" alt="${item.title}" loading="lazy">
        <div class="archive-photo-overlay">
          <span class="archive-tag">${item.tag}</span>
          <span class="archive-photo-title">${item.title}</span>
        </div>
      </div>
    `).join('');
  }

  yearButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      yearButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const year = e.currentTarget.getAttribute('data-year');
      renderYear(year);
    });
  });

  // Render inicial
  renderYear("2026");
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

// Lógica de Regala una Burger (Panel 9)
function initGiftCardSection() {
  const giftOptions = document.querySelectorAll('.gift-amount-option');
  const displayAmount = document.getElementById('giftCardDisplayAmount');
  let selectedAmount = 50000;

  giftOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      giftOptions.forEach(o => o.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const val = parseInt(e.currentTarget.getAttribute('data-amount'), 10);
      selectedAmount = val;
      if (displayAmount) {
        displayAmount.textContent = window.cpCart ? window.cpCart.formatMoney(val) : `$${val}`;
      }
    });
  });

  const regalarBtn = document.getElementById('regalarBurgerBtn');
  if (regalarBtn) {
    regalarBtn.addEventListener('click', () => {
      openGiftModal(selectedAmount);
    });
  }
}

function openGiftModal(amount) {
  const modal = document.getElementById('giftCardModal');
  const amountField = document.getElementById('modalGiftAmount');
  if (amountField) amountField.value = window.cpCart ? window.cpCart.formatMoney(amount) : `$${amount}`;
  if (modal) modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeGiftModal() {
  const modal = document.getElementById('giftCardModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  initSeasonCarousel();
  initArchiveCP();
  init3DTilt();
  initGiftCardSection();
});
