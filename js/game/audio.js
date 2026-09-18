// CP Burger Breaker - SFX sintetizados con WebAudio. Cero archivos de
// audio que descargar; se generan en tiempo real y son silenciables.

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  class GameAudio {
    constructor() {
      this.muted = false;
      this._ctx = null;
    }

    _ensureContext() {
      if (!this._ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this._ctx = new AudioCtx();
      }
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }

    _tone(freq, duration, type, gainValue) {
      if (this.muted) return;
      const ctx = this._ensureContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.value = gainValue || 0.06;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }

    brickHit() { this._tone(520, 0.08, 'square', 0.05); }
    brickBreak() { this._tone(760, 0.1, 'square', 0.06); }
    paddleHit() { this._tone(220, 0.07, 'triangle', 0.05); }
    wallHit() { this._tone(180, 0.05, 'sine', 0.03); }
    powerUp() {
      this._tone(440, 0.09, 'sawtooth', 0.05);
      setTimeout(() => this._tone(660, 0.12, 'sawtooth', 0.05), 90);
    }
    loseLife() { this._tone(140, 0.35, 'sawtooth', 0.07); }
    bossHit() { this._tone(300, 0.06, 'square', 0.06); }
    bossDefeat() {
      [440, 550, 660, 880].forEach((f, i) => {
        setTimeout(() => this._tone(f, 0.18, 'square', 0.06), i * 110);
      });
    }
    levelClear() {
      [523, 659, 784].forEach((f, i) => {
        setTimeout(() => this._tone(f, 0.15, 'sine', 0.05), i * 100);
      });
    }
    gameOver() { this._tone(160, 0.5, 'sawtooth', 0.07); }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
  }

  window.CPGame.Audio = GameAudio;
})();
