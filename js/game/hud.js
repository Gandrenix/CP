// CP Burger Breaker - HUD como overlay de DOM sobre el canvas (no se
// dibuja texto en el canvas: así se ve nítido en cualquier densidad de
// pantalla y usa las fuentes reales del sitio).

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  class HUD {
    constructor(root) {
      this.root = root;
      this.scoreEl = root.querySelector('[data-hud="score"]');
      this.livesEl = root.querySelector('[data-hud="lives"]');
      this.levelEl = root.querySelector('[data-hud="level"]');
      this.comboEl = root.querySelector('[data-hud="combo"]');
      this.bossBarWrap = root.querySelector('[data-hud="boss-bar-wrap"]');
      this.bossBarFill = root.querySelector('[data-hud="boss-bar-fill"]');
      this.bossName = root.querySelector('[data-hud="boss-name"]');
      this.messageWrap = root.querySelector('[data-hud="message"]');
      this.messageTitle = root.querySelector('[data-hud="message-title"]');
      this.messageSub = root.querySelector('[data-hud="message-sub"]');
      this.muteBtn = root.querySelector('[data-hud="mute-btn"]');
      this.fullscreenBtn = root.querySelector('[data-hud="fullscreen-btn"]');
    }

    setScore(score) {
      if (this.scoreEl) this.scoreEl.textContent = score.toLocaleString('es-CO');
    }

    setLives(lives) {
      if (!this.livesEl) return;
      this.livesEl.innerHTML = '';
      for (let i = 0; i < lives; i++) {
        const dot = document.createElement('span');
        dot.className = 'game-hud-life';
        this.livesEl.appendChild(dot);
      }
    }

    setLevel(label) {
      if (this.levelEl) this.levelEl.textContent = label;
    }

    setCombo(count) {
      if (!this.comboEl) return;
      if (count > 1) {
        this.comboEl.textContent = `COMBO x${count}`;
        this.comboEl.classList.add('is-active');
      } else {
        this.comboEl.classList.remove('is-active');
      }
    }

    setBoss(visible, name, hp, maxHp) {
      if (!this.bossBarWrap) return;
      this.bossBarWrap.hidden = !visible;
      if (visible) {
        if (this.bossName) this.bossName.textContent = name;
        const pct = Math.max(0, hp / maxHp) * 100;
        if (this.bossBarFill) this.bossBarFill.style.width = `${pct}%`;
      }
    }

    showMessage(title, sub, opts) {
      if (!this.messageWrap) return;
      this.messageWrap.hidden = false;
      if (this.messageTitle) this.messageTitle.textContent = title;
      if (this.messageSub) this.messageSub.innerHTML = sub || '';
      this.messageWrap.classList.toggle('game-message--tap', !!(opts && opts.tapToContinue));
    }

    hideMessage() {
      if (this.messageWrap) this.messageWrap.hidden = true;
    }

    setMuted(muted) {
      if (this.muteBtn) this.muteBtn.textContent = muted ? '🔇' : '🔊';
    }

    setFullscreenState(isFullscreen) {
      if (this.fullscreenBtn) this.fullscreenBtn.textContent = isFullscreen ? '⤢' : '⛶';
    }
  }

  window.CPGame.HUD = HUD;
})();
