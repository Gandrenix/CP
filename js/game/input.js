// CP Burger Breaker - Entrada unificada.
// El resto del juego nunca lee eventos de mouse/touch/teclado directamente;
// solo consulta input.paddleTarget (0-1, posición horizontal normalizada)
// y se suscribe a input.on('launch' | 'pause').

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  class InputManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.paddleTarget = 0.5; // 0..1, normalizado al ancho lógico
      this._listeners = { launch: [], pause: [] };
      this._keysDown = new Set();
      this._bound = {};
      this._attach();
    }

    on(event, cb) {
      if (this._listeners[event]) this._listeners[event].push(cb);
    }

    _emit(event) {
      (this._listeners[event] || []).forEach(cb => cb());
    }

    _normalizedXFromClientX(clientX) {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(1, Math.max(0, ratio));
    }

    _attach() {
      const canvas = this.canvas;

      this._bound.mousemove = (e) => {
        this.paddleTarget = this._normalizedXFromClientX(e.clientX);
      };
      this._bound.mousedown = () => this._emit('launch');

      this._bound.touchmove = (e) => {
        if (e.touches.length > 0) {
          this.paddleTarget = this._normalizedXFromClientX(e.touches[0].clientX);
          e.preventDefault();
        }
      };
      this._bound.touchstart = (e) => {
        if (e.touches.length > 0) {
          this.paddleTarget = this._normalizedXFromClientX(e.touches[0].clientX);
        }
        this._emit('launch');
        e.preventDefault();
      };

      this._bound.keydown = (e) => {
        this._keysDown.add(e.key);
        if (e.key === ' ' || e.key === 'ArrowUp') {
          this._emit('launch');
          e.preventDefault();
        }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          this._emit('pause');
        }
      };
      this._bound.keyup = (e) => this._keysDown.delete(e.key);

      canvas.addEventListener('mousemove', this._bound.mousemove);
      canvas.addEventListener('mousedown', this._bound.mousedown);
      canvas.addEventListener('touchmove', this._bound.touchmove, { passive: false });
      canvas.addEventListener('touchstart', this._bound.touchstart, { passive: false });
      window.addEventListener('keydown', this._bound.keydown);
      window.addEventListener('keyup', this._bound.keyup);
    }

    // Teclado: mueve el objetivo de forma continua mientras la flecha esté
    // presionada (independiente del framerate, se llama desde el loop).
    updateKeyboard(dt, normalizedStep) {
      if (this._keysDown.has('ArrowLeft') || this._keysDown.has('a') || this._keysDown.has('A')) {
        this.paddleTarget = Math.max(0, this.paddleTarget - normalizedStep * dt);
      }
      if (this._keysDown.has('ArrowRight') || this._keysDown.has('d') || this._keysDown.has('D')) {
        this.paddleTarget = Math.min(1, this.paddleTarget + normalizedStep * dt);
      }
    }

    destroy() {
      const canvas = this.canvas;
      canvas.removeEventListener('mousemove', this._bound.mousemove);
      canvas.removeEventListener('mousedown', this._bound.mousedown);
      canvas.removeEventListener('touchmove', this._bound.touchmove);
      canvas.removeEventListener('touchstart', this._bound.touchstart);
      window.removeEventListener('keydown', this._bound.keydown);
      window.removeEventListener('keyup', this._bound.keyup);
    }
  }

  window.CPGame.InputManager = InputManager;
})();
