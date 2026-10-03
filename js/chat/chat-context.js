// CP Chat - Arma los mensajes que llegan a LiveConnect. Es la parte que le
// da claridad al empleado: cada conversación abre con un encabezado
// reconocible (PEDIDO CP-XXXX / CONSULTA) y los datos básicos ya ordenados,
// sin que el cliente tenga que registrarse ni escribir nada de eso.
// Funciones puras (sin DOM ni red): reciben un "pedido" y devuelven texto.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const MAX = () => window.CPChat.config.maxMessageChars;

  function money(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Código corto y legible para que cliente y empleado se refieran al mismo
  // pedido ("CP-7K3F"). No es secreto ni único globalmente: solo ordena.
  function orderCode(now = Date.now()) {
    return 'CP-' + now.toString(36).slice(-4).toUpperCase();
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  // Teléfono canónico = la "llave" que LiveConnect usa para saber que dos
  // pedidos son de la misma persona (agrupa por teléfono; el nombre no cuenta).
  // Solo dígitos, y los móviles colombianos (10 dígitos que empiezan en 3) con
  // el prefijo 57, que es como llegan los contactos de WhatsApp: así
  // "300 123 4567", "+57 300 123 4567" y "3001234567" son la misma persona.
  function normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10 && digits[0] === '3') digits = '57' + digits;
    return digits;
  }

  // Para leerlo en la bandeja: +57 300 123 4567
  function formatPhone(digits) {
    const m = /^57(\d{3})(\d{3})(\d{4})$/.exec(digits);
    return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : digits;
  }

  // order: { city, mode, name, phone, address, notes, items:[{name,quantity}],
  //          subtotal, deliveryFee, total }
  function buildOrderMessage(order, code = orderCode()) {
    const head = [
      `PEDIDO ${code}`,
      `${order.city} · ${order.mode}`,
      `${clean(order.name)} · ${formatPhone(normalizePhone(order.phone))}`
    ];
    if (order.mode === 'DOMICILIO' && clean(order.address)) {
      head.push(`Dir: ${clean(order.address)}`);
    }

    const totals = [];
    totals.push(
      order.mode === 'DOMICILIO'
        ? `${money(order.subtotal)} + envío ${money(order.deliveryFee)}`
        : money(order.subtotal)
    );
    totals.push(`TOTAL ${money(order.total)}`);
    const tail = [totals.join(' = ')];
    if (clean(order.notes)) tail.push(`Notas: ${clean(order.notes)}`);

    const itemLines = order.items.map((i) => `${i.quantity}x ${clean(i.name)}`);

    // El límite de LiveConnect manda: si no cabe, se recortan los ítems del
    // final (nunca los datos de contacto ni el total) y se avisa cuántos.
    const fixed = head.join('\n') + '\n' + tail.join('\n');
    let kept = itemLines.slice();
    const compose = (list, omitted) => {
      const items = list.join('; ') + (omitted ? ` … +${omitted} más` : '');
      return `${head.join('\n')}\n${items}\n${tail.join('\n')}`;
    };
    let message = compose(kept, 0);
    while (message.length > MAX() && kept.length > 1) {
      kept = kept.slice(0, -1);
      message = compose(kept, itemLines.length - kept.length);
    }
    if (message.length > MAX()) {
      // Caso extremo (notas enormes): se recortan las notas, no el pedido.
      const room = MAX() - (fixed.length - clean(order.notes).length) - 12;
      const notes = clean(order.notes).slice(0, Math.max(0, room)) + '…';
      return compose(kept, itemLines.length - kept.length).replace(
        `Notas: ${clean(order.notes)}`,
        `Notas: ${notes}`
      ).slice(0, MAX());
    }
    return message;
  }

  function validateOrder(order) {
    if (!order.items.length) return 'Tu carrito está vacío. Agrega una burger primero.';
    if (!clean(order.name)) return 'Escribe tu nombre para que sepamos a quién atender.';
    if (clean(order.phone).replace(/\D/g, '').length < 7) return 'Escribe un teléfono de contacto válido.';
    if (order.mode === 'DOMICILIO' && !clean(order.address)) return 'Falta la dirección para el domicilio.';
    return '';
  }

  window.CPChat.context = Object.freeze({
    buildOrderMessage, validateOrder, orderCode, money, normalizePhone, formatPhone, clean
  });
})();
