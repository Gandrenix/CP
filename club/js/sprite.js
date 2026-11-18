// CP Club - sprites: mascota animada, iconos y efectos (confeti, +puntos).
// Lee club/assets/atlas.json (generado por club-de-puntos/sprites/gen_sprites.py).

window.CPClub = window.CPClub || {};

(function (CP) {
  'use strict';

  const BASE = '/club/assets/';
  CP.reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastImpact = -1000;
  CP.impact = function (el) {
    if (CP.reduced() || performance.now() - lastImpact < 700) return;
    lastImpact = performance.now();
    const rays = document.createElement('i');
    rays.className = 'impact-rays';
    rays.setAttribute('aria-hidden', 'true');
    el.appendChild(rays);
    const subject = el.querySelector('.spr,.coin,.ico-wrap') || el.querySelector('[id="sd-spr"]');
    if (subject) {
      subject.animate([
        {transform:'translateY(1px)'}, {transform:'translateY(-2px)', offset:.25},
        {transform:'translateY(-2px)', offset:.48}, {transform:'none'}
      ], {duration:220, easing:'steps(4)'});
    }
    setTimeout(() => rays.remove(), 360);
  };
  let atlasPromise = null;

  CP.loadAtlas = function () {
    if (!atlasPromise) {
      atlasPromise = fetch(BASE + 'atlas.json').then((r) => r.json());
    }
    return atlasPromise;
  };

  // ------------------------------------------------------------------
  // Mascota: una hoja por nivel; una fila por animación.
  // ------------------------------------------------------------------
  class Sprite {
    constructor(el, atlas, scale) {
      this.el = el;
      this.atlas = atlas;
      this.fw = atlas.smiley.frame[0];
      this.fh = atlas.smiley.frame[1];
      this.cols = 8;
      this.rows = Object.keys(atlas.smiley.anims).length;
      this.k = scale || 3;
      this.timer = null;
      this.name = null;
      el.style.imageRendering = 'pixelated';
      el.style.backgroundRepeat = 'no-repeat';
      this.setScale(this.k);
    }

    setScale(k) {
      this.k = k;
      this.el.style.width = this.fw * k + 'px';
      this.el.style.height = this.fh * k + 'px';
      this.el.style.backgroundSize = this.cols * this.fw * k + 'px ' + this.rows * this.fh * k + 'px';
      if (this.name) this._show(this.name, this._frame || 0);
    }

    setTier(tier) {
      this.el.style.backgroundImage = 'url(' + BASE + this.atlas.smiley.tiers[String(tier)] + ')';
    }

    _show(name, frame) {
      const a = this.atlas.smiley.anims[name];
      this._frame = frame;
      this.el.style.backgroundPosition = -frame * this.fw * this.k + 'px ' + -a.row * this.fh * this.k + 'px';
    }

    // opts: { loop, onend }. Una animación "once" se queda en su último cuadro.
    play(name, opts) {
      opts = opts || {};
      const a = this.atlas.smiley.anims[name];
      if (!a) return;
      this.stop();
      this.name = name;
      const loop = opts.loop !== undefined ? opts.loop : a.loop;
      if (CP.reduced()) {
        this._show(name, loop ? 0 : a.frames - 1);
        if (opts.onend) this.timer = setTimeout(opts.onend, 400);
        return;
      }
      let f = 0;
      const step = () => {
        this._show(name, f);
        if (CP.reduced()) {
          if (opts.onend) this.timer = setTimeout(opts.onend, 250);
          return;
        }
        f += 1;
        if (f >= a.frames) {
          if (loop) { f = 0; } else {
            this.timer = null;
            if (opts.onend) this.timer = setTimeout(opts.onend, 250);
            return;
          }
        }
        this.timer = setTimeout(step, 1000 / a.fps);
      };
      step();
    }

    stop() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    }
  }

  CP.Sprite = Sprite;

  // ------------------------------------------------------------------
  // Iconos (hoja 8 columnas de 32 px) y partículas (celdas de 20 px)
  // ------------------------------------------------------------------
  function paint(el, atlas, group, name, size) {
    const g = atlas[group];
    const pos = g.items[name];
    if (!pos) return;
    const cell = g.cell;
    const k = size / cell;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.backgroundImage = 'url(' + BASE + g.sheet + ')';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.imageRendering = 'pixelated';
    const cols = group === 'icons' ? 8 : group === 'particles' ? 7 : 4;
    const rows = group === 'icons' ? 2 : group === 'particles' ? 2 : 1;
    el.style.backgroundSize = cols * size + 'px ' + rows * size + 'px';
    el.style.backgroundPosition = -pos[0] * size + 'px ' + -pos[1] * size + 'px';
    return k;
  }

  CP.icon = (el, atlas, name, size) => paint(el, atlas, 'icons', name, size || 64);
  CP.badge = (el, atlas, name, size) => paint(el, atlas, 'badges', name, size || 64);
  CP.particle = (el, atlas, name, size) => paint(el, atlas, 'particles', name, size || 40);

  // Moneda que gira (6 cuadros) junto al contador de puntos
  CP.spinCoin = function (el, atlas, size) {
    let i = 0;
    const draw = () => paint(el, atlas, 'particles', 'moneda_' + i, size);
    draw();
    if (CP.reduced()) return;
    return setInterval(() => {
      if (document.hidden || CP.reduced()) return;
      i = (i + 1) % 6; draw();
    }, 240);
  };

  // ------------------------------------------------------------------
  // Efectos sobre una capa (posición absoluta dentro del escenario)
  // ------------------------------------------------------------------
  CP.fx = {
    earn(layer, atlas, n, k) {
      const tag = document.createElement('div');
      tag.className = 'fx-earn';
      tag.textContent = '+' + n;
      tag.style.fontSize = 10 * k + 'px';
      layer.appendChild(tag);
      if (!CP.reduced()) {
        tag.animate([
          { transform: 'translate(-50%, 0)', opacity: 0 },
          { transform: 'translate(-50%, -' + 6 * k + 'px)', opacity: 1, offset: .2 },
          { transform: 'translate(-50%, -' + 22 * k + 'px)', opacity: 0 }
        ], { duration: 1800, easing: 'steps(14)' });
      }
      setTimeout(() => tag.remove(), 1800);
      // lluvia de mini burgers
      if (CP.reduced()) return;
      for (let i = 0; i < 5 && layer.childElementCount < 18; i++) {
        const p = document.createElement('div');
        p.className = 'fx-part';
        paint(p, atlas, 'particles', 'mini_burger', 20 * k);
        p.style.left = (10 + Math.random() * 80) + '%';
        layer.appendChild(p);
        {
          p.animate([
            { transform: 'translateY(-' + 20 * k + 'px)', opacity: 0 },
            { opacity: 1, offset: .15 },
            { transform: 'translateY(' + (layer.clientHeight * (.55 + Math.random() * .3)) + 'px)', opacity: 1, offset: .85 },
            { transform: 'translateY(' + layer.clientHeight * .9 + 'px)', opacity: 0 }
          ], { duration: 1100 + Math.random() * 900, delay: Math.random() * 500, easing: 'steps(12)', fill: 'both' });
        }
        setTimeout(() => p.remove(), 2800);
      }
    },

    confetti(layer, k, count) {
      const colors = ['#EE282F', '#FFF8E9', '#B3DDDE', '#FFD84A'];
      if (CP.reduced()) return;
      for (let i = 0; i < Math.min(count || 12, 12) && layer.childElementCount < 18; i++) {
        const p = document.createElement('i');
        p.className = 'fx-conf';
        p.style.width = p.style.height = 3 * k + 'px';
        p.style.background = colors[i % colors.length];
        p.style.left = Math.random() * 100 + '%';
        layer.appendChild(p);
        {
          const dx = (Math.random() - .5) * 20 * k;
          p.animate([
            { transform: 'translate(0,-' + 10 * k + 'px)', opacity: 1 },
            { transform: 'translate(' + dx + 'px,' + layer.clientHeight + 'px)', opacity: 1 }
          ], { duration: 1400 + Math.random() * 1400, delay: Math.random() * 400, easing: 'steps(16)', fill: 'both' });
        }
        setTimeout(() => p.remove(), 3400);
      }
    }
  };
})(window.CPClub);
