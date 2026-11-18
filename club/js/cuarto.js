// Gestos del cuarto. La cruceta y el teclado comparten las mismas secuencias.
(function (CP) {
  'use strict';

  const secrets = {
    AAAAAA: ['charge', '¡Más de 9000!', 'charge'],
    UUU: ['star', '¡Estrella del parche!', 'sparkle'],
    DDD: ['gravity', '¡Patas arriba!', 'jump'],
    RRR: ['comet', '¡Tocineta fugaz!', 'wave'],
    LLL: ['rain', '¡Lluvia de píxeles!', 'whistle'],
    LRL: ['feast', '¡Combo secreto!', 'eat']
  };

  CP.roomControls = function (state, mood) {
    const room = state.stageEl;
    const actor = state.sprEl;
    const sound = document.querySelector('#sound');
    const cabinet = room.closest('.cabinet');
    let sequence = '', last = 0, until = 0, idleTimer, endTimer, audio;
    let movement;

    function melody(notes) {
      if (!audio || sound.getAttribute('aria-pressed') !== 'true') return;
      notes.forEach((frequency, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + i * .115;
        osc.type = i % 2 ? 'triangle' : 'square';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.035, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .11);
        osc.connect(gain).connect(audio.destination);
        osc.start(start);
        osc.stop(start + .12);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
    }
    sound.onclick = async () => {
      const enable = sound.getAttribute('aria-pressed') === 'false';
      try {
        if (enable) { audio ||= new AudioContext(); await audio.resume(); }
        else await audio.suspend();
        sound.setAttribute('aria-pressed', String(enable));
        sound.textContent = enable ? 'Sonido activo' : 'Sonido apagado';
        if (enable) melody([330, 495]);
      } catch { sound.textContent = 'Sonido no disponible'; }
    };

    const banner = document.createElement('div');
    banner.className = 'room-banner';
    banner.hidden = true;
    banner.setAttribute('aria-hidden', 'true');
    room.appendChild(banner);
    const dust = document.createElement('i');
    dust.className = 'dust';
    room.appendChild(dust);
    function reset() {
      clearTimeout(endTimer);
      movement?.cancel();
      sequence = ''; until = 0;
      delete room.dataset.secret;
      banner.hidden = true;
      dust.style.transform = '';
    }
    function input(key) {
      if (state.busy || performance.now() < until) return;
      const now = performance.now();
      sequence = ((now - last < 1100 ? sequence : '') + key).slice(-6);
      last = now;
      const combo = Object.keys(secrets).find(s => sequence.endsWith(s));
      movement?.cancel();
      if (!combo) {
        state.sprite.play(key === 'A' ? 'jump' : 'stretch', { loop: false, onend: mood });
        if (key !== 'A' && !CP.reduced()) {
          const dx = (key === 'R' ? 1 : key === 'L' ? -1 : 0) * 12 * state.k;
          const dy = (key === 'U' ? -8 : key === 'D' ? 3 : 0) * state.k;
          movement = actor.animate([{transform:'none'}, {transform:'translate('+dx+'px,'+dy+'px)', offset:.42}, {transform:'none'}],
            {duration:480, easing:'steps(8)'});
        }
        return;
      }
      const [effect, label, pose] = secrets[combo];
      sequence = '';
      until = now + 2800;
      room.dataset.secret = effect;
      banner.textContent = label;
      banner.hidden = false;
      document.querySelector('#game-status').textContent = label;
      state.sprite.play(pose, { loop: true });
      melody(effect === 'star' ? [392, 587, 494, 784, 659, 523, 880] : [294, 392, 523]);
      endTimer = setTimeout(() => { reset(); mood(); }, 2800);
    }
    actor.onclick = () => input('A');
    cabinet.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => input(b.dataset.dir));
    const arrows = { ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R' };
    cabinet.addEventListener('keydown', e => {
      if (!arrows[e.key]) return;
      e.preventDefault();
      if (!e.repeat) input(arrows[e.key]);
    });
    room.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || CP.reduced()) return;
      const rect = room.getBoundingClientRect();
      dust.style.transform = 'translateX(' + Math.round((e.clientX - rect.left - rect.width / 2) / 30) + 'px)';
    });
    function idle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!document.hidden && !state.busy && !state.active && !room.dataset.secret &&
            !document.querySelector('.cl-sheet:not([hidden])') && !CP.reduced()) {
          const acts = ['yawn', 'whistle', 'stretch'];
          state.sprite.play(acts[Math.floor(Math.random() * acts.length)], { loop:false, onend:mood });
        }
        idle();
      }, 7500 + Math.random() * 7000);
    }
    idle();
    return reset;
  };
})(window.CPClub);
