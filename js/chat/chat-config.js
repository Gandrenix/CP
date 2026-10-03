// CP Chat - Configuración única del módulo. Todo lo que cambia entre entornos
// o que el cliente puede querer ajustar vive acá; el resto del módulo no
// tiene constantes de negocio escritas a mano.

window.CPChat = window.CPChat || {};

(function () {
  'use strict';

  window.CPChat.config = Object.freeze({
    // Clave PÚBLICA del canal "LiveChat para Sitios Web" (ID 48715). Es
    // pública por diseño: LiveConnect la pide en el HTML del sitio. El
    // secreto para firmar identidades (jwt) NO va acá y no se usa: los
    // visitantes son anónimos a propósito (sin registro para pedir).
    channelKey: 'cnc3278b25bade44bf63ef955bfbdb5e91',
    widgetSrc: 'https://widget.liveconnect.chat/widget.js',

    // Límite de LiveConnect para el mensaje que arranca la conversación
    // (parámetro lcmsg del enlace).
    maxMessageChars: 500,

    // Si el widget no carga en este tiempo (bloqueador, sin conexión, dominio
    // sin registrar en el canal), se ofrece WhatsApp para no perder el pedido.
    loadTimeoutMs: 9000,

    // Tope de espera a que el panel abierto termine de pintar (solo afecta al
    // indicador "cargando" del botón; el panel ya está a la vista).
    panelTimeoutMs: 4000,

    // Tope de espera, tras enviar un pedido, a que el panel confirme que abrió.
    // Más largo que el anterior porque acá una falsa alarma sí cuesta.
    sendTimeoutMs: 8000,

    // Número del canal WhatsApp Business conectado a LiveConnect.
    fallbackWhatsApp: '573178705555',

    // Cuánto esperar antes de ofrecer abrir el chat por iniciativa propia.
    introBubbleDelayMs: 9000,

    // Si el visitante ya chateó antes, se precarga el widget en reposo para
    // restaurar el contador de no leídos sin que tenga que abrir nada.
    storageKeys: Object.freeze({
      started: 'cp_chat_started',
      introSeen: 'cp_chat_intro_seen',
      customer: 'cp_customer'
    }),

    labels: Object.freeze({
      launcher: '¿Hambre? Escríbenos',
      bubbleTitle: '¿Hambre?',
      bubbleText: 'Pregúntanos lo que quieras o haz tu pedido por aquí.',
      loading: 'Abriendo el chat…',
      failTitle: 'No pudimos abrir el chat',
      failText: 'Escríbenos por WhatsApp y te atendemos igual.',
      failCta: 'ABRIR WHATSAPP'
    })
  });
})();
