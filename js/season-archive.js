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

function initGalleryCP() {
  const galleryContainer = document.getElementById('archiveGalleryGrid');
  if (!galleryContainer) return;

  galleryContainer.innerHTML = GALLERY_PHOTOS.map((item) => `
    <div class="archive-photo-card" onclick="openLightbox('${item.image}', '${item.title}', '${item.tag}')">
      <img src="${item.image}" alt="${item.title}" loading="lazy">
      <div class="archive-photo-overlay">
        <span class="archive-tag">${item.tag}</span>
        <span class="archive-photo-title">${item.title}</span>
      </div>
    </div>
  `).join('');
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
  initGalleryCP();
  init3DTilt();
});
