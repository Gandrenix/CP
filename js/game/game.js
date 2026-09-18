// CP Burger Breaker - Orquestación (máquina de estados). Conecta engine +
// input + entities + levels + hud + audio. Es el único archivo que sabe
// qué significa "perder una vida" o "pasar de nivel".

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  const STATE = {
    MENU: 'menu',
    INTRO: 'intro',
    PLAYING: 'playing',
    PAUSED: 'paused',
    CLEARED: 'cleared',
    GAME_OVER: 'game_over',
    WIN: 'win'
  };

  const STORAGE_KEY = 'cp_arcade_best';
  const STARTING_LIVES = 3;
  const COMBO_WINDOW_MS = 1500;
  const BALL_DAMAGE_TO_BOSS = 1;

  class BurgerBreaker {
    constructor({ canvas, canvasWrap, shell, hudRoot, primaryBtn }) {
      const { Levels, Entities, Physics } = window.CPGame;
      this.Levels = Levels;
      this.Entities = Entities;
      this.Physics = Physics;

      this.hud = new window.CPGame.HUD(hudRoot);
      this.audio = new window.CPGame.Audio();
      this.input = new window.CPGame.InputManager(canvas);
      this.engine = new window.CPGame.Engine({
        canvas,
        container: canvasWrap,
        fullscreenTarget: shell,
        update: (dt, now) => this._update(dt, now),
        render: (ctx, w, h) => this._render(ctx, w, h)
      });

      this.primaryBtn = primaryBtn;
      this._onPrimaryClick = () => this.handlePrimaryAction();
      if (this.primaryBtn) this.primaryBtn.addEventListener('click', this._onPrimaryClick);

      this.input.on('launch', () => this._onLaunchInput());
      this.input.on('pause', () => this.togglePause());

      this._onMuteClick = () => this.toggleMute();
      this._onFullscreenClick = () => this.toggleFullscreen();
      this._onMessageClick = () => this._onMessageTap();
      if (this.hud.muteBtn) this.hud.muteBtn.addEventListener('click', this._onMuteClick);
      if (this.hud.fullscreenBtn) this.hud.fullscreenBtn.addEventListener('click', this._onFullscreenClick);
      if (this.hud.messageWrap) this.hud.messageWrap.addEventListener('click', this._onMessageClick);

      this._destroyed = false;
      this._introTimer = null;
      this._levelClearTimer = null;

      this.best = this._loadBest();
      this._resetGameSession();
      this.state = STATE.MENU;
      this._showMenuMessage();

      this.engine.start();
    }

    // -----------------------------------------------------------------
    // Ciclo de vida público
    // -----------------------------------------------------------------
    destroy() {
      this._destroyed = true;
      clearTimeout(this._introTimer);
      clearTimeout(this._levelClearTimer);
      this.engine.destroy();
      this.input.destroy();
      if (this.primaryBtn) this.primaryBtn.removeEventListener('click', this._onPrimaryClick);
      if (this.hud.muteBtn) this.hud.muteBtn.removeEventListener('click', this._onMuteClick);
      if (this.hud.fullscreenBtn) this.hud.fullscreenBtn.removeEventListener('click', this._onFullscreenClick);
      if (this.hud.messageWrap) this.hud.messageWrap.removeEventListener('click', this._onMessageClick);
    }

    _onMessageTap() {
      if (this.state === STATE.PAUSED) { this.togglePause(); return; }
      if (this.state === STATE.MENU || this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
        this.handlePrimaryAction();
      }
    }

    toggleFullscreen() {
      this.engine.toggleFullscreen();
      setTimeout(() => this.hud.setFullscreenState(this.engine.isFullscreen()), 80);
    }

    toggleMute() {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    }

    togglePause() {
      if (this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED;
        this.hud.showMessage('PAUSA', 'Toca para continuar', { tapToContinue: true });
      } else if (this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING;
        this.hud.hideMessage();
      }
    }

    handlePrimaryAction() {
      if (this.state === STATE.MENU) {
        this._resetGameSession();
        this._startLevel(0);
      } else if (this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
        this._resetGameSession();
        this._startLevel(0);
      } else if (this.state === STATE.PAUSED) {
        this.togglePause();
      }
    }

    _onLaunchInput() {
      if (this.state === STATE.PAUSED) { this.togglePause(); return; }
      if (this.state !== STATE.PLAYING) return;
      const idle = this.balls.find(b => !b.launched);
      if (idle) idle.launch();
    }

    // -----------------------------------------------------------------
    // Sesión / niveles
    // -----------------------------------------------------------------
    _resetGameSession() {
      this.score = 0;
      this.lives = STARTING_LIVES;
      this.levelIndex = 0;
      this.combo = 0;
      this.comboTimer = 0;
      // Sincroniza el HUD aquí (no solo en el menú) para que "Jugar de
      // nuevo" desde Game Over / Win nunca deje el puntaje anterior pegado.
      this.hud.setScore(0);
      this.hud.setLives(this.lives);
      this.hud.setCombo(0);
    }

    _startLevel(index) {
      const { LOGICAL_WIDTH: W, LOGICAL_HEIGHT: H } = window.CPGame;
      const level = this.Levels.get(index);
      if (!level) { this._win(); return; }

      this.levelIndex = index;
      this.currentLevel = level;
      this.paddle = new this.Entities.Paddle(W, H);
      this.bricks = [];
      this.boss = null;
      this.powerUps = [];
      this.particles = [];
      this.projectiles = [];
      this.combo = 0;
      this.comboTimer = 0;

      if (level.isBoss) {
        this.boss = new this.Entities.Boss(W, level.boss);
      } else {
        this._buildBricks(level.grid, level.ballSpeed);
      }

      this.balls = [this._spawnBall(level.ballSpeed)];

      this.state = STATE.INTRO;
      this.hud.setLevel(level.name);
      this.hud.setBoss(!!level.isBoss, level.boss ? level.boss.name : '', this.boss ? this.boss.hp : 0, this.boss ? this.boss.maxHp : 1);
      this.hud.showMessage(level.name, level.isBoss ? '¡Cuidado, apareció un Burger Dealer!' : 'Prepárate…');

      // setTimeout en vez de comparar contra un timestamp dentro del loop
      // de rAF: así la transición nunca depende de que el navegador siga
      // pidiendo frames a tiempo (pestaña sin foco, throttling, etc.) — es
      // el mismo patrón que ya usa _levelCleared() más abajo.
      clearTimeout(this._introTimer);
      this._introTimer = setTimeout(() => {
        if (this._destroyed || this.state !== STATE.INTRO) return;
        this.state = STATE.PLAYING;
        this.hud.hideMessage();
      }, 1300);
    }

    _buildBricks(grid, speed) {
      const { LOGICAL_WIDTH: W } = window.CPGame;
      const cols = this.Levels.GRID_COLS;
      const marginX = 14;
      const topY = 90;
      const gap = 4;
      const brickW = (W - marginX * 2 - gap * (cols - 1)) / cols;
      const brickH = 20;

      grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell === '.') return;
          const def = this.Levels.BRICK_TYPES[cell];
          if (!def) return;
          const x = marginX + colIndex * (brickW + gap);
          const y = topY + rowIndex * (brickH + gap);
          this.bricks.push(new this.Entities.Brick(x, y, brickW, brickH, cell, def));
        });
      });
    }

    _spawnBall(speed) {
      const ball = new this.Entities.Ball(this.paddle.x, this.paddle.top() - 9, speed);
      return ball;
    }

    _levelCleared() {
      this.state = STATE.CLEARED;
      const wasBoss = !!this.currentLevel.isBoss;
      if (wasBoss) {
        this.audio.bossDefeat();
        this._burstParticles(window.CPGame.LOGICAL_WIDTH / 2, 120, '#EE282F', 40);
        this.hud.showMessage('¡DEALER DERROTADO!', `+${500} puntos de bono`);
        this.score += 500;
        this.hud.setScore(this.score);
      } else {
        this.audio.levelClear();
        this.hud.showMessage('¡NIVEL SUPERADO!', '');
      }
      this.hud.setBoss(false);
      clearTimeout(this._levelClearTimer);
      this._levelClearTimer = setTimeout(() => {
        if (this._destroyed) return;
        this._startLevel(this.levelIndex + 1);
      }, 1400);
    }

    _win() {
      this.state = STATE.WIN;
      this._saveBestIfNeeded();
      this.hud.showMessage('¡GANASTE CP BURGER BREAKER!', `Puntaje final: ${this.score.toLocaleString('es-CO')}`, { tapToContinue: true });
      this._setPrimaryLabel('JUGAR DE NUEVO');
    }

    _loseLife() {
      this.lives -= 1;
      this.audio.loseLife();
      this.hud.setLives(this.lives);
      this.combo = 0;
      this.comboTimer = 0;
      this.hud.setCombo(0);
      if (this.lives <= 0) {
        this._gameOver();
      } else {
        this.balls = [this._spawnBall(this.currentLevel.ballSpeed)];
      }
    }

    _gameOver() {
      this.state = STATE.GAME_OVER;
      this.audio.gameOver();
      this._saveBestIfNeeded();
      this.hud.showMessage('GAME OVER', `Puntaje: ${this.score.toLocaleString('es-CO')} · Mejor: ${this.best.score.toLocaleString('es-CO')}`, { tapToContinue: true });
      this._setPrimaryLabel('JUGAR DE NUEVO');
    }

    _showMenuMessage() {
      this.hud.setLevel('');
      this.hud.setBoss(false);
      const bestLine = this.best.score > 0
        ? `Mejor puntaje: ${this.best.score.toLocaleString('es-CO')} · Nivel más alto: ${this.best.level}`
        : 'Atrapa ingredientes, esquiva y noquea a los Burger Dealers.';
      this.hud.showMessage('CP BURGER BREAKER', bestLine, { tapToContinue: true });
      this._setPrimaryLabel('COMENZAR JUEGO');
    }

    _setPrimaryLabel(text) {
      if (this.primaryBtn) this.primaryBtn.textContent = text;
    }

    _loadBest() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* localStorage no disponible */ }
      return { score: 0, level: 0 };
    }

    _saveBestIfNeeded() {
      let changed = false;
      if (this.score > this.best.score) { this.best.score = this.score; changed = true; }
      if (this.levelIndex + 1 > this.best.level) { this.best.level = this.levelIndex + 1; changed = true; }
      if (changed) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.best)); } catch (e) { /* ignore */ }
      }
    }

    // -----------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------
    _update(dt, now) {
      // INTRO ya no se resuelve aquí: el setTimeout de _startLevel se
      // encarga, independiente de si este loop recibe frames a tiempo.
      if (this.state !== STATE.PLAYING) return;

      const { LOGICAL_WIDTH: W, LOGICAL_HEIGHT: H } = window.CPGame;

      this.input.updateKeyboard(dt, 2.4);
      this.paddle.update(dt, this.input.paddleTarget, W, now);

      if (this.comboTimer > 0) {
        this.comboTimer -= dt * 1000;
        if (this.comboTimer <= 0) { this.combo = 0; this.hud.setCombo(0); }
      }

      this._updateBalls(dt, now, W, H);
      this._updatePowerUps(dt, H);
      this._updateParticles(dt);

      if (this.boss) {
        const shouldFire = this.boss.update(dt, W, now);
        if (shouldFire) this._bossFire();
        this._updateProjectiles(dt, H);
        if (!this.boss.alive) { this._levelCleared(); return; }
      } else {
        const remaining = this.bricks.some(b => b.alive);
        if (!remaining) { this._levelCleared(); return; }
      }
    }

    _updateBalls(dt, now, W, H) {
      const survivors = [];
      for (const ball of this.balls) {
        ball.tickFire(now);
        if (!ball.launched) {
          ball.x = this.paddle.x;
          ball.y = this.paddle.top() - ball.radius - 1;
          survivors.push(ball);
          continue;
        }
        ball.update(dt, now);

        if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx *= -1; this.audio.wallHit(); }
        if (ball.x + ball.radius > W) { ball.x = W - ball.radius; ball.vx *= -1; this.audio.wallHit(); }
        if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy *= -1; this.audio.wallHit(); }

        if (ball.y - ball.radius > H) {
          continue; // se cae, no sobrevive
        }

        if (this.Physics.circleRectCollision(ball.x, ball.y, ball.radius, this.paddle.left(), this.paddle.top(), this.paddle.width, this.paddle.height) && ball.vy > 0) {
          ball.bounceOffPaddle(this.paddle);
          this.audio.paddleHit();
        }

        this._resolveBrickCollisions(ball);
        this._resolveBossCollision(ball, now);

        survivors.push(ball);
      }

      if (survivors.length === 0) {
        this._loseLife();
      } else {
        this.balls = survivors;
      }
    }

    _resolveBrickCollisions(ball) {
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (!this.Physics.circleRectCollision(ball.x, ball.y, ball.radius, brick.x, brick.y, brick.w, brick.h)) continue;

        const destroyed = brick.hit();
        this._registerHit(brick.points);
        this._burstParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 8);

        if (destroyed) {
          this.audio.brickBreak();
          this._maybeDropPowerUp(brick.x + brick.w / 2, brick.y + brick.h / 2);
        } else {
          this.audio.brickHit();
        }

        if (!ball.piercing) {
          const axis = this.Physics.collisionAxis(ball.x, ball.y, brick.x, brick.y, brick.w, brick.h);
          if (axis === 'x') ball.vx *= -1; else ball.vy *= -1;
          break; // una colisión resuelta por frame evita rebotes dobles raros
        }
      }
    }

    _resolveBossCollision(ball, now) {
      if (!this.boss || !this.boss.alive) return;
      if (!this.Physics.circleRectCollision(ball.x, ball.y, ball.radius, this.boss.left(), this.boss.top(), this.boss.width, this.boss.height)) return;
      this.boss.hit(BALL_DAMAGE_TO_BOSS, now);
      this.audio.bossHit();
      this._registerHit(15);
      this._burstParticles(ball.x, ball.y, this.boss.color, 6);
      this.hud.setBoss(true, this.boss.name, this.boss.hp, this.boss.maxHp);
      if (!ball.piercing) ball.vy = Math.abs(ball.vy);
    }

    _registerHit(points) {
      this.combo += 1;
      this.comboTimer = COMBO_WINDOW_MS;
      const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
      this.score += Math.round(points * multiplier);
      this.hud.setScore(this.score);
      this.hud.setCombo(this.combo);
    }

    _maybeDropPowerUp(x, y) {
      if (Math.random() > this.Levels.POWERUP_DROP_CHANCE) return;
      const key = this._weightedPowerUpKey();
      const def = this.Levels.POWERUP_TYPES[key];
      this.powerUps.push(new this.Entities.PowerUp(x, y, key, def));
    }

    _weightedPowerUpKey() {
      const weights = this.Levels.POWERUP_WEIGHTS;
      const total = weights.reduce((s, [, w]) => s + w, 0);
      let roll = Math.random() * total;
      for (const [key, w] of weights) {
        roll -= w;
        if (roll <= 0) return key;
      }
      return weights[0][0];
    }

    _updatePowerUps(dt, H) {
      const now = performance.now();
      this.powerUps = this.powerUps.filter(p => {
        p.update(dt);
        if (p.y - p.radius > H) return false;
        if (this.Physics.circleRectCollision(p.x, p.y, p.radius, this.paddle.left(), this.paddle.top(), this.paddle.width, this.paddle.height)) {
          this._applyPowerUp(p.key, now);
          this.audio.powerUp();
          return false;
        }
        return true;
      });
    }

    _applyPowerUp(key, now) {
      const def = this.Levels.POWERUP_TYPES[key];
      const activeBall = this.balls.find(b => b.launched) || this.balls[0];
      switch (key) {
        case 'SLOW':
          this.balls.forEach(b => b.applySlow(def.duration, now));
          break;
        case 'FIRE':
          this.balls.forEach(b => b.applyFire(def.duration, now));
          break;
        case 'WIDE':
          this.paddle.applyWide(def.duration, now);
          break;
        case 'LIFE':
          this.lives += 1;
          this.hud.setLives(this.lives);
          break;
        case 'MULTI':
          this._splitBalls();
          break;
      }
    }

    _splitBalls() {
      const base = this.balls.find(b => b.launched);
      if (!base) { const idle = this.balls[0]; if (idle) idle.launch(); return; }
      const extras = [-0.5, 0.5].map(offset => {
        const clone = new this.Entities.Ball(base.x, base.y, base.baseSpeed);
        clone.launched = true;
        const speed = Math.hypot(base.vx, base.vy);
        const baseAngle = Math.atan2(base.vy, base.vx);
        const angle = baseAngle + offset;
        clone.vx = Math.cos(angle) * speed;
        clone.vy = Math.sin(angle) * speed;
        return clone;
      });
      this.balls = this.balls.concat(extras);
    }

    _bossFire() {
      const count = this.boss.def.projectilesPerVolley;
      const spread = 60;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const vx = (t - 0.5) * spread;
        this.projectiles.push(new this.Entities.Projectile(this.boss.x, this.boss.y + this.boss.height / 2, vx, this.boss.def.projectileSpeed));
      }
    }

    _updateProjectiles(dt, H) {
      const now = performance.now();
      this.projectiles = this.projectiles.filter(p => {
        p.update(dt);
        if (p.y - p.radius > H) return false;
        if (this.Physics.circleRectCollision(p.x, p.y, p.radius, this.paddle.left(), this.paddle.top(), this.paddle.width, this.paddle.height)) {
          this._burstParticles(p.x, p.y, '#A5171C', 10);
          this._loseLife();
          return false;
        }
        return true;
      });
    }

    _updateParticles(dt) {
      this.particles.forEach(p => p.update(dt));
      this.particles = this.particles.filter(p => p.alive);
    }

    _burstParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        this.particles.push(new this.Entities.Particle(x, y, color));
      }
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    _render(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Textura sutil de tablero (líneas), fiel a la identidad roja/negra.
      ctx.strokeStyle = 'rgba(238, 40, 47, 0.06)';
      ctx.lineWidth = 1;
      for (let gy = 0; gy < h; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      if (this.bricks) this.bricks.forEach(b => { if (b.alive) b.draw(ctx); });
      if (this.boss && this.boss.alive) this.boss.draw(ctx, performance.now());
      if (this.projectiles) this.projectiles.forEach(p => p.draw(ctx));
      if (this.powerUps) this.powerUps.forEach(p => p.draw(ctx));
      if (this.particles) this.particles.forEach(p => p.draw(ctx));
      if (this.paddle) this.paddle.draw(ctx);
      if (this.balls) this.balls.forEach(b => b.draw(ctx));
    }
  }

  window.CPGame.BurgerBreaker = BurgerBreaker;
})();
