// CP Chat - Memoria del cliente en SU navegador (localStorage). Guarda el
// último nombre, teléfono y dirección usados en un pedido y los devuelve para
// pre-llenar el carrito: quien vuelve a pedir no tiene que reescribirlos, y de
// paso no cambia "Carlos Alberto" por "Carlooos" entre un pedido y otro.
// No sale del navegador: LiveConnect solo recibe lo que viaja en el pedido.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  const key = () => window.CPChat.config.storageKeys.customer;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(key()) || '{}');
      return {
        name: typeof data.name === 'string' ? data.name : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        address: typeof data.address === 'string' ? data.address : ''
      };
    } catch (err) {
      return { name: '', phone: '', address: '' };
    }
  }

  function save({ name, phone, address }) {
    try {
      localStorage.setItem(key(), JSON.stringify({ name, phone, address }));
    } catch (err) {}
  }

  window.CPChat.customer = Object.freeze({ load, save });
})();
