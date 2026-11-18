// CP Club - elige qué API usan las páginas: la real (Worker) o la de prueba.
// La de prueba (datos en el navegador) solo se activa con ?demo=1.

window.CPClub = window.CPClub || {};

(function (CP) {
  'use strict';
  const demo = new URLSearchParams(location.search).has('demo');
  CP.api = demo && CP.mockApi ? CP.mockApi : CP.httpApi;
})(window.CPClub);
