// CP Burger Breaker - Motor: canvas responsivo + pantalla completa + loop
// de tiempo fijo. No sabe nada de bricks, bosses ni power-ups; solo llama
// a update(fixedDt) N veces y luego render() una vez por frame.

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  const LOGICAL_WIDTH = 400;
  const LOGICAL_HEIGHT = 700;
  const FIXED_DT = 1 / 120; // física estable independiente del refresco de pantalla
  const MAX_FRAME_MS = 250; // evita "spiral of death" si la pestaña estuvo en segundo plano

  class Engine {
    constructor({ canvas, container, fullscreenTarget, update, render }) {
      this.canvas = canvas;
      this.container = container; // solo mide tamaño disponible para el canvas
      this.fullscreenTarget = fullscreenTarget || container; // qué entra en pantalla completa (incluye HUD)
      this.ctx = canvas.getContext('2d');
      this._updateCb = update;
      this._renderCb = render;

      this.width = LOGICAL_WIDTH;
      this.height = LOGICAL_HEIGHT;

      this._running = false;
      this._rafId = null;
      this._lastTime = 0;
      this._accumulator = 0;

      this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
      this._resizeObserver.observe(container);
      this._resizeCanvas();

      this._onFullscreenChange = () => {
        setTimeout(() => this._resizeCanvas(), 60);
      };
      document.addEventListener('fullscreenchange', this._onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }

    _resizeCanvas() {
      const rect = this.container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const targetRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
      let cssWidth = rect.width;
      let cssHeight = rect.width / targetRatio;
      if (cssHeight > rect.height) {
        cssHeight = rect.height;
        cssWidth = rect.height * targetRatio;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.canvas.width = Math.round(LOGICAL_WIDTH * dpr);
      this.canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    toggleFullscreen() {
      if (this.isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const el = this.fullscreenTarget;
        const request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (request) request.call(el);
      }
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastTime = performance.now();
      this._accumulator = 0;
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }

    stop() {
      this._running = false;
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    _loop(now) {
      if (!this._running) return;
      let frameMs = now - this._lastTime;
      if (frameMs > MAX_FRAME_MS) frameMs = MAX_FRAME_MS;
      this._lastTime = now;
      this._accumulator += frameMs / 1000;

      // Un solo frame con un error no debe dejar el juego congelado para
      // siempre: se registra en consola y se sigue pidiendo el próximo
      // frame de todas formas.
      try {
        while (this._accumulator >= FIXED_DT) {
          this._updateCb(FIXED_DT, now);
          this._accumulator -= FIXED_DT;
        }
        this._renderCb(this.ctx, this.width, this.height);
      } catch (err) {
        console.error('CP Burger Breaker: error en el loop del juego', err);
        this._accumulator = 0;
      }

      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }

    destroy() {
      this.stop();
      this._resizeObserver.disconnect();
      document.removeEventListener('fullscreenchange', this._onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }
  }

  window.CPGame.Engine = Engine;
  window.CPGame.LOGICAL_WIDTH = LOGICAL_WIDTH;
  window.CPGame.LOGICAL_HEIGHT = LOGICAL_HEIGHT;
})();
