// Cuatro Paredes - Lógica del Carrito y Generador de Pedidos

class CuatroParedesCart {
  constructor() {
    this.items = [];
    this.city = 'BUCARAMANGA'; // BUCARAMANGA or SAN GIL
    this.mode = 'DOMICILIO';   // DOMICILIO or RECOGER
    this.phoneBga = '573170000000';
    this.phoneSanGil = '573180000000';
    this.deliveryFee = 5000;
    
    this.loadFromStorage();
    this.initElements();
    this.bindEvents();
    this.render();
  }

  initElements() {
    this.cartDrawer = document.getElementById('cartDrawer');
    this.cartBackdrop = document.getElementById('cartBackdrop');
    this.cartTriggerBtn = document.getElementById('cartTriggerBtn');
    this.cartCloseBtn = document.getElementById('cartCloseBtn');
    this.cartItemsList = document.getElementById('cartItemsList');
    this.cartBadge = document.getElementById('cartBadge');
    this.cartSubtotalElem = document.getElementById('cartSubtotal');
    this.cartDeliveryFeeElem = document.getElementById('cartDeliveryFee');
    this.cartTotalElem = document.getElementById('cartTotal');
    this.whatsappOrderBtn = document.getElementById('whatsappOrderBtn');
    this.emptyCartState = document.getElementById('emptyCartState');
    this.cartSummaryBlock = document.getElementById('cartSummaryBlock');
  }

  bindEvents() {
    if (this.cartTriggerBtn) {
      this.cartTriggerBtn.addEventListener('click', () => this.openCart());
    }
    if (this.cartCloseBtn) {
      this.cartCloseBtn.addEventListener('click', () => this.closeCart());
    }
    if (this.cartBackdrop) {
      this.cartBackdrop.addEventListener('click', () => this.closeCart());
    }

    if (this.whatsappOrderBtn) {
      this.whatsappOrderBtn.addEventListener('click', () => this.checkoutWhatsApp());
    }

    // Escuchar cambios de ciudad y modo en el panel Pedir
    document.querySelectorAll('[data-order-city]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const city = e.currentTarget.getAttribute('data-order-city');
        this.setCity(city);
      });
    });

    document.querySelectorAll('[data-order-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-order-mode');
        this.setMode(mode);
      });
    });
  }

  setCity(city) {
    this.city = city.toUpperCase();
    document.querySelectorAll('[data-order-city]').forEach(b => {
      if (b.getAttribute('data-order-city').toUpperCase() === this.city) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    this.saveToStorage();
    this.render();
    this.showToast(`Ciudad seleccionada: ${this.city}`);
  }

  setMode(mode) {
    this.mode = mode.toUpperCase();
    document.querySelectorAll('[data-order-mode]').forEach(b => {
      if (b.getAttribute('data-order-mode').toUpperCase() === this.mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    this.saveToStorage();
    this.render();
    this.showToast(`Modalidad: ${this.mode}`);
  }

  addItem(item, quantity = 1, notes = '') {
    const existingIndex = this.items.findIndex(i => i.id === item.id);
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: quantity,
        notes: notes
      });
    }

    this.saveToStorage();
    this.render();
    this.showToast(`¡${item.name} agregado al pedido!`);

    // Animación de rebote en el botón del carrito
    if (this.cartTriggerBtn) {
      this.cartTriggerBtn.classList.add('pulse-bounce');
      setTimeout(() => this.cartTriggerBtn.classList.remove('pulse-bounce'), 600);
    }
  }

  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.saveToStorage();
    this.render();
  }

  updateQuantity(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(id);
    } else {
      this.saveToStorage();
      this.render();
    }
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getTotal() {
    const sub = this.getSubtotal();
    if (sub === 0) return 0;
    const delivery = (this.mode === 'DOMICILIO') ? this.deliveryFee : 0;
    return sub + delivery;
  }

  formatMoney(amount) {
    return '$' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  openCart() {
    if (this.cartDrawer) this.cartDrawer.classList.add('open');
    if (this.cartBackdrop) this.cartBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeCart() {
    if (this.cartDrawer) this.cartDrawer.classList.remove('open');
    if (this.cartBackdrop) this.cartBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  render() {
    const totalCount = this.items.reduce((sum, item) => sum + item.quantity, 0);

    if (this.cartBadge) {
      this.cartBadge.textContent = totalCount;
      this.cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    if (!this.cartItemsList) return;

    if (this.items.length === 0) {
      if (this.emptyCartState) this.emptyCartState.style.display = 'block';
      if (this.cartSummaryBlock) this.cartSummaryBlock.style.display = 'none';
      this.cartItemsList.innerHTML = '';
      return;
    }

    if (this.emptyCartState) this.emptyCartState.style.display = 'none';
    if (this.cartSummaryBlock) this.cartSummaryBlock.style.display = 'block';

    this.cartItemsList.innerHTML = this.items.map(item => `
      <div class="cart-item-row" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" class="cart-item-thumb">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-unit-price">${this.formatMoney(item.price)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="cpCart.updateQuantity('${item.id}', -1)">−</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="cpCart.updateQuantity('${item.id}', 1)">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-subtotal">${this.formatMoney(item.price * item.quantity)}</span>
          <button class="cart-item-del" onclick="cpCart.removeItem('${item.id}')" title="Eliminar">&times;</button>
        </div>
      </div>
    `).join('');

    const subtotal = this.getSubtotal();
    const fee = (this.mode === 'DOMICILIO') ? this.deliveryFee : 0;
    const total = this.getTotal();

    if (this.cartSubtotalElem) this.cartSubtotalElem.textContent = this.formatMoney(subtotal);
    if (this.cartDeliveryFeeElem) {
      this.cartDeliveryFeeElem.textContent = (this.mode === 'DOMICILIO') ? this.formatMoney(fee) : 'GRATIS (Recoger)';
    }
    if (this.cartTotalElem) this.cartTotalElem.textContent = this.formatMoney(total);
  }

  checkoutWhatsApp() {
    if (this.items.length === 0) {
      alert('Tu carrito está vacío. Agrega una deliciosa burger primero.');
      return;
    }

    const customerName = document.getElementById('checkoutCustomerName')?.value.trim() || 'Cliente';
    const customerPhone = document.getElementById('checkoutCustomerPhone')?.value.trim() || '';
    const customerAddress = document.getElementById('checkoutCustomerAddress')?.value.trim() || '';
    const customerNotes = document.getElementById('checkoutCustomerNotes')?.value.trim() || 'Sin notas';

    let orderText = `🔥 *PEDIDO CUATRO PAREDES* 🔥\n`;
    orderText += `--------------------------------\n`;
    orderText += `📍 *Ciudad:* ${this.city}\n`;
    orderText += `🛵 *Modalidad:* ${this.mode}\n`;
    orderText += `👤 *Cliente:* ${customerName}\n`;
    if (customerPhone) orderText += `📞 *Tel:* ${customerPhone}\n`;
    if (this.mode === 'DOMICILIO') {
      orderText += `🏠 *Dirección:* ${customerAddress || 'Por confirmar'}\n`;
    }
    orderText += `--------------------------------\n`;
    orderText += `*ITEMS:* \n`;

    this.items.forEach(item => {
      orderText += `• ${item.quantity}x ${item.name} (${this.formatMoney(item.price * item.quantity)})\n`;
    });

    orderText += `--------------------------------\n`;
    orderText += `*Subtotal:* ${this.formatMoney(this.getSubtotal())}\n`;
    if (this.mode === 'DOMICILIO') {
      orderText += `*Envío:* ${this.formatMoney(this.deliveryFee)}\n`;
    }
    orderText += `*TOTAL A PAGAR:* ${this.formatMoney(this.getTotal())}\n`;
    orderText += `--------------------------------\n`;
    orderText += `💬 *Notas:* ${customerNotes}\n\n`;
    orderText += `_Hecho para el antojo. ¡Parchado en Cuatro Paredes!_`;

    const targetPhone = this.city === 'SAN GIL' ? this.phoneSanGil : this.phoneBga;
    const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(orderText)}`;
    
    window.open(url, '_blank');
  }

  saveToStorage() {
    try {
      localStorage.setItem('cp_cart_items', JSON.stringify(this.items));
      localStorage.setItem('cp_cart_city', this.city);
      localStorage.setItem('cp_cart_mode', this.mode);
    } catch (e) {}
  }

  loadFromStorage() {
    try {
      const savedItems = localStorage.getItem('cp_cart_items');
      const savedCity = localStorage.getItem('cp_cart_city');
      const savedMode = localStorage.getItem('cp_cart_mode');
      if (savedItems) this.items = JSON.parse(savedItems);
      if (savedCity) this.city = savedCity;
      if (savedMode) this.mode = savedMode;
    } catch (e) {}
  }

  showToast(message) {
    let toast = document.getElementById('cpToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cpToast';
      toast.className = 'cp-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

let cpCart;
document.addEventListener('DOMContentLoaded', () => {
  cpCart = new CuatroParedesCart();
});
