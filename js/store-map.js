// Cuatro Paredes - Mapa interactivo de sedes (Leaflet.js + OpenStreetMap)
// La librería Leaflet solo se descarga cuando el cliente abre "Cómo llegar",
// así el mapa no afecta en nada el peso ni la velocidad de carga inicial del sitio.

(function () {
  'use strict';

  const STORE_COORDS = {
    bucaramanga: { lat: 7.1210, lng: -73.1198, zoom: 15 }
  };

  let leafletLoading = null;
  let map = null;
  let marker = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletLoading) return leafletLoading;

    leafletLoading = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/vendor/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'js/vendor/leaflet.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });

    return leafletLoading;
  }

  function cpPinIcon() {
    return L.divIcon({
      className: '',
      html: `<div class="cp-map-pin">
               <div class="cp-map-pin-pulse"></div>
               <svg class="cp-map-pin-marker" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
               </svg>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 32]
    });
  }

  function renderStoreOnMap(storeKey) {
    const coords = STORE_COORDS[storeKey] || STORE_COORDS.bucaramanga;
    const container = document.getElementById('storeMap');
    const fallback = document.getElementById('storeMapFallback');
    if (!container) return;

    loadLeaflet().then(() => {
      if (fallback) fallback.style.display = 'none';

      if (!map) {
        map = L.map('storeMap', {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          subdomains: 'abc',
          maxZoom: 19
        }).addTo(map);
      }

      map.setView([coords.lat, coords.lng], coords.zoom);

      if (marker) {
        marker.setLatLng([coords.lat, coords.lng]);
      } else {
        marker = L.marker([coords.lat, coords.lng], { icon: cpPinIcon() }).addTo(map);
      }

      setTimeout(() => map.invalidateSize(), 250);
    }).catch(() => {
      if (fallback) fallback.textContent = 'No fue posible cargar el mapa. Usa "Abrir en Google Maps".';
    });
  }

  window.showStoreOnMap = renderStoreOnMap;
})();
